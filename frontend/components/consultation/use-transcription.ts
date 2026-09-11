"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getTranscriptionToken } from "@/lib/api/ai";
import { ApiError } from "@/lib/api/client";

export type TranscriptionStatus = "idle" | "connecting" | "recording";

const WS_URL = "wss://streaming.assemblyai.com/v3/ws";
/** How much audio goes in each frame; AssemblyAI wants 50–1000 ms. */
const CHUNK_MS = 50;

/** Runs off the audio thread: float samples in, 16-bit PCM chunks out. Registered from a blob so there is no extra file to serve. */
const WORKLET = `
class PcmChunker extends AudioWorkletProcessor {
  constructor(options) { super(); this.target = options.processorOptions.chunkSamples; this.pending = []; this.length = 0; }
  process(inputs) {
    const input = inputs[0] && inputs[0][0];
    if (!input) return true;
    const out = new Int16Array(input.length);
    for (let i = 0; i < input.length; i++) { const s = Math.max(-1, Math.min(1, input[i])); out[i] = s < 0 ? s * 0x8000 : s * 0x7fff; }
    this.pending.push(out); this.length += out.length;
    if (this.length >= this.target) {
      const merged = new Int16Array(this.length); let o = 0;
      for (const p of this.pending) { merged.set(p, o); o += p.length; }
      this.port.postMessage(merged.buffer, [merged.buffer]);
      this.pending = []; this.length = 0;
    }
    return true;
  }
}
registerProcessor("pcm-chunker", PcmChunker);`;

interface Turn {
  type: "Turn";
  end_of_turn: boolean;
  turn_is_formatted: boolean;
  transcript: string;
}

function describe(err: unknown): string {
  if (err instanceof DOMException && (err.name === "NotAllowedError" || err.name === "SecurityError")) {
    return "Microphone access is blocked. Allow it in the browser and try again.";
  }
  if (err instanceof DOMException && err.name === "NotFoundError") return "No microphone was found.";
  if (err instanceof ApiError) return err.message;
  return "Recording stopped unexpectedly.";
}

/**
 * Live dictation into the notes. Audio goes browser → AssemblyAI over a WebSocket; the backend only mints the token.
 * Finalised sentences are handed to `onFinal`; the in-progress one is exposed as `partial` so the doctor's own
 * typing is never overwritten by text that may still change.
 */
export function useTranscription({ onFinal }: { onFinal: (text: string) => void }) {
  const [status, setStatus] = useState<TranscriptionStatus>("idle");
  const [partial, setPartial] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  /** Taps the mic for the level meter; null when not recording. */
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  /** Which input the browser gave us, so a wrong default device is visible instead of a mystery. */
  const [device, setDevice] = useState<string | null>(null);
  /** True once a few seconds pass with nothing but silence coming in. */
  const [silent, setSilent] = useState(false);
  const onFinalRef = useRef(onFinal);
  useEffect(() => {
    onFinalRef.current = onFinal;
  });

  const session = useRef<{ ws: WebSocket; ctx: AudioContext; stream: MediaStream; retried: boolean } | null>(null);

  const teardown = useCallback(() => {
    const s = session.current;
    session.current = null;
    if (!s) return;
    if (s.ws.readyState === WebSocket.OPEN) s.ws.send(JSON.stringify({ type: "Terminate" }));
    s.ws.close();
    s.stream.getTracks().forEach((t) => t.stop());
    void s.ctx.close();
  }, []);

  const start = useCallback(async function start(retried = false) {
    if (session.current) return;
    setError(null);
    setStatus("connecting");
    let stream: MediaStream | undefined;
    let ctx: AudioContext | undefined;
    try {
      // One token per connection; it is only needed for the handshake.
      const [{ token }, mic] = await Promise.all([
        getTranscriptionToken(),
        navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true } }),
      ]);
      stream = mic;
      // 16 kHz is what speech models expect; browsers that refuse the rate resample on their own and we tell AssemblyAI what we got.
      ctx = new AudioContext({ sampleRate: 16_000 });
      // Some browsers create the context suspended even after a click; audio would silently go nowhere.
      if (ctx.state === "suspended") await ctx.resume();
      const workletUrl = URL.createObjectURL(new Blob([WORKLET], { type: "application/javascript" }));
      await ctx.audioWorklet.addModule(workletUrl);
      URL.revokeObjectURL(workletUrl);

      const ws = new WebSocket(`${WS_URL}?sample_rate=${ctx.sampleRate}&encoding=pcm_s16le&format_turns=true&token=${encodeURIComponent(token)}`);
      const current = { ws, ctx, stream, retried };
      session.current = current;

      await new Promise<void>((resolve, reject) => {
        ws.onopen = () => resolve();
        ws.onerror = () => reject(new ApiError("AI_UNAVAILABLE", "Could not connect to the transcription service", 0));
      });

      const node = new AudioWorkletNode(ctx, "pcm-chunker", { processorOptions: { chunkSamples: Math.round((ctx.sampleRate * CHUNK_MS) / 1000) } });
      node.port.onmessage = (e: MessageEvent<ArrayBuffer>) => {
        if (ws.readyState === WebSocket.OPEN) ws.send(e.data);
      };
      const source = ctx.createMediaStreamSource(stream);
      source.connect(node);
      const tap = ctx.createAnalyser();
      tap.fftSize = 256;
      source.connect(tap);
      setAnalyser(tap);
      setDevice(stream.getAudioTracks()[0]?.label || null);

      ws.onmessage = (e) => {
        const msg = JSON.parse(String(e.data)) as { type: string } | Turn;
        if (msg.type !== "Turn") return;
        const turn = msg as Turn;
        if (turn.end_of_turn) {
          // With format_turns on, a finished turn arrives twice: raw, then punctuated. Keep the second.
          if (!turn.turn_is_formatted) return;
          setPartial("");
          if (turn.transcript.trim()) onFinalRef.current(turn.transcript.trim());
        } else {
          setPartial(turn.transcript);
        }
      };
      ws.onclose = (ev) => {
        if (session.current !== current) return; // we closed it
        session.current = null;
        stream?.getTracks().forEach((t) => t.stop());
        void ctx?.close();
        setPartial("");
        setAnalyser(null);
        setSilent(false);
        // One quiet reconnect covers a dropped network or an expired session; a second failure is reported.
        if (!ev.wasClean && !current.retried) {
          void start(true);
          return;
        }
        setStatus("idle");
        setStartedAt(null);
        if (!ev.wasClean) setError("Recording stopped unexpectedly.");
      };

      setStatus("recording");
      setStartedAt((t) => t ?? Date.now());
    } catch (err) {
      session.current = null;
      stream?.getTracks().forEach((t) => t.stop());
      void ctx?.close();
      setStatus("idle");
      setStartedAt(null);
      setAnalyser(null);
      setDevice(null);
      setError(describe(err));
    }
  }, []);

  const stop = useCallback(() => {
    teardown();
    setPartial("");
    setStatus("idle");
    setStartedAt(null);
    setAnalyser(null);
    setDevice(null);
    setSilent(false);
  }, [teardown]);

  // Flat input for a few seconds means the wrong device or a muted mic, not a slow transcriber. Say so.
  useEffect(() => {
    if (!analyser) return;
    const buf = new Uint8Array(analyser.fftSize);
    let quietSince = Date.now();
    const id = setInterval(() => {
      analyser.getByteTimeDomainData(buf);
      let peak = 0;
      for (let i = 0; i < buf.length; i++) peak = Math.max(peak, Math.abs(buf[i] - 128));
      if (peak > 3) {
        quietSince = Date.now();
        setSilent(false);
      } else if (Date.now() - quietSince > 4000) {
        setSilent(true);
      }
    }, 500);
    return () => clearInterval(id);
  }, [analyser]);

  // Leaving the page (save, discard, navigation) releases the microphone.
  useEffect(() => teardown, [teardown]);

  return { status, partial, error, startedAt, analyser, device, silent, start: () => void start(), stop };
}

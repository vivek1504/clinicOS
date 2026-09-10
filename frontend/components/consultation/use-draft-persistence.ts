"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { EditorState, PersistedDraft } from "./draft-reducer";
import { toPersisted } from "./draft-reducer";

function storageKey(patientId: string, appointmentId?: string) {
  return `emr:consult:${patientId}:${appointmentId ?? "none"}`;
}

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}

function parseSnapshot(raw: string | null): PersistedDraft | null {
  if (!raw) return null;
  try {
    const snap = JSON.parse(raw) as PersistedDraft;
    return snap.rawNotes?.trim() || snap.aiDraft ? snap : null;
  } catch {
    return null;
  }
}

/**
 * Keeps an in-progress consultation in sessionStorage so a crash or accidental reload does not
 * lose a long note. Offers a snapshot found on mount until the doctor restores or discards it.
 */
export function useDraftPersistence(patientId: string, appointmentId: string | undefined, state: EditorState) {
  const key = storageKey(patientId, appointmentId);
  const [decided, setDecided] = useState(false);
  const wasDirty = useRef(false);
  /** Snapshots written by this session (savedAt >= mount) are never offered back as "earlier". */
  const [mountedAt] = useState(() => Date.now());

  const raw = useSyncExternalStore(
    subscribe,
    () => {
      try {
        return sessionStorage.getItem(key);
      } catch {
        return null;
      }
    },
    () => null,
  );

  const pending = useMemo(() => {
    if (decided) return null;
    const snap = parseSnapshot(raw);
    return snap && snap.savedAt < mountedAt ? snap : null;
  }, [decided, raw, mountedAt]);

  useEffect(() => {
    if (pending) return; // never overwrite a snapshot the doctor has not decided on
    try {
      if (state.dirty) {
        wasDirty.current = true;
        sessionStorage.setItem(key, JSON.stringify(toPersisted(state)));
      } else if (wasDirty.current) {
        sessionStorage.removeItem(key);
      }
    } catch {
      // storage unavailable
    }
  }, [key, state, pending]);

  const clear = useCallback(() => {
    try {
      sessionStorage.removeItem(key);
    } catch {
      // ignore
    }
    setDecided(true);
  }, [key]);

  const dismissPending = useCallback(() => setDecided(true), []);

  return { pending, clear, dismissPending };
}

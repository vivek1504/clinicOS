import { prisma } from "../lib/prisma";
import { AppError } from "../lib/errors";
import { type AiProvider, AiProviderError } from "../ai/provider";
import { normalizeNote } from "../ai/normalize";
import type { StructuredNoteType } from "../ai/schema";

export function extractJsonString(text: string): string {
  let cleaned = text.trim();
  // Strip markdown code fences if present
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  }

  // If there is surrounding prose, find the first '{' and the last '}'
  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace >= firstBrace) {
    cleaned = cleaned.slice(firstBrace, lastBrace + 1);
  }

  return cleaned;
}

export function tryValidate(
  text: string
): { success: true; note: StructuredNoteType } | { success: false; problem: string } {
  try {
    const cleaned = extractJsonString(text);
    if (!cleaned) {
      return { success: false, problem: "Empty JSON content" };
    }
    const parsed = JSON.parse(cleaned);
    const note = normalizeNote(parsed);
    return { success: true, note };
  } catch (err: unknown) {
    const problem = err instanceof Error ? err.message : "Invalid JSON output";
    return { success: false, problem };
  }
}

/** Compact, dated plain-text record: only what the doctor saved, nothing derived. */
export function buildRecord(
  consultations: { createdAt: Date; finalNote: unknown }[],
): string {
  return consultations
    .map((c, i) => {
      const n = c.finalNote as Partial<StructuredNoteType>;
      const date = c.createdAt.toISOString().slice(0, 10);
      const line = (label: string, items?: string[] | null) => (items && items.length ? `  ${label}: ${items.join("; ")}` : null);
      return [
        `Visit ${i + 1} (${date})`,
        `  complaint: ${n.chiefComplaint ?? "not recorded"}`,
        line("symptoms", n.symptoms),
        line("history", n.relevantHistory),
        line("medications", n.medicationsMentioned),
        line("plan", n.doctorPlan),
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n");
}

export class AiService {
  constructor(private provider: AiProvider) {}

  async summarizePatientHistory(input: {
    patientId: string;
    signal?: AbortSignal;
  }): Promise<{ summary: string; model: string; latencyMs: number; basedOn: number }> {
    const patient = await prisma.patient.findUnique({
      where: { id: input.patientId },
      include: { consultations: { orderBy: { createdAt: "asc" }, select: { createdAt: true, finalNote: true } } },
    });
    if (!patient) throw new AppError("NOT_FOUND", `Patient not found: ${input.patientId}`);
    if (patient.consultations.length === 0) {
      throw new AppError("VALIDATION", "This patient has no saved consultations to summarise");
    }

    const t0 = Date.now();
    let text: string;
    try {
      ({ text } = await this.provider.summarize({ record: buildRecord(patient.consultations), signal: input.signal }));
    } catch (err) {
      if (err instanceof AiProviderError) throw new AppError(err.code, err.message);
      throw err;
    }
    const summary = text.replace(/\s+/g, " ").trim();
    if (!summary) throw new AppError("AI_INVALID_OUTPUT", "The AI returned an empty summary");
    return { summary, model: this.provider.model, latencyMs: Date.now() - t0, basedOn: patient.consultations.length };
  }

  async structureConsultation(input: {
    rawNotes: string;
    patientId: string;
    signal?: AbortSignal;
  }): Promise<{ draft: StructuredNoteType; model: string; latencyMs: number }> {
    const patient = await prisma.patient.findUnique({
      where: { id: input.patientId },
    });

    if (!patient) {
      throw new AppError("NOT_FOUND", `Patient not found: ${input.patientId}`);
    }

    const t0 = Date.now();

    // Attempt 1
    let outText = "";
    try {
      const res = await this.provider.structure({
        rawNotes: input.rawNotes,
        signal: input.signal,
      });
      outText = res.text;
    } catch (err: unknown) {
      if (err instanceof AiProviderError) {
        throw new AppError(err.code, err.message);
      }
      throw err;
    }

    let validation = tryValidate(outText);

    // Attempt 2 (Repair pass)
    if (!validation.success) {
      try {
        const res = await this.provider.structure({
          rawNotes: input.rawNotes,
          repair: {
            previousOutput: outText,
            problem: validation.problem,
          },
          signal: input.signal,
        });
        outText = res.text;
        validation = tryValidate(outText);
      } catch (err: unknown) {
        if (err instanceof AiProviderError) {
          throw new AppError(err.code, err.message);
        }
        throw err;
      }

      if (!validation.success) {
        throw new AppError(
          "AI_INVALID_OUTPUT",
          `The AI returned an unusable response: ${validation.problem}`
        );
      }
    }

    const latencyMs = Date.now() - t0;
    return {
      draft: validation.note,
      model: this.provider.model,
      latencyMs,
    };
  }
}

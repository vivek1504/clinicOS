export interface AiErrorCopy {
  title: string;
  body: string;
}

const COPY: Record<string, AiErrorCopy> = {
  AI_TIMEOUT: {
    title: "The AI took too long",
    body: "Your notes are still here. Retry, or fill in the note by hand.",
  },
  AI_RATE_LIMITED: {
    title: "The AI is busy right now",
    body: "Wait a moment and retry, or continue without AI.",
  },
  AI_INVALID_OUTPUT: {
    title: "The AI returned something unusable",
    body: "Nothing was added to your note. Retry or continue without AI.",
  },
  AI_UNAVAILABLE: {
    title: "AI assistance is unavailable",
    body: "You can still write and save the consultation.",
  },
  VALIDATION: {
    title: "Notes could not be sent",
    body: "Check the length of your notes and try again.",
  },
  NOT_FOUND: {
    title: "Patient not found",
    body: "Reload the page. If this keeps happening, the patient record may have been removed.",
  },
};

const FALLBACK: AiErrorCopy = {
  title: "Something went wrong",
  body: "Retry or continue without AI.",
};

export function aiErrorCopy(code: string): AiErrorCopy {
  return COPY[code] ?? FALLBACK;
}

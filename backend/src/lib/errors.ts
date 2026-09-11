export type ErrorCode =
  | "NOT_FOUND"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "VALIDATION"
  | "CONFLICT"
  | "ALREADY_IN_CONSULTATION"
  | "QUEUE_ORDER"
  | "INTERNAL"
  | "AI_TIMEOUT"
  | "AI_INVALID_OUTPUT"
  | "AI_RATE_LIMITED"
  | "AI_UNAVAILABLE";

export class AppError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
    public details?: unknown
  ) {
    super(message);
    this.name = "AppError";
  }
}

export const STATUS_BY_CODE: Record<ErrorCode, number> = {
  NOT_FOUND: 404,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  VALIDATION: 400,
  CONFLICT: 409,
  ALREADY_IN_CONSULTATION: 409,
  QUEUE_ORDER: 409,
  INTERNAL: 500,
  AI_TIMEOUT: 504,
  AI_INVALID_OUTPUT: 502,
  AI_RATE_LIMITED: 429,
  AI_UNAVAILABLE: 503,
};

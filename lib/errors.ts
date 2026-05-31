/**
 * App-level error types
 * ใช้ throw จาก service layer → API route แปลงเป็น JSON response
 */

export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    message?: string
  ) {
    super(message ?? code);
    this.name = "HttpError";
  }
}

export class Unauthorized extends HttpError {
  constructor(code = "unauthorized") {
    super(401, code);
    this.name = "Unauthorized";
  }
}

export class Forbidden extends HttpError {
  constructor(code = "forbidden") {
    super(403, code);
    this.name = "Forbidden";
  }
}

export class NotFound extends HttpError {
  constructor(code = "not_found") {
    super(404, code);
    this.name = "NotFound";
  }
}

export class Conflict extends HttpError {
  constructor(code = "conflict") {
    super(409, code);
    this.name = "Conflict";
  }
}

export class TooManyRequests extends HttpError {
  constructor(
    code = "too_many_requests",
    public retryAfterSeconds?: number
  ) {
    super(429, code);
    this.name = "TooManyRequests";
  }
}

export class ValidationError extends HttpError {
  constructor(
    public errors: Record<string, string>,
    code = "validation_error"
  ) {
    super(400, code);
    this.name = "ValidationError";
  }
}

/** Convert error → API JSON response shape */
export function errorResponse(err: unknown): {
  status: number;
  body: { error: { code: string; message: string; details?: unknown } };
} {
  if (err instanceof ValidationError) {
    return {
      status: err.status,
      body: {
        error: { code: err.code, message: err.message, details: err.errors },
      },
    };
  }
  if (err instanceof HttpError) {
    return {
      status: err.status,
      body: { error: { code: err.code, message: err.message } },
    };
  }
  console.error("Unhandled error:", err);
  return {
    status: 500,
    body: {
      error: { code: "internal_error", message: "Internal server error" },
    },
  };
}

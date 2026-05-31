import { describe, it, expect } from "vitest";
import {
  Forbidden,
  Unauthorized,
  NotFound,
  Conflict,
  TooManyRequests,
  ValidationError,
  errorResponse,
} from "@/lib/errors";

describe("HttpError subclasses", () => {
  it("Unauthorized → 401", () => {
    const e = new Unauthorized();
    expect(e.status).toBe(401);
    expect(e.code).toBe("unauthorized");
  });

  it("Forbidden → 403", () => {
    const e = new Forbidden("wrong_role");
    expect(e.status).toBe(403);
    expect(e.code).toBe("wrong_role");
  });

  it("NotFound → 404", () => {
    expect(new NotFound().status).toBe(404);
  });

  it("Conflict → 409", () => {
    expect(new Conflict("student_id_taken").status).toBe(409);
  });

  it("TooManyRequests → 429 with retry-after", () => {
    const e = new TooManyRequests("rate_limit", 60);
    expect(e.status).toBe(429);
    expect(e.retryAfterSeconds).toBe(60);
  });

  it("ValidationError → 400 with field errors", () => {
    const e = new ValidationError({ email: "invalid" });
    expect(e.status).toBe(400);
    expect(e.errors).toEqual({ email: "invalid" });
  });
});

describe("errorResponse", () => {
  it("converts ValidationError → 400 with details", () => {
    const e = new ValidationError({ name: "required" });
    const { status, body } = errorResponse(e);
    expect(status).toBe(400);
    expect(body.error.code).toBe("validation_error");
    expect(body.error.details).toEqual({ name: "required" });
  });

  it("converts HttpError → matching status", () => {
    const { status, body } = errorResponse(new Forbidden());
    expect(status).toBe(403);
    expect(body.error.code).toBe("forbidden");
  });

  it("converts unknown error → 500 generic", () => {
    const { status, body } = errorResponse(new Error("DB exploded"));
    expect(status).toBe(500);
    expect(body.error.code).toBe("internal_error");
    // Doesn't leak the original message
    expect(body.error.message).not.toContain("DB exploded");
  });
});

import { describe, it, expect } from "vitest";
import {
  LoginSchema,
  StudentIdSchema,
  SignupStudentSchema,
  ChangePasswordSchema,
} from "@/lib/validation/schemas";

describe("StudentIdSchema", () => {
  it("accepts 4-10 digit IDs", () => {
    expect(StudentIdSchema.safeParse("60001").success).toBe(true);
    expect(StudentIdSchema.safeParse("1234").success).toBe(true);
    expect(StudentIdSchema.safeParse("1234567890").success).toBe(true);
  });

  it("rejects non-numeric", () => {
    expect(StudentIdSchema.safeParse("abc").success).toBe(false);
    expect(StudentIdSchema.safeParse("60-001").success).toBe(false);
    expect(StudentIdSchema.safeParse("60 001").success).toBe(false);
  });

  it("rejects too short / too long", () => {
    expect(StudentIdSchema.safeParse("123").success).toBe(false);
    expect(StudentIdSchema.safeParse("12345678901").success).toBe(false);
  });
});

describe("LoginSchema", () => {
  it("requires both fields", () => {
    expect(
      LoginSchema.safeParse({ identifier: "", password: "x" }).success
    ).toBe(false);
    expect(
      LoginSchema.safeParse({ identifier: "abc", password: "" }).success
    ).toBe(false);
  });

  it("accepts valid input", () => {
    expect(
      LoginSchema.safeParse({ identifier: "60001", password: "pass1234" })
        .success
    ).toBe(true);
  });
});

describe("SignupStudentSchema", () => {
  const valid = {
    studentId: "60001",
    firstName: "ทดสอบ",
    lastName: "นักเรียน",
    password: "test12345678",
    confirmPassword: "test12345678",
    consent: true as const,
    turnstileToken: "valid-token",
  };

  it("accepts valid input", () => {
    expect(SignupStudentSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects when passwords do not match", () => {
    const res = SignupStudentSchema.safeParse({
      ...valid,
      confirmPassword: "different",
    });
    expect(res.success).toBe(false);
    if (!res.success) {
      const fields = res.error.issues.map((i) => i.path.join("."));
      expect(fields).toContain("confirmPassword");
    }
  });

  it("rejects without consent", () => {
    const res = SignupStudentSchema.safeParse({ ...valid, consent: false });
    expect(res.success).toBe(false);
  });

  it("accepts an empty/absent turnstile token at the schema layer", () => {
    // Turnstile is optional in the schema (default ""); enforcement lives in
    // verifyTurnstile, which is skipped when TURNSTILE_SECRET_KEY is unset.
    // See lib/validation/schemas.ts + commit e25421a (signup deadlock fix).
    expect(
      SignupStudentSchema.safeParse({ ...valid, turnstileToken: "" }).success
    ).toBe(true);
    const { turnstileToken: _omit, ...withoutToken } = valid;
    expect(SignupStudentSchema.safeParse(withoutToken).success).toBe(true);
  });

  it("rejects short password", () => {
    const res = SignupStudentSchema.safeParse({
      ...valid,
      password: "short",
      confirmPassword: "short",
    });
    expect(res.success).toBe(false);
  });
});

describe("ChangePasswordSchema", () => {
  it("requires matching new + confirm", () => {
    const res = ChangePasswordSchema.safeParse({
      currentPassword: "old",
      newPassword: "newpass1234",
      confirmPassword: "different",
    });
    expect(res.success).toBe(false);
  });

  it("accepts valid input", () => {
    expect(
      ChangePasswordSchema.safeParse({
        currentPassword: "old",
        newPassword: "newpass1234",
        confirmPassword: "newpass1234",
      }).success
    ).toBe(true);
  });
});

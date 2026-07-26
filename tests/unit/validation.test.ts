import { describe, it, expect } from "vitest";
import {
  LoginSchema,
  NameSchema,
  ChangePasswordSchema,
} from "@/lib/validation/schemas";

describe("LoginSchema", () => {
  it("requires both fields", () => {
    expect(
      LoginSchema.safeParse({ identifier: "", password: "x" }).success
    ).toBe(false);
    expect(
      LoginSchema.safeParse({ identifier: "abc", password: "" }).success
    ).toBe(false);
  });

  it("keeps legacy credential identifiers working during cutover", () => {
    expect(
      LoginSchema.safeParse({ identifier: "60001", password: "pass1234" })
        .success
    ).toBe(true);
  });
});

describe("NameSchema", () => {
  it("accepts a non-empty real name", () => {
    expect(NameSchema.safeParse("สมชาย").success).toBe(true);
  });

  it("rejects blank values", () => {
    expect(NameSchema.safeParse("   ").success).toBe(false);
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

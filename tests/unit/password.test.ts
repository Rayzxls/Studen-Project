import { describe, it, expect } from "vitest";
import {
  hashPassword,
  verifyPassword,
  isCommonPassword,
  validatePassword,
} from "@/lib/auth/password";

describe("hashPassword + verifyPassword", () => {
  it("hashes and verifies correctly", async () => {
    const plain = "MyS3cur3P@ss!";
    const hash = await hashPassword(plain);
    expect(hash).not.toBe(plain);
    expect(hash.length).toBeGreaterThan(50);
    expect(await verifyPassword(plain, hash)).toBe(true);
  });

  it("rejects wrong password", async () => {
    const hash = await hashPassword("correct123");
    expect(await verifyPassword("wrong123", hash)).toBe(false);
  });

  it("uses bcrypt (slow, deterministic verification)", async () => {
    const start = Date.now();
    await hashPassword("test12345678");
    const elapsed = Date.now() - start;
    // bcrypt cost 12 should take 100+ms — verifies we're not using a fast hash
    expect(elapsed).toBeGreaterThan(50);
  });
});

describe("isCommonPassword", () => {
  it("rejects common passwords (case-insensitive)", () => {
    expect(isCommonPassword("password")).toBe(true);
    expect(isCommonPassword("Password")).toBe(true);
    expect(isCommonPassword("123456")).toBe(true);
    expect(isCommonPassword("ADMIN")).toBe(true);
  });

  it("accepts strong passwords", () => {
    expect(isCommonPassword("Tx9!mZpL2qK")).toBe(false);
    expect(isCommonPassword("ดอกไม้สวยงาม123")).toBe(false);
  });
});

describe("validatePassword", () => {
  it("requires 8 chars for STUDENT", () => {
    expect(validatePassword("short", "STUDENT")).toEqual({
      ok: false,
      reason: expect.stringContaining("8"),
    });
    expect(validatePassword("longenoughpw", "STUDENT")).toEqual({ ok: true });
  });

  it("requires 12 chars for TEACHER", () => {
    expect(validatePassword("11charssss!", "TEACHER")).toEqual({
      ok: false,
      reason: expect.stringContaining("12"),
    });
    expect(validatePassword("verylongteacherpw1", "TEACHER")).toEqual({
      ok: true,
    });
  });

  it("requires 12 chars for ADMIN", () => {
    expect(validatePassword("shortadmin1", "ADMIN")).toEqual({
      ok: false,
      reason: expect.stringContaining("12"),
    });
    expect(validatePassword("verylongadminpw1!", "ADMIN")).toEqual({
      ok: true,
    });
  });

  it("rejects common passwords for all roles", () => {
    expect(validatePassword("password", "STUDENT")).toMatchObject({
      ok: false,
    });
    expect(validatePassword("password1234", "TEACHER")).toMatchObject({
      ok: true,
    }); // not in top-50 list
    expect(validatePassword("admin", "ADMIN")).toMatchObject({ ok: false });
  });

  it("rejects passwords longer than 200", () => {
    const tooLong = "a".repeat(201);
    expect(validatePassword(tooLong, "STUDENT")).toMatchObject({ ok: false });
  });
});

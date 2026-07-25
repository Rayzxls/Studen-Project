import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";

import { afterEach, describe, expect, it } from "vitest";

import {
  compareDependencyBaseline,
  createDependencyBaseline,
  scanDependencyInventory,
} from "@/lib/release-gate/dependency-inventory";

const fixtures: string[] = [];

function createFixture() {
  const fixture = path.join(
    tmpdir(),
    `beagle-dependency-gate-${Date.now()}-${Math.random()}`
  );
  mkdirSync(path.join(fixture, "app"), { recursive: true });
  mkdirSync(path.join(fixture, "prisma", "migrations", "legacy"), {
    recursive: true,
  });
  fixtures.push(fixture);
  return fixture;
}

afterEach(() => {
  fixtures.splice(0).forEach((fixture) => {
    rmSync(fixture, { recursive: true, force: true });
  });
});

describe("identity and course dependency gate", () => {
  it("keeps a stable fingerprint when matching code moves to another line", () => {
    const fixture = createFixture();
    const filePath = path.join(fixture, "app", "example.ts");
    writeFileSync(filePath, "const studentId = input.studentId;\n");
    const before = scanDependencyInventory(fixture);

    writeFileSync(filePath, "\n\nconst studentId = input.studentId;\n");
    const after = scanDependencyInventory(fixture);

    expect(after.map((finding) => finding.fingerprint)).toEqual(
      before.map((finding) => finding.fingerprint)
    );
    expect(after.map((finding) => finding.line)).not.toEqual(
      before.map((finding) => finding.line)
    );
  });

  it("reports a newly introduced dependency against the baseline", () => {
    const fixture = createFixture();
    const baseline = createDependencyBaseline(scanDependencyInventory(fixture));

    writeFileSync(
      path.join(fixture, "app", "profile.ts"),
      'const label = "เลขประจำตัวนักเรียน";\n'
    );

    const comparison = compareDependencyBaseline(
      baseline,
      scanDependencyInventory(fixture)
    );

    expect(comparison.added).toHaveLength(1);
    expect(comparison.added[0]?.ruleId).toBe("student-number-copy");
  });

  it("ignores historical Prisma migrations", () => {
    const fixture = createFixture();
    writeFileSync(
      path.join(fixture, "prisma", "migrations", "legacy", "migration.sql"),
      'ALTER TABLE "Student" ADD COLUMN "studentId" TEXT;\n'
    );

    expect(scanDependencyInventory(fixture)).toEqual([]);
  });

  it("allows one reviewed rule suppression without masking other rules", () => {
    const fixture = createFixture();
    writeFileSync(
      path.join(fixture, "app", "compatibility.ts"),
      [
        "const mustResetPwd = false; // dependency-gate-allow(temporary-password): legacy non-null schema bridge",
        "const gradeLevel = input.gradeLevel; // dependency-gate-allow(temporary-password): unrelated rule",
        "const temporaryPassword = true; // dependency-gate-allow(temporary-password):",
        "",
      ].join("\n")
    );

    const findings = scanDependencyInventory(fixture);

    expect(
      findings.some(
        (finding) =>
          finding.ruleId === "temporary-password" && finding.line === 1
      )
    ).toBe(false);
    expect(
      findings.some(
        (finding) => finding.ruleId === "grade-level" && finding.line === 2
      )
    ).toBe(true);
    expect(
      findings.some(
        (finding) =>
          finding.ruleId === "temporary-password" && finding.line === 3
      )
    ).toBe(true);
  });
});

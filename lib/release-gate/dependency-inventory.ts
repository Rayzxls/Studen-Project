import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

export type DependencyRuleSeverity = "blocker" | "review";

export type DependencyRule = {
  id: string;
  description: string;
  severity: DependencyRuleSeverity;
  linePattern?: RegExp;
  pathPattern?: RegExp;
};

export type DependencyFinding = {
  fingerprint: string;
  ruleId: string;
  severity: DependencyRuleSeverity;
  description: string;
  path: string;
  line: number;
  excerpt: string;
  occurrence: number;
};

export type DependencyBaseline = {
  rulesVersion: string;
  generatedAt: string;
  findings: DependencyFinding[];
};

export type DependencyComparison = {
  added: DependencyFinding[];
  resolved: DependencyFinding[];
  unchanged: DependencyFinding[];
};

export const DEPENDENCY_RULES_VERSION = "2026-07-24.3";

const SOURCE_ROOTS = ["app", "components", "lib", "prisma", "scripts", "tests"];

const ROOT_FILES = [
  "auth.ts",
  "middleware.ts",
  "package.json",
  "playwright.config.ts",
  "vitest.config.ts",
];

const SOURCE_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".json",
  ".prisma",
  ".sql",
]);

const EXCLUDED_PATHS = [
  /^prisma\/migrations\//,
  /^lib\/release-gate\//,
  /^scripts\/identity-course-dependency-gate\.ts$/,
  /^tests\/unit\/identity-course-dependency-gate\.test\.ts$/,
];

export const DEPENDENCY_RULES: DependencyRule[] = [
  {
    id: "student-number-schema",
    description: "Student Number remains a persisted unique identity field.",
    severity: "blocker",
    pathPattern: /^prisma\/schema\.prisma$/,
    linePattern: /^\s*studentId\s+String\s+@unique\b/,
  },
  {
    id: "student-number-copy",
    description: "User-facing Student Number or Student ID copy remains.",
    severity: "blocker",
    linePattern:
      /(?:เลขประจำตัว(?:นักเรียน|นักศึกษา)?|\bstudent\s+(?:number|no\.?|id)\b)/i,
  },
  {
    id: "student-number-auth-and-admin-flow",
    description:
      "Student Number is still used by signup, validation, Admin, seed, or bootstrap flows.",
    severity: "blocker",
    pathPattern:
      /^(?:app\/\(auth\)\/signup\/|app\/api\/signup\/|app\/admin\/|lib\/admin\/|lib\/validation\/|prisma\/(?:seed|bootstrap)\.ts$)/,
    linePattern: /\bstudentId\b/,
  },
  {
    id: "legacy-display-name",
    description: "Legacy displayName remains in the target identity model.",
    severity: "blocker",
    linePattern: /\bdisplayName\b/,
  },
  {
    id: "temporary-password",
    description: "Temporary-password onboarding remains.",
    severity: "blocker",
    linePattern: /\b(?:mustResetPwd|temporaryPassword|tempPassword)\b/i,
  },
  {
    id: "academic-year-model",
    description: "Admin-managed AcademicYear remains.",
    severity: "blocker",
    linePattern: /\b(?:AcademicYear|academicYearId)\b/,
  },
  {
    id: "term-model",
    description: "Admin-managed Term remains.",
    severity: "blocker",
    linePattern: /\b(?:termId|prisma\.term|TermStatus|TermSummary)\b/,
  },
  {
    id: "class-model",
    description: "Admin-managed Class remains.",
    severity: "blocker",
    linePattern: /\b(?:classId|prisma\.class)\b/,
  },
  {
    id: "grade-level",
    description: "Structured gradeLevel remains.",
    severity: "blocker",
    linePattern: /\bgradeLevel\b/,
  },
  {
    id: "homeroom",
    description: "Homeroom ownership remains.",
    severity: "blocker",
    linePattern: /\b(?:homeroom|Homeroom)\b/,
  },
  {
    id: "cross-course-grade-aggregate",
    description: "Term GPA, GPAX, or cross-course status remains.",
    severity: "blocker",
    linePattern: /\b(?:GPA|GPAX|termGpa|termStatus|termSummary)\b/i,
  },
  {
    id: "legacy-admin-academic-structure",
    description: "Legacy Admin setup or classes surface remains.",
    severity: "blocker",
    pathPattern:
      /^(?:app\/admin\/(?:setup|classes)(?:\/|$)|components\/admin\/(?:setup|classes)(?:\/|$)|lib\/admin\/setup\.ts$)/,
  },
  {
    id: "legacy-student-term-surface",
    description: "Student term-level result surface remains.",
    severity: "blocker",
    pathPattern: /^app\/student\/(?:term|results\/term)(?:\/|$)/,
  },
  {
    id: "student-id-symbol-review",
    description:
      "studentId may be an internal User relation or a retired human identifier; classify before changing it.",
    severity: "review",
    linePattern: /\bstudentId\b/,
  },
];

function normalizePath(filePath: string, rootDir: string) {
  return path.relative(rootDir, filePath).split(path.sep).join("/");
}

function isExcluded(relativePath: string) {
  return EXCLUDED_PATHS.some((pattern) => pattern.test(relativePath));
}

function collectFiles(entryPath: string): string[] {
  if (!existsSync(entryPath)) {
    return [];
  }

  if (!statSync(entryPath).isDirectory()) {
    return SOURCE_EXTENSIONS.has(path.extname(entryPath)) ? [entryPath] : [];
  }

  return readdirSync(entryPath, { withFileTypes: true }).flatMap((entry) => {
    const childPath = path.join(entryPath, entry.name);
    return entry.isDirectory()
      ? collectFiles(childPath)
      : collectFiles(childPath);
  });
}

function normalizeExcerpt(line: string) {
  return line.trim().replace(/\s+/g, " ");
}

function hasReviewedSuppression(line: string, ruleId: string) {
  const marker = `dependency-gate-allow(${ruleId}):`;
  const markerIndex = line.indexOf(marker);
  return (
    markerIndex >= 0 &&
    line.slice(markerIndex + marker.length).trim().length > 0
  );
}

function createFingerprint(input: {
  ruleId: string;
  relativePath: string;
  excerpt: string;
  occurrence: number;
}) {
  return createHash("sha256")
    .update(
      [
        input.ruleId,
        input.relativePath,
        input.excerpt,
        String(input.occurrence),
      ].join("\0")
    )
    .digest("hex")
    .slice(0, 20);
}

export function scanDependencyInventory(rootDir: string): DependencyFinding[] {
  const files = [
    ...SOURCE_ROOTS.flatMap((root) => collectFiles(path.join(rootDir, root))),
    ...ROOT_FILES.flatMap((file) => collectFiles(path.join(rootDir, file))),
  ];

  const findings: DependencyFinding[] = [];

  for (const filePath of files) {
    const relativePath = normalizePath(filePath, rootDir);
    if (isExcluded(relativePath)) {
      continue;
    }

    const lines = readFileSync(filePath, "utf8").split(/\r?\n/);

    for (const rule of DEPENDENCY_RULES) {
      const pathMatches =
        rule.pathPattern === undefined || rule.pathPattern.test(relativePath);
      if (!pathMatches) {
        continue;
      }

      const occurrences = new Map<string, number>();

      if (rule.linePattern === undefined) {
        const excerpt = "<path dependency>";
        findings.push({
          fingerprint: createFingerprint({
            ruleId: rule.id,
            relativePath,
            excerpt,
            occurrence: 1,
          }),
          ruleId: rule.id,
          severity: rule.severity,
          description: rule.description,
          path: relativePath,
          line: 1,
          excerpt,
          occurrence: 1,
        });
        continue;
      }

      lines.forEach((line, lineIndex) => {
        if (!rule.linePattern?.test(line)) {
          return;
        }
        if (hasReviewedSuppression(line, rule.id)) {
          return;
        }

        const excerpt = normalizeExcerpt(line);
        const occurrence = (occurrences.get(excerpt) ?? 0) + 1;
        occurrences.set(excerpt, occurrence);

        findings.push({
          fingerprint: createFingerprint({
            ruleId: rule.id,
            relativePath,
            excerpt,
            occurrence,
          }),
          ruleId: rule.id,
          severity: rule.severity,
          description: rule.description,
          path: relativePath,
          line: lineIndex + 1,
          excerpt,
          occurrence,
        });
      });
    }
  }

  return findings.sort(
    (left, right) =>
      left.severity.localeCompare(right.severity) ||
      left.ruleId.localeCompare(right.ruleId) ||
      left.path.localeCompare(right.path) ||
      left.line - right.line
  );
}

export function createDependencyBaseline(
  findings: DependencyFinding[]
): DependencyBaseline {
  return {
    rulesVersion: DEPENDENCY_RULES_VERSION,
    generatedAt: new Date().toISOString(),
    findings,
  };
}

export function compareDependencyBaseline(
  baseline: DependencyBaseline,
  current: DependencyFinding[]
): DependencyComparison {
  const baselineByFingerprint = new Map(
    baseline.findings.map((finding) => [finding.fingerprint, finding])
  );
  const currentByFingerprint = new Map(
    current.map((finding) => [finding.fingerprint, finding])
  );

  return {
    added: current.filter(
      (finding) => !baselineByFingerprint.has(finding.fingerprint)
    ),
    resolved: baseline.findings.filter(
      (finding) => !currentByFingerprint.has(finding.fingerprint)
    ),
    unchanged: current.filter((finding) =>
      baselineByFingerprint.has(finding.fingerprint)
    ),
  };
}

export function countDependencyFindings(findings: DependencyFinding[]) {
  return findings.reduce(
    (counts, finding) => {
      counts.total += 1;
      counts[finding.severity] += 1;
      counts.byRule[finding.ruleId] = (counts.byRule[finding.ruleId] ?? 0) + 1;
      return counts;
    },
    {
      total: 0,
      blocker: 0,
      review: 0,
      byRule: {} as Record<string, number>,
    }
  );
}

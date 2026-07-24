import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import {
  compareDependencyBaseline,
  countDependencyFindings,
  createDependencyBaseline,
  DEPENDENCY_RULES_VERSION,
  scanDependencyInventory,
  type DependencyBaseline,
  type DependencyFinding,
} from "../lib/release-gate/dependency-inventory";

const rootDir = process.cwd();
const baselinePath = path.join(
  rootDir,
  "docs",
  "release-gates",
  "identity-course-dependency-baseline.json"
);
const args = new Set(process.argv.slice(2));
const writeBaseline = args.has("--write-baseline");
const strict = args.has("--strict");
const jsonOutput = args.has("--json");

function printFinding(prefix: string, finding: DependencyFinding) {
  console.error(
    `${prefix} [${finding.severity}] ${finding.ruleId} ${finding.path}:${finding.line}`
  );
  console.error(`  ${finding.excerpt}`);
}

function readBaseline(): DependencyBaseline {
  if (!existsSync(baselinePath)) {
    throw new Error(
      "dependency_baseline_missing: run npm run qa:release:dependencies:baseline"
    );
  }

  return JSON.parse(readFileSync(baselinePath, "utf8")) as DependencyBaseline;
}

const findings = scanDependencyInventory(rootDir);
const counts = countDependencyFindings(findings);

if (writeBaseline) {
  const baseline = createDependencyBaseline(findings);
  writeFileSync(baselinePath, `${JSON.stringify(baseline, null, 2)}\n`, "utf8");
  console.log(
    `Dependency baseline written: ${path.relative(rootDir, baselinePath)}`
  );
  console.log(
    `Current debt: ${counts.blocker} blocker, ${counts.review} review, ${counts.total} total`
  );
  process.exit(0);
}

let baseline: DependencyBaseline;
try {
  baseline = readBaseline();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

if (baseline.rulesVersion !== DEPENDENCY_RULES_VERSION) {
  console.error(
    `dependency_baseline_rules_version_mismatch: expected ${DEPENDENCY_RULES_VERSION}, received ${baseline.rulesVersion}`
  );
  console.error(
    "Review the changed rules, then regenerate the baseline intentionally."
  );
  process.exit(1);
}

const comparison = compareDependencyBaseline(baseline, findings);

if (jsonOutput) {
  console.log(
    JSON.stringify(
      {
        rulesVersion: DEPENDENCY_RULES_VERSION,
        counts,
        added: comparison.added,
        resolved: comparison.resolved,
      },
      null,
      2
    )
  );
} else {
  console.log(
    `Dependency gate: ${counts.blocker} blocker, ${counts.review} review, ${counts.total} total`
  );
  console.log(
    `Delta: +${comparison.added.length} new, -${comparison.resolved.length} resolved`
  );
}

if (comparison.added.length > 0) {
  comparison.added.forEach((finding) => printFinding("NEW", finding));
  console.error(
    "Dependency gate failed: new retired-concept dependencies were introduced."
  );
  process.exit(1);
}

if (strict && counts.blocker > 0) {
  console.error(
    `Strict dependency gate failed: ${counts.blocker} blocker finding(s) remain.`
  );
  process.exit(1);
}

console.log(
  strict
    ? "Strict dependency gate passed."
    : "Dependency gate passed: no new retired-concept dependencies."
);

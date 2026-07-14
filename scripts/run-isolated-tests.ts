import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { prepareIsolatedDatabaseEnv } from "../tests/helpers/database-safety";

type Mode = "integration" | "all" | "e2e" | "smoke";

const mode = process.argv[2] as Mode | undefined;
const extraArgs = process.argv.slice(3);
const commands: Record<Mode, { entry: string; args: string[] }> = {
  integration: {
    entry: resolve("node_modules/vitest/vitest.mjs"),
    args: ["run", "tests/integration", "--no-file-parallelism"],
  },
  all: {
    entry: resolve("node_modules/vitest/vitest.mjs"),
    args: ["run", "--no-file-parallelism"],
  },
  e2e: {
    entry: resolve("node_modules/@playwright/test/cli.js"),
    args: ["test"],
  },
  smoke: {
    entry: resolve("node_modules/tsx/dist/cli.mjs"),
    args: [resolve("scripts/smoke-test.ts")],
  },
};

if (!mode || !(mode in commands)) {
  throw new Error("usage: run-isolated-tests <integration|all|e2e|smoke>");
}

let isolatedEnv: NodeJS.ProcessEnv;
try {
  isolatedEnv = prepareIsolatedDatabaseEnv(process.env);
} catch (error) {
  const message = error instanceof Error ? error.message : "unknown_error";
  console.error(`\nBlocked mutating tests: ${message}`);
  console.error(
    "Set QA_DATABASE_URL to a separate PostgreSQL database or Neon branch."
  );
  console.error("The primary DATABASE_URL was not modified.\n");
  process.exit(1);
}

isolatedEnv = {
  ...isolatedEnv,
  AUTH_URL: "http://localhost:3100",
  NEXTAUTH_URL: "http://localhost:3100",
  NEXT_DIST_DIR: ".next-qa",
};

const command = commands[mode];
const commandArgs =
  mode === "integration" && extraArgs.length > 0
    ? ["run", ...extraArgs, "--no-file-parallelism"]
    : [...command.args, ...extraArgs];
const child = spawn(process.execPath, [command.entry, ...commandArgs], {
  cwd: process.cwd(),
  env: isolatedEnv,
  stdio: "inherit",
});

child.on("error", (error) => {
  console.error(error);
  process.exitCode = 1;
});
child.on("exit", (code, signal) => {
  if (signal) {
    console.error(`Test process stopped by ${signal}`);
    process.exitCode = 1;
    return;
  }
  process.exitCode = code ?? 1;
});

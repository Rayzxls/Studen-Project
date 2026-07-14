import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { prepareIsolatedDatabaseEnv } from "../tests/helpers/database-safety";

let isolatedEnv: NodeJS.ProcessEnv;
try {
  isolatedEnv = prepareIsolatedDatabaseEnv(process.env);
} catch (error) {
  const message = error instanceof Error ? error.message : "unknown_error";
  console.error(`\nBlocked QA server: ${message}`);
  console.error(
    "Set QA_DATABASE_URL to a separate PostgreSQL database or Neon branch.\n"
  );
  process.exit(1);
}

const child = spawn(
  process.execPath,
  [resolve("node_modules/next/dist/bin/next"), "dev", "--port", "3100"],
  {
    cwd: process.cwd(),
    env: {
      ...isolatedEnv,
      QA_BASE_URL: "http://localhost:3100",
      AUTH_URL: "http://localhost:3100",
      NEXTAUTH_URL: "http://localhost:3100",
      NEXT_DIST_DIR: ".next-qa",
    },
    stdio: "inherit",
  }
);

child.on("error", (error) => {
  console.error(error);
  process.exitCode = 1;
});
child.on("exit", (code, signal) => {
  if (signal) {
    process.exitCode = 1;
    return;
  }
  process.exitCode = code ?? 1;
});

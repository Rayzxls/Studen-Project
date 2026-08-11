import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { prepareIsolatedDatabaseEnv } from "../tests/helpers/database-safety";

type Mode = "status" | "deploy" | "studio";

const mode = process.argv[2] as Mode | undefined;
if (mode !== "status" && mode !== "deploy" && mode !== "studio") {
  throw new Error("usage: run-isolated-prisma <status|deploy|studio>");
}

let isolatedEnv: NodeJS.ProcessEnv;
try {
  isolatedEnv = prepareIsolatedDatabaseEnv(process.env);
} catch (error) {
  const message = error instanceof Error ? error.message : "unknown_error";
  console.error(`\nBlocked QA migration: ${message}`);
  console.error(
    "Set QA_DATABASE_URL to a separate PostgreSQL database or Neon branch."
  );
  console.error("The primary DATABASE_URL was not modified.\n");
  process.exit(1);
}

// Studio is a browser over the data, not a migration, so it takes no
// `migrate` verb. It is offered here — pointed at the isolated QA database —
// because the primary DATABASE_URL is Production, and Studio can edit every
// row it shows.
const args =
  mode === "studio"
    ? ["studio"]
    : ["migrate", mode === "deploy" ? "deploy" : "status"];

const child = spawn(
  process.execPath,
  [resolve("node_modules/prisma/build/index.js"), ...args],
  {
    cwd: process.cwd(),
    env: isolatedEnv,
    stdio: "inherit",
  }
);

child.on("error", (error) => {
  console.error(error);
  process.exitCode = 1;
});

child.on("exit", (code, signal) => {
  if (signal) {
    console.error(`QA migration process stopped by ${signal}`);
    process.exitCode = 1;
    return;
  }
  process.exitCode = code ?? 1;
});

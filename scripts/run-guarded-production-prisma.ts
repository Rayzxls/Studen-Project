import { spawn } from "node:child_process";
import { resolve } from "node:path";

import { databaseIdentity } from "../tests/helpers/database-safety";

const mode = process.argv[2];
if (mode !== "deploy") {
  throw new Error(
    "usage: run-guarded-production-prisma deploy --confirm=TOKEN"
  );
}

const confirmation = process.argv.find((arg) => arg.startsWith("--confirm="));
if (confirmation !== "--confirm=DEPLOY_PRODUCTION_MIGRATIONS") {
  throw new Error("production_migration_confirmation_required");
}

const primaryUrl = process.env.DATABASE_URL?.trim();
const qaUrl = process.env.QA_DATABASE_URL?.trim();
if (!primaryUrl) throw new Error("database_url_required");
if (!qaUrl) throw new Error("qa_database_url_required");
if (databaseIdentity(primaryUrl) === databaseIdentity(qaUrl)) {
  throw new Error("qa_database_matches_primary");
}

console.log(`Production database identity: ${databaseIdentity(primaryUrl)}`);
console.log("QA identity differs. Starting guarded Prisma migrate deploy.");

const child = spawn(
  process.execPath,
  [resolve("node_modules/prisma/build/index.js"), "migrate", "deploy"],
  {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_URL: primaryUrl },
    stdio: "inherit",
  }
);

child.on("error", (error) => {
  console.error(error);
  process.exitCode = 1;
});

child.on("exit", (code, signal) => {
  if (signal) {
    console.error(`Production migration process stopped by ${signal}`);
    process.exitCode = 1;
    return;
  }
  process.exitCode = code ?? 1;
});

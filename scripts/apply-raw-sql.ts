/**
 * Applies every file in `prisma/raw-sql/` to the active database.
 *
 * These statements exist because Prisma's schema language cannot express them —
 * the notification post-once index is a partial unique index, which
 * `@@unique` has no syntax for. Neither `prisma db push` nor a generated
 * migration will ever create them, so they have to be applied separately.
 *
 * Until now that meant remembering to run a file by hand, with nothing to
 * check it had happened. A database missing the post-once index still works,
 * it just quietly sends a class the same notification twice.
 *
 * Every file is written to be idempotent (`IF NOT EXISTS`), so re-running is
 * safe and is the intended way to bring an environment up to date.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const DIR = "prisma/raw-sql";

async function main(): Promise<void> {
  const files = readdirSync(DIR)
    .filter((name) => name.endsWith(".sql"))
    .sort();

  if (files.length === 0) {
    console.log("No raw SQL files to apply.");
    return;
  }

  const { PrismaClient } = await import("@prisma/client");
  const db = new PrismaClient();

  try {
    for (const file of files) {
      const sql = readFileSync(join(DIR, file), "utf8");
      await db.$executeRawUnsafe(sql);
      console.log(`applied ${file}`);
    }
    console.log(`\nRaw SQL applied: ${files.length} file(s).`);
  } finally {
    await db.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});

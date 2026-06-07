/**
 * ⚠️ DESTRUCTIVE — wipes ALL data in the connected database, then creates a
 * single ADMIN account. The schema is preserved; every table (except Prisma's
 * own _prisma_migrations bookkeeping) is TRUNCATEd. There is no undo.
 *
 * Safety:
 *   - refuses to run without the explicit `--yes` flag;
 *   - admin credentials come from env vars (ADMIN_IDENTIFIER / ADMIN_PASSWORD)
 *     so no secret is ever hard-coded into the repo.
 *
 * Usage (reads DATABASE_URL from .env.local via the npm script):
 *   ADMIN_IDENTIFIER=you ADMIN_PASSWORD=secret pnpm db:reset-admin -- --yes
 *
 * To reset a PRODUCTION database instead, point DATABASE_URL at it explicitly.
 */

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

async function main() {
  if (!process.argv.includes("--yes")) {
    console.error(
      "Refusing to run without --yes. This DELETES ALL DATA in the connected DB."
    );
    process.exit(1);
  }

  const identifier = process.env.ADMIN_IDENTIFIER;
  const password = process.env.ADMIN_PASSWORD;
  if (!identifier || !password) {
    console.error("Set ADMIN_IDENTIFIER and ADMIN_PASSWORD env vars.");
    process.exit(1);
  }

  const firstName = process.env.ADMIN_FIRST_NAME ?? "ผู้ดูแล";
  const lastName = process.env.ADMIN_LAST_NAME ?? "ระบบ";

  // Truncate every public table except Prisma's migration bookkeeping.
  const rows = await db.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'
  `;
  const tables = rows.map((r) => `"public"."${r.tablename}"`);
  if (tables.length > 0) {
    await db.$executeRawUnsafe(
      `TRUNCATE TABLE ${tables.join(", ")} RESTART IDENTITY CASCADE`
    );
  }
  console.log(`✓ Wiped ${tables.length} table(s)`);

  await db.user.create({
    data: {
      role: "ADMIN",
      identifier,
      passwordHash: await bcrypt.hash(password, 12),
      mustResetPwd: false,
      consentedAt: new Date(),
      consentVersion: "1.0",
      admin: { create: { firstName, lastName } },
    },
  });
  console.log(`✓ Created sole admin: ${identifier}`);
  console.log(
    "\n✨ Database now contains exactly one ADMIN and no other data."
  );
}

main()
  .then(() => db.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await db.$disconnect();
    process.exit(1);
  });

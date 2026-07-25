import { prepareIsolatedDatabaseEnv } from "../tests/helpers/database-safety";

/**
 * Anonymizes Deletion Pending accounts whose 30-day recovery window has lapsed
 * (Release D / D1). Runs against the isolated QA database only. Dry-run by
 * default — it reports what it would anonymize and changes nothing; pass
 * `--apply` to perform the irreversible anonymization.
 *
 *   pnpm db:anonymize:qa:dry-run
 *   pnpm db:anonymize:qa:apply
 */
Object.assign(process.env, prepareIsolatedDatabaseEnv(process.env));

async function main() {
  const apply = process.argv.includes("--apply");
  const now = new Date();

  const { db } = await import("@/lib/db/client");
  const { createPrismaAccountAnonymizationService } =
    await import("@/lib/identity/account-anonymization-prisma");

  const eligible = await db.user.findMany({
    where: {
      accountStatus: "DELETION_PENDING",
      deletionScheduledFor: { lt: now },
    },
    select: { id: true, role: true, deletionScheduledFor: true },
    orderBy: { deletionScheduledFor: "asc" },
    take: 500,
  });

  console.log(
    `[anonymize] ${eligible.length} account(s) past their recovery window as of ${now.toISOString()}`
  );
  for (const row of eligible) {
    console.log(
      `  - ${row.id} (${row.role}) scheduled ${row.deletionScheduledFor?.toISOString()}`
    );
  }

  if (!apply) {
    console.log("[anonymize] dry-run only — pass --apply to anonymize.");
    await db.$disconnect();
    return;
  }

  const result =
    await createPrismaAccountAnonymizationService().anonymizeExpiredDeletions({
      now,
    });
  console.log(
    `[anonymize] anonymized ${result.anonymizedUserIds.length}, skipped ${result.skippedUserIds.length}`
  );
  await db.$disconnect();
}

void main().catch((error) => {
  console.error("[anonymize] failed:", error);
  process.exit(1);
});

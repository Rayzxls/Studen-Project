import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  const recent = await db.auditLog.findMany({
    orderBy: { timestamp: "desc" },
    take: 10,
    select: {
      timestamp: true,
      action: true,
      actorRole: true,
      ipAddress: true,
      targetId: true,
      reason: true,
    },
  });

  console.log("\n=== Recent audit log (last 10) ===\n");
  for (const r of recent) {
    console.log(
      `[${r.timestamp.toISOString()}] ${r.action} | role=${r.actorRole ?? "—"} | ip=${r.ipAddress ?? "—"} | target=${r.targetId ?? "—"} ${r.reason ? `| reason=${r.reason}` : ""}`
    );
  }
  console.log(`\nTotal: ${recent.length}`);
}

main()
  .then(() => db.$disconnect())
  .catch((e) => {
    console.error(e);
    return db.$disconnect();
  });

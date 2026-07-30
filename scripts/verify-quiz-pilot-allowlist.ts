/**
 * Read-only check that the configured Quiz pilot allowlist points at courses
 * that actually exist.
 *
 * `QUIZ_PILOT_COURSE_IDS` is an exact CourseOffering-id allowlist and is
 * fail-closed, so a value naming a deleted course disables Quiz everywhere and
 * looks identical to "the flag is off". The 2026-07-29 reset deleted every
 * course, which is exactly how a whole environment ends up silently
 * Quiz-less. This command turns that silence into a non-zero exit.
 *
 * It reads the database and mutates nothing, so it is safe to run against the
 * environment being verified, including Production.
 */
import {
  parseQuizPilotAllowlist,
  quizEnabled,
  quizMutationsEnabled,
} from "../lib/quiz/feature-flags";

type CourseRow = {
  id: string;
  archivedAt: Date | null;
  _count: { quizzes: number };
};

async function main(): Promise<void> {
  const enabled = quizEnabled(process.env);
  const mutations = quizMutationsEnabled(process.env);
  const allowlist = parseQuizPilotAllowlist(process.env);

  console.log(`QUIZ_ENABLED: ${enabled}`);
  console.log(`QUIZ_MUTATIONS_ENABLED: ${mutations}`);

  const problems: string[] = [];

  if (allowlist.wildcard) {
    console.log("Allowlist: * (every course)");
    if (process.env.NODE_ENV === "production") {
      problems.push(
        "The wildcard is for identity-checked isolated QA only and must never be set in Production."
      );
    }
  } else if (allowlist.ids.length === 0) {
    console.log("Allowlist: (empty)");
    if (enabled) {
      problems.push(
        "QUIZ_ENABLED is on but the allowlist names no course, so Quiz is unreachable everywhere."
      );
    }
  } else {
    const { PrismaClient } = await import("@prisma/client");
    const db = new PrismaClient();

    let found: CourseRow[];
    try {
      found = await db.courseOffering.findMany({
        where: { id: { in: [...allowlist.ids] } },
        select: {
          id: true,
          archivedAt: true,
          _count: { select: { quizzes: true } },
        },
      });
    } finally {
      await db.$disconnect();
    }

    const byId = new Map(found.map((course) => [course.id, course]));
    for (const id of allowlist.ids) {
      const course = byId.get(id);
      if (!course) {
        console.log(`  ${id}: MISSING`);
        problems.push(`Allowlisted course ${id} does not exist.`);
        continue;
      }
      const state = course.archivedAt ? "archived" : "active";
      console.log(`  ${id}: ${state}, ${course._count.quizzes} quiz(zes)`);
      if (course.archivedAt) {
        problems.push(
          `Allowlisted course ${id} is archived, so teachers cannot use it.`
        );
      }
    }
  }

  if (problems.length > 0) {
    console.error("\nQuiz pilot allowlist is not serviceable:");
    for (const problem of problems) console.error(`  - ${problem}`);
    process.exitCode = 1;
    return;
  }

  console.log("\nQuiz pilot allowlist is serviceable.");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});

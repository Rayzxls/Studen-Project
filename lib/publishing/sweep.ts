import { db } from "@/lib/db/client";
import { clipExcerpt, fanOutBroadcast } from "@/lib/notification";

/**
 * Notifies for content whose publish time has passed (ADR-0046).
 *
 * Only notifications need this. Visibility is decided by comparing `publishAt`
 * with the clock, so a class can already see everything here — a late sweep
 * means a late nudge, never hidden coursework.
 *
 * A row is claimed by stamping `notifiedAt` in the same transaction as its
 * fan-out, so two overlapping runs cannot notify the same class twice.
 */

const BATCH = 50;

export type SweepResult = {
  announcements: number;
  materials: number;
  assignments: number;
};

export async function publishDueContent(
  now: Date = new Date()
): Promise<SweepResult> {
  return {
    announcements: await sweepAnnouncements(now),
    materials: await sweepMaterials(now),
    assignments: await sweepAssignments(now),
  };
}

/** Rows due to publish and not yet notified. Ordered so the oldest goes first. */
const dueWhere = (now: Date) => ({
  publishAt: { not: null, lte: now },
  notifiedAt: null,
});

async function sweepAnnouncements(now: Date): Promise<number> {
  const rows = await db.announcement.findMany({
    where: { ...dueWhere(now), deletedAt: null },
    orderBy: { publishAt: "asc" },
    take: BATCH,
    select: {
      id: true,
      title: true,
      body: true,
      courseOfferingId: true,
      course: { select: { name: true } },
      postedBy: {
        select: { teacher: { select: { firstName: true, lastName: true } } },
      },
    },
  });

  let sent = 0;
  for (const row of rows) {
    const claimed = await claim("announcement", row.id, now);
    if (!claimed) continue;
    await db.$transaction(async (tx) => {
      await fanOutBroadcast(tx, {
        kind: "ANNOUNCEMENT_POSTED",
        sourceEntityType: "ANNOUNCEMENT",
        sourceEntityId: row.id,
        courseOfferingId: row.courseOfferingId,
        payload: {
          courseId: row.courseOfferingId,
          courseName: row.course.name,
          title: row.title,
          bodyExcerpt: clipExcerpt(row.body),
          postedByName: row.postedBy.teacher
            ? `${row.postedBy.teacher.firstName} ${row.postedBy.teacher.lastName}`
            : "",
        },
      });
    });
    sent += 1;
  }
  return sent;
}

async function sweepMaterials(now: Date): Promise<number> {
  const rows = await db.material.findMany({
    where: { ...dueWhere(now), deletedAt: null },
    orderBy: { publishAt: "asc" },
    take: BATCH,
    select: {
      id: true,
      title: true,
      courseOfferingId: true,
      course: { select: { name: true } },
      postedBy: {
        select: { teacher: { select: { firstName: true, lastName: true } } },
      },
    },
  });

  let sent = 0;
  for (const row of rows) {
    const claimed = await claim("material", row.id, now);
    if (!claimed) continue;
    await db.$transaction(async (tx) => {
      await fanOutBroadcast(tx, {
        kind: "MATERIAL_POSTED",
        sourceEntityType: "MATERIAL",
        sourceEntityId: row.id,
        courseOfferingId: row.courseOfferingId,
        payload: {
          courseId: row.courseOfferingId,
          courseName: row.course.name,
          title: row.title,
          postedByName: row.postedBy.teacher
            ? `${row.postedBy.teacher.firstName} ${row.postedBy.teacher.lastName}`
            : "",
        },
      });
    });
    sent += 1;
  }
  return sent;
}

async function sweepAssignments(now: Date): Promise<number> {
  const rows = await db.assignment.findMany({
    where: dueWhere(now),
    orderBy: { publishAt: "asc" },
    take: BATCH,
    select: {
      id: true,
      title: true,
      dueAt: true,
      courseOfferingId: true,
      course: { select: { name: true } },
    },
  });

  let sent = 0;
  for (const row of rows) {
    const claimed = await claim("assignment", row.id, now);
    if (!claimed) continue;
    await db.$transaction(async (tx) => {
      await fanOutBroadcast(tx, {
        kind: "ASSIGNMENT_POSTED",
        sourceEntityType: "ASSIGNMENT",
        sourceEntityId: row.id,
        courseOfferingId: row.courseOfferingId,
        payload: {
          courseId: row.courseOfferingId,
          courseName: row.course.name,
          assignmentTitle: row.title,
          dueAt: row.dueAt ? row.dueAt.toISOString() : null,
        },
      });
    });
    sent += 1;
  }
  return sent;
}

/**
 * Takes ownership of one row by stamping `notifiedAt`, and reports whether this
 * caller was the one that got it.
 *
 * `updateMany` with `notifiedAt: null` in the filter makes the claim atomic:
 * two runs racing on the same row produce one update of 1 and one of 0, so only
 * one of them fans out.
 */
async function claim(
  model: "announcement" | "material" | "assignment",
  id: string,
  now: Date
): Promise<boolean> {
  const where = { id, notifiedAt: null };
  const data = { notifiedAt: now };
  const { count } =
    model === "announcement"
      ? await db.announcement.updateMany({ where, data })
      : model === "material"
        ? await db.material.updateMany({ where, data })
        : await db.assignment.updateMany({ where, data });
  return count === 1;
}

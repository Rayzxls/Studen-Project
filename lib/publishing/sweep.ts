import type { Prisma } from "@prisma/client";

import { db } from "@/lib/db/client";
import { clipExcerpt, fanOutBroadcast } from "@/lib/notification";
import { sendCoursePush } from "@/lib/notification/push";
import type { ScheduledContentKind } from "@/lib/publishing/schedule";

/**
 * Notifies for content whose publish time has passed (ADR-0046).
 *
 * Only notifications need this. Visibility is decided by comparing `publishAt`
 * with the clock, so a class can already see everything here — a late sweep
 * means a late nudge, never hidden coursework.
 *
 * A row is claimed by stamping `notifiedAt` in the same transaction as its
 * fan-out, so two overlapping runs cannot notify the same class twice.
 *
 * The same per-row fan-out is reachable one row at a time through
 * `notifyPublishedNow`, for a teacher who moves a scheduled post to right now
 * and should not wait for the next sweep to have their class told.
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

/**
 * Fans out for a single row that just went live, claiming it the same way the
 * sweep does. False means someone else got there first — a sweep running at
 * the same moment — and is not an error: the class is notified either way.
 */
export async function notifyPublishedNow(
  kind: ScheduledContentKind,
  id: string,
  now: Date = new Date()
): Promise<boolean> {
  if (kind === "ANNOUNCEMENT") {
    const row = await db.announcement.findUnique({
      where: { id },
      select: announcementNotifySelect,
    });
    if (!row) return false;
    if (!(await claim("announcement", id, now))) return false;
    await fanOutAnnouncement(row);
    return true;
  }

  if (kind === "MATERIAL") {
    const row = await db.material.findUnique({
      where: { id },
      select: materialNotifySelect,
    });
    if (!row) return false;
    if (!(await claim("material", id, now))) return false;
    await fanOutMaterial(row);
    return true;
  }

  const row = await db.assignment.findUnique({
    where: { id },
    select: assignmentNotifySelect,
  });
  if (!row) return false;
  if (!(await claim("assignment", id, now))) return false;
  await fanOutAssignment(row);
  return true;
}

/** Rows due to publish and not yet notified. Ordered so the oldest goes first. */
const dueWhere = (now: Date) => ({
  publishAt: { not: null, lte: now },
  notifiedAt: null,
});

const announcementNotifySelect = {
  id: true,
  title: true,
  body: true,
  courseOfferingId: true,
  course: { select: { name: true } },
  postedBy: {
    select: { teacher: { select: { firstName: true, lastName: true } } },
  },
} satisfies Prisma.AnnouncementSelect;

type AnnouncementNotifyRow = Prisma.AnnouncementGetPayload<{
  select: typeof announcementNotifySelect;
}>;

const materialNotifySelect = {
  id: true,
  title: true,
  courseOfferingId: true,
  course: { select: { name: true } },
  postedBy: {
    select: { teacher: { select: { firstName: true, lastName: true } } },
  },
} satisfies Prisma.MaterialSelect;

type MaterialNotifyRow = Prisma.MaterialGetPayload<{
  select: typeof materialNotifySelect;
}>;

const assignmentNotifySelect = {
  id: true,
  title: true,
  dueAt: true,
  courseOfferingId: true,
  course: { select: { name: true } },
} satisfies Prisma.AssignmentSelect;

type AssignmentNotifyRow = Prisma.AssignmentGetPayload<{
  select: typeof assignmentNotifySelect;
}>;

async function sweepAnnouncements(now: Date): Promise<number> {
  const rows = await db.announcement.findMany({
    where: { ...dueWhere(now), deletedAt: null },
    orderBy: { publishAt: "asc" },
    take: BATCH,
    select: announcementNotifySelect,
  });

  let sent = 0;
  for (const row of rows) {
    const claimed = await claim("announcement", row.id, now);
    if (!claimed) continue;
    await fanOutAnnouncement(row);
    sent += 1;
  }
  return sent;
}

async function fanOutAnnouncement(row: AnnouncementNotifyRow): Promise<void> {
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
  await sendCoursePush(row.courseOfferingId, {
    title: row.course.name,
    body: "มีประกาศใหม่",
    url: `/student/courses/${row.courseOfferingId}/feed`,
    tag: `announcement:${row.id}`,
  });
}

async function sweepMaterials(now: Date): Promise<number> {
  const rows = await db.material.findMany({
    where: { ...dueWhere(now), deletedAt: null },
    orderBy: { publishAt: "asc" },
    take: BATCH,
    select: materialNotifySelect,
  });

  let sent = 0;
  for (const row of rows) {
    const claimed = await claim("material", row.id, now);
    if (!claimed) continue;
    await fanOutMaterial(row);
    sent += 1;
  }
  return sent;
}

async function fanOutMaterial(row: MaterialNotifyRow): Promise<void> {
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
  await sendCoursePush(row.courseOfferingId, {
    title: row.course.name,
    body: "มีเอกสารใหม่",
    url: `/student/courses/${row.courseOfferingId}/feed`,
    tag: `material:${row.id}`,
  });
}

async function sweepAssignments(now: Date): Promise<number> {
  const rows = await db.assignment.findMany({
    where: dueWhere(now),
    orderBy: { publishAt: "asc" },
    take: BATCH,
    select: assignmentNotifySelect,
  });

  let sent = 0;
  for (const row of rows) {
    const claimed = await claim("assignment", row.id, now);
    if (!claimed) continue;
    await fanOutAssignment(row);
    sent += 1;
  }
  return sent;
}

async function fanOutAssignment(row: AssignmentNotifyRow): Promise<void> {
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
  await sendCoursePush(row.courseOfferingId, {
    title: row.course.name,
    body: "มีงานใหม่ที่ต้องส่ง",
    url: `/student/courses/${row.courseOfferingId}/assignments/${row.id}`,
    tag: `assignment:${row.id}`,
  });
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

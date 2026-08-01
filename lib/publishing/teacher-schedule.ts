import { db } from "@/lib/db/client";
import {
  derivePublishingStatus,
  summarizePublishingQueue,
  type PublishingStatus,
  type ScheduledContentKind,
} from "@/lib/publishing/schedule";

export interface TeacherPublishingItem {
  kind: ScheduledContentKind;
  id: string;
  title: string;
  createdAt: Date;
  publishAt: Date;
  notifiedAt: Date | null;
  status: PublishingStatus;
  notificationTargetCount: number;
  notificationCount: number;
  notificationReadCount: number;
}

export interface TeacherPublishingSchedule {
  upcoming: TeacherPublishingItem[];
  recent: TeacherPublishingItem[];
  activeStudentCount: number;
  studentsWithPushCount: number;
}

type RawPublishingItem = Omit<
  TeacherPublishingItem,
  | "status"
  | "notificationTargetCount"
  | "notificationCount"
  | "notificationReadCount"
>;

export async function getTeacherPublishingSchedule(
  courseOfferingId: string,
  now: Date = new Date()
): Promise<TeacherPublishingSchedule> {
  const [
    upcomingAnnouncements,
    recentAnnouncements,
    upcomingMaterials,
    recentMaterials,
    upcomingAssignments,
    recentAssignments,
    enrollments,
  ] = await Promise.all([
    db.announcement.findMany({
      where: {
        courseOfferingId,
        deletedAt: null,
        publishAt: { gt: now },
      },
      orderBy: { publishAt: "asc" },
      take: 50,
      select: {
        id: true,
        title: true,
        postedAt: true,
        publishAt: true,
        notifiedAt: true,
      },
    }),
    db.announcement.findMany({
      where: {
        courseOfferingId,
        deletedAt: null,
        publishAt: { lte: now },
      },
      orderBy: { publishAt: "desc" },
      take: 20,
      select: {
        id: true,
        title: true,
        postedAt: true,
        publishAt: true,
        notifiedAt: true,
      },
    }),
    db.material.findMany({
      where: {
        courseOfferingId,
        deletedAt: null,
        publishAt: { gt: now },
      },
      orderBy: { publishAt: "asc" },
      take: 50,
      select: {
        id: true,
        title: true,
        postedAt: true,
        publishAt: true,
        notifiedAt: true,
      },
    }),
    db.material.findMany({
      where: {
        courseOfferingId,
        deletedAt: null,
        publishAt: { lte: now },
      },
      orderBy: { publishAt: "desc" },
      take: 20,
      select: {
        id: true,
        title: true,
        postedAt: true,
        publishAt: true,
        notifiedAt: true,
      },
    }),
    db.assignment.findMany({
      where: { courseOfferingId, publishAt: { gt: now } },
      orderBy: { publishAt: "asc" },
      take: 50,
      select: {
        id: true,
        title: true,
        createdAt: true,
        publishAt: true,
        notifiedAt: true,
      },
    }),
    db.assignment.findMany({
      where: { courseOfferingId, publishAt: { lte: now } },
      orderBy: { publishAt: "desc" },
      take: 20,
      select: {
        id: true,
        title: true,
        createdAt: true,
        publishAt: true,
        notifiedAt: true,
      },
    }),
    db.enrollment.findMany({
      where: { courseOfferingId, removedAt: null },
      select: {
        student: {
          select: {
            user: {
              select: {
                _count: { select: { webPushSubscriptions: true } },
              },
            },
          },
        },
        enrolledAt: true,
      },
    }),
  ]);

  const announcements = [...upcomingAnnouncements, ...recentAnnouncements];
  const materials = [...upcomingMaterials, ...recentMaterials];
  const assignments = [...upcomingAssignments, ...recentAssignments];

  const rawItems: RawPublishingItem[] = [
    ...announcements.map((item) => ({
      kind: "ANNOUNCEMENT" as const,
      id: item.id,
      title: item.title || "ประกาศไม่มีหัวข้อ",
      createdAt: item.postedAt,
      publishAt: item.publishAt!,
      notifiedAt: item.notifiedAt,
    })),
    ...materials.map((item) => ({
      kind: "MATERIAL" as const,
      id: item.id,
      title: item.title,
      createdAt: item.postedAt,
      publishAt: item.publishAt!,
      notifiedAt: item.notifiedAt,
    })),
    ...assignments.map((item) => ({
      kind: "ASSIGNMENT" as const,
      id: item.id,
      title: item.title,
      createdAt: item.createdAt,
      publishAt: item.publishAt!,
      notifiedAt: item.notifiedAt,
    })),
  ];

  const notifications =
    rawItems.length === 0
      ? []
      : await db.notification.findMany({
          where: {
            suppressedAt: null,
            OR: rawItems.map((item) => ({
              sourceEntityType: item.kind,
              sourceEntityId: item.id,
            })),
          },
          select: {
            sourceEntityType: true,
            sourceEntityId: true,
            readAt: true,
          },
        });

  const notificationStats = new Map<
    string,
    { count: number; readCount: number }
  >();
  for (const notification of notifications) {
    const key = `${notification.sourceEntityType}:${notification.sourceEntityId}`;
    const current = notificationStats.get(key) ?? { count: 0, readCount: 0 };
    current.count += 1;
    if (notification.readAt !== null) current.readCount += 1;
    notificationStats.set(key, current);
  }

  const activeStudentCount = enrollments.length;
  const studentsWithPushCount = enrollments.filter(
    (enrollment) => enrollment.student.user._count.webPushSubscriptions > 0
  ).length;
  const items = rawItems.map((item): TeacherPublishingItem => {
    const stats = notificationStats.get(`${item.kind}:${item.id}`) ?? {
      count: 0,
      readCount: 0,
    };
    const notificationTargetCount =
      item.notifiedAt === null
        ? activeStudentCount
        : enrollments.filter(
            (enrollment) =>
              enrollment.enrolledAt.getTime() <= item.notifiedAt!.getTime()
          ).length;
    return {
      ...item,
      status: derivePublishingStatus({
        now,
        publishAt: item.publishAt,
        notifiedAt: item.notifiedAt,
        activeStudentCount,
        notificationTargetCount,
        notificationCount: stats.count,
      }),
      notificationTargetCount,
      notificationCount: stats.count,
      notificationReadCount: stats.readCount,
    };
  });

  return {
    upcoming: items
      .filter((item) => item.status === "SCHEDULED")
      .sort((a, b) => a.publishAt.getTime() - b.publishAt.getTime())
      .slice(0, 50),
    recent: items
      .filter((item) => item.status !== "SCHEDULED")
      .sort((a, b) => b.publishAt.getTime() - a.publishAt.getTime())
      .slice(0, 20),
    activeStudentCount,
    studentsWithPushCount,
  };
}

export async function getPublishingQueueSummary(
  courseOfferingId: string,
  now: Date = new Date()
) {
  const [announcements, materials, assignments] = await Promise.all([
    db.announcement.findMany({
      where: { courseOfferingId, deletedAt: null, publishAt: { gt: now } },
      orderBy: { publishAt: "asc" },
      select: { title: true, publishAt: true },
    }),
    db.material.findMany({
      where: { courseOfferingId, deletedAt: null, publishAt: { gt: now } },
      orderBy: { publishAt: "asc" },
      select: { title: true, publishAt: true },
    }),
    db.assignment.findMany({
      where: { courseOfferingId, publishAt: { gt: now } },
      orderBy: { publishAt: "asc" },
      select: { title: true, publishAt: true },
    }),
  ]);

  return summarizePublishingQueue(
    [
      ...announcements.map((item) => ({
        kind: "ANNOUNCEMENT" as const,
        title: item.title || "ประกาศไม่มีหัวข้อ",
        publishAt: item.publishAt!,
      })),
      ...materials.map((item) => ({
        kind: "MATERIAL" as const,
        title: item.title,
        publishAt: item.publishAt!,
      })),
      ...assignments.map((item) => ({
        kind: "ASSIGNMENT" as const,
        title: item.title,
        publishAt: item.publishAt!,
      })),
    ],
    now
  );
}

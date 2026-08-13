import { db } from "@/lib/db/client";
import { Forbidden, NotFound, ValidationError } from "@/lib/errors";
import {
  chatEnabled,
  chatMutationsEnabled,
  type ChatFeatureFlagEnv,
} from "@/lib/chat/feature-flags";
import { chatMessageExpiresAt, normalizeChatMessage } from "@/lib/chat/policy";
import { fanOutTargetedMany } from "@/lib/notification/fan-out";
import { restrictedChatMessageIds } from "@/lib/chat/moderation";

export type ChatActorContext = {
  actorUserId: string;
  env?: ChatFeatureFlagEnv;
};

export type ChatMessageView = {
  id: string;
  author: {
    userId: string;
    firstName: string | null;
    lastName: string | null;
    profileImageId: string | null;
  } | null;
  body: string | null;
  createdAt: Date;
  deleted: boolean;
};

function assertReadsEnabled(env?: ChatFeatureFlagEnv) {
  if (!chatEnabled(env)) throw new NotFound("chat_not_found");
}

function assertMutationsEnabled(env?: ChatFeatureFlagEnv) {
  if (!chatMutationsEnabled(env)) {
    throw new Forbidden("chat_mutations_disabled");
  }
}

async function requireCourseMember(params: {
  courseOfferingId: string;
  actorUserId: string;
  requireOpenCourse?: boolean;
}) {
  const course = await db.courseOffering.findUnique({
    where: { id: params.courseOfferingId },
    select: {
      id: true,
      teacherId: true,
      archivedAt: true,
      enrollments: {
        where: {
          studentId: params.actorUserId, // dependency-gate-allow(student-id-symbol-review): internal Enrollment foreign key to User.id
          removedAt: null,
        },
        select: { id: true },
        take: 1,
      },
    },
  });
  if (!course) throw new NotFound("course_not_found");
  if (
    course.teacherId !== params.actorUserId &&
    course.enrollments.length === 0
  ) {
    throw new Forbidden("chat_course_forbidden");
  }
  if (params.requireOpenCourse && course.archivedAt !== null) {
    throw new Forbidden("chat_course_archived");
  }
  return course;
}

function messageBody(input: string): string {
  try {
    return normalizeChatMessage(input);
  } catch (error) {
    const code =
      error instanceof Error ? error.message : "chat_message_invalid";
    const message =
      code === "chat_message_required"
        ? "กรุณาพิมพ์ข้อความ"
        : code === "chat_message_too_long"
          ? "ข้อความยาวเกิน 4,000 ตัวอักษร"
          : "ข้อความไม่ถูกต้อง";
    throw new ValidationError({ body: message }, code);
  }
}

/**
 * The Course Channel has no membership table. Authorization always follows
 * the current owning Teacher and active Enrollment rows (ADR-0050).
 */
export async function listCourseChannelMessages(params: {
  courseOfferingId: string;
  afterMessageId?: string;
  limit?: number;
  ctx: ChatActorContext;
}): Promise<{ conversationId: string | null; messages: ChatMessageView[] }> {
  assertReadsEnabled(params.ctx.env);
  await requireCourseMember({
    courseOfferingId: params.courseOfferingId,
    actorUserId: params.ctx.actorUserId,
  });

  const conversation = await db.chatConversation.findUnique({
    where: { courseOfferingId: params.courseOfferingId },
    select: { id: true },
  });
  if (!conversation) return { conversationId: null, messages: [] };

  const limit = Math.min(Math.max(params.limit ?? 50, 1), 100);
  const cursor = params.afterMessageId
    ? await db.chatMessage.findFirst({
        where: {
          id: params.afterMessageId,
          conversationId: conversation.id,
        },
        select: { id: true, createdAt: true },
      })
    : null;
  const rows = await db.chatMessage.findMany({
    where: {
      conversationId: conversation.id,
      ...(cursor
        ? {
            OR: [
              { createdAt: { gt: cursor.createdAt } },
              { createdAt: cursor.createdAt, id: { gt: cursor.id } },
            ],
          }
        : {}),
    },
    orderBy: [
      { createdAt: cursor ? "asc" : "desc" },
      { id: cursor ? "asc" : "desc" },
    ],
    take: limit,
    select: {
      id: true,
      body: true,
      createdAt: true,
      deletedAt: true,
      author: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          profileImageId: true,
          teacher: { select: { firstName: true, lastName: true } },
          student: { select: { firstName: true, lastName: true } },
        },
      },
    },
  });
  if (!cursor) rows.reverse();
  const restricted = await restrictedChatMessageIds(rows.map((row) => row.id));

  return {
    conversationId: conversation.id,
    messages: rows.map((row) => ({
      id: row.id,
      author: row.author
        ? {
            userId: row.author.id,
            firstName:
              row.author.firstName ??
              row.author.teacher?.firstName ??
              row.author.student?.firstName ??
              null,
            lastName:
              row.author.lastName ??
              row.author.teacher?.lastName ??
              row.author.student?.lastName ??
              null,
            profileImageId: row.author.profileImageId,
          }
        : null,
      body: restricted.has(row.id) ? null : row.body,
      createdAt: row.createdAt,
      deleted: row.deletedAt !== null || restricted.has(row.id),
    })),
  };
}

export async function sendCourseChannelMessage(params: {
  courseOfferingId: string;
  body: string;
  now?: Date;
  ctx: ChatActorContext;
}): Promise<ChatMessageView> {
  assertMutationsEnabled(params.ctx.env);
  const body = messageBody(params.body);
  const now = params.now ?? new Date();
  await requireCourseMember({
    courseOfferingId: params.courseOfferingId,
    actorUserId: params.ctx.actorUserId,
    requireOpenCourse: true,
  });

  const author = await db.user.findUnique({
    where: { id: params.ctx.actorUserId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      profileImageId: true,
      teacher: { select: { firstName: true, lastName: true } },
      student: { select: { firstName: true, lastName: true } },
    },
  });
  if (!author) throw new NotFound("chat_author_not_found");
  const firstName =
    author.firstName ??
    author.teacher?.firstName ??
    author.student?.firstName ??
    null;
  const lastName =
    author.lastName ??
    author.teacher?.lastName ??
    author.student?.lastName ??
    null;
  const senderName =
    [firstName, lastName]
      .filter((part): part is string => Boolean(part?.trim()))
      .join(" ")
      .trim() || "สมาชิก";

  const message = await db.$transaction(async (tx) => {
    const conversation = await tx.chatConversation.upsert({
      where: { courseOfferingId: params.courseOfferingId },
      create: {
        kind: "COURSE_CHANNEL",
        courseOfferingId: params.courseOfferingId,
        createdById: params.ctx.actorUserId,
      },
      update: {},
      select: { id: true },
    });
    const created = await tx.chatMessage.create({
      data: {
        conversationId: conversation.id,
        authorId: params.ctx.actorUserId,
        body,
        createdAt: now,
        expiresAt: chatMessageExpiresAt(now),
      },
      select: { id: true, body: true, createdAt: true },
    });
    await tx.chatConversation.update({
      where: { id: conversation.id },
      data: { lastMessageAt: now },
    });
    const course = await tx.courseOffering.findUniqueOrThrow({
      where: { id: params.courseOfferingId },
      select: {
        name: true,
        teacherId: true,
        enrollments: {
          where: { removedAt: null },
          select: { studentId: true }, // dependency-gate-allow(student-id-symbol-review): internal Enrollment foreign key to User.id
        },
      },
    });
    const recipientIds = [
      course.teacherId,
      ...course.enrollments.map((enrollment) => enrollment.studentId), // dependency-gate-allow(student-id-symbol-review): internal Enrollment foreign key to User.id
    ].filter((userId) => userId !== params.ctx.actorUserId);
    await fanOutTargetedMany(tx, {
      recipientIds,
      kind: "CHAT_MESSAGE",
      sourceEntityType: "CHAT_CONVERSATION",
      sourceEntityId: conversation.id,
      courseOfferingId: params.courseOfferingId,
      payload: {
        courseId: params.courseOfferingId,
        courseName: course.name,
        senderName,
        messagePreview: body,
      },
    });
    return created;
  });

  return {
    id: message.id,
    author: {
      userId: author.id,
      firstName,
      lastName,
      profileImageId: author.profileImageId,
    },
    body: message.body,
    createdAt: message.createdAt,
    deleted: false,
  };
}

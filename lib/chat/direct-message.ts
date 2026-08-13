import type { Role } from "@prisma/client";

import { db } from "@/lib/db/client";
import { Conflict, Forbidden, NotFound, ValidationError } from "@/lib/errors";
import { fanOutTargeted } from "@/lib/notification/fan-out";
import {
  chatEnabled,
  chatMutationsEnabled,
  type ChatFeatureFlagEnv,
} from "@/lib/chat/feature-flags";
import {
  chatMessageExpiresAt,
  directConversationKey,
  normalizeChatMessage,
} from "@/lib/chat/policy";
import type { ChatMessageView } from "@/lib/chat/course-channel";
import { restrictedChatMessageIds } from "@/lib/chat/moderation";

type ChatContext = { actorUserId: string; env?: ChatFeatureFlagEnv };

export type ChatPerson = {
  userId: string;
  role: Exclude<Role, "ADMIN">;
  firstName: string | null;
  lastName: string | null;
  profileImageId: string | null;
};

export type DirectConversationSummary = {
  id: string;
  other: ChatPerson;
  lastMessage: {
    body: string | null;
    createdAt: Date;
    deleted: boolean;
  } | null;
  blocked: boolean;
  blockedByMe: boolean;
};

function assertReadsEnabled(env?: ChatFeatureFlagEnv) {
  if (!chatEnabled(env)) throw new NotFound("chat_not_found");
}

function assertMutationsEnabled(env?: ChatFeatureFlagEnv) {
  if (!chatMutationsEnabled(env))
    throw new Forbidden("chat_mutations_disabled");
}

function displayName(person: {
  firstName: string | null;
  lastName: string | null;
}): string {
  const name = [person.firstName, person.lastName]
    .filter((part): part is string => Boolean(part?.trim()))
    .join(" ")
    .trim();
  return name || "สมาชิก";
}

function normalizedBody(value: string): string {
  try {
    return normalizeChatMessage(value);
  } catch (error) {
    const code =
      error instanceof Error ? error.message : "chat_message_invalid";
    throw new ValidationError(
      {
        body:
          code === "chat_message_required"
            ? "กรุณาพิมพ์ข้อความ"
            : code === "chat_message_too_long"
              ? "ข้อความยาวเกิน 4,000 ตัวอักษร"
              : "ข้อความไม่ถูกต้อง",
      },
      code
    );
  }
}

const personSelect = {
  id: true,
  role: true,
  firstName: true,
  lastName: true,
  profileImageId: true,
  teacher: { select: { firstName: true, lastName: true } },
  student: { select: { firstName: true, lastName: true } },
} as const;

function toPerson(person: {
  id: string;
  role: Role;
  firstName: string | null;
  lastName: string | null;
  profileImageId: string | null;
  teacher: { firstName: string; lastName: string } | null;
  student: { firstName: string; lastName: string } | null;
}): ChatPerson {
  if (person.role === "ADMIN") throw new NotFound("chat_person_not_found");
  return {
    userId: person.id,
    role: person.role,
    firstName:
      person.firstName ??
      person.teacher?.firstName ??
      person.student?.firstName ??
      null,
    lastName:
      person.lastName ??
      person.teacher?.lastName ??
      person.student?.lastName ??
      null,
    profileImageId: person.profileImageId,
  };
}

/** Narrow discovery: no directory, only a deliberate 3+ character name search. */
export async function searchChatPeople(params: {
  query: string;
  ctx: ChatContext;
}): Promise<ChatPerson[]> {
  assertReadsEnabled(params.ctx.env);
  const query = params.query.trim().replace(/\s+/g, " ");
  if (query.length < 3) {
    throw new ValidationError({ query: "พิมพ์ชื่ออย่างน้อย 3 ตัวอักษร" });
  }
  if (query.length > 80) {
    throw new ValidationError({ query: "คำค้นหายาวเกินไป" });
  }

  const users = await db.user.findMany({
    where: {
      id: { not: params.ctx.actorUserId },
      role: { in: ["TEACHER", "STUDENT"] },
      isActive: true,
      accountStatus: "ACTIVE",
      deletedAt: null,
      chatBlocksMade: {
        none: { blockedId: params.ctx.actorUserId },
      },
      chatBlocksReceived: {
        none: { blockerId: params.ctx.actorUserId },
      },
      OR: [
        { firstName: { contains: query, mode: "insensitive" } },
        { lastName: { contains: query, mode: "insensitive" } },
        { teacher: { firstName: { contains: query, mode: "insensitive" } } },
        { teacher: { lastName: { contains: query, mode: "insensitive" } } },
        { student: { firstName: { contains: query, mode: "insensitive" } } },
        { student: { lastName: { contains: query, mode: "insensitive" } } },
      ],
    },
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }, { id: "asc" }],
    take: 12,
    select: personSelect,
  });
  return users.map(toPerson);
}

export async function openDirectConversation(params: {
  otherUserId: string;
  ctx: ChatContext;
}): Promise<{ conversationId: string }> {
  assertMutationsEnabled(params.ctx.env);
  let key: string;
  try {
    key = directConversationKey(params.ctx.actorUserId, params.otherUserId);
  } catch {
    throw new ValidationError({ otherUserId: "ผู้รับไม่ถูกต้อง" });
  }

  const [other, block] = await Promise.all([
    db.user.findFirst({
      where: {
        id: params.otherUserId,
        role: { in: ["TEACHER", "STUDENT"] },
        isActive: true,
        accountStatus: "ACTIVE",
        deletedAt: null,
      },
      select: { id: true },
    }),
    db.chatBlock.findFirst({
      where: {
        OR: [
          {
            blockerId: params.ctx.actorUserId,
            blockedId: params.otherUserId,
          },
          {
            blockerId: params.otherUserId,
            blockedId: params.ctx.actorUserId,
          },
        ],
      },
      select: { blockerId: true },
    }),
  ]);
  if (!other) throw new NotFound("chat_person_not_found");
  if (block) throw new Forbidden("chat_direct_blocked");

  const conversation = await db.$transaction(async (tx) => {
    const row = await tx.chatConversation.upsert({
      where: { directKey: key },
      create: {
        kind: "DIRECT_MESSAGE",
        directKey: key,
        createdById: params.ctx.actorUserId,
      },
      update: {},
      select: { id: true, kind: true },
    });
    if (row.kind !== "DIRECT_MESSAGE") throw new Conflict("chat_kind_conflict");
    await tx.chatConversationMember.createMany({
      data: [
        { conversationId: row.id, userId: params.ctx.actorUserId },
        { conversationId: row.id, userId: params.otherUserId },
      ],
      skipDuplicates: true,
    });
    return row;
  });
  return { conversationId: conversation.id };
}

export async function listDirectConversations(params: {
  ctx: ChatContext;
}): Promise<DirectConversationSummary[]> {
  assertReadsEnabled(params.ctx.env);
  const rows = await db.chatConversation.findMany({
    where: {
      kind: "DIRECT_MESSAGE",
      members: { some: { userId: params.ctx.actorUserId } },
    },
    orderBy: [{ lastMessageAt: "desc" }, { updatedAt: "desc" }],
    take: 100,
    select: {
      id: true,
      members: {
        where: { userId: { not: params.ctx.actorUserId } },
        take: 1,
        select: { user: { select: personSelect } },
      },
      messages: {
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 1,
        select: { body: true, createdAt: true, deletedAt: true },
      },
    },
  });
  const otherIds = rows.flatMap((row) => row.members.map((m) => m.user.id));
  const blocks =
    otherIds.length === 0
      ? []
      : await db.chatBlock.findMany({
          where: {
            OR: [
              {
                blockerId: params.ctx.actorUserId,
                blockedId: { in: otherIds },
              },
              {
                blockerId: { in: otherIds },
                blockedId: params.ctx.actorUserId,
              },
            ],
          },
          select: { blockerId: true, blockedId: true },
        });

  return rows.flatMap((row) => {
    const person = row.members[0]?.user;
    if (!person || person.role === "ADMIN") return [];
    const other = toPerson(person);
    const related = blocks.filter(
      (block) =>
        block.blockerId === other.userId || block.blockedId === other.userId
    );
    const last = row.messages[0];
    return [
      {
        id: row.id,
        other,
        lastMessage: last
          ? {
              body: last.body,
              createdAt: last.createdAt,
              deleted: last.deletedAt !== null,
            }
          : null,
        blocked: related.length > 0,
        blockedByMe: related.some(
          (block) => block.blockerId === params.ctx.actorUserId
        ),
      },
    ];
  });
}

export async function getDirectConversation(params: {
  conversationId: string;
  ctx: ChatContext;
}): Promise<{
  other: ChatPerson;
  blocked: boolean;
  blockedByMe: boolean;
}> {
  assertReadsEnabled(params.ctx.env);
  const row = await db.chatConversation.findFirst({
    where: {
      id: params.conversationId,
      kind: "DIRECT_MESSAGE",
      members: { some: { userId: params.ctx.actorUserId } },
    },
    select: {
      members: {
        where: { userId: { not: params.ctx.actorUserId } },
        take: 1,
        select: { user: { select: personSelect } },
      },
    },
  });
  const person = row?.members[0]?.user;
  if (!person || person.role === "ADMIN") {
    throw new NotFound("chat_conversation_not_found");
  }
  const blocks = await db.chatBlock.findMany({
    where: {
      OR: [
        { blockerId: params.ctx.actorUserId, blockedId: person.id },
        { blockerId: person.id, blockedId: params.ctx.actorUserId },
      ],
    },
    select: { blockerId: true },
  });
  return {
    other: toPerson(person),
    blocked: blocks.length > 0,
    blockedByMe: blocks.some(
      (block) => block.blockerId === params.ctx.actorUserId
    ),
  };
}

export async function listDirectMessages(params: {
  conversationId: string;
  afterMessageId?: string;
  limit?: number;
  ctx: ChatContext;
}): Promise<ChatMessageView[]> {
  assertReadsEnabled(params.ctx.env);
  await getDirectConversation({
    conversationId: params.conversationId,
    ctx: params.ctx,
  });
  const cursor = params.afterMessageId
    ? await db.chatMessage.findFirst({
        where: {
          id: params.afterMessageId,
          conversationId: params.conversationId,
        },
        select: { id: true, createdAt: true },
      })
    : null;
  const limit = Math.min(Math.max(params.limit ?? 50, 1), 100);
  const rows = await db.chatMessage.findMany({
    where: {
      conversationId: params.conversationId,
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
      author: { select: personSelect },
    },
  });
  if (!cursor) rows.reverse();
  const restricted = await restrictedChatMessageIds(rows.map((row) => row.id));
  return rows.map((row) => ({
    id: row.id,
    author: row.author
      ? {
          userId: row.author.id,
          firstName: toPerson(row.author).firstName,
          lastName: toPerson(row.author).lastName,
          profileImageId: row.author.profileImageId,
        }
      : null,
    body: restricted.has(row.id) ? null : row.body,
    createdAt: row.createdAt,
    deleted: row.deletedAt !== null || restricted.has(row.id),
  }));
}

export async function sendDirectMessage(params: {
  conversationId: string;
  body: string;
  now?: Date;
  ctx: ChatContext;
}): Promise<{ message: ChatMessageView; recipientId: string }> {
  assertMutationsEnabled(params.ctx.env);
  const body = normalizedBody(params.body);
  const now = params.now ?? new Date();
  const conversation = await getDirectConversation({
    conversationId: params.conversationId,
    ctx: params.ctx,
  });
  if (conversation.blocked) throw new Forbidden("chat_direct_blocked");

  const actor = await db.user.findUnique({
    where: { id: params.ctx.actorUserId },
    select: personSelect,
  });
  if (!actor || actor.role === "ADMIN")
    throw new Forbidden("chat_actor_forbidden");
  const author = toPerson(actor);
  const senderName = displayName(author);

  const message = await db.$transaction(async (tx) => {
    const created = await tx.chatMessage.create({
      data: {
        conversationId: params.conversationId,
        authorId: params.ctx.actorUserId,
        body,
        createdAt: now,
        expiresAt: chatMessageExpiresAt(now),
      },
      select: { id: true, body: true, createdAt: true },
    });
    await tx.chatConversation.update({
      where: { id: params.conversationId },
      data: { lastMessageAt: now },
    });
    await fanOutTargeted(tx, {
      recipientId: conversation.other.userId,
      kind: "CHAT_MESSAGE",
      sourceEntityType: "CHAT_CONVERSATION",
      sourceEntityId: params.conversationId,
      courseOfferingId: null,
      payload: { senderName, messagePreview: body },
    });
    return created;
  });

  return {
    message: {
      id: message.id,
      author: {
        userId: author.userId,
        firstName: author.firstName,
        lastName: author.lastName,
        profileImageId: author.profileImageId,
      },
      body: message.body,
      createdAt: message.createdAt,
      deleted: false,
    },
    recipientId: conversation.other.userId,
  };
}

export async function setDirectMessageBlock(params: {
  conversationId: string;
  blocked: boolean;
  ctx: ChatContext;
}): Promise<{ blocked: boolean; blockedByMe: boolean }> {
  assertMutationsEnabled(params.ctx.env);
  const conversation = await getDirectConversation({
    conversationId: params.conversationId,
    ctx: params.ctx,
  });
  if (params.blocked) {
    await db.chatBlock.upsert({
      where: {
        blockerId_blockedId: {
          blockerId: params.ctx.actorUserId,
          blockedId: conversation.other.userId,
        },
      },
      create: {
        blockerId: params.ctx.actorUserId,
        blockedId: conversation.other.userId,
      },
      update: {},
    });
    return { blocked: true, blockedByMe: true };
  }

  await db.chatBlock.deleteMany({
    where: {
      blockerId: params.ctx.actorUserId,
      blockedId: conversation.other.userId,
    },
  });
  const blockedByOther = await db.chatBlock.count({
    where: {
      blockerId: conversation.other.userId,
      blockedId: params.ctx.actorUserId,
    },
  });
  return { blocked: blockedByOther > 0, blockedByMe: false };
}

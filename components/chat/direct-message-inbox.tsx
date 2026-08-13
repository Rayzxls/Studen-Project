"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { MessageCircle, Search, ShieldBan } from "lucide-react";

import { UserAvatar } from "@/components/profile/user-avatar";
import type { ChatPerson } from "@/lib/chat/direct-message";

export type DirectConversationCard = {
  id: string;
  other: ChatPerson;
  lastMessage: {
    body: string | null;
    createdAt: string;
    deleted: boolean;
  } | null;
  blocked: boolean;
  blockedByMe: boolean;
};

export function DirectMessageInbox({
  conversations,
}: {
  conversations: DirectConversationCard[];
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ChatPerson[]>([]);
  const [searching, setSearching] = useState(false);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function search(event: FormEvent) {
    event.preventDefault();
    const normalized = query.trim();
    if (normalized.length < 3) {
      setError("พิมพ์ชื่ออย่างน้อย 3 ตัวอักษร");
      return;
    }
    setSearching(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/chat/people?q=${encodeURIComponent(normalized)}`,
        {
          cache: "no-store",
        }
      );
      if (!response.ok) throw new Error("ค้นหาสมาชิกไม่สำเร็จ");
      const result = (await response.json()) as { people: ChatPerson[] };
      setResults(result.people);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "ค้นหาสมาชิกไม่สำเร็จ"
      );
    } finally {
      setSearching(false);
    }
  }

  async function open(person: ChatPerson) {
    if (openingId) return;
    setOpeningId(person.userId);
    setError(null);
    try {
      const response = await fetch("/api/chat/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ otherUserId: person.userId }),
      });
      const result = (await response.json()) as {
        conversationId?: string;
        error?: { code?: string };
      };
      if (!response.ok || !result.conversationId) {
        throw new Error(
          result.error?.code === "chat_direct_blocked"
            ? "ไม่สามารถเปิดการสนทนานี้ได้"
            : "เปิดการสนทนาไม่สำเร็จ"
        );
      }
      router.push(`/chat/${result.conversationId}`);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "เปิดการสนทนาไม่สำเร็จ"
      );
      setOpeningId(null);
    }
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start">
      <section className="rounded-3xl border border-black/[0.07] bg-surface p-4 shadow-card sm:p-6">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
            <MessageCircle className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <h1 className="text-xl font-semibold text-ink">ข้อความ</h1>
            <p className="text-sm text-ink-mute">การสนทนาส่วนตัวของคุณ</p>
          </div>
        </div>

        {conversations.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-dashed border-black/[0.1] px-5 py-12 text-center">
            <p className="font-medium text-ink">ยังไม่มีการสนทนา</p>
            <p className="mt-1 text-sm text-ink-mute">
              ค้นหาชื่อคนที่รู้จักเพื่อเริ่มข้อความแรก
            </p>
          </div>
        ) : (
          <div className="mt-5 divide-y divide-black/[0.06]">
            {conversations.map((conversation) => (
              <button
                key={conversation.id}
                type="button"
                onClick={() => router.push(`/chat/${conversation.id}`)}
                className="flex w-full items-center gap-3 rounded-2xl px-2 py-4 text-left transition hover:bg-bg focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-500/15"
              >
                <UserAvatar
                  userId={conversation.other.userId}
                  hasImage={conversation.other.profileImageId !== null}
                  version={conversation.other.profileImageId}
                  size={44}
                  alt={personName(conversation.other)}
                />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <strong className="truncate text-sm text-ink">
                      {personName(conversation.other)}
                    </strong>
                    <small className="shrink-0 text-[10px] text-ink-mute">
                      {conversation.other.role === "TEACHER"
                        ? "ครู"
                        : "นักเรียน"}
                    </small>
                  </span>
                  <span className="mt-0.5 block truncate text-sm text-ink-mute">
                    {conversation.blocked
                      ? "การสนทนานี้ถูกบล็อก"
                      : conversation.lastMessage?.deleted
                        ? "ข้อความถูกนำออกแล้ว"
                        : (conversation.lastMessage?.body ?? "เริ่มการสนทนา")}
                  </span>
                </span>
                {conversation.blocked && (
                  <ShieldBan
                    className="h-4 w-4 shrink-0 text-ink-mute"
                    aria-label="ถูกบล็อก"
                  />
                )}
              </button>
            ))}
          </div>
        )}
      </section>

      <aside className="rounded-3xl border border-black/[0.07] bg-surface p-4 shadow-card sm:p-5 lg:sticky lg:top-24">
        <h2 className="font-semibold text-ink">เริ่มการสนทนาใหม่</h2>
        <p className="mt-1 text-xs leading-5 text-ink-mute">
          ค้นหาจากชื่ออย่างน้อย 3 ตัวอักษร ระบบจะไม่แสดงรายชื่อทั้งโรงเรียน
        </p>
        <form onSubmit={search} className="mt-4 flex gap-2">
          <label htmlFor="chat-person-search" className="sr-only">
            ค้นหาชื่อ
          </label>
          <input
            id="chat-person-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            maxLength={80}
            placeholder="ชื่อหรือนามสกุล"
            className="input min-w-0 flex-1"
          />
          <button
            type="submit"
            className="btn-primary btn-sm h-11 w-11 shrink-0 p-0"
            disabled={searching || query.trim().length < 3}
            aria-label={searching ? "กำลังค้นหา" : "ค้นหา"}
          >
            <Search className="h-4 w-4" aria-hidden="true" />
          </button>
        </form>

        {error && (
          <p role="alert" className="mt-3 text-sm text-red-700">
            {error}
          </p>
        )}
        {results.length > 0 && (
          <div className="mt-4 space-y-1" aria-label="ผลการค้นหา">
            {results.map((person) => (
              <button
                key={person.userId}
                type="button"
                onClick={() => open(person)}
                disabled={openingId !== null}
                className="flex w-full items-center gap-3 rounded-xl p-2 text-left transition hover:bg-bg focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-500/15 disabled:opacity-50"
              >
                <UserAvatar
                  userId={person.userId}
                  hasImage={person.profileImageId !== null}
                  version={person.profileImageId}
                  size={36}
                  alt={personName(person)}
                />
                <span className="min-w-0">
                  <strong className="block truncate text-sm text-ink">
                    {personName(person)}
                  </strong>
                  <small className="text-xs text-ink-mute">
                    {person.role === "TEACHER" ? "ครู" : "นักเรียน"}
                  </small>
                </span>
              </button>
            ))}
          </div>
        )}
        {!searching &&
          query.trim().length >= 3 &&
          results.length === 0 &&
          !error && (
            <p className="mt-4 text-center text-sm text-ink-mute">
              ไม่พบชื่อที่ค้นหา
            </p>
          )}
      </aside>
    </div>
  );
}

function personName(
  person: Pick<ChatPerson, "firstName" | "lastName">
): string {
  return (
    [person.firstName, person.lastName]
      .filter((part): part is string => Boolean(part?.trim()))
      .join(" ")
      .trim() || "สมาชิก"
  );
}

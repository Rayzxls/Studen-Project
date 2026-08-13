"use client";

import {
  FormEvent,
  KeyboardEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { MessageCircle, Send, ShieldBan } from "lucide-react";

import { UserAvatar } from "@/components/profile/user-avatar";
import { ReportContentButton } from "@/components/moderation/report-content-button";

export type CourseChannelMessage = {
  id: string;
  author: {
    userId: string;
    firstName: string | null;
    lastName: string | null;
    profileImageId: string | null;
  } | null;
  body: string | null;
  createdAt: string;
  deleted: boolean;
};

type MessagesResponse = {
  conversationId: string | null;
  messages: CourseChannelMessage[];
};

const POLL_INTERVAL_MS = 5_000;
const MAX_LENGTH = 4_000;

export function CourseChannel({
  courseId,
  currentUserId,
  initialMessages,
  readOnly = false,
  endpoint,
  title = "แชตประจำวิชา",
  subtitle = "ครูและสมาชิกที่ยังอยู่ในวิชานี้เท่านั้น",
  reportingEnabled = false,
  initialBlocked = false,
  initialBlockedByMe = false,
}: {
  courseId: string;
  currentUserId: string;
  initialMessages: CourseChannelMessage[];
  readOnly?: boolean;
  endpoint?: string;
  title?: string;
  subtitle?: string;
  reportingEnabled?: boolean;
  initialBlocked?: boolean;
  initialBlockedByMe?: boolean;
}) {
  const [messages, setMessages] = useState(initialMessages);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [blocked, setBlocked] = useState(initialBlocked);
  const [blockedByMe, setBlockedByMe] = useState(initialBlockedByMe);
  const [changingBlock, setChangingBlock] = useState(false);
  const lastMessageIdRef = useRef(initialMessages.at(-1)?.id);
  const endRef = useRef<HTMLDivElement>(null);
  const messagesEndpoint =
    endpoint ?? `/api/chat/course/${encodeURIComponent(courseId)}/messages`;

  const mergeMessages = useCallback((incoming: CourseChannelMessage[]) => {
    if (incoming.length === 0) return;
    setMessages((current) => {
      const seen = new Set(current.map((message) => message.id));
      return [
        ...current,
        ...incoming.filter((message) => !seen.has(message.id)),
      ];
    });
    lastMessageIdRef.current = incoming.at(-1)?.id ?? lastMessageIdRef.current;
  }, []);

  const poll = useCallback(async () => {
    if (document.visibilityState !== "visible" || !document.hasFocus()) return;
    const after = lastMessageIdRef.current;
    const query = after ? `?after=${encodeURIComponent(after)}` : "";
    try {
      const response = await fetch(`${messagesEndpoint}${query}`, {
        cache: "no-store",
      });
      if (!response.ok) throw new Error("poll_failed");
      const result = (await response.json()) as MessagesResponse;
      mergeMessages(result.messages);
      setError(null);
    } catch {
      setError("เชื่อมต่อแชตไม่ได้ชั่วคราว ระบบจะลองใหม่อัตโนมัติ");
    }
  }, [mergeMessages, messagesEndpoint]);

  useEffect(() => {
    const timer = window.setInterval(poll, POLL_INTERVAL_MS);
    const onFocus = () => void poll();
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") void poll();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [poll]);

  useEffect(() => {
    endRef.current?.scrollIntoView?.({ block: "end" });
  }, [messages.length]);

  async function submit(event?: FormEvent) {
    event?.preventDefault();
    const trimmed = body.trim();
    if (!trimmed || sending || readOnly || blocked) return;
    setSending(true);
    setError(null);
    try {
      const response = await fetch(messagesEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: trimmed }),
      });
      const result = (await response.json()) as CourseChannelMessage | ApiError;
      if (!response.ok) throw new Error(messageFromError(result));
      mergeMessages([result as CourseChannelMessage]);
      setBody("");
    } catch (caught) {
      setError(
        caught instanceof Error && caught.message !== "[object Object]"
          ? caught.message
          : "ส่งข้อความไม่สำเร็จ กรุณาลองอีกครั้ง"
      );
    } finally {
      setSending(false);
    }
  }

  async function changeBlock() {
    if (!endpoint || changingBlock) return;
    const next = !blockedByMe;
    setChangingBlock(true);
    setError(null);
    try {
      const response = await fetch(
        `${endpoint.replace(/\/messages$/, "")}/block`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ blocked: next }),
        }
      );
      if (!response.ok) throw new Error("เปลี่ยนสถานะการบล็อกไม่สำเร็จ");
      const result = (await response.json()) as {
        blocked: boolean;
        blockedByMe: boolean;
      };
      setBlocked(result.blocked);
      setBlockedByMe(result.blockedByMe);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "เปลี่ยนสถานะการบล็อกไม่สำเร็จ"
      );
    } finally {
      setChangingBlock(false);
    }
  }

  function onComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void submit();
    }
  }

  return (
    <section className="overflow-hidden rounded-3xl border border-black/[0.07] bg-surface shadow-card">
      <header className="flex items-center justify-between gap-4 border-b border-black/[0.06] px-4 py-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
            <MessageCircle className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold text-ink">
              {title}
            </h2>
            <p className="truncate text-xs text-ink-mute">{subtitle}</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {endpoint && (
            <button
              type="button"
              className={`btn-sm inline-flex items-center gap-1.5 rounded-xl border px-3 ${
                blockedByMe
                  ? "border-blue-200 bg-blue-50 text-blue-700"
                  : "border-black/[0.08] bg-surface text-ink-mute hover:text-red-700"
              }`}
              onClick={changeBlock}
              disabled={changingBlock}
            >
              <ShieldBan className="h-4 w-4" aria-hidden="true" />
              {blockedByMe ? "เลิกบล็อก" : "บล็อก"}
            </button>
          )}
          <span className="hidden items-center gap-1.5 text-xs text-ink-mute sm:inline-flex">
            <span
              className="h-2 w-2 rounded-full bg-emerald-500"
              aria-hidden="true"
            />
            อัปเดตอัตโนมัติ
          </span>
        </div>
      </header>

      <div
        className="h-[min(58vh,620px)] min-h-[360px] overflow-y-auto overscroll-contain bg-bg/45 px-3 py-5 sm:px-6"
        aria-label="ข้อความในวิชา"
      >
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center px-5 text-center">
            <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
              <MessageCircle className="h-7 w-7" aria-hidden="true" />
            </span>
            <h3 className="font-semibold text-ink">เริ่มบทสนทนาในวิชานี้</h3>
            <p className="mt-1 max-w-sm text-sm leading-6 text-ink-mute">
              ใช้ถามเรื่องบทเรียน นัดหมาย หรือแจ้งข้อมูลสั้น ๆ
              ที่ทุกคนในวิชาเห็นร่วมกัน
            </p>
          </div>
        ) : (
          <div
            className="space-y-3"
            aria-live="polite"
            aria-relevant="additions"
          >
            {messages.map((message) => (
              <MessageBubble
                key={message.id}
                message={message}
                mine={message.author?.userId === currentUserId}
                reportingEnabled={reportingEnabled}
              />
            ))}
            <div ref={endRef} />
          </div>
        )}
      </div>

      <footer className="border-t border-black/[0.06] bg-surface p-3 sm:p-4">
        {readOnly || blocked ? (
          <p className="rounded-2xl bg-black/[0.035] px-4 py-3 text-center text-sm text-ink-mute">
            {blocked
              ? blockedByMe
                ? "คุณบล็อกสมาชิกคนนี้อยู่ เลิกบล็อกก่อนจึงจะส่งข้อความได้"
                : "การสนทนานี้ถูกบล็อก จึงส่งข้อความใหม่ไม่ได้"
              : "วิชานี้ถูกเก็บแล้ว จึงอ่านประวัติได้แต่ส่งข้อความใหม่ไม่ได้"}
          </p>
        ) : (
          <form onSubmit={submit} className="flex items-end gap-2 sm:gap-3">
            <label className="sr-only" htmlFor="course-chat-message">
              พิมพ์ข้อความ
            </label>
            <textarea
              id="course-chat-message"
              value={body}
              onChange={(event) =>
                setBody(event.target.value.slice(0, MAX_LENGTH))
              }
              onKeyDown={onComposerKeyDown}
              rows={1}
              maxLength={MAX_LENGTH}
              placeholder="พิมพ์ข้อความ…"
              className="min-h-11 max-h-36 min-w-0 flex-1 resize-y rounded-2xl border border-black/[0.1] bg-bg px-4 py-2.5 text-sm text-ink outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
              disabled={sending}
            />
            <button
              type="submit"
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-sm transition hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-500/25 disabled:cursor-not-allowed disabled:opacity-45"
              disabled={sending || body.trim().length === 0}
              aria-label={sending ? "กำลังส่งข้อความ" : "ส่งข้อความ"}
            >
              <Send className="h-4.5 w-4.5" aria-hidden="true" />
            </button>
          </form>
        )}
        <div className="mt-2 flex min-h-5 items-start justify-between gap-3 px-1 text-xs">
          <p className="text-ink-mute">
            Enter เพื่อส่ง · Shift+Enter เพื่อขึ้นบรรทัดใหม่
          </p>
          <span className="shrink-0 text-ink-mute">
            {body.length.toLocaleString("th-TH")}/4,000
          </span>
        </div>
        {error && (
          <p
            role="alert"
            className="mt-2 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700"
          >
            {error}
          </p>
        )}
      </footer>
    </section>
  );
}

function MessageBubble({
  message,
  mine,
  reportingEnabled,
}: {
  message: CourseChannelMessage;
  mine: boolean;
  reportingEnabled: boolean;
}) {
  const name = personName(message.author);
  return (
    <article
      className={`flex items-end gap-2 ${mine ? "flex-row-reverse" : ""}`}
    >
      {message.author ? (
        <UserAvatar
          userId={message.author.userId}
          hasImage={message.author.profileImageId !== null}
          version={message.author.profileImageId}
          size={30}
          alt={name}
        />
      ) : (
        <span
          className="h-[30px] w-[30px] shrink-0 rounded-full bg-black/[0.06]"
          aria-hidden="true"
        />
      )}
      <div
        className={`max-w-[82%] sm:max-w-[70%] ${mine ? "items-end" : "items-start"}`}
      >
        {!mine && (
          <p className="mb-1 px-1 text-[11px] font-medium text-ink-mute">
            {name}
          </p>
        )}
        <div
          className={
            "rounded-2xl px-3.5 py-2.5 text-sm leading-6 " +
            (mine
              ? "rounded-br-md bg-blue-600 text-white"
              : "rounded-bl-md border border-black/[0.06] bg-surface text-ink")
          }
        >
          <p
            className={`whitespace-pre-wrap break-words ${message.deleted ? "italic opacity-70" : ""}`}
          >
            {message.deleted || message.body === null
              ? "ข้อความนี้ถูกนำออกแล้ว"
              : message.body}
          </p>
        </div>
        <div
          className={`mt-1 flex items-center gap-1 px-1 ${mine ? "justify-end" : ""}`}
        >
          <time
            className="text-[10px] text-ink-mute"
            dateTime={message.createdAt}
          >
            {formatMessageTime(message.createdAt)}
          </time>
          {reportingEnabled && !mine && !message.deleted && (
            <ReportContentButton
              targetType="CHAT_MESSAGE"
              targetId={message.id}
              compact
            />
          )}
        </div>
      </div>
    </article>
  );
}

type ApiError = {
  error?: { message?: string; details?: { body?: string }; code?: string };
};

function messageFromError(value: CourseChannelMessage | ApiError): string {
  if (!("error" in value)) return "ส่งข้อความไม่สำเร็จ กรุณาลองอีกครั้ง";
  if (value.error?.details?.body) return value.error.details.body;
  if (value.error?.code === "chat_send_rate_limited") {
    return "ส่งข้อความถี่เกินไป กรุณารอสักครู่แล้วลองใหม่";
  }
  return "ส่งข้อความไม่สำเร็จ กรุณาลองอีกครั้ง";
}

function personName(author: CourseChannelMessage["author"]): string {
  if (!author) return "อดีตสมาชิก";
  const name = [author.firstName, author.lastName]
    .filter((part): part is string => Boolean(part?.trim()))
    .join(" ")
    .trim();
  return name || "สมาชิก";
}

function formatMessageTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("th-TH", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: "Asia/Bangkok",
  }).format(date);
}

"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useChat, useLocalParticipant } from "@livekit/components-react";
import { SendHorizonal } from "lucide-react";

/** Long enough for a question, short enough not to become a wall. */
const MAX_LENGTH = 500;

/**
 * The class's side channel while the lesson is running (ADR-0055).
 *
 * Not the course Channel from ADR-0050. This is Zoom's in-meeting chat: typed,
 * read, gone. Messages ride the stage's own data channel between browsers —
 * there is no table, no row, and nothing survives a refresh. When the room
 * closes the conversation has already ceased to exist.
 *
 * It renders through a portal because it belongs in the right rail beside the
 * roster, while the connection it needs lives inside the stage. The alternative
 * was passing the whole rail down into the stage, which would have put the
 * roster somewhere it has no reason to be.
 */
export function RoomChat({ container }: { container: HTMLElement | null }) {
  const { chatMessages, send, isSending } = useChat();
  const { localParticipant } = useLocalParticipant();
  const [draft, setDraft] = useState("");
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "nearest" });
  }, [chatMessages.length]);

  if (!container) return null;

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const text = draft.trim();
    if (text.length === 0 || isSending) return;
    setDraft("");
    void send(text).catch(() => {
      // Put it back rather than swallowing what someone typed.
      setDraft(text);
    });
  };

  return createPortal(
    <div className="mt-4 border-t border-hairline pt-3">
      <p className="text-xs text-ink-mute">แชทในคาบ</p>

      <div className="mt-2 max-h-64 space-y-2 overflow-y-auto">
        {chatMessages.length === 0 ? (
          <p className="text-xs leading-5 text-ink-mute">
            ข้อความจะหายไปเมื่อจบคาบ และไม่ถูกบันทึกไว้
          </p>
        ) : (
          chatMessages.map((message) => {
            const mine = message.from?.identity === localParticipant.identity;
            return (
              <div key={`${message.timestamp}-${message.from?.identity}`}>
                <p className="text-[11px] text-ink-mute">
                  {mine ? "คุณ" : (message.from?.name ?? "ไม่ทราบชื่อ")}
                </p>
                <p
                  className={
                    "mt-0.5 whitespace-pre-wrap break-words rounded-lg px-2.5 py-1.5 text-sm " +
                    (mine
                      ? "bg-blue-50 text-blue-700"
                      : "bg-surface text-ink ring-1 ring-hairline")
                  }
                >
                  {message.message}
                </p>
              </div>
            );
          })
        )}
        <div ref={endRef} />
      </div>

      <form onSubmit={submit} className="mt-3 flex items-center gap-2">
        <label htmlFor="room-chat-input" className="sr-only">
          พิมพ์ข้อความถึงคนในห้อง
        </label>
        <input
          id="room-chat-input"
          value={draft}
          onChange={(event) =>
            setDraft(event.target.value.slice(0, MAX_LENGTH))
          }
          maxLength={MAX_LENGTH}
          placeholder="พิมพ์…"
          className="input min-h-10 flex-1 text-sm"
        />
        <button
          type="submit"
          disabled={isSending || draft.trim().length === 0}
          aria-label="ส่งข้อความ"
          className="grid min-h-10 w-10 shrink-0 place-items-center rounded-full border border-hairline-strong text-ink transition-colors hover:bg-black/[0.04] disabled:opacity-50"
        >
          <SendHorizonal className="h-4 w-4" aria-hidden="true" />
        </button>
      </form>
    </div>,
    container
  );
}

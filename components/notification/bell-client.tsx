"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { ArrowUpRight, Bell as BellIcon, BellOff } from "lucide-react";
import { NotificationIcon } from "./bell-icon";
import { RelativeTime } from "./relative-time";
import {
  markAllReadAction,
  markReadAndNavigate,
  markVisibleReadAction,
} from "./actions";

export interface BellClientItem {
  id: string;
  destinationLabel: string;
  createdAtIso: string;
  readAtIso: string | null;
  preview: {
    iconKey: string;
    bold: string;
    meta: string;
  };
}

export function BellClient({
  initialUnreadCount,
  items,
}: {
  initialUnreadCount: number;
  items: BellClientItem[];
}) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const markingRef = useRef(false);
  const [, startTransition] = useTransition();
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount);
  const [readIds, setReadIds] = useState<Set<string>>(
    () =>
      new Set(
        items.filter((item) => item.readAtIso !== null).map((item) => item.id)
      )
  );

  const hasItems = items.length > 0;
  const visibleUnreadIds = useMemo(
    () => items.filter((item) => !readIds.has(item.id)).map((item) => item.id),
    [items, readIds]
  );
  const visibleUnreadCount = visibleUnreadIds.length;
  const showMarkAll = unreadCount > visibleUnreadCount;
  const badge = unreadCount > 99 ? "99+" : String(unreadCount);

  const markVisibleRead = useCallback(() => {
    if (markingRef.current || visibleUnreadIds.length === 0) return;

    const ids = visibleUnreadIds;
    markingRef.current = true;
    setReadIds((previous) => {
      const next = new Set(previous);
      ids.forEach((id) => next.add(id));
      return next;
    });
    setUnreadCount((previous) => Math.max(0, previous - ids.length));

    startTransition(() => {
      void markVisibleReadAction(ids)
        .then(({ marked }) => {
          if (marked !== ids.length) {
            setUnreadCount((previous) =>
              Math.max(0, previous + ids.length - marked)
            );
          }
        })
        .catch(() => {
          setReadIds((previous) => {
            const next = new Set(previous);
            ids.forEach((id) => next.delete(id));
            return next;
          });
          setUnreadCount((previous) => previous + ids.length);
        })
        .finally(() => {
          markingRef.current = false;
        });
    });
  }, [startTransition, visibleUnreadIds]);

  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;

    const handleToggle = () => {
      if (panel.matches(":popover-open")) {
        markVisibleRead();
      }
    };

    panel.addEventListener("toggle", handleToggle);
    return () => {
      panel.removeEventListener("toggle", handleToggle);
    };
  }, [markVisibleRead]);

  return (
    <>
      <button
        type="button"
        popoverTarget="notification-bell-panel"
        aria-label="การแจ้งเตือน"
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-full text-black/70 transition-colors hover:bg-black/[0.05] hover:text-black"
      >
        <BellIcon className="h-5 w-5" aria-hidden="true" />
        {unreadCount > 0 && (
          <span className="absolute right-0.5 top-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-black px-1 text-[10px] font-medium leading-none text-white">
            {badge}
          </span>
        )}
      </button>

      <div
        ref={panelRef}
        id="notification-bell-panel"
        popover="auto"
        className="bell-popover fixed left-4 right-4 top-16 z-40 m-0 max-h-[min(32rem,calc(100vh-5rem))] w-[unset] overflow-hidden rounded-2xl border border-black/[0.06] bg-white p-0 shadow-lift backdrop:bg-transparent md:left-[unset] md:right-4 md:w-96"
      >
        <div className="flex items-center justify-between gap-2 border-b border-black/[0.06] px-4 py-3">
          <div>
            <h2
              className="text-sm font-medium text-black"
              style={{ letterSpacing: "-0.01em" }}
            >
              การแจ้งเตือน
            </h2>
            {hasItems && (
              <p className="text-[11px] text-black/50">
                {unreadCount > 0
                  ? `ยังไม่อ่าน ${unreadCount} รายการ`
                  : "อ่านทั้งหมดแล้ว"}
              </p>
            )}
          </div>
          {showMarkAll && (
            <form action={markAllReadAction}>
              <button type="submit" className="btn-ghost btn-sm">
                ทำเครื่องหมายว่าอ่านทั้งหมด
              </button>
            </form>
          )}
        </div>

        {!hasItems ? (
          <div className="px-6 py-10 text-center">
            <BellOff
              className="mx-auto mb-3 h-8 w-8 text-black/20"
              aria-hidden="true"
            />
            <p className="text-sm font-medium text-black">
              ยังไม่มีการแจ้งเตือน
            </p>
            <p className="mt-1 text-xs text-black/50">
              การแจ้งเตือนใหม่จะปรากฏที่นี่
            </p>
          </div>
        ) : (
          <ul className="max-h-[26rem] overflow-y-auto">
            {items.map((item) => {
              const isUnread = !readIds.has(item.id);
              return (
                <li
                  key={item.id}
                  className="border-b border-black/[0.04] last:border-b-0"
                >
                  <form action={markReadAndNavigate}>
                    <input
                      type="hidden"
                      name="notificationId"
                      value={item.id}
                    />
                    <button
                      type="submit"
                      className={
                        "group flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-black/[0.035] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500 " +
                        (isUnread ? "" : "opacity-60")
                      }
                    >
                      <span className="relative mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-black/[0.04] text-black/70">
                        <NotificationIcon
                          iconKey={item.preview.iconKey}
                          className="h-4 w-4"
                        />
                        {isUnread && (
                          <span
                            className="absolute -left-1 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-black"
                            aria-label="ยังไม่อ่าน"
                          />
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-black">
                          {item.preview.bold}
                        </span>
                        <span className="mt-0.5 flex items-center gap-1 text-[11px] text-black/50">
                          {item.preview.meta && (
                            <>
                              <span className="truncate">
                                {item.preview.meta}
                              </span>
                              <span aria-hidden="true">·</span>
                            </>
                          )}
                          <span className="shrink-0">
                            <RelativeTime iso={item.createdAtIso} />
                          </span>
                        </span>
                      </span>
                      <span className="ml-1 inline-flex shrink-0 self-center items-center gap-1 rounded-full bg-blue-50 px-2 py-1 text-[10px] font-medium text-blue-700 transition-colors group-hover:bg-blue-100">
                        {item.destinationLabel}
                        <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
                      </span>
                    </button>
                  </form>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </>
  );
}

import { Bell as BellIcon, BellOff } from "lucide-react";
import type { Role } from "@prisma/client";
import {
  countUnreadNotifications,
  listNotificationsForRecipient,
} from "@/lib/notification";
import { buildNotificationPreview } from "@/lib/notification/preview";
import { resolveNotificationHref } from "@/lib/notification/navigation";
import { NotificationIcon } from "./bell-icon";
import { RelativeTime } from "./relative-time";
import { markReadAndNavigate, markAllReadAction } from "./actions";

/**
 * Notification bell — Phase 7 · P7-5
 *
 * Server Component. Fetches the unread count + the 20 most recent
 * non-suppressed notifications for the signed-in recipient (Q3 lock =
 * eager render), builds per-row preview + href server-side (Q5.2 lock
 * = c), and renders an HTML popover panel (Q4 lock = A, no Pattern-7
 * dialog).
 *
 * Children:
 *  - trigger button (with optional unread dot indicator)
 *  - popover panel anchored with CSS (mobile-first full-width, desktop
 *    anchored at right; positioning via plain CSS)
 *  - per-row form posting to `markReadAndNavigate` → redirect to href
 *  - "ทำเครื่องหมายว่าอ่านทั้งหมด" (top-right, conditional)
 *  - empty state (Q10.1 lock = A illustrated)
 */
export async function Bell({ userId, role }: { userId: string; role: Role }) {
  const [unreadCount, page] = await Promise.all([
    countUnreadNotifications(userId),
    listNotificationsForRecipient({ recipientId: userId }),
  ]);

  const items = page.items;
  const hasItems = items.length > 0;
  const showMarkAll = unreadCount > 0;
  const badge = unreadCount > 99 ? "99+" : String(unreadCount);

  return (
    <>
      <button
        type="button"
        // React 19 normalises the HTML popover anchor attribute as
        // camelCase `popoverTarget`. The popover API itself is browser-
        // native and doesn't need client JS to open/close.
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
            {items.map((n) => {
              const preview = buildNotificationPreview({
                kind: n.kind,
                payload: n.payloadJson,
              });
              const href = resolveNotificationHref({
                kind: n.kind,
                role,
                courseOfferingId: n.courseOfferingId,
                sourceEntityId: n.sourceEntityId,
                payload: n.payloadJson,
              });
              const isUnread = n.readAt === null;
              return (
                <li
                  key={n.id}
                  className="border-b border-black/[0.04] last:border-b-0"
                >
                  <form action={markReadAndNavigate}>
                    <input type="hidden" name="notificationId" value={n.id} />
                    <input type="hidden" name="href" value={href} />
                    <button
                      type="submit"
                      className={
                        "flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-black/[0.025] " +
                        (isUnread ? "" : "opacity-60")
                      }
                    >
                      <span className="relative mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-black/[0.04] text-black/70">
                        <NotificationIcon
                          iconKey={preview.iconKey}
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
                          {preview.bold}
                        </span>
                        <span className="mt-0.5 flex items-center gap-1 text-[11px] text-black/50">
                          {preview.meta && (
                            <>
                              <span className="truncate">{preview.meta}</span>
                              <span aria-hidden="true">·</span>
                            </>
                          )}
                          <span className="shrink-0">
                            <RelativeTime iso={n.createdAt.toISOString()} />
                          </span>
                        </span>
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

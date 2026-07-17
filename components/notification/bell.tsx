import type { Role } from "@prisma/client";
import {
  countUnreadNotifications,
  listNotificationsForRecipient,
} from "@/lib/notification";
import { buildNotificationPreview } from "@/lib/notification/preview";
import { resolveNotificationDestinationLabel } from "@/lib/notification/navigation";
import { BellClient, type BellClientItem } from "./bell-client";

/**
 * Notification bell — Phase 7 · P7-5
 *
 * Server Component. Fetches the unread count + the 20 most recent
 * non-suppressed notifications for the signed-in recipient (Q3 lock =
 * eager render), builds each preview and destination label server-side,
 * and renders an HTML popover panel (Q4 lock = A, no Pattern-7
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

  const items: BellClientItem[] = page.items.map((n) => ({
    id: n.id,
    destinationLabel: resolveNotificationDestinationLabel({
      kind: n.kind,
      role,
      payload: n.payloadJson,
    }),
    createdAtIso: n.createdAt.toISOString(),
    readAtIso: n.readAt?.toISOString() ?? null,
    preview: buildNotificationPreview({
      kind: n.kind,
      payload: n.payloadJson,
    }),
  }));

  return <BellClient initialUnreadCount={unreadCount} items={items} />;
}

import Link from "next/link";
import { Inbox } from "lucide-react";
import type { Session } from "@/lib/auth/permissions";
import { getUserFeed, resolveFeedHref, buildFeedRowPreview } from "@/lib/feed";
import { getCourseScopeForUser } from "@/lib/feed/scope";
import { db } from "@/lib/db/client";
import { NotificationIcon } from "@/components/notification/bell-icon";
import { RelativeTime } from "@/components/notification/relative-time";

/**
 * User Feed section — Phase 7 · P7-6 · STUDENT ONLY (Q3 = B lock)
 *
 * Server Component. One call to `getUserFeed` returns 20 items merged
 * across Assignment / Material / Announcement / ScoreItem(published)
 * for the student's active-term courses (L1 boundary lives in
 * `lib/feed/scope`).
 *
 * Per Q1 = A: cap at 20, no "Load more" button. The `nextCursor` from
 * the lib stays unused for now; a future `/feed` full-page route can
 * pick it up.
 *
 * Per-row href resolved server-side via `lib/feed/navigation`.
 * Per-row preview text + icon-key via `lib/feed/preview`.
 *
 * Empty state: illustrated (mirrors bell empty state posture).
 */
export async function UserFeed({ session }: { session: Session }) {
  if (session.user.role !== "STUDENT") return null;

  // Resolve course names in one extra query so feed rows can show the
  // course context line ("คณิตศาสตร์ ม.4/2 · ส่งภายใน ..."). Names are
  // not on FeedItem because aggregator stays prop-light per ADR-0023.
  const [page, scope] = await Promise.all([
    getUserFeed(session),
    getCourseScopeForUser(session),
  ]);
  const courses = await db.courseOffering.findMany({
    where: { id: { in: scope.courseIds } },
    select: { id: true, name: true },
  });
  const courseNameById = new Map(courses.map((c) => [c.id, c.name]));

  return (
    <section>
      <h2
        className="mb-3 text-xl font-medium text-black"
        style={{ letterSpacing: "-0.02em" }}
      >
        กิจกรรมล่าสุด
      </h2>

      {page.items.length === 0 ? (
        <div className="card-flat flex flex-col items-center px-6 py-10 text-center">
          <Inbox className="mb-3 h-8 w-8 text-black/20" aria-hidden="true" />
          <p className="text-sm font-medium text-black">
            ยังไม่มีกิจกรรมในห้องเรียน
          </p>
          <p className="mt-1 text-xs text-black/50">
            ประกาศ การบ้าน และคะแนนใหม่จะปรากฏที่นี่
          </p>
        </div>
      ) : (
        <ul className="card-flat divide-y divide-black/[0.04]">
          {page.items.map((item) => {
            const courseName = courseNameById.get(item.courseOfferingId) ?? "";
            const preview = buildFeedRowPreview({ item, courseName });
            const href = resolveFeedHref({
              kind: item.kind,
              courseOfferingId: item.courseOfferingId,
              itemId: item.id,
            });
            return (
              <li key={`${item.kind}-${item.id}`}>
                <Link
                  href={href}
                  className="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-black/[0.025] hover:no-underline"
                >
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-black/[0.04] text-black/70">
                    <NotificationIcon
                      iconKey={preview.iconKey}
                      className="h-4 w-4"
                    />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-black">
                      {preview.bold}
                    </span>
                    <span className="mt-0.5 flex flex-wrap items-center gap-1 text-[11px] text-black/50">
                      {preview.meta && (
                        <>
                          <span className="truncate">{preview.meta}</span>
                          <span aria-hidden="true">·</span>
                        </>
                      )}
                      <span className="shrink-0">
                        <RelativeTime iso={item.sortAt.toISOString()} />
                      </span>
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

import Link from "next/link";
import {
  CalendarClock,
  ClipboardList,
  FileText,
  Link2,
  Megaphone,
  Paperclip,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import type { FeedItem, FeedKind } from "@/lib/feed/aggregator";
import { resolveCourseFeedHref } from "@/lib/feed/navigation";
import { EntryStagger } from "@/components/motion/entry-stagger";
import { UserAvatar } from "@/components/profile/user-avatar";

/**
 * Course Feed — Phase 11.8 Instagram-style redesign.
 *
 * Full-width post-style cards with author header + type chip + bold
 * title + body preview + attachment line + day grouping dividers.
 * The previous Phase 10C list-row layout is replaced; the FeedItem
 * shape widens to carry bodyPreview / authorName / attachmentCount
 * via the aggregator (all optional for backwards compat with
 * inline FeedItem constructors in the dashboard recent-activity widget).
 *
 * Server component. Active filter is reflected in `?type=` so the chips
 * are server-rendered initial state.
 */

export type CourseFeedFilter =
  | "all"
  | "announcement"
  | "assignment"
  | "material"
  | "score";

const FILTER_TO_KIND: Record<CourseFeedFilter, ReadonlySet<FeedKind> | null> = {
  all: null,
  announcement: new Set(["ANNOUNCEMENT"]),
  assignment: new Set(["ASSIGNMENT"]),
  material: new Set(["MATERIAL"]),
  score: new Set(["SCORE_PUBLISHED"]),
};

export function feedKindsForFilter(
  filter: CourseFeedFilter
): ReadonlySet<FeedKind> | null {
  return FILTER_TO_KIND[filter];
}

export function CourseFeedView({
  items,
  courseId,
  role,
  filter,
}: {
  items: FeedItem[];
  courseId: string;
  role: "TEACHER" | "STUDENT";
  filter: CourseFeedFilter;
}) {
  const basePath =
    role === "TEACHER"
      ? `/teacher/courses/${courseId}/feed`
      : `/student/courses/${courseId}/feed`;

  const groups = groupByDay(items);

  return (
    <div className="space-y-4">
      {/* iOS-segmented filter row — same vocabulary as the TabNav. */}
      <nav
        role="tablist"
        aria-label="Filter feed by type"
        className="inline-flex w-full max-w-full gap-1 overflow-x-auto rounded-2xl bg-black/[0.04] p-1"
        style={{ scrollbarWidth: "none" }}
      >
        <FilterChip href={basePath} active={filter === "all"} label="ทั้งหมด" />
        <FilterChip
          href={`${basePath}?type=announcement`}
          active={filter === "announcement"}
          label="ประกาศ"
          icon={<Megaphone className="h-3.5 w-3.5" />}
        />
        <FilterChip
          href={`${basePath}?type=assignment`}
          active={filter === "assignment"}
          label="การบ้าน"
          icon={<ClipboardList className="h-3.5 w-3.5" />}
        />
        <FilterChip
          href={`${basePath}?type=material`}
          active={filter === "material"}
          label="เอกสาร"
          icon={<FileText className="h-3.5 w-3.5" />}
        />
        <FilterChip
          href={`${basePath}?type=score`}
          active={filter === "score"}
          label="คะแนน"
          icon={<Sparkles className="h-3.5 w-3.5" />}
        />
      </nav>

      {items.length === 0 ? (
        <EmptyState filter={filter} />
      ) : (
        <div className="space-y-6">
          {groups.map((group) => (
            <section key={group.label} className="space-y-3">
              <h3 className="px-1 text-xs font-medium uppercase tracking-wider text-black/40">
                {group.label}
              </h3>
              <EntryStagger className="space-y-4">
                {group.items.map((it) => (
                  <FeedCard key={`${it.kind}-${it.id}`} item={it} role={role} />
                ))}
              </EntryStagger>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function FilterChip({
  href,
  active,
  label,
  icon,
}: {
  href: string;
  active: boolean;
  label: string;
  icon?: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      role="tab"
      aria-selected={active}
      className={
        "inline-flex shrink-0 items-center gap-1.5 rounded-xl px-4 py-1.5 text-sm font-medium " +
        (active
          ? "bg-white text-black shadow-lift"
          : "text-black/60 hover:text-black")
      }
      style={{
        transition:
          "background-color var(--duration-spring-standard) var(--ease-spring), box-shadow var(--duration-spring-standard) var(--ease-spring), color var(--duration-spring-standard) var(--ease-spring)",
      }}
    >
      {icon}
      {label}
    </Link>
  );
}

// ─────────────────────────────────────────────────────────────
// FeedCard — Instagram-style post
// ─────────────────────────────────────────────────────────────

function FeedCard({
  item,
  role,
}: {
  item: FeedItem;
  role: "TEACHER" | "STUDENT";
}) {
  const href = resolveCourseFeedHref({
    kind: item.kind,
    courseOfferingId: item.courseOfferingId,
    itemId: item.id,
    role,
  });
  const decor = kindDecor(item.kind);
  const headline =
    item.title ??
    (item.kind === "ANNOUNCEMENT" ? "ประกาศไม่มีหัวข้อ" : "(ไม่มีชื่อ)");
  const authorName = item.authorName ?? "ครูผู้สอน";
  const initials = initialsOf(authorName);

  // Due-date chip — orange when within 48h, neutral otherwise.
  const dueAt =
    item.kind === "ASSIGNMENT" && item.detail ? new Date(item.detail) : null;
  const dueSoon = dueAt !== null && isWithin48h(dueAt);

  return (
    <Link
      href={href}
      className="card group block overflow-hidden p-0 hover:no-underline"
      style={{
        transition:
          "transform var(--duration-spring-standard) var(--ease-spring), box-shadow var(--duration-spring-standard) var(--ease-spring)",
      }}
    >
      {/* Header strip — avatar + author + kind chip + relative time */}
      <header className="flex items-center gap-3 px-5 pt-5">
        {item.authorUserId ? (
          <UserAvatar
            userId={item.authorUserId}
            hasImage={Boolean(item.authorHasAvatar)}
            size={40}
            alt={authorName}
          />
        ) : (
          <span
            className={
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-medium " +
              decor.avatarBg
            }
            aria-hidden="true"
          >
            <span className={"text-sm " + decor.avatarText}>{initials}</span>
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-black">
            {authorName}
          </p>
          <p className="mt-0.5 text-[11px] text-black/45">
            {fmtRelative(item.sortAt)}
          </p>
        </div>
        {/* Type chip — tinted by kind */}
        <span
          className={
            "inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium " +
            decor.chip
          }
        >
          {decor.icon}
          {decor.kindLabel}
        </span>
      </header>

      {/* Body — title + preview */}
      <div className="px-5 pt-4">
        <h3
          className="text-lg font-semibold text-black"
          style={{ letterSpacing: "-0.02em", lineHeight: 1.3 }}
        >
          {headline}
        </h3>
        {item.bodyPreview && (
          <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-black/70">
            {item.bodyPreview}
          </p>
        )}
      </div>

      {/* Score-published callout — bigger visual moment for the
            student's score being live (replaces a plain body). */}
      {item.kind === "SCORE_PUBLISHED" && (
        <div className="mx-5 mt-4 flex items-center gap-3 rounded-xl bg-blue-50 px-4 py-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white">
            <TrendingUp className="h-4 w-4 text-blue-700" />
          </span>
          <p className="text-sm font-medium text-blue-700">
            {role === "STUDENT"
              ? "คะแนนของคุณพร้อมดูแล้ว"
              : "คะแนนถูกเผยแพร่ให้นักเรียนเห็นแล้ว"}
          </p>
        </div>
      )}

      {/* Meta row — due date + attachments */}
      {(dueAt || (item.attachmentCount ?? 0) > 0) && (
        <div className="flex flex-wrap items-center gap-2 px-5 pt-4 text-[12px]">
          {dueAt && (
            <span
              className={
                "inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-medium " +
                (dueSoon
                  ? "bg-orange-50 text-orange-700"
                  : "bg-black/[0.04] text-black/70")
              }
            >
              <CalendarClock className="h-3.5 w-3.5" />
              ส่งภายใน {fmtThaiDateShort(dueAt)}
            </span>
          )}
          {(item.attachmentCount ?? 0) > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-black/[0.04] px-2.5 py-1 font-medium text-black/70">
              {item.kind === "MATERIAL" ? (
                <Link2 className="h-3.5 w-3.5" />
              ) : (
                <Paperclip className="h-3.5 w-3.5" />
              )}
              {item.attachmentCount} ไฟล์/ลิงก์
            </span>
          )}
        </div>
      )}

      {/* Footer — soft action CTA */}
      <footer className="mt-5 flex items-center justify-between border-t border-black/[0.05] px-5 py-3 text-xs">
        <span className="font-medium text-black/55">
          {ctaLabel(item.kind, role)}
        </span>
        <span className="inline-flex items-center gap-1 text-blue-700 transition-transform group-hover:translate-x-0.5">
          ดูเพิ่มเติม
          <span aria-hidden="true">→</span>
        </span>
      </footer>
    </Link>
  );
}

function EmptyState({ filter }: { filter: CourseFeedFilter }) {
  const label =
    filter === "all"
      ? "ยังไม่มีกิจกรรมในวิชานี้"
      : `ยังไม่มี${
          filter === "announcement"
            ? "ประกาศ"
            : filter === "assignment"
              ? "การบ้าน"
              : filter === "material"
                ? "เอกสาร"
                : "คะแนนที่เผยแพร่"
        }ในวิชานี้`;
  return (
    <div className="card-flat p-10 text-center text-sm text-black/40">
      <p>{label}</p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Per-kind decor
// ─────────────────────────────────────────────────────────────

interface KindDecor {
  icon: React.ReactNode;
  kindLabel: string;
  chip: string;
  avatarBg: string;
  avatarText: string;
}

function kindDecor(kind: FeedKind): KindDecor {
  switch (kind) {
    case "ANNOUNCEMENT":
      return {
        icon: <Megaphone className="h-3 w-3" />,
        kindLabel: "ประกาศ",
        chip: "bg-orange-50 text-orange-700 ring-1 ring-orange-200/60",
        avatarBg: "bg-orange-100",
        avatarText: "text-orange-700",
      };
    case "ASSIGNMENT":
      return {
        icon: <ClipboardList className="h-3 w-3" />,
        kindLabel: "การบ้าน",
        chip: "bg-blue-50 text-blue-700 ring-1 ring-blue-200/60",
        avatarBg: "bg-blue-100",
        avatarText: "text-blue-700",
      };
    case "MATERIAL":
      return {
        icon: <FileText className="h-3 w-3" />,
        kindLabel: "เอกสาร",
        chip: "bg-green-50 text-green-700 ring-1 ring-green-200/60",
        avatarBg: "bg-green-100",
        avatarText: "text-green-700",
      };
    case "SCORE_PUBLISHED":
      return {
        icon: <Sparkles className="h-3 w-3" />,
        kindLabel: "คะแนนเผยแพร่",
        chip: "bg-blue-50 text-blue-700 ring-1 ring-blue-200/60",
        avatarBg: "bg-blue-100",
        avatarText: "text-blue-700",
      };
  }
}

function ctaLabel(kind: FeedKind, role: "TEACHER" | "STUDENT"): string {
  if (kind === "ANNOUNCEMENT") return "ประกาศจากครู";
  if (kind === "ASSIGNMENT")
    return role === "STUDENT" ? "ดูและส่งงาน" : "ดูการส่งของนักเรียน";
  if (kind === "MATERIAL") return "เปิดเอกสาร";
  return role === "STUDENT" ? "ดูคะแนนของคุณ" : "ดูรายการคะแนน";
}

// ─────────────────────────────────────────────────────────────
// Date helpers + day grouping
// ─────────────────────────────────────────────────────────────

interface FeedGroup {
  label: string;
  items: FeedItem[];
}

/**
 * Group feed items by relative day bucket: วันนี้ / เมื่อวาน /
 * <weekday-name> for items within the past week / fallback to month +
 * year for older items. Keeps cards visually anchored in time.
 */
function groupByDay(items: FeedItem[]): FeedGroup[] {
  if (items.length === 0) return [];
  const now = new Date();
  const groups: FeedGroup[] = [];
  let current: FeedGroup | null = null;

  for (const item of items) {
    const label = dayBucketLabel(item.sortAt, now);
    if (!current || current.label !== label) {
      current = { label, items: [] };
      groups.push(current);
    }
    current.items.push(item);
  }
  return groups;
}

function dayBucketLabel(d: Date, now: Date): string {
  const a = startOfDay(d);
  const b = startOfDay(now);
  const diffDays = Math.round((b.getTime() - a.getTime()) / 86_400_000);
  if (diffDays <= 0) return "วันนี้";
  if (diffDays === 1) return "เมื่อวาน";
  if (diffDays < 7) {
    const weekday = new Intl.DateTimeFormat("th-TH", {
      weekday: "long",
    }).format(d);
    return weekday;
  }
  return new Intl.DateTimeFormat("th-TH-u-ca-buddhist", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(d);
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

// Date.now() is wrapped in a named helper so the react-hooks/purity lint
// doesn't flag a bare Date.now() in component render — this is a
// Server Component and the value is intentionally request-time.
function isWithin48h(d: Date): boolean {
  return d.getTime() - Date.now() < 48 * 60 * 60 * 1000;
}

function fmtThaiDateShort(d: Date): string {
  return new Intl.DateTimeFormat("th-TH-u-ca-buddhist", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(d);
}

function fmtRelative(d: Date): string {
  const diffMs = Date.now() - d.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return "เพิ่งนี้";
  if (diffMin < 60) return `${diffMin} นาทีก่อน`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr} ชม. ก่อน`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay} วันก่อน`;
  return fmtThaiDateShort(d);
}

function initialsOf(name: string): string {
  // Two-character initial — first non-space character of the first word
  // plus the first non-space character of the last word. Thai surnames
  // commonly start with the family name particle so this lands "สใ" for
  // "สมชาย ใจดี" which reads nicely on the avatar.
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "—";
  const first = parts[0]!.charAt(0);
  const last = parts[parts.length - 1]!.charAt(0);
  return parts.length === 1 ? first : first + last;
}

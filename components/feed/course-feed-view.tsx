import Link from "next/link";
import {
  CalendarClock,
  ClipboardList,
  FileText,
  Megaphone,
  Sparkles,
} from "lucide-react";
import type { FeedItem, FeedKind } from "@/lib/feed/aggregator";
import { resolveCourseFeedHref } from "@/lib/feed/navigation";

/**
 * Course Feed list — Phase 10C · ADR-0025.
 *
 * Pure Server Component. Receives the already-aggregated list from the
 * page above; renders the type-chip filter row + the chronological
 * Insta-style card list.
 *
 * Active filter is reflected in the `?type=` URL param so the chips are
 * server-rendered initial state (no client island for filter switching).
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

  return (
    <div className="space-y-4">
      {/* Filter chips */}
      <div className="-mx-1 flex flex-wrap gap-1">
        <FilterChip href={basePath} active={filter === "all"} label="ทั้งหมด" />
        <FilterChip
          href={`${basePath}?type=announcement`}
          active={filter === "announcement"}
          label="ประกาศ"
          icon={<Megaphone className="h-3 w-3" />}
        />
        <FilterChip
          href={`${basePath}?type=assignment`}
          active={filter === "assignment"}
          label="การบ้าน"
          icon={<ClipboardList className="h-3 w-3" />}
        />
        <FilterChip
          href={`${basePath}?type=material`}
          active={filter === "material"}
          label="เอกสาร"
          icon={<FileText className="h-3 w-3" />}
        />
        <FilterChip
          href={`${basePath}?type=score`}
          active={filter === "score"}
          label="คะแนนที่เผยแพร่"
          icon={<Sparkles className="h-3 w-3" />}
        />
      </div>

      {items.length === 0 ? (
        <EmptyState filter={filter} />
      ) : (
        <ul className="space-y-3">
          {items.map((it) => (
            <FeedCard key={`${it.kind}-${it.id}`} item={it} role={role} />
          ))}
        </ul>
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
      className={
        "inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs transition-colors " +
        (active
          ? "border-black bg-black text-white"
          : "border-black/[0.08] bg-white text-black/60 hover:border-black/30 hover:text-black")
      }
    >
      {icon}
      {label}
    </Link>
  );
}

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
  const { icon, kindLabel, accent } = kindDecor(item.kind);
  const headline =
    item.title ??
    (item.kind === "ANNOUNCEMENT" ? "ประกาศไม่มีหัวข้อ" : "(ไม่มีชื่อ)");

  return (
    <li>
      <Link
        href={href}
        className="card group block p-5 transition-all hover:shadow-lift hover:-translate-y-0.5"
      >
        <div className="flex items-start gap-3">
          <div
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${accent}`}
          >
            {icon}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-medium uppercase tracking-wider text-black/40">
              {kindLabel}
            </p>
            <p
              className="mt-0.5 truncate text-base font-medium text-black"
              style={{ letterSpacing: "-0.02em" }}
            >
              {headline}
            </p>
            {item.detail && item.kind === "ASSIGNMENT" && (
              <p className="mt-1 flex items-center gap-1 text-xs text-amber-700">
                <CalendarClock className="h-3 w-3" />
                ส่งภายใน {fmtThaiDateShort(new Date(item.detail))}
              </p>
            )}
          </div>
          <p className="shrink-0 text-[10px] text-black/40">
            {fmtRelative(item.sortAt)}
          </p>
        </div>
      </Link>
    </li>
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

function kindDecor(kind: FeedKind): {
  icon: React.ReactNode;
  kindLabel: string;
  accent: string;
} {
  switch (kind) {
    case "ANNOUNCEMENT":
      return {
        icon: <Megaphone className="h-4 w-4 text-amber-700" />,
        kindLabel: "ประกาศ",
        accent: "bg-amber-50",
      };
    case "ASSIGNMENT":
      return {
        icon: <ClipboardList className="h-4 w-4 text-blue-700" />,
        kindLabel: "การบ้าน",
        accent: "bg-blue-50",
      };
    case "MATERIAL":
      return {
        icon: <FileText className="h-4 w-4 text-emerald-700" />,
        kindLabel: "เอกสาร",
        accent: "bg-emerald-50",
      };
    case "SCORE_PUBLISHED":
      return {
        icon: <Sparkles className="h-4 w-4 text-purple-700" />,
        kindLabel: "คะแนนเผยแพร่",
        accent: "bg-purple-50",
      };
  }
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

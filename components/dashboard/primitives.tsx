import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight,
  BookOpen,
  ChevronRight,
  type LucideIcon,
} from "lucide-react";
import { CourseColorChip } from "@/components/course/course-color-chip";
import { AnimatedStat } from "@/components/dashboard/animated-stat";
import { UserAvatar } from "@/components/profile/user-avatar";
import { getCourseSlotColors } from "@/lib/theme/course-color";

/**
 * Dashboard primitives — Phase 11 dashboard reshape.
 *
 * One vocabulary for all three role dashboards so the same affordance
 * reads the same everywhere (product register: consistency over surprise):
 *
 *   SectionHeader   — block title + optional "ดูทั้งหมด" action
 *   MetricTile      — KPI tile (icon chip + number + label), optionally a link
 *   ActionRow       — list-row link with meta + trailing slot + chevron
 *   CourseQuickLink — compact course row with the identity colour dot
 *   EmptyState      — teaches the next action instead of "nothing here"
 *
 * All server components. Single elevation level: white surface, hairline
 * border, soft shadow — never a card inside a card.
 */

// ─────────────────────────────────────────────────────────────

export function SectionHeader({
  title,
  count,
  action,
}: {
  title: string;
  count?: number;
  action?: { href: string; label: string };
}) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-3">
      <h2
        className="text-base font-semibold text-black"
        style={{ letterSpacing: "-0.01em" }}
      >
        {title}
        {count !== undefined && (
          <span className="ml-1.5 text-sm font-normal text-black/40">
            {count}
          </span>
        )}
      </h2>
      {action && (
        <Link
          href={action.href}
          className="text-xs font-medium text-blue-700 hover:underline"
        >
          {action.label}
        </Link>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────

export type MetricTone = "neutral" | "blue" | "orange" | "red" | "green";

const TONE_CHIP: Record<MetricTone, string> = {
  neutral: "bg-black/[0.05] text-black/60",
  blue: "bg-blue-50 text-blue-700",
  orange: "bg-orange-50 text-orange-700",
  red: "bg-red-50 text-red-700",
  green: "bg-green-50 text-green-700",
};

const TONE_VALUE: Record<MetricTone, string> = {
  neutral: "text-black",
  blue: "text-black",
  orange: "text-orange-700",
  red: "text-red-700",
  green: "text-green-700",
};

/**
 * KPI tile. `tone` colours the icon chip; the number only takes the tone
 * when it signals attention (orange/red/green) so a wall of tiles never
 * turns into a rainbow.
 */
export function MetricTile({
  icon: Icon,
  label,
  value,
  suffix,
  hint,
  href,
  tone = "neutral",
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  suffix?: string;
  hint?: string;
  href?: string;
  tone?: MetricTone;
}) {
  const inner = (
    <div className="card flex h-full flex-col p-4">
      <div className="flex items-center gap-2.5">
        <span
          className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl ${TONE_CHIP[tone]}`}
        >
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
        <span className="text-xs font-medium text-black/55">{label}</span>
      </div>
      <p
        className={`mt-3 text-2xl font-semibold ${TONE_VALUE[tone]}`}
        style={{ letterSpacing: "-0.02em" }}
      >
        <AnimatedStat value={value} />
        {suffix && (
          <span className="ml-1 text-sm font-medium text-black/40">
            {suffix}
          </span>
        )}
      </p>
      {hint && <p className="mt-0.5 text-[11px] text-black/45">{hint}</p>}
    </div>
  );
  return href ? (
    <Link href={href} className="block hover:no-underline">
      {inner}
    </Link>
  ) : (
    inner
  );
}

// ─────────────────────────────────────────────────────────────

/**
 * One actionable row inside a list block. The whole row is the link;
 * `trailing` carries the status badge or due chip, and the chevron
 * signals "this goes somewhere" without a fake button.
 */
export function ActionRow({
  href,
  title,
  meta,
  leading,
  trailing,
}: {
  href: string;
  title: string;
  meta?: React.ReactNode;
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="group flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-black/[0.03] hover:no-underline"
    >
      {leading}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-black">
          {title}
        </span>
        {meta && (
          <span className="mt-0.5 block truncate text-xs text-black/50">
            {meta}
          </span>
        )}
      </span>
      {trailing && <span className="shrink-0">{trailing}</span>}
      <ChevronRight
        className="h-4 w-4 shrink-0 text-black/25 transition-transform group-hover:translate-x-0.5"
        aria-hidden="true"
      />
    </Link>
  );
}

// ─────────────────────────────────────────────────────────────

/** Compact course row — identity dot + name + context line. */
export function CourseQuickLink({
  href,
  name,
  subtitle,
  classId,
  trailing,
}: {
  href: string;
  name: string;
  subtitle?: string;
  classId: string;
  trailing?: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="group flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-black/[0.03] hover:no-underline"
    >
      <CourseColorChip classId={classId} variant="dot" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-black">
          {name}
        </span>
        {subtitle && (
          <span className="mt-0.5 block truncate text-xs text-black/50">
            {subtitle}
          </span>
        )}
      </span>
      {trailing && (
        <span className="shrink-0 text-xs text-black/45">{trailing}</span>
      )}
      <ChevronRight
        className="h-4 w-4 shrink-0 text-black/25 transition-transform group-hover:translate-x-0.5"
        aria-hidden="true"
      />
    </Link>
  );
}

// ─────────────────────────────────────────────────────────────

export interface CourseShowcaseStat {
  value: React.ReactNode;
  label: string;
}

/**
 * Large course card for the top dashboard area. The visual language mirrors
 * the class profile reference: soft sky banner, overlapping avatar, centered
 * course identity, compact 3-column stats, then a single clear action.
 */
export function CourseShowcaseCard({
  href,
  title,
  subtitle,
  badge,
  notice,
  noticeTone = "muted",
  classId,
  avatarUserId,
  hasAvatar = false,
  avatarAlt = "",
  stats,
  actionLabel,
  menu,
}: {
  href: string;
  title: string;
  subtitle: string;
  badge?: string;
  notice?: string;
  noticeTone?: "muted" | "attention" | "success";
  classId: string;
  avatarUserId?: string;
  hasAvatar?: boolean;
  avatarAlt?: string;
  stats: [CourseShowcaseStat, CourseShowcaseStat, CourseShowcaseStat];
  actionLabel: string;
  menu?: React.ReactNode;
}) {
  const color = getCourseSlotColors(classId);
  const noticeClass =
    noticeTone === "attention"
      ? "text-orange-600"
      : noticeTone === "success"
        ? "text-green-600"
        : "text-black/45";

  return (
    <article className="group relative rounded-[28px] bg-white text-center shadow-[0_18px_48px_rgba(15,23,42,0.08)] ring-1 ring-black/[0.05] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_22px_56px_rgba(15,23,42,0.12)]">
      {menu && <div className="absolute right-4 top-4 z-20">{menu}</div>}
      <Link
        href={href}
        className="block overflow-hidden rounded-[28px] hover:no-underline"
      >
        <div className="relative h-32 overflow-hidden">
          <Image
            src="/brand/cloud-banner.webp"
            alt=""
            fill
            sizes="(max-width: 768px) 100vw, 360px"
            className="object-cover"
          />
          <div
            aria-hidden
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(180deg, rgba(255,255,255,0.02) 0%, rgba(255,255,255,0.88) 100%)",
            }}
          />
          {badge && (
            <span
              className={
                "absolute top-4 rounded-full bg-white/80 px-3 py-1 text-xs font-semibold text-black/55 shadow-sm backdrop-blur " +
                (menu ? "left-4" : "right-4")
              }
            >
              {badge}
            </span>
          )}
        </div>

        <div className="-mt-11 px-6 pb-7">
          <span
            className="relative z-10 mx-auto grid h-[86px] w-[86px] place-items-center rounded-full p-1 shadow-[0_12px_30px_rgba(15,23,42,0.16)]"
            style={{
              background: `linear-gradient(135deg, #0a84ff 0%, ${color.bg} 100%)`,
            }}
          >
            <span className="grid h-full w-full place-items-center overflow-hidden rounded-full bg-white">
              {avatarUserId ? (
                <UserAvatar
                  userId={avatarUserId}
                  hasImage={hasAvatar}
                  size={74}
                  alt={avatarAlt}
                  className="h-[74px] w-[74px] ring-0"
                />
              ) : (
                <Image
                  src="/brand/beagle-avatar.webp"
                  alt=""
                  width={74}
                  height={74}
                  className="h-[74px] w-[74px] object-cover"
                />
              )}
            </span>
          </span>

          <h3
            className="mt-4 truncate text-2xl font-semibold text-black"
            style={{ letterSpacing: "-0.02em" }}
          >
            {title}
          </h3>
          <p className="mt-0.5 truncate text-sm font-medium text-black/35">
            {subtitle}
          </p>
          {notice && (
            <p className={`mt-3 text-sm font-medium ${noticeClass}`}>
              {notice}
            </p>
          )}

          <dl className="mt-6 grid grid-cols-3 overflow-hidden rounded-2xl bg-black/[0.035]">
            {stats.map((stat, index) => (
              <div
                key={stat.label}
                className={
                  "px-3 py-4" +
                  (index > 0 ? " border-l border-black/[0.06]" : "")
                }
              >
                <dt className="text-[11px] font-medium text-black/35">
                  {stat.label}
                </dt>
                <dd
                  className="text-xl font-semibold leading-none text-black"
                  style={{ letterSpacing: "-0.02em" }}
                >
                  {stat.value}
                </dd>
              </div>
            ))}
          </dl>

          <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-blue-700">
            {actionLabel}
            <ArrowRight
              className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
              aria-hidden="true"
            />
          </span>
        </div>
      </Link>
    </article>
  );
}

export function CourseShowcaseEmpty({
  href,
  title,
  hint,
  actionLabel,
}: {
  href: string;
  title: string;
  hint: string;
  actionLabel: string;
}) {
  return (
    <div className="mx-auto max-w-sm rounded-[28px] bg-white px-6 py-8 text-center shadow-[0_18px_48px_rgba(15,23,42,0.08)] ring-1 ring-black/[0.05]">
      <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-blue-50 text-blue-700">
        <BookOpen className="h-6 w-6" aria-hidden="true" />
      </span>
      <h3 className="mt-4 text-base font-semibold text-black">{title}</h3>
      <p className="mt-1 text-sm text-black/45">{hint}</p>
      <Link href={href} className="btn-primary btn-sm mt-5">
        {actionLabel}
      </Link>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────

/** Empty state that points at the next action instead of dead-ending. */
export function EmptyState({
  icon: Icon,
  title,
  hint,
  action,
  beagle = false,
}: {
  icon: LucideIcon;
  title: string;
  hint?: string;
  action?: { href: string; label: string };
  /**
   * Show the beagle mark instead of the icon — reserved for "good news"
   * empties (nothing pending / all caught up), where the mascot reads as
   * a calm reward rather than decoration.
   */
  beagle?: boolean;
}) {
  return (
    <div className="rounded-xl border border-dashed border-black/15 px-6 py-8 text-center">
      {beagle ? (
        <Image
          src="/brand/beagle-mark.png"
          alt=""
          width={464}
          height={483}
          className="mx-auto h-[58px] w-auto opacity-90"
          aria-hidden="true"
        />
      ) : (
        <Icon className="mx-auto h-7 w-7 text-black/20" aria-hidden="true" />
      )}
      <p className="mt-2 text-sm font-medium text-black/70">{title}</p>
      {hint && <p className="mt-1 text-xs text-black/45">{hint}</p>}
      {action && (
        <Link href={action.href} className="btn-secondary btn-sm mt-4">
          {action.label}
        </Link>
      )}
    </div>
  );
}

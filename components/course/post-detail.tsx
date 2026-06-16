import type { ReactNode } from "react";
import { FileText, Megaphone } from "lucide-react";
import type { FeedAttachment } from "@/lib/feed/aggregator";
import { FeedAttachmentPreview } from "@/components/feed/feed-attachment-preview";
import { formatThaiDateShort } from "@/lib/attendance/format";

/**
 * PostDetail — shared detail surface for announcements + materials.
 *
 * Mirrors the feed card vocabulary (author avatar + kind chip + bold title +
 * body + the same FeedAttachmentPreview, so files/images/links render with
 * the lightbox) so the detail page feels continuous with the feed and tracks
 * the Calm Ledger theme via tokens. `actions` is an optional trailing slot
 * for owner controls (edit / delete).
 */

type PostKind = "ANNOUNCEMENT" | "MATERIAL";

const KIND: Record<
  PostKind,
  { label: string; icon: typeof Megaphone; chip: string; avatar: string }
> = {
  ANNOUNCEMENT: {
    label: "ประกาศ",
    icon: Megaphone,
    chip: "bg-orange-50 text-orange-700 ring-1 ring-orange-200/60",
    avatar: "bg-orange-100 text-orange-700",
  },
  MATERIAL: {
    label: "เอกสาร",
    icon: FileText,
    chip: "bg-green-50 text-green-700 ring-1 ring-green-200/60",
    avatar: "bg-green-100 text-green-700",
  },
};

export function PostDetail({
  kind,
  title,
  emptyTitle = "(ไม่มีชื่อ)",
  body,
  posterName,
  postedAt,
  attachments,
  linkUrls,
  actions,
}: {
  kind: PostKind;
  title: string | null;
  emptyTitle?: string;
  body: string | null;
  posterName: string;
  postedAt: Date;
  attachments: FeedAttachment[];
  linkUrls: string[];
  actions?: ReactNode;
}) {
  const decor = KIND[kind];
  const Icon = decor.icon;
  const isPlaceholder = !title?.trim();
  const headline = isPlaceholder ? emptyTitle : title!.trim();

  return (
    <article className="card overflow-hidden p-0">
      <header className="flex items-center gap-3 px-5 pt-5">
        <span
          aria-hidden="true"
          className={
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-medium " +
            decor.avatar
          }
        >
          {initialsOf(posterName)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-black">
            {posterName}
          </p>
          <p className="mt-0.5 text-[11px] text-black/45">
            โพสต์เมื่อ {formatThaiDateShort(postedAt)}
          </p>
        </div>
        <span
          className={
            "inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium " +
            decor.chip
          }
        >
          <Icon className="h-3 w-3" />
          {decor.label}
        </span>
      </header>

      <div className="px-5 pt-4">
        <h1
          className={
            "text-2xl font-semibold md:text-[28px] " +
            (isPlaceholder ? "text-black/45" : "text-black")
          }
          style={{ letterSpacing: "-0.02em", lineHeight: 1.25 }}
        >
          {headline}
        </h1>
        {body && (
          <div className="mt-3 whitespace-pre-wrap text-[15px] leading-relaxed text-black/75">
            {body}
          </div>
        )}
      </div>

      {/* Files + images + links — same component (and lightbox) as the feed */}
      <FeedAttachmentPreview attachments={attachments} linkUrls={linkUrls} />

      {actions ? (
        <footer className="mt-5 flex items-center justify-end gap-2 border-t border-black/[0.06] px-5 py-3">
          {actions}
        </footer>
      ) : (
        <div className="h-5" />
      )}
    </article>
  );
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "—";
  const first = parts[0]!.charAt(0);
  const last = parts[parts.length - 1]!.charAt(0);
  return parts.length === 1 ? first : first + last;
}

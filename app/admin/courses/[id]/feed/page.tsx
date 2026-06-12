import {
  ClipboardList,
  FileText,
  Megaphone,
  Paperclip,
  Sparkles,
} from "lucide-react";
import { getCourseFeed, type FeedItem } from "@/lib/feed/aggregator";
import {
  feedKindsForFilter,
  type CourseFeedFilter,
} from "@/components/feed/course-feed-view";
import { UserAvatar } from "@/components/profile/user-avatar";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ type?: string }>;
}

export default async function AdminCourseFeedPage({
  params,
  searchParams,
}: PageProps) {
  const { id } = await params;
  const { type } = await searchParams;
  const filter = normalizeFilter(type);
  const kindFilter = feedKindsForFilter(filter);
  const page = await getCourseFeed(id, undefined, kindFilter ?? undefined);

  return (
    <div className="space-y-4">
      <div className="card p-4">
        <p className="text-sm font-medium text-black">ฟีดของรายวิชา</p>
        <p className="mt-1 text-xs text-ink-soft">
          มุมมองอ่านอย่างเดียวสำหรับ Admin · ไม่มีปุ่มโพสต์/แก้ไข/ลบ
        </p>
      </div>

      {page.items.length === 0 ? (
        <div className="card-flat p-10 text-center text-sm text-ink-soft">
          ยังไม่มีกิจกรรมในรายวิชานี้
        </div>
      ) : (
        <div className="space-y-4">
          {page.items.map((item) => (
            <AdminFeedCard key={`${item.kind}-${item.id}`} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}

function AdminFeedCard({ item }: { item: FeedItem }) {
  const decor = kindDecor(item.kind);
  const authorName = item.authorName ?? "ครูผู้สอน";

  return (
    <article className="card p-0">
      <header className="flex items-center gap-3 px-5 pt-5">
        {item.authorUserId ? (
          <UserAvatar
            userId={item.authorUserId}
            hasImage={Boolean(item.authorHasAvatar)}
            size={40}
            alt={authorName}
          />
        ) : (
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 text-sm font-semibold text-blue-700">
            {authorName.slice(0, 1)}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-black">
            {authorName}
          </p>
          <p className="mt-0.5 text-[11px] text-ink-soft">
            {formatDate(item.sortAt)}
          </p>
        </div>
        <span className={decor.chip}>
          {decor.icon}
          {decor.label}
        </span>
      </header>

      <div className="px-5 py-4">
        <h2 className="text-lg font-semibold tracking-tight text-black">
          {item.title ?? decor.fallback}
        </h2>
        {item.bodyPreview && (
          <p className="mt-2 whitespace-pre-line text-sm leading-6 text-black/70">
            {item.bodyPreview}
          </p>
        )}
        {item.attachmentCount ? (
          <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-black/[0.04] px-3 py-1 text-xs text-ink-soft">
            <Paperclip className="h-3.5 w-3.5" />
            {item.attachmentCount} ไฟล์/ลิงก์แนบ
          </p>
        ) : null}
      </div>
    </article>
  );
}

function normalizeFilter(raw: string | undefined): CourseFeedFilter {
  if (
    raw === "announcement" ||
    raw === "assignment" ||
    raw === "material" ||
    raw === "score"
  ) {
    return raw;
  }
  return "all";
}

function kindDecor(kind: FeedItem["kind"]) {
  if (kind === "ANNOUNCEMENT") {
    return {
      label: "ประกาศ",
      fallback: "ประกาศไม่มีหัวข้อ",
      icon: <Megaphone className="h-3.5 w-3.5" />,
      chip: "inline-flex shrink-0 items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-medium text-blue-700",
    };
  }
  if (kind === "ASSIGNMENT") {
    return {
      label: "งาน",
      fallback: "งานไม่มีหัวข้อ",
      icon: <ClipboardList className="h-3.5 w-3.5" />,
      chip: "inline-flex shrink-0 items-center gap-1 rounded-full bg-orange-50 px-2.5 py-1 text-[11px] font-medium text-orange-700",
    };
  }
  if (kind === "MATERIAL") {
    return {
      label: "เอกสาร",
      fallback: "เอกสารไม่มีชื่อ",
      icon: <FileText className="h-3.5 w-3.5" />,
      chip: "inline-flex shrink-0 items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-700",
    };
  }
  return {
    label: "คะแนน",
    fallback: "คะแนนเผยแพร่แล้ว",
    icon: <Sparkles className="h-3.5 w-3.5" />,
    chip: "inline-flex shrink-0 items-center gap-1 rounded-full bg-green-50 px-2.5 py-1 text-[11px] font-medium text-green-700",
  };
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("th-TH-u-ca-buddhist", {
    timeZone: "Asia/Bangkok",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

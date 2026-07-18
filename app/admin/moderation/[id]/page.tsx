import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { ChevronLeft, FileSearch, Flag, ShieldCheck } from "lucide-react";
import { requireRole } from "@/lib/auth/guards";
import { ModerationCaseActions } from "@/components/admin/moderation-case-actions";
import { FeedAttachmentPreview } from "@/components/feed/feed-attachment-preview";
import type { FeedAttachment } from "@/lib/feed/aggregator";
import { moderationEvidenceFileIds } from "@/lib/moderation/evidence";
import { moderationCenterEnabled } from "@/lib/moderation/feature-flags";
import { getModerationCaseDetail } from "@/lib/moderation/queries";

export const dynamic = "force-dynamic";

export default async function ModerationCasePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  try {
    await requireRole(["ADMIN"]);
  } catch {
    redirect("/dashboard");
  }
  if (!moderationCenterEnabled()) redirect("/admin/dashboard");

  const { id } = await params;
  const item = await getModerationCaseDetail(id);
  if (!item) notFound();

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-4 sm:p-6 lg:p-8">
      <Link
        href="/admin/moderation"
        className="inline-flex items-center gap-1 text-sm text-ink-soft hover:text-black"
      >
        <ChevronLeft className="h-4 w-4" />
        กลับไป Moderation Center
      </Link>

      <header className="card p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-700">
              <Flag className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-medium text-blue-700">
                {item.targetType}
              </p>
              <h1 className="mt-1 text-xl font-semibold text-black sm:text-2xl">
                {item.targetLabel}
              </h1>
              <p className="mt-1 text-sm text-ink-soft">
                {item.reportCount} รายงาน · เปิดเมื่อ {dateTime(item.createdAt)}
              </p>
            </div>
          </div>
          <span className="badge badge-info self-start">
            {statusLabel(item.status)}
          </span>
        </div>
        {item.restrictionKind && (
          <div className="mt-4 rounded-lg bg-orange-50 p-3 text-sm text-orange-700">
            {item.restrictionKind === "HIDDEN"
              ? "เนื้อหาถูกซ่อนชั่วคราว"
              : "ไฟล์ถูกกักชั่วคราว"}
            {item.restrictedReason ? ` · ${item.restrictedReason}` : ""}
          </div>
        )}
      </header>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-5">
          <EvidencePreview
            caseId={item.id}
            snapshot={item.targetSnapshot}
            attachments={item.evidenceAttachments}
          />

          <section className="card p-5">
            <h2 className="text-base font-semibold text-black">
              รายงานที่รวมอยู่ใน Case
            </h2>
            <div className="mt-4 space-y-3">
              {item.reports.map((report) => (
                <article key={report.id} className="panel-inset p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <strong className="text-sm text-black">
                      {personName(report.reporter)}
                    </strong>
                    <span className="text-xs text-ink-soft">
                      {dateTime(report.createdAt)}
                    </span>
                  </div>
                  <p className="mt-1 text-xs font-medium text-blue-700">
                    {report.category}
                  </p>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-black/80">
                    {report.details}
                  </p>
                </article>
              ))}
            </div>
          </section>

          <section className="card p-5">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-blue-700" />
              <h2 className="text-base font-semibold text-black">
                ลำดับการตรวจสอบ
              </h2>
            </div>
            <ol className="mt-4 space-y-4 border-l border-hairline pl-5">
              {item.events.map((event) => (
                <li key={event.id} className="relative">
                  <span className="absolute -left-[25px] top-1 h-2 w-2 rounded-full bg-blue-500 ring-4 ring-surface" />
                  <p className="text-sm font-medium text-black">
                    {eventLabel(event.type)}
                  </p>
                  <p className="mt-0.5 text-xs text-ink-soft">
                    {personName(event.actorUser)} · {dateTime(event.createdAt)}
                  </p>
                  {event.reason && (
                    <p className="mt-2 text-sm text-black/75">{event.reason}</p>
                  )}
                </li>
              ))}
            </ol>
          </section>
        </div>

        <aside>
          <ModerationCaseActions
            caseId={item.id}
            status={item.status}
            targetType={item.targetType}
            restrictionKind={item.restrictionKind}
          />
        </aside>
      </div>
    </div>
  );
}

function EvidencePreview({
  caseId,
  snapshot,
  attachments,
}: {
  caseId: string;
  snapshot: Prisma.JsonValue;
  attachments: FeedAttachment[];
}) {
  const record =
    snapshot && typeof snapshot === "object" && !Array.isArray(snapshot)
      ? snapshot
      : {};
  const title = textValue(record, "title");
  const body = textValue(record, "body") || textValue(record, "description");
  const links = stringList(record, "linkUrls");
  const filename = textValue(record, "originalFilename");
  const questions = evidenceQuestions(record);
  const capturedFileCount = moderationEvidenceFileIds(snapshot).length;
  const unavailableFileCount = Math.max(
    0,
    capturedFileCount - attachments.length
  );

  return (
    <section className="card p-5">
      <div className="flex items-center gap-2">
        <FileSearch className="h-4 w-4 text-blue-700" />
        <h2 className="text-base font-semibold text-black">
          หลักฐาน ณ เวลาที่รับรายงาน
        </h2>
      </div>
      <div className="panel-inset mt-4 space-y-3 p-4">
        {title && <h3 className="font-semibold text-black">{title}</h3>}
        {body && (
          <p className="whitespace-pre-wrap text-sm leading-6 text-black/80">
            {body}
          </p>
        )}
        {filename && (
          <p className="text-sm text-black">
            ไฟล์: <strong>{filename}</strong>
          </p>
        )}
        {questions.length > 0 && (
          <div className="space-y-3">
            <p className="text-xs font-medium text-ink-soft">
              เนื้อหาแบบทดสอบที่บันทึกไว้ {questions.length} คำถาม
            </p>
            {questions.map((question, index) => (
              <article
                key={question.id}
                className="rounded-lg border border-hairline bg-surface p-4"
              >
                <p className="text-xs font-medium text-blue-700">
                  คำถามที่ {index + 1} · {question.type}
                </p>
                <h4 className="mt-1.5 text-sm font-semibold leading-6 text-ink">
                  {question.prompt}
                </h4>
                {question.options.length > 0 && (
                  <ol className="mt-3 grid gap-2 sm:grid-cols-2">
                    {question.options.map((option, optionIndex) => (
                      <li
                        key={option.id}
                        className="rounded-md bg-bg px-3 py-2 text-sm text-ink-soft"
                      >
                        <span className="mr-2 font-medium text-ink-soft">
                          {String.fromCharCode(65 + optionIndex)}.
                        </span>
                        {option.text}
                      </li>
                    ))}
                  </ol>
                )}
              </article>
            ))}
            <p className="text-xs text-ink-soft">
              หลักฐานไม่แสดงเฉลย คำตอบนักเรียน หรือคะแนนของ Attempt
            </p>
          </div>
        )}
        {attachments.length > 0 && (
          <div className="rounded-xl border border-hairline bg-surface py-3">
            <p className="px-5 text-xs font-medium text-ink-soft">
              ไฟล์หลักฐาน {attachments.length} รายการ · กดเพื่อเปิดดู
            </p>
            <FeedAttachmentPreview
              attachments={attachments}
              fileBasePath={`/api/admin/moderation/cases/${caseId}/files`}
            />
          </div>
        )}
        {links.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-ink-soft">ลิงก์ที่แนบ</p>
            {links.map((url) => (
              <a
                key={url}
                href={url}
                target="_blank"
                rel="noreferrer"
                className="block break-all text-sm text-blue-700"
              >
                {url}
              </a>
            ))}
          </div>
        )}
        {unavailableFileCount > 0 && (
          <p className="text-xs text-ink-soft">
            มีไฟล์หลักฐาน {unavailableFileCount} รายการที่ไม่พบ metadata
          </p>
        )}
        {!title &&
          !body &&
          !filename &&
          links.length === 0 &&
          questions.length === 0 && (
            <p className="text-sm text-ink-soft">
              รายการนี้มีเฉพาะข้อมูลอ้างอิงของเนื้อหา
            </p>
          )}
      </div>
    </section>
  );
}

function textValue(record: Prisma.JsonObject, key: string): string {
  const value = record[key];
  return typeof value === "string" ? value : "";
}

function stringList(record: Prisma.JsonObject, key: string): string[] {
  const value = record[key];
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function evidenceQuestions(record: Prisma.JsonObject): Array<{
  id: string;
  type: string;
  prompt: string;
  options: Array<{ id: string; text: string }>;
}> {
  const questions = record.questions;
  if (!Array.isArray(questions)) return [];
  return questions.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const question = item as Prisma.JsonObject;
    if (
      typeof question.id !== "string" ||
      typeof question.type !== "string" ||
      typeof question.prompt !== "string"
    ) {
      return [];
    }
    const options = Array.isArray(question.options)
      ? question.options.flatMap((optionItem) => {
          if (
            !optionItem ||
            typeof optionItem !== "object" ||
            Array.isArray(optionItem)
          ) {
            return [];
          }
          const option = optionItem as Prisma.JsonObject;
          return typeof option.id === "string" &&
            typeof option.text === "string"
            ? [{ id: option.id, text: option.text }]
            : [];
        })
      : [];
    return [
      {
        id: question.id,
        type: question.type,
        prompt: question.prompt,
        options,
      },
    ];
  });
}

function personName(person: {
  identifier?: string;
  teacher: { firstName: string; lastName: string } | null;
  student: { firstName: string; lastName: string } | null;
  admin: { firstName: string; lastName: string } | null;
}): string {
  const profile = person.teacher ?? person.student ?? person.admin;
  return profile
    ? `${profile.firstName} ${profile.lastName}`
    : (person.identifier ?? "ผู้ใช้");
}

function dateTime(value: Date): string {
  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Bangkok",
  }).format(value);
}

function statusLabel(status: string): string {
  return (
    (
      {
        OPEN: "ใหม่",
        IN_REVIEW: "กำลังตรวจ",
        APPEALED: "อุทธรณ์",
        RESOLVED: "ดำเนินการแล้ว",
        DISMISSED: "ยกคำร้อง",
      } as Record<string, string>
    )[status] ?? status
  );
}

function eventLabel(type: string): string {
  return (
    (
      {
        REPORT_ADDED: "เพิ่มรายงานใน Case",
        REVIEW_STARTED: "Admin รับเข้าตรวจสอบ",
        TEMPORARILY_RESTRICTED: "จำกัดการแสดงผลชั่วคราว",
        RESTRICTION_RESTORED: "คืนค่าการแสดงผล",
        RESOLVED: "ตัดสินและปิด Case",
        DISMISSED: "ยกคำร้อง",
        APPEAL_SUBMITTED: "เจ้าของเนื้อหายื่นอุทธรณ์",
      } as Record<string, string>
    )[type] ?? type
  );
}

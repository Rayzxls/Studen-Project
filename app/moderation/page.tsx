import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft, Scale, ShieldCheck } from "lucide-react";
import { TopNav } from "@/components/layout/top-nav";
import { AppealForm } from "@/components/moderation/appeal-form";
import { requireAuth } from "@/lib/auth/guards";
import { moderationCenterEnabled } from "@/lib/moderation/feature-flags";
import { getOwnedModerationCases } from "@/lib/moderation/queries";

export const dynamic = "force-dynamic";

export default async function MyModerationPage() {
  const session = await requireAuth();
  if (!moderationCenterEnabled()) redirect("/dashboard");

  const cases = await getOwnedModerationCases(session.user.id);
  const now = new Date();

  return (
    <div className="min-h-screen bg-page">
      <TopNav session={session} />
      <main className="mx-auto max-w-4xl space-y-5 px-4 py-6 sm:px-6 sm:py-8">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1 text-sm text-ink-soft hover:text-black"
        >
          <ChevronLeft className="h-4 w-4" />
          กลับหน้า Dashboard
        </Link>

        <header>
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-blue-50 text-blue-700">
              <Scale className="h-5 w-5" />
            </span>
            <div>
              <h1 className="text-2xl font-semibold text-black">
                การตรวจสอบเนื้อหาของฉัน
              </h1>
              <p className="mt-1 text-sm text-ink-soft">
                ดูผลการพิจารณาและยื่นอุทธรณ์ได้หนึ่งครั้งภายใน 7 วัน
              </p>
            </div>
          </div>
        </header>

        {cases.length === 0 ? (
          <section className="card grid min-h-64 place-items-center p-8 text-center">
            <div>
              <ShieldCheck className="mx-auto h-8 w-8 text-blue-600" />
              <h2 className="mt-3 font-semibold text-black">
                ไม่มีรายการที่ต้องดำเนินการ
              </h2>
              <p className="mt-1 text-sm text-ink-soft">
                หากมีผลการตรวจสอบเนื้อหาของคุณ รายละเอียดจะปรากฏที่นี่
              </p>
            </div>
          </section>
        ) : (
          <div className="space-y-3">
            {cases.map((item) => {
              const canAppeal =
                item.status === "RESOLVED" &&
                !item.appealUsed &&
                item.appealDeadline !== null &&
                item.appealDeadline > now;
              return (
                <article key={item.id} className="card p-5 sm:p-6">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-blue-700">
                        {targetLabel(item.targetType)}
                      </p>
                      <h2 className="mt-1 truncate text-lg font-semibold text-black">
                        {item.targetLabel}
                      </h2>
                      <p className="mt-1 text-xs text-ink-soft">
                        อัปเดตล่าสุด {dateTime(item.updatedAt)}
                      </p>
                    </div>
                    <span className="badge badge-info self-start">
                      {statusLabel(item.status)}
                    </span>
                  </div>

                  {item.restrictionKind && (
                    <p className="mt-4 rounded-lg bg-orange-50 p-3 text-sm text-orange-700">
                      เนื้อหานี้ถูกจำกัดการแสดงผลชั่วคราวระหว่างการตรวจสอบ
                    </p>
                  )}
                  {item.userMessage && (
                    <div className="panel-inset mt-4 p-4">
                      <p className="text-xs font-medium text-ink-soft">
                        ข้อความจากผู้ดูแล
                      </p>
                      <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-black">
                        {item.userMessage}
                      </p>
                    </div>
                  )}
                  {item.status === "APPEALED" && (
                    <p className="mt-4 rounded-lg bg-blue-50 p-3 text-sm text-blue-700">
                      ผู้ดูแลได้รับคำอุทธรณ์แล้วและกำลังตรวจสอบอีกครั้ง
                    </p>
                  )}
                  {canAppeal && <AppealForm caseId={item.id} />}
                  {item.status === "RESOLVED" &&
                    !canAppeal &&
                    !item.appealUsed && (
                      <p className="mt-4 text-xs text-ink-soft">
                        ระยะเวลายื่นอุทธรณ์สิ้นสุดแล้ว
                      </p>
                    )}
                </article>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
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
        OPEN: "รับรายงานแล้ว",
        IN_REVIEW: "กำลังตรวจสอบ",
        APPEALED: "อยู่ระหว่างอุทธรณ์",
        RESOLVED: "ดำเนินการแล้ว",
        DISMISSED: "ไม่พบการละเมิด",
      } as Record<string, string>
    )[status] ?? status
  );
}

function targetLabel(type: string): string {
  return (
    (
      {
        COMMENT: "ความคิดเห็น",
        ANNOUNCEMENT: "ประกาศ",
        MATERIAL: "เอกสาร",
        ASSIGNMENT: "การบ้าน",
        FILE_ATTACHMENT: "ไฟล์แนบ",
        PROFILE_IMAGE: "รูปโปรไฟล์",
      } as Record<string, string>
    )[type] ?? type
  );
}

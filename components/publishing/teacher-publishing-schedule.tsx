import Link from "next/link";
import {
  ArrowRight,
  Bell,
  BellRing,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Eye,
  FileText,
  Megaphone,
  Radio,
  TriangleAlert,
  Users,
  type LucideIcon,
} from "lucide-react";

import { MetricTile, SectionHeader } from "@/components/dashboard/primitives";
import { EditAnnouncementDialog } from "@/components/announcement/edit-announcement-dialog";
import { DeleteAnnouncementDialog } from "@/components/announcement/delete-announcement-dialog";
import { EditMaterialDialog } from "@/components/material/edit-material-dialog";
import { DeleteMaterialDialog } from "@/components/material/delete-material-dialog";
import { AssignmentRowActions } from "@/components/assignment/assignment-row-actions";
import { ReschedulePublishingDialog } from "@/components/publishing/reschedule-dialog";
import {
  formatBangkokTime,
  formatThaiDateShort,
} from "@/lib/attendance/format";
import { resolveCourseFeedHref } from "@/lib/feed/navigation";
import type {
  TeacherPublishingItem,
  TeacherPublishingSchedule,
} from "@/lib/publishing/teacher-schedule";

export function TeacherPublishingScheduleView({
  courseId,
  schedule,
}: {
  courseId: string;
  schedule: TeacherPublishingSchedule;
}) {
  return (
    <div className="space-y-8">
      <section>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-blue-700">
              โพสต์ที่ตั้งเวลาไว้
            </p>
            <h2 className="mt-1 text-2xl font-semibold text-ink">
              กำหนดการโพสต์
            </h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-ink-mute">
              ตรวจว่าโพสต์ใดยังซ่อนจากนักเรียน โพสต์ใดเข้าถึงได้แล้ว
              และสร้างการแจ้งเตือนครบหรือยัง
            </p>
          </div>
          <Link
            href={`/teacher/courses/${courseId}/feed`}
            className="btn-secondary btn-sm cursor-pointer"
          >
            กลับไปหน้าฟีด
          </Link>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <MetricTile
            icon={CalendarClock}
            label="รอเผยแพร่"
            value={schedule.upcoming.length}
            suffix="รายการ"
            hint="เรียงจากเวลาที่ใกล้ที่สุด"
            tone={schedule.upcoming.length > 0 ? "blue" : "neutral"}
          />
          <MetricTile
            icon={Users}
            label="นักเรียนที่เข้าถึงได้เมื่อเผยแพร่"
            value={schedule.activeStudentCount}
            suffix="คน"
            tone="green"
          />
          <MetricTile
            icon={BellRing}
            label="เปิด Web Push"
            value={schedule.studentsWithPushCount}
            suffix={`/ ${schedule.activeStudentCount} คน`}
            hint="Push เป็นช่องทางเสริมจากแจ้งเตือนในแอป"
            tone="orange"
          />
        </div>
      </section>

      <section>
        <SectionHeader title="รอเผยแพร่" count={schedule.upcoming.length} />
        {schedule.upcoming.length === 0 ? (
          <EmptySchedule />
        ) : (
          <div className="space-y-3">
            {schedule.upcoming.map((item) => (
              <PublishingItemCard
                key={`${item.kind}:${item.id}`}
                courseId={courseId}
                item={item}
                activeStudentCount={schedule.activeStudentCount}
              />
            ))}
          </div>
        )}
      </section>

      <section>
        <SectionHeader title="เผยแพร่ล่าสุด" count={schedule.recent.length} />
        {schedule.recent.length === 0 ? (
          <div className="card-flat p-6 text-center text-sm text-ink-mute">
            ยังไม่มีโพสต์ตั้งเวลาที่ถึงกำหนดเผยแพร่
          </div>
        ) : (
          <div className="space-y-3">
            {schedule.recent.map((item) => (
              <PublishingItemCard
                key={`${item.kind}:${item.id}`}
                courseId={courseId}
                item={item}
                activeStudentCount={schedule.activeStudentCount}
              />
            ))}
          </div>
        )}
      </section>

      <p className="panel-inset flex items-start gap-2 p-4 text-xs leading-5 text-ink-mute">
        <Eye className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        “อ่านแจ้งเตือน” หมายถึงนักเรียนเปิดรายการแจ้งเตือนในระบบ
        ไม่ได้ยืนยันว่าเปิดอ่านเนื้อหาโพสต์แล้ว
      </p>
    </div>
  );
}

export function PublishingQueueBanner({
  courseId,
  count,
  next,
}: {
  courseId: string;
  count: number;
  next: { title: string; publishAt: Date } | null;
}) {
  if (count === 0 || !next) return null;
  return (
    <Link
      href={`/teacher/courses/${courseId}/schedule`}
      className="group flex items-center gap-3 rounded-2xl border border-blue-200 bg-blue-50/80 px-4 py-3 text-blue-700 transition-colors duration-200 hover:border-blue-300 hover:bg-blue-50 hover:no-underline"
    >
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white text-blue-700 shadow-sm">
        <CalendarClock className="h-5 w-5" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">
          รอเผยแพร่ {count} รายการ
        </span>
        <span className="mt-0.5 block truncate text-xs text-blue-700/75">
          ถัดไป: {next.title} · {formatPublishingDate(next.publishAt)}
        </span>
      </span>
      <span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-blue-700">
        ดูกำหนดการ
        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
      </span>
    </Link>
  );
}

function PublishingItemCard({
  courseId,
  item,
  activeStudentCount,
}: {
  courseId: string;
  item: TeacherPublishingItem;
  activeStudentCount: number;
}) {
  const kind = kindPresentation(item.kind);
  const status = statusPresentation(item, activeStudentCount);
  const href = resolveCourseFeedHref({
    kind: item.kind,
    courseOfferingId: courseId,
    itemId: item.id,
    role: "TEACHER",
  });
  const KindIcon = kind.icon;
  const StatusIcon = status.icon;

  return (
    <article className="card p-4 sm:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <span
          className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${kind.iconClass}`}
        >
          <KindIcon className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`badge ${kind.badgeClass}`}>{kind.label}</span>
            <span className={`badge ${status.badgeClass}`}>
              <StatusIcon className="h-3.5 w-3.5" aria-hidden="true" />
              {status.label}
            </span>
          </div>
          <h3 className="mt-2 truncate text-base font-semibold text-ink">
            {item.title}
          </h3>
          <p className="mt-1 flex items-center gap-1.5 text-sm font-medium text-ink-soft">
            <CalendarClock className="h-4 w-4 shrink-0" aria-hidden="true" />
            {item.status === "SCHEDULED" ? "เผยแพร่" : "เผยแพร่เมื่อ"}{" "}
            {formatPublishingDate(item.publishAt)}
          </p>
          <p className={`mt-2 text-xs leading-5 ${status.textClass}`}>
            {status.description}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-1 self-start">
          {item.status === "SCHEDULED" && (
            <ReschedulePublishingDialog
              courseId={courseId}
              kind={item.kind}
              itemId={item.id}
              publishAt={item.publishAt.toISOString()}
            />
          )}
          <PublishingItemActions courseId={courseId} item={item} />
          <Link href={href} className="btn-ghost btn-sm cursor-pointer">
            ดูโพสต์
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </article>
  );
}

function PublishingItemActions({
  courseId,
  item,
}: {
  courseId: string;
  item: TeacherPublishingItem;
}) {
  const schedulePath = `/teacher/courses/${courseId}/schedule`;

  if (item.kind === "ANNOUNCEMENT") {
    return (
      <>
        <EditAnnouncementDialog
          courseId={courseId}
          announcementId={item.id}
          initialTitle={item.editable.title}
          initialBody={item.editable.body}
          initialLinkUrls={item.editable.linkUrls}
        />
        <DeleteAnnouncementDialog
          courseId={courseId}
          announcementId={item.id}
          redirectTo={schedulePath}
        />
      </>
    );
  }

  if (item.kind === "MATERIAL") {
    return (
      <>
        <EditMaterialDialog
          courseId={courseId}
          materialId={item.id}
          initialTitle={item.editable.title}
          initialBody={item.editable.body}
          initialLinkUrls={item.editable.linkUrls}
        />
        <DeleteMaterialDialog
          courseId={courseId}
          materialId={item.id}
          redirectTo={schedulePath}
        />
      </>
    );
  }

  return (
    <AssignmentRowActions
      courseId={courseId}
      assignment={item.editable}
      showLabels
    />
  );
}

function EmptySchedule() {
  return (
    <div className="card-flat p-8 text-center">
      <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-blue-50 text-blue-700">
        <CalendarClock className="h-6 w-6" aria-hidden="true" />
      </span>
      <p className="mt-3 text-sm font-semibold text-ink">
        ไม่มีโพสต์ที่รอเผยแพร่
      </p>
      <p className="mt-1 text-xs text-ink-mute">
        โพสต์ที่ตั้งเวลาใหม่จะปรากฏที่นี่ทันที
      </p>
    </div>
  );
}

function kindPresentation(kind: TeacherPublishingItem["kind"]): {
  label: string;
  icon: LucideIcon;
  iconClass: string;
  badgeClass: string;
} {
  if (kind === "ANNOUNCEMENT") {
    return {
      label: "ประกาศ",
      icon: Megaphone,
      iconClass: "bg-orange-50 text-orange-700",
      badgeClass: "bg-orange-50 text-orange-700",
    };
  }
  if (kind === "MATERIAL") {
    return {
      label: "เอกสาร",
      icon: FileText,
      iconClass: "bg-green-50 text-green-700",
      badgeClass: "bg-green-50 text-green-700",
    };
  }
  return {
    label: "การบ้าน",
    icon: ClipboardList,
    iconClass: "bg-blue-50 text-blue-700",
    badgeClass: "bg-blue-50 text-blue-700",
  };
}

function statusPresentation(
  item: TeacherPublishingItem,
  activeStudentCount: number
): {
  label: string;
  description: string;
  icon: LucideIcon;
  badgeClass: string;
  textClass: string;
} {
  switch (item.status) {
    case "SCHEDULED":
      return {
        label: "ตั้งเวลา",
        description: `นักเรียนยังไม่เห็น · เมื่อถึงเวลาจะเปิดให้ ${activeStudentCount} คนเข้าถึงได้`,
        icon: CalendarClock,
        badgeClass: "badge-info",
        textClass: "text-blue-700",
      };
    case "LIVE_NOTIFYING":
      return {
        label: "เผยแพร่แล้ว",
        description: `นักเรียน ${activeStudentCount} คนเข้าถึงได้แล้ว · กำลังสร้างการแจ้งเตือน`,
        icon: Radio,
        badgeClass: "badge-success",
        textClass: "text-green-700",
      };
    case "LIVE_NOTIFIED":
      return {
        label: "แจ้งเตือนครบ",
        description: `นักเรียน ${activeStudentCount} คนเข้าถึงได้ · สร้างการแจ้งเตือนแล้ว ${item.notificationCount}/${item.notificationTargetCount} · อ่านแจ้งเตือน ${item.notificationReadCount}/${item.notificationCount}`,
        icon: CheckCircle2,
        badgeClass: "badge-success",
        textClass: "text-green-700",
      };
    case "LIVE_NOTIFICATION_INCOMPLETE":
      return {
        label: "แจ้งเตือนไม่ครบ",
        description: `โพสต์เข้าถึงได้แล้ว แต่พบการแจ้งเตือน ${item.notificationCount}/${item.notificationTargetCount} รายการ`,
        icon: TriangleAlert,
        badgeClass: "badge-warn",
        textClass: "text-orange-700",
      };
    case "LIVE_NO_STUDENTS":
      return {
        label: "เผยแพร่แล้ว",
        description: "โพสต์เผยแพร่แล้ว แต่รายวิชายังไม่มีนักเรียนที่ใช้งานอยู่",
        icon: Bell,
        badgeClass: "badge-success",
        textClass: "text-ink-mute",
      };
  }
}

function formatPublishingDate(date: Date): string {
  return `${formatThaiDateShort(date)} เวลา ${formatBangkokTime(date)} น.`;
}

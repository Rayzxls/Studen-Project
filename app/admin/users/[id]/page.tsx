import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft, KeyRound, Mail, ShieldCheck, User2 } from "lucide-react";
import { requireRole } from "@/lib/auth/guards";
import { db } from "@/lib/db/client";
import { renderAuditLog } from "@/lib/audit/render";
import { ResetPasswordCard } from "@/components/admin/reset-password-card";

// Auth-gated DB-fetching page — skip static prerender.
export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function AdminUserDetailPage({ params }: PageProps) {
  let session;
  try {
    session = await requireRole(["ADMIN"]);
  } catch {
    redirect("/dashboard");
  }
  const { id } = await params;

  const user = await db.user.findUnique({
    where: { id },
    select: {
      id: true,
      identifier: true,
      role: true,
      mustResetPwd: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
      deletedAt: true,
      consentedAt: true,
      consentVersion: true,
      admin: { select: { firstName: true, lastName: true } },
      teacher: {
        select: {
          firstName: true,
          lastName: true,
          email: true,
          homeroomOf: {
            select: {
              id: true,
              name: true,
              academicYear: { select: { name: true } },
            },
          },
          courses: {
            where: { term: { isActive: true } },
            select: {
              id: true,
              name: true,
              class: { select: { name: true } },
              _count: {
                select: { enrollments: { where: { removedAt: null } } },
              },
            },
            orderBy: { name: "asc" },
          },
        },
      },
      student: {
        select: {
          firstName: true,
          lastName: true,
          studentId: true,
          anonymized: true,
          class: {
            select: {
              id: true,
              name: true,
              academicYear: { select: { name: true } },
            },
          },
          enrollments: {
            where: { removedAt: null, course: { term: { isActive: true } } },
            select: {
              id: true,
              course: {
                select: {
                  id: true,
                  name: true,
                  teacher: { select: { firstName: true, lastName: true } },
                },
              },
            },
          },
        },
      },
    },
  });
  if (!user) notFound();

  const audits = await db.auditLog.findMany({
    where: {
      OR: [{ actorId: id }, { targetId: id }],
    },
    orderBy: { timestamp: "desc" },
    take: 50,
    select: {
      id: true,
      timestamp: true,
      action: true,
      actorId: true,
      actorRole: true,
      targetType: true,
      targetId: true,
      targetLabel: true,
      reason: true,
    },
  });

  // Actor name lookup for the audit renderer — single batch read.
  const actorIds = Array.from(
    new Set(audits.map((a) => a.actorId).filter((x): x is string => x !== null))
  );
  const actorRows = await db.user.findMany({
    where: { id: { in: actorIds } },
    select: {
      id: true,
      teacher: { select: { firstName: true, lastName: true } },
      student: { select: { firstName: true, lastName: true } },
      admin: { select: { firstName: true, lastName: true } },
      identifier: true,
    },
  });
  const actorNameMap = new Map<string, string>();
  for (const a of actorRows) {
    const n = a.teacher
      ? `${a.teacher.firstName} ${a.teacher.lastName}`
      : a.student
        ? `${a.student.firstName} ${a.student.lastName}`
        : a.admin
          ? `${a.admin.firstName} ${a.admin.lastName}`
          : a.identifier;
    actorNameMap.set(a.id, n);
  }

  const displayName = user.teacher
    ? `${user.teacher.firstName} ${user.teacher.lastName}`
    : user.student
      ? `${user.student.firstName} ${user.student.lastName}`
      : user.admin
        ? `${user.admin.firstName} ${user.admin.lastName}`
        : user.identifier;
  const isSelf = user.id === session.user.id;

  return (
    <div className="mx-auto max-w-4xl px-6 py-8 space-y-6">
      <Link
        href="/admin/teachers"
        className="inline-flex items-center gap-1 text-xs text-black/60 hover:text-black"
      >
        <ChevronLeft className="h-3.5 w-3.5" />
        กลับไปรายชื่อผู้ใช้
      </Link>

      <header className="card p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1
              className="text-2xl font-medium text-black"
              style={{ letterSpacing: "-0.02em" }}
            >
              {displayName}
            </h1>
            <p className="mt-1 flex items-center gap-2 text-sm text-black/60">
              <Mail className="h-3.5 w-3.5" />
              {user.teacher?.email ?? user.identifier}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <RoleBadge role={user.role} />
            {user.isActive ? (
              <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] text-green-700">
                ใช้งาน
              </span>
            ) : (
              <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] text-slate-700">
                ปิดใช้งาน
              </span>
            )}
            {user.mustResetPwd && (
              <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[10px] text-orange-700">
                ต้องตั้งรหัสผ่านใหม่ตอนเข้าใช้
              </span>
            )}
            {user.deletedAt && (
              <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] text-red-700">
                ลบแล้ว
              </span>
            )}
          </div>
        </div>
      </header>

      {/* Reset password card — full reveal-once flow */}
      {!isSelf && !user.deletedAt && (
        <ResetPasswordCard userId={user.id} displayName={displayName} />
      )}
      {isSelf && (
        <div className="card-flat p-4 text-xs text-black/50">
          คุณไม่สามารถรีเซ็ตรหัสผ่านของตัวเองได้ผ่านหน้านี้ — ใช้เมนู
          &ldquo;เปลี่ยนรหัสผ่าน&rdquo; แทน
        </div>
      )}

      <section className="card p-6">
        <h2 className="mb-3 text-sm font-medium text-black/80 flex items-center gap-2">
          <User2 className="h-4 w-4" />
          ข้อมูลบัญชี
        </h2>
        <dl className="grid grid-cols-2 gap-3 text-xs">
          <Row label="User ID" value={user.id} mono />
          <Row label="Identifier" value={user.identifier} mono />
          <Row label="สร้างเมื่อ" value={fmtDateTime(user.createdAt)} />
          <Row label="แก้ไขล่าสุด" value={fmtDateTime(user.updatedAt)} />
          {user.consentedAt && (
            <Row
              label="ยินยอมเมื่อ"
              value={`${fmtDateTime(user.consentedAt)}${user.consentVersion ? ` (v${user.consentVersion})` : ""}`}
            />
          )}
        </dl>
      </section>

      {user.teacher && (
        <section className="card p-6">
          <h2 className="mb-3 text-sm font-medium text-black/80 flex items-center gap-2">
            <ShieldCheck className="h-4 w-4" />
            ครู
          </h2>
          <dl className="grid grid-cols-2 gap-3 text-xs">
            <Row label="ชื่อ" value={user.teacher.firstName} />
            <Row label="นามสกุล" value={user.teacher.lastName} />
            <Row
              label="ครูประจำชั้น"
              value={
                user.teacher.homeroomOf
                  ? `${user.teacher.homeroomOf.name} (ปี ${user.teacher.homeroomOf.academicYear.name})`
                  : "—"
              }
            />
            <Row
              label="วิชาที่สอน (เทอมปัจจุบัน)"
              value={`${user.teacher.courses.length} วิชา`}
            />
          </dl>
          {user.teacher.courses.length > 0 && (
            <ul className="mt-4 divide-y divide-black/[0.06]">
              {user.teacher.courses.map((c) => (
                <li key={c.id} className="py-2 text-xs">
                  <p className="font-medium text-black">{c.name}</p>
                  <p className="mt-0.5 text-black/50">
                    ห้อง {c.class.name} · {c._count.enrollments} นักเรียน
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {user.student && (
        <section className="card p-6">
          <h2 className="mb-3 text-sm font-medium text-black/80 flex items-center gap-2">
            <User2 className="h-4 w-4" />
            นักเรียน
          </h2>
          <dl className="grid grid-cols-2 gap-3 text-xs">
            <Row label="รหัสนักเรียน" value={user.student.studentId} mono />
            <Row label="ชื่อ" value={user.student.firstName} />
            <Row label="นามสกุล" value={user.student.lastName} />
            <Row
              label="ห้องประจำ"
              value={
                user.student.class
                  ? `${user.student.class.name} (ปี ${user.student.class.academicYear.name})`
                  : "—"
              }
            />
            <Row
              label="วิชาที่ลงทะเบียน (เทอมปัจจุบัน)"
              value={`${user.student.enrollments.length} วิชา`}
            />
            {user.student.anonymized && (
              <Row label="สถานะ" value="ลบข้อมูลแบบนิรนามแล้ว" />
            )}
          </dl>
          {user.student.enrollments.length > 0 && (
            <ul className="mt-4 divide-y divide-black/[0.06]">
              {user.student.enrollments.map((e) => (
                <li key={e.id} className="py-2 text-xs">
                  <p className="font-medium text-black">{e.course.name}</p>
                  <p className="mt-0.5 text-black/50">
                    ครู {e.course.teacher.firstName} {e.course.teacher.lastName}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <section className="card p-6">
        <h2 className="mb-3 text-sm font-medium text-black/80 flex items-center gap-2">
          <KeyRound className="h-4 w-4" />
          ประวัติ Audit Log (ล่าสุด 50 รายการ)
        </h2>
        {audits.length === 0 ? (
          <p className="text-xs text-black/40">ยังไม่มีรายการ</p>
        ) : (
          <ul className="divide-y divide-black/[0.06] text-xs">
            {audits.map((a) => (
              <li key={a.id} className="py-2">
                <p className="text-black/80">
                  {renderAuditLog(
                    a,
                    a.actorId ? actorNameMap.get(a.actorId) : null
                  )}
                </p>
                <Link
                  href={`/admin/audit/${a.id}`}
                  className="mt-1 inline-block text-[10px] text-blue-600 hover:underline"
                >
                  ดูรายละเอียด →
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Row({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <dt className="text-black/40">{label}</dt>
      <dd
        className={"mt-0.5 text-black " + (mono ? "font-mono text-[11px]" : "")}
      >
        {value}
      </dd>
    </div>
  );
}

function RoleBadge({ role }: { role: string }) {
  // ADR-0028 § 2: role badges remain neutral grayscale. Saturated semantic
  // colours are reserved for state (system colours) and content category
  // (course slot colours); role differentiation is via label + placement.
  const label =
    role === "ADMIN"
      ? "Admin"
      : role === "TEACHER"
        ? "ครู"
        : role === "STUDENT"
          ? "นักเรียน"
          : role;
  return <span className="badge">{label}</span>;
}

function fmtDateTime(d: Date): string {
  return new Intl.DateTimeFormat("th-TH-u-ca-buddhist", {
    timeZone: "Asia/Bangkok",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(d));
}

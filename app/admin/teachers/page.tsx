import Link from "next/link";
import { cookies } from "next/headers";
import { CheckCircle2, KeyRound, Search, Upload, UserPlus } from "lucide-react";
import { listTeachers } from "@/lib/admin/teachers-list";
import {
  TEACHER_CREATED_FLASH_COOKIE,
  type TeacherCreatedFlash,
} from "@/lib/admin/teacher-created-flash";
import { PaginationLinks } from "@/components/pagination";
import { UserAvatar } from "@/components/profile/user-avatar";
import { AccountStatusBadge } from "@/components/admin/account-status-badge";
import { dismissTeacherCreatedFlashAction } from "./actions";

interface PageProps {
  searchParams: Promise<{
    search?: string;
    page?: string;
    created?: string;
    imported?: string;
  }>;
}

export const dynamic = "force-dynamic";

export default async function AdminTeachersPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const search = sp.search ?? "";
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const importedCount = Math.max(0, parseInt(sp.imported ?? "0", 10) || 0);

  const [result, createdFlash] = await Promise.all([
    listTeachers({ search, page }),
    readTeacherCreatedFlash(sp.created),
  ]);

  const dateFmt = new Intl.DateTimeFormat("th-TH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  return (
    <div className="animate-fade-in p-6 md:p-10 space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-3xl font-medium tracking-tight">ครู</h1>
          <p className="mt-1 text-sm text-ink-soft">
            ทั้งหมด {result.total.toLocaleString("th-TH")} คน
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/teachers/new" className="btn-primary btn-sm">
            <UserPlus className="h-4 w-4" />
            เพิ่มครูรายคน
          </Link>
          <Link href="/admin/import/teachers" className="btn-secondary btn-sm">
            <Upload className="h-4 w-4" />
            นำเข้าครูหลายคน
          </Link>
        </div>
      </div>

      {createdFlash && <TeacherCreatedBanner flash={createdFlash} />}
      {importedCount > 0 && (
        <div className="card flex items-start gap-3 border-green-200 bg-green-50/70 p-4">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-700" />
          <div>
            <p className="font-medium text-green-900">
              นำเข้าครูสำเร็จ {importedCount.toLocaleString("th-TH")} คน
            </p>
            <p className="mt-0.5 text-xs text-green-800/70">
              รายชื่อครูที่นำเข้าจะปรากฏในตารางด้านล่าง
            </p>
          </div>
        </div>
      )}

      {/* Search */}
      <form method="get" className="card p-4">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              name="search"
              defaultValue={search}
              placeholder="ค้นหาชื่อ-นามสกุล หรืออีเมล..."
              className="input pl-9"
            />
          </div>
          <button type="submit" className="btn-secondary">
            ค้นหา
          </button>
          {search && (
            <Link href="/admin/teachers" className="btn-ghost btn-sm">
              ล้าง
            </Link>
          )}
        </div>
      </form>

      {/* Table */}
      {result.items.length === 0 ? (
        <div className="card-flat p-10 text-center">
          <p className="text-sm text-ink-soft">
            {search ? "ไม่พบครูที่ค้นหา" : "ยังไม่มีครูในระบบ"}
          </p>
          {!search && (
            <div className="mt-4 flex justify-center gap-2">
              <Link href="/admin/teachers/new" className="btn-primary">
                <UserPlus className="h-4 w-4" />
                เพิ่มครูรายคน
              </Link>
              <Link href="/admin/import/teachers" className="btn-secondary">
                <Upload className="h-4 w-4" />
                นำเข้าครูหลายคน
              </Link>
            </div>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>ชื่อ-นามสกุล</th>
                <th>อีเมล</th>
                <th>ครูประจำชั้น</th>
                <th>วิชาที่สอน</th>
                <th>สมาชิกตั้งแต่</th>
                <th>สถานะ</th>
                <th>จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {result.items.map((t) => (
                <tr key={t.userId}>
                  <td>
                    <Link
                      href={`/admin/users/${t.userId}`}
                      className="inline-flex items-center gap-2 font-medium text-black hover:underline"
                    >
                      <UserAvatar
                        userId={t.userId}
                        hasImage={t.hasAvatar}
                        size={26}
                      />
                      {t.firstName} {t.lastName}
                    </Link>
                  </td>
                  <td className="text-sm">{t.email}</td>
                  <td className="text-sm">
                    {t.homeroomOf ? (
                      <span className="badge">{t.homeroomOf}</span>
                    ) : (
                      <span className="text-ink-soft">—</span>
                    )}
                  </td>
                  <td className="text-sm">{t.courseCount}</td>
                  <td className="text-xs text-ink-soft whitespace-nowrap">
                    {dateFmt.format(t.createdAt)}
                  </td>
                  <td>
                    <AccountStatusBadge status={t.accountStatus} />
                  </td>
                  <td>
                    <div className="flex flex-wrap gap-2">
                      <Link
                        href={`/admin/users/${t.userId}`}
                        className="btn-ghost btn-sm"
                      >
                        ดูข้อมูล
                      </Link>
                      <Link
                        href={`/admin/users/${t.userId}#reset-password`}
                        className="btn-secondary btn-sm"
                      >
                        <KeyRound className="h-3.5 w-3.5" />
                        Reset Password
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <PaginationLinks
        basePath="/admin/teachers"
        page={result.page}
        pageCount={result.pageCount}
        searchParams={{ search }}
      />
    </div>
  );
}

async function readTeacherCreatedFlash(
  createdUserId?: string
): Promise<TeacherCreatedFlash | null> {
  if (!createdUserId) return null;
  const cookieStore = await cookies();
  const raw = cookieStore.get(TEACHER_CREATED_FLASH_COOKIE)?.value;
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<TeacherCreatedFlash>;
    if (
      parsed.userId !== createdUserId ||
      typeof parsed.displayName !== "string" ||
      typeof parsed.email !== "string" ||
      typeof parsed.tempPassword !== "string"
    ) {
      return null;
    }
    return {
      userId: parsed.userId,
      displayName: parsed.displayName,
      email: parsed.email,
      tempPassword: parsed.tempPassword,
    };
  } catch {
    return null;
  }
}

function TeacherCreatedBanner({ flash }: { flash: TeacherCreatedFlash }) {
  return (
    <section className="card border-green-200 bg-green-50/70 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-700" />
          <div>
            <p className="font-medium text-green-950">
              เพิ่มครูสำเร็จ: {flash.displayName}
            </p>
            <p className="mt-0.5 text-xs text-green-800/70">{flash.email}</p>
          </div>
        </div>
        <form action={dismissTeacherCreatedFlashAction}>
          <button type="submit" className="btn-ghost btn-sm">
            ปิด
          </button>
        </form>
      </div>

      <div className="mt-4 rounded-2xl border border-green-200 bg-white p-4">
        <p className="text-xs text-green-800/80">
          รหัสผ่านชั่วคราว (แสดงครั้งเดียว — เก็บไว้แจ้งครูตอนนี้)
        </p>
        <code className="mt-2 block rounded-xl bg-black/[0.04] px-3 py-2 font-mono text-sm tracking-wider text-black">
          {flash.tempPassword}
        </code>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link
            href={`/admin/users/${flash.userId}`}
            className="btn-primary btn-sm"
          >
            ดูข้อมูลครูคนนี้
          </Link>
          <Link
            href={`/admin/users/${flash.userId}#reset-password`}
            className="btn-secondary btn-sm"
          >
            <KeyRound className="h-3.5 w-3.5" />
            Reset Password
          </Link>
        </div>
      </div>
    </section>
  );
}

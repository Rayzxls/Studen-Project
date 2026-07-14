import Link from "next/link";
import { KeyRound, Search } from "lucide-react";
import { listStudents } from "@/lib/admin/students-list";
import { getActiveAcademicYear, getClassesByYear } from "@/lib/course/queries";
import { PaginationLinks } from "@/components/pagination";
import { UserAvatar } from "@/components/profile/user-avatar";
import { AccountStatusBadge } from "@/components/admin/account-status-badge";

interface PageProps {
  searchParams: Promise<{
    search?: string;
    classId?: string;
    page?: string;
  }>;
}

export default async function AdminStudentsPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const search = sp.search ?? "";
  const classId = sp.classId ?? "";
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);

  const year = await getActiveAcademicYear();
  const classes = year ? await getClassesByYear(year.id) : [];
  const result = await listStudents({
    search,
    classId: classId || undefined,
    page,
  });

  const dateFmt = new Intl.DateTimeFormat("th-TH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  return (
    <div className="animate-fade-in p-6 md:p-10 space-y-5">
      <div>
        <h1 className="text-3xl font-medium tracking-tight">นักเรียน</h1>
        <p className="mt-1 text-sm text-ink-soft">
          ทั้งหมด {result.total.toLocaleString("th-TH")} คน
        </p>
      </div>

      {/* Filters */}
      <form method="get" className="card p-4">
        <div className="flex flex-wrap items-end gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <label className="mb-1 block text-xs font-medium text-ink-soft">
              ค้นหา
            </label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                name="search"
                defaultValue={search}
                placeholder="ชื่อ หรือ เลขประจำตัว..."
                className="input pl-9"
              />
            </div>
          </div>
          <div className="min-w-[160px]">
            <label className="mb-1 block text-xs font-medium text-ink-soft">
              ห้อง
            </label>
            <select name="classId" defaultValue={classId} className="input">
              <option value="">ทุกห้อง</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <button type="submit" className="btn-secondary">
            กรอง
          </button>
          {(search || classId) && (
            <Link href="/admin/students" className="btn-ghost btn-sm">
              ล้าง
            </Link>
          )}
        </div>
      </form>

      {/* Table */}
      {result.items.length === 0 ? (
        <div className="card-flat p-10 text-center">
          <p className="text-sm text-ink-soft">
            {search || classId
              ? "ไม่พบนักเรียนที่ตรงกับตัวกรอง"
              : "ยังไม่มีนักเรียนในระบบ"}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>เลขประจำตัว</th>
                <th>ชื่อ-นามสกุล</th>
                <th>ห้องประจำ</th>
                <th>วิชาที่ลงทะเบียน</th>
                <th>สมัครเมื่อ</th>
                <th>สถานะ</th>
                <th>จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {result.items.map((s) => (
                <tr key={s.userId}>
                  <td className="font-mono text-sm">{s.studentId}</td>
                  <td>
                    <Link
                      href={`/admin/users/${s.userId}`}
                      className="inline-flex items-center gap-2 font-medium text-black hover:underline"
                    >
                      <UserAvatar
                        userId={s.userId}
                        hasImage={s.hasAvatar}
                        size={26}
                      />
                      {s.firstName} {s.lastName}
                    </Link>
                  </td>
                  <td className="text-sm">
                    {s.className ? (
                      <span className="badge">{s.className}</span>
                    ) : (
                      <span className="text-ink-soft">—</span>
                    )}
                  </td>
                  <td className="text-sm">{s.enrolledCount}</td>
                  <td className="text-xs text-ink-soft whitespace-nowrap">
                    {dateFmt.format(s.createdAt)}
                  </td>
                  <td>
                    <AccountStatusBadge status={s.accountStatus} />
                  </td>
                  <td>
                    <div className="flex flex-wrap gap-2">
                      <Link
                        href={`/admin/users/${s.userId}`}
                        className="btn-ghost btn-sm"
                      >
                        ดูข้อมูล
                      </Link>
                      <Link
                        href={`/admin/users/${s.userId}#reset-password`}
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
        basePath="/admin/students"
        page={result.page}
        pageCount={result.pageCount}
        searchParams={{ search, classId }}
      />
    </div>
  );
}

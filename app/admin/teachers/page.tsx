import Link from "next/link";
import { Mail, Search, UserPlus } from "lucide-react";
import { listTeachers } from "@/lib/admin/teachers-list";
import { identityFoundationMutationsEnabled } from "@/lib/identity/feature-flags";
import { PaginationLinks } from "@/components/pagination";
import { UserAvatar } from "@/components/profile/user-avatar";
import { AccountStatusBadge } from "@/components/admin/account-status-badge";

interface PageProps {
  searchParams: Promise<{
    search?: string;
    page?: string;
  }>;
}

export const dynamic = "force-dynamic";

export default async function AdminTeachersPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const search = sp.search ?? "";
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const result = await listTeachers({ search, page });

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
        {identityFoundationMutationsEnabled() && (
          <Link href="/admin/teachers/invites" className="btn-primary btn-sm">
            <UserPlus className="h-4 w-4" />
            เพิ่มหรือนำเข้าครู
          </Link>
        )}
      </div>

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
          {!search && identityFoundationMutationsEnabled() && (
            <div className="mt-4 flex justify-center">
              <Link href="/admin/teachers/invites" className="btn-primary">
                <Mail className="h-4 w-4" />
                เพิ่มหรือนำเข้าครู
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
                  <td className="text-sm">{t.courseCount}</td>
                  <td className="text-xs text-ink-soft whitespace-nowrap">
                    {dateFmt.format(t.createdAt)}
                  </td>
                  <td>
                    <AccountStatusBadge status={t.accountStatus} />
                  </td>
                  <td>
                    <Link
                      href={`/admin/users/${t.userId}`}
                      className="btn-ghost btn-sm"
                    >
                      ดูข้อมูล
                    </Link>
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

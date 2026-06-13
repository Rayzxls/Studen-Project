import { db } from "@/lib/db/client";

export interface TeacherListParams {
  search?: string;
  page?: number;
  pageSize?: number;
}

export interface TeacherListItem {
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  isActive: boolean;
  createdAt: Date;
  hasAvatar: boolean;
  homeroomOf: string | null;
  courseCount: number;
}

export interface TeacherListResult {
  items: TeacherListItem[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

const DEFAULT_PAGE_SIZE = 20;

export async function listTeachers(
  params: TeacherListParams = {}
): Promise<TeacherListResult> {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(
    100,
    Math.max(5, params.pageSize ?? DEFAULT_PAGE_SIZE)
  );
  const skip = (page - 1) * pageSize;
  const search = params.search?.trim() ?? "";

  const where = {
    user: { deletedAt: null },
    ...(search
      ? {
          OR: [
            { firstName: { contains: search, mode: "insensitive" as const } },
            { lastName: { contains: search, mode: "insensitive" as const } },
            { email: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [total, teachers] = await Promise.all([
    db.teacher.count({ where }),
    db.teacher.findMany({
      where,
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
      skip,
      take: pageSize,
      select: {
        userId: true,
        firstName: true,
        lastName: true,
        email: true,
        user: {
          select: { isActive: true, createdAt: true, profileImageId: true },
        },
        homeroomOf: { select: { name: true } },
        _count: { select: { courses: true } },
      },
    }),
  ]);

  return {
    items: teachers.map((t) => ({
      userId: t.userId,
      firstName: t.firstName,
      lastName: t.lastName,
      email: t.email,
      isActive: t.user.isActive,
      createdAt: t.user.createdAt,
      hasAvatar: t.user.profileImageId !== null,
      homeroomOf: t.homeroomOf?.name ?? null,
      courseCount: t._count.courses,
    })),
    total,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
  };
}

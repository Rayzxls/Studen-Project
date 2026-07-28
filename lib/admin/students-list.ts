import { db } from "@/lib/db/client";
import {
  deriveLegacyAccountStatus,
  type AccountStatus,
} from "@/lib/account/status";

export interface StudentListParams {
  search?: string;
  page?: number;
  pageSize?: number;
}

export interface StudentListItem {
  userId: string;
  studentId: string;
  firstName: string;
  lastName: string;
  accountStatus: AccountStatus;
  createdAt: Date;
  hasAvatar: boolean;
  enrolledCount: number;
}

export interface StudentListResult {
  items: StudentListItem[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

const DEFAULT_PAGE_SIZE = 20;

export async function listStudents(
  params: StudentListParams = {}
): Promise<StudentListResult> {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(
    100,
    Math.max(5, params.pageSize ?? DEFAULT_PAGE_SIZE)
  );
  const skip = (page - 1) * pageSize;
  const search = params.search?.trim() ?? "";

  const where = {
    user: { deletedAt: null },
    anonymized: false,
    ...(search
      ? {
          OR: [
            { firstName: { contains: search, mode: "insensitive" as const } },
            { lastName: { contains: search, mode: "insensitive" as const } },
            { studentId: { contains: search } },
          ],
        }
      : {}),
  };

  const [total, students] = await Promise.all([
    db.student.count({ where }),
    db.student.findMany({
      where,
      orderBy: [{ studentId: "asc" }],
      skip,
      take: pageSize,
      select: {
        userId: true,
        studentId: true,
        firstName: true,
        lastName: true,
        anonymized: true,
        user: {
          select: { isActive: true, createdAt: true, profileImageId: true },
        },
        _count: { select: { enrollments: true } },
      },
    }),
  ]);

  return {
    items: students.map((s) => ({
      userId: s.userId,
      studentId: s.studentId,
      firstName: s.firstName,
      lastName: s.lastName,
      accountStatus: deriveLegacyAccountStatus({
        isActive: s.user.isActive,
        deletedAt: null,
        studentAnonymized: s.anonymized,
      }),
      createdAt: s.user.createdAt,
      hasAvatar: s.user.profileImageId !== null,
      enrolledCount: s._count.enrollments,
    })),
    total,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
  };
}

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findActiveTerm: vi.fn(),
  findTerm: vi.fn(),
  countClasses: vi.fn(),
  countTeachers: vi.fn(),
  countStudents: vi.fn(),
  countAudits: vi.fn(),
}));

vi.mock("@/lib/db/client", () => ({
  db: {
    term: {
      findFirst: mocks.findActiveTerm,
      findUnique: mocks.findTerm,
    },
    class: { count: mocks.countClasses },
    teacher: { count: mocks.countTeachers },
    student: { count: mocks.countStudents },
    auditLog: { count: mocks.countAudits },
  },
}));

import { getAdminStats } from "@/lib/dashboard/queries";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.findActiveTerm.mockResolvedValue(null);
  mocks.countTeachers.mockResolvedValue(2);
  mocks.countStudents.mockResolvedValue(3);
  mocks.countAudits.mockResolvedValue(0);
});

describe("getAdminStats account visibility", () => {
  it("uses the same active-identity filters as the Admin user lists", async () => {
    await expect(getAdminStats()).resolves.toMatchObject({
      teacherCount: 2,
      studentCount: 3,
    });

    expect(mocks.countTeachers).toHaveBeenCalledWith({
      where: { user: { deletedAt: null } },
    });
    expect(mocks.countStudents).toHaveBeenCalledWith({
      where: { anonymized: false, user: { deletedAt: null } },
    });
  });
});

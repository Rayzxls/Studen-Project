// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  revalidatePath: vi.fn(),
  redirect: vi.fn(() => {
    // The real one throws NEXT_REDIRECT so nothing after it runs.
    throw new Error("NEXT_REDIRECT");
  }),
  archiveCourseOffering: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/lib/course/archive", () => ({
  archiveCourseOffering: mocks.archiveCourseOffering,
}));
vi.mock("@/lib/auth/guards", () => ({
  requireRole: () => Promise.resolve({ user: { id: "teacher-1" } }),
}));
vi.mock("@/lib/utils/request", () => ({
  getRequestMeta: () => Promise.resolve({ ipAddress: null, userAgent: null }),
}));

const { archiveCourseAction } =
  await import("@/app/teacher/courses/[id]/settings/actions");

const COURSE_ID = "course-1";

function archiveForm(): FormData {
  const form = new FormData();
  form.set("courseId", COURSE_ID);
  form.set("reason", "จบภาคเรียนแล้ว");
  return form;
}

beforeEach(() => {
  mocks.revalidatePath.mockClear();
  mocks.redirect.mockClear();
  mocks.archiveCourseOffering.mockClear();
  mocks.archiveCourseOffering.mockResolvedValue(undefined);
});

describe("archiveCourseAction", () => {
  it("redirects off the course instead of returning to a page that no longer resolves", async () => {
    await expect(archiveCourseAction({}, archiveForm())).rejects.toThrow(
      "NEXT_REDIRECT"
    );

    expect(mocks.archiveCourseOffering).toHaveBeenCalledOnce();
    expect(mocks.redirect).toHaveBeenCalledWith("/teacher/courses");
  });

  it("never revalidates a course-scoped path, which would render notFound", async () => {
    // The teacher queries filter on `archivedAt: null`, so re-rendering any
    // /teacher/courses/<id>/… page as part of the action response is a 404 in
    // the user's face. This is what made archiving from Settings look broken.
    await expect(archiveCourseAction({}, archiveForm())).rejects.toThrow(
      "NEXT_REDIRECT"
    );

    const revalidated = mocks.revalidatePath.mock.calls.map(([path]) => path);
    expect(revalidated).not.toContain(`/teacher/courses/${COURSE_ID}`);
    for (const path of revalidated) {
      expect(path.startsWith(`/teacher/courses/${COURSE_ID}/`)).toBe(false);
    }
    expect(revalidated).toContain("/teacher/courses");
  });
});

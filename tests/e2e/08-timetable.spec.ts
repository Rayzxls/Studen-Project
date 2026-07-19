import { expect, test, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import {
  enrollStudent,
  setupTestCourse,
  type TestCourseContext,
} from "../integration/permissions/_fixtures";
import { signIn, signOut } from "./helpers";

const db = new PrismaClient();
const PASSWORD = "Test1234!";

let ctx: TestCourseContext | undefined;

async function chooseTime(
  page: Page,
  field: "startTime" | "endTime",
  hour: string,
  minute: string
) {
  const picker = page.getByTestId(`time-picker-${field}`);
  await picker.locator("button").first().click();
  const panel = picker.getByRole("dialog");
  await panel.getByTestId(`time-picker-hour-${hour}`).click();
  await panel.getByTestId(`time-picker-minute-${minute}`).click();
}

test.beforeAll(async () => {
  ctx = await setupTestCourse();
  await Promise.all([
    enrollStudent(ctx.courseOfferingId, ctx.studentUserId),
    db.user.update({
      where: { id: ctx.teacherUserId },
      data: { themeMode: "DARK" },
    }),
    db.user.update({
      where: { id: ctx.studentUserId },
      data: { themeMode: "CREAM" },
    }),
  ]);
});

test.beforeEach(async () => {
  await db.rateLimitBucket.deleteMany({
    where: { id: { startsWith: "login:" } },
  });
});

test.afterAll(async () => {
  try {
    await ctx?.cleanup();
  } finally {
    await db.$disconnect();
  }
});

test("teacher manages a timetable slot and the enrolled student sees it read-only on mobile", async ({
  page,
}) => {
  const courseName = `Test Course ${ctx!.prefix}`;
  const teacherIdentifier = `${ctx!.prefix}_t1@test.local`;
  const studentIdentifier = `${ctx!.prefix}_s1`;

  await signIn(page, teacherIdentifier, PASSWORD);
  await page.goto("/teacher/timetable");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

  await page.getByTestId("timetable-add-slot").click();
  const createDialog = page.getByTestId("timetable-slot-dialog");
  await expect(createDialog).toHaveAttribute("data-mode", "create");
  await createDialog
    .locator("#timetable-course")
    .selectOption(ctx!.courseOfferingId);
  await createDialog.locator("#timetable-day").selectOption("3");
  await createDialog.locator("#timetable-location").fill("Room QA 101");
  await chooseTime(page, "startTime", "09", "10");
  await chooseTime(page, "endTime", "10", "15");
  await createDialog.getByTestId("timetable-save-slot").click();
  await expect(createDialog).toBeHidden();

  const teacherSlot = page
    .locator('[data-testid="timetable-slot"][data-view="desktop"]')
    .filter({ hasText: courseName })
    .first();
  await expect(teacherSlot).toBeVisible();
  await expect(teacherSlot).toContainText("Room QA 101");

  await teacherSlot.click();
  const editDialog = page.getByTestId("timetable-slot-dialog");
  await expect(editDialog).toHaveAttribute("data-mode", "edit");
  await editDialog.locator("#timetable-location").fill("Lab QA 204");
  await editDialog.getByTestId("timetable-save-slot").click();
  await expect(editDialog).toBeHidden();
  await expect(
    page.getByTestId("timetable-slot").filter({ hasText: "Lab QA 204" }).first()
  ).toBeVisible();

  const persisted = await db.timetableSlot.findFirstOrThrow({
    where: { courseOfferingId: ctx!.courseOfferingId },
    select: { dayOfWeek: true, startTime: true, endTime: true, location: true },
  });
  expect(persisted).toEqual({
    dayOfWeek: 3,
    startTime: "09:10",
    endTime: "10:15",
    location: "Lab QA 204",
  });

  await signOut(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page, studentIdentifier, PASSWORD);
  await page.goto("/student/timetable");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "cream");
  await page.locator('[data-testid="timetable-day-tab"][data-day="3"]').click();

  const studentSlot = page
    .locator('[data-testid="timetable-slot"][data-view="mobile"]')
    .filter({ hasText: courseName })
    .first();
  await expect(studentSlot).toBeVisible();
  await expect(studentSlot).toContainText("Lab QA 204");
  await expect(page.getByTestId("timetable-add-slot")).toHaveCount(0);
  await expect(page.getByTestId("timetable-slot-dialog")).toHaveCount(0);
  const mobileLayout = await page.evaluate(() => ({
    viewportWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(mobileLayout.scrollWidth).toBeLessThanOrEqual(
    mobileLayout.viewportWidth
  );

  await signOut(page);
  await page.setViewportSize({ width: 1280, height: 900 });
  await signIn(page, teacherIdentifier, PASSWORD);
  await page.goto("/teacher/timetable");
  await page
    .locator('[data-testid="timetable-slot"][data-view="desktop"]')
    .filter({ hasText: courseName })
    .first()
    .click();
  await page.getByTestId("timetable-delete-slot").click();
  await expect(page.getByTestId("timetable-slot-dialog")).toBeHidden();
  await expect(
    page.getByTestId("timetable-slot").filter({ hasText: courseName })
  ).toHaveCount(0);
  await expect(
    db.timetableSlot.count({
      where: { courseOfferingId: ctx!.courseOfferingId },
    })
  ).resolves.toBe(0);
});

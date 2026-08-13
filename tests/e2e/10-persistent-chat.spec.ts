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
let searchableTeacherName = "";
let searchableTeacherQuery = "";

async function expectResponsivePage(page: Page) {
  await expect(page.locator("main")).toBeVisible();
  await expect(page.locator("body")).not.toContainText("Application error");

  const layout = await page.evaluate(() => ({
    viewportWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(layout.scrollWidth).toBeLessThanOrEqual(layout.viewportWidth);
}

async function sendMessage(page: Page, body: string) {
  const composer = page.locator("#course-chat-message");
  await composer.fill(body);
  await page.getByRole("button", { name: "ส่งข้อความ" }).click();
  await expect(composer).toHaveValue("", { timeout: 30_000 });
  await expect(
    page.getByLabel("ข้อความในวิชา").getByText(body, { exact: true })
  ).toBeVisible();
}

async function expectMessage(page: Page, body: string) {
  await expect(
    page.getByLabel("ข้อความในวิชา").getByText(body, { exact: true })
  ).toBeVisible();
}

test.beforeAll(async () => {
  ctx = await setupTestCourse();
  await enrollStudent(ctx.courseOfferingId, ctx.studentUserId);

  const uniqueTeacherLastName = `Teacher${ctx.prefix.slice(-6)}`;
  searchableTeacherName = `Test ${uniqueTeacherLastName}`;
  searchableTeacherQuery = uniqueTeacherLastName;

  await Promise.all([
    db.teacher.update({
      where: { userId: ctx.teacherUserId },
      data: { lastName: uniqueTeacherLastName },
    }),
    db.user.update({
      where: { id: ctx.teacherUserId },
      data: { themeMode: "DARK" },
    }),
    db.user.update({
      where: { id: ctx.studentUserId },
      data: { themeMode: "CREAM" },
    }),
    db.user.update({
      where: { id: ctx.otherStudentUserId },
      data: { themeMode: "LIGHT" },
    }),
    db.user.update({
      where: { id: ctx.otherTeacherUserId },
      data: { themeMode: "SYSTEM" },
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

test("teacher and enrolled student share one Course Channel and can start a DM", async ({
  page,
}, testInfo) => {
  const courseId = ctx!.courseOfferingId;
  const teacherIdentifier = `${ctx!.prefix}_t1@test.local`;
  const studentIdentifier = `${ctx!.prefix}_s1@test.local`;
  const teacherMessage = `ข้อความจากครู ${Date.now()}`;
  const studentReply = `ข้อความตอบจากนักเรียน ${Date.now()}`;
  const directMessage = `ข้อความส่วนตัวถึงครู ${Date.now()}`;

  await page.setViewportSize({ width: 1440, height: 900 });
  await signIn(page, teacherIdentifier, PASSWORD);
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

  const teacherResponse = await page.goto(`/teacher/courses/${courseId}/chat`);
  expect(teacherResponse?.ok()).toBe(true);
  await expect(
    page.getByRole("heading", { name: "แชตประจำวิชา", level: 2 })
  ).toBeVisible();
  await sendMessage(page, teacherMessage);
  await expectResponsivePage(page);

  await expect(
    db.chatMessage.count({
      where: {
        body: teacherMessage,
        conversation: { courseOfferingId: courseId },
      },
    })
  ).resolves.toBe(1);
  await signOut(page);

  await expect(
    db.chatMessage.count({
      where: {
        body: teacherMessage,
        conversation: { courseOfferingId: courseId },
      },
    })
  ).resolves.toBe(1);

  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page, studentIdentifier, PASSWORD);
  await expect(page.locator("html")).toHaveAttribute("data-theme", "cream");

  const studentResponse = await page.goto(`/student/courses/${courseId}/chat`);
  expect(studentResponse?.ok()).toBe(true);
  await expectMessage(page, teacherMessage);
  await sendMessage(page, studentReply);
  await expectResponsivePage(page);

  await page.goto("/chat");
  await page.locator("#chat-person-search").fill(searchableTeacherQuery);
  await page.getByRole("button", { name: "ค้นหา" }).click();
  const result = page
    .getByLabel("ผลการค้นหา")
    .getByRole("button", { name: new RegExp(searchableTeacherName) });
  await expect(result).toBeVisible();
  await result.click();
  await page.waitForURL(/\/chat\/[^/]+$/);
  await sendMessage(page, directMessage);
  await expectResponsivePage(page);
  await page.screenshot({
    path: testInfo.outputPath("persistent-chat-student-mobile-cream.png"),
    fullPage: true,
    caret: "initial",
  });
  await signOut(page);

  await page.setViewportSize({ width: 1440, height: 900 });
  await signIn(page, teacherIdentifier, PASSWORD);
  await page.goto("/chat");
  await page
    .getByRole("button", { name: /Alice Tester/ })
    .first()
    .click();
  await page.waitForURL(/\/chat\/[^/]+$/);
  await expectMessage(page, directMessage);
  await expectResponsivePage(page);
});

test("Chat inbox stays responsive in Light and System themes", async ({
  page,
}, testInfo) => {
  const scenarios = [
    {
      identifier: `${ctx!.prefix}_s2@test.local`,
      expectedTheme: "light",
      viewport: { width: 1280, height: 800 },
      label: "light",
    },
    {
      identifier: `${ctx!.prefix}_t2@test.local`,
      expectedTheme: "light",
      viewport: { width: 430, height: 932 },
      label: "system-mobile",
    },
  ] as const;

  for (const scenario of scenarios) {
    await page.setViewportSize(scenario.viewport);
    await signIn(page, scenario.identifier, PASSWORD);
    await expect(page.locator("html")).toHaveAttribute(
      "data-theme",
      scenario.expectedTheme
    );

    const response = await page.goto("/chat");
    expect(response?.ok()).toBe(true);
    await expect(
      page.getByRole("heading", { name: "ข้อความ", level: 1 })
    ).toBeVisible();
    await expectResponsivePage(page);
    await page.screenshot({
      path: testInfo.outputPath(`persistent-chat-${scenario.label}.png`),
      fullPage: true,
      caret: "initial",
    });
    await signOut(page);
  }
});

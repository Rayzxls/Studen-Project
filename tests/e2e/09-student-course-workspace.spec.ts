import { expect, test, type Page } from "@playwright/test";
import { PrismaClient, type ThemeMode } from "@prisma/client";
import {
  enrollStudent,
  setupTestCourse,
  type TestCourseContext,
} from "../integration/permissions/_fixtures";
import { signIn, signOut } from "./helpers";

const db = new PrismaClient();
const PASSWORD = "Test1234!";

let ctx: TestCourseContext | undefined;

const coursePages = ["overview", "assignments", "members", "scores"] as const;

async function assertCourseWorkspace(
  page: Page,
  viewport: { width: number; height: number }
) {
  await page.setViewportSize(viewport);

  for (const route of coursePages) {
    const response = await page.goto(
      `/student/courses/${ctx!.courseOfferingId}/${route}`
    );

    expect(response?.ok(), `${route} should return a successful response`).toBe(
      true
    );
    await expect(page.locator("main")).toBeVisible();
    await expect(page.locator("body")).not.toContainText("Application error");

    const layout = await page.evaluate(() => ({
      viewportWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));
    expect(
      layout.scrollWidth,
      `${route} should not overflow the document horizontally`
    ).toBeLessThanOrEqual(layout.viewportWidth);
  }
}

test.beforeAll(async () => {
  ctx = await setupTestCourse();
  await enrollStudent(ctx.courseOfferingId, ctx.studentUserId);
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

test("student course workspace stays routable and responsive across every theme", async ({
  page,
}, testInfo) => {
  const studentIdentifier = `${ctx!.prefix}_s1`;
  const scenarios: Array<{
    theme: ThemeMode;
    expectedTheme: "light" | "dark" | "cream";
    viewport: { width: number; height: number };
  }> = [
    {
      theme: "DARK",
      expectedTheme: "dark",
      viewport: { width: 1440, height: 900 },
    },
    {
      theme: "CREAM",
      expectedTheme: "cream",
      viewport: { width: 390, height: 844 },
    },
    {
      theme: "LIGHT",
      expectedTheme: "light",
      viewport: { width: 1280, height: 800 },
    },
    {
      theme: "SYSTEM",
      expectedTheme: "light",
      viewport: { width: 430, height: 932 },
    },
  ];

  for (const scenario of scenarios) {
    await db.user.update({
      where: { id: ctx!.studentUserId },
      data: { themeMode: scenario.theme },
    });

    await signIn(page, studentIdentifier, PASSWORD);
    await expect(page.locator("html")).toHaveAttribute(
      "data-theme",
      scenario.expectedTheme
    );
    await assertCourseWorkspace(page, scenario.viewport);
    await page.screenshot({
      path: testInfo.outputPath(
        `student-course-${scenario.theme.toLowerCase()}.png`
      ),
      fullPage: true,
      caret: "initial",
    });
    await signOut(page);
  }
});

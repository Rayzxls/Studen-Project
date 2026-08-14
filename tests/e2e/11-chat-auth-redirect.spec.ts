import { expect, test } from "@playwright/test";

test("unauthenticated persistent Chat pages redirect to Login", async ({
  page,
}) => {
  for (const path of [
    "/chat",
    "/chat/course/course-probe",
    "/chat/conversation-probe",
  ]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/login$/);
  }
});

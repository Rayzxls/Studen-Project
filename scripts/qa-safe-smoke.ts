const baseUrl = (process.env.QA_BASE_URL ?? "http://localhost:3000").replace(
  /\/$/,
  ""
);
const pilotCourseId = process.env.QA_PILOT_COURSE_ID?.trim();

export {};

type Check = {
  name: string;
  path: string;
  accept: (response: Response) => boolean;
};

const isLoginRedirect = (response: Response) => {
  if (![302, 303, 307, 308].includes(response.status)) return false;
  return (response.headers.get("location") ?? "").includes("/login");
};

const isRoleGateRedirect = (response: Response) => {
  if (![302, 303, 307, 308].includes(response.status)) return false;
  const location = response.headers.get("location") ?? "";
  return location.includes("/login") || location.includes("/dashboard");
};

const checks: Check[] = [
  ...["/", "/login", "/signup", "/privacy"].map((path) => ({
    name: `public ${path}`,
    path,
    accept: (response: Response) => response.status === 200,
  })),
  {
    name: "protected /dashboard",
    path: "/dashboard",
    accept: isLoginRedirect,
  },
  ...[
    "/teacher/courses",
    "/teacher/timetable",
    "/student/courses",
    "/student/timetable",
    "/admin/dashboard",
  ].map((path) => ({
    name: `protected ${path}`,
    path,
    accept: isRoleGateRedirect,
  })),
  ...(pilotCourseId
    ? [
        `/teacher/courses/${pilotCourseId}/quizzes`,
        `/student/courses/${pilotCourseId}/quizzes`,
        `/admin/courses/${pilotCourseId}/quizzes`,
      ].map((path) => ({
        name: `protected pilot ${path}`,
        path,
        accept: isRoleGateRedirect,
      }))
    : []),
  ...[
    "/teacher/courses/not-a-course/scores/export",
    "/teacher/courses/not-a-course/attendance/export",
  ].map((path) => ({
    name: `protected export ${path}`,
    path,
    accept: (response: Response) =>
      response.status === 401 || isLoginRedirect(response),
  })),
];

async function main() {
  let failed = 0;
  for (const check of checks) {
    try {
      const response = await fetch(`${baseUrl}${check.path}`, {
        redirect: "manual",
        headers: { "user-agent": "beagle-safe-qa/1.0" },
      });
      if (check.accept(response)) {
        console.log(`PASS ${check.name} (${response.status})`);
      } else {
        failed += 1;
        console.error(
          `FAIL ${check.name} (${response.status}, location=${response.headers.get("location") ?? "-"})`
        );
      }
    } catch (error) {
      failed += 1;
      console.error(`FAIL ${check.name}: ${String(error)}`);
    }
  }

  if (failed > 0) {
    console.error(`\nSafe QA failed: ${failed}/${checks.length}`);
    process.exitCode = 1;
  } else {
    console.log(`\nSafe QA passed: ${checks.length}/${checks.length}`);
  }
}

void main();

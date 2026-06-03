/**
 * Phase 1 End-to-End Smoke Test
 * Runs HTTP requests against a live dev server (http://localhost:3000)
 *
 * Usage:
 *   1. In one terminal: pnpm dev
 *   2. In another:      pnpm exec dotenv -e .env.local -- tsx scripts/smoke-test.ts
 */

import { PrismaClient } from "@prisma/client";

const BASE = "http://localhost:3000";
const db = new PrismaClient();

let passed = 0;
let failed = 0;
const failures: string[] = [];

function pass(name: string) {
  passed++;
  console.log(`  \x1b[32m✓\x1b[0m ${name}`);
}

function fail(name: string, msg: string) {
  failed++;
  failures.push(`${name}: ${msg}`);
  console.log(`  \x1b[31m✗\x1b[0m ${name}\n      ${msg}`);
}

async function expect(name: string, cond: boolean, msg = "assertion failed") {
  if (cond) pass(name);
  else fail(name, msg);
}

// ────── HTTP helpers ──────

/** Parse Set-Cookie list, dedupe by name (last-write-wins), return Cookie header string */
function cookiesFromSetCookie(setCookies: string[]): string {
  const map = new Map<string, string>();
  for (const sc of setCookies) {
    const nv = sc.split(";")[0];
    const eq = nv.indexOf("=");
    if (eq < 0) continue;
    const name = nv.slice(0, eq).trim();
    const value = nv.slice(eq + 1).trim();
    if (value === "") continue; // cookie deletion
    map.set(name, value);
  }
  return [...map.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}

async function getCsrf(): Promise<{ token: string; cookie: string }> {
  const r = await fetch(`${BASE}/api/auth/csrf`);
  const j = (await r.json()) as { csrfToken: string };
  const cookie = cookiesFromSetCookie(r.headers.getSetCookie());
  return { token: j.csrfToken, cookie };
}

/** Sign in via Credentials. Returns session cookie string or null. */
async function signin(
  identifier: string,
  password: string,
  debug = false
): Promise<string | null> {
  const { token, cookie } = await getCsrf();
  if (debug) {
    console.log(`    [debug] csrf token=${token.slice(0, 20)}...`);
    console.log(`    [debug] sending cookie="${cookie}"`);
  }
  const r = await fetch(`${BASE}/api/auth/callback/credentials`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Cookie: cookie,
    },
    redirect: "manual",
    body: new URLSearchParams({
      csrfToken: token,
      identifier,
      password,
      callbackUrl: "/dashboard",
      json: "true",
    }),
  });

  const setCookies = r.headers.getSetCookie();
  if (debug) {
    console.log(`    [debug] signin status=${r.status}`);
    console.log(`    [debug] location=${r.headers.get("location")}`);
    console.log(`    [debug] cookies returned: ${setCookies.length}`);
  }
  const hasSession = setCookies.some(
    (c) =>
      c.includes("session-token") && !c.startsWith("authjs.session-token=;")
  );
  if (!hasSession) return null;

  return cookiesFromSetCookie(setCookies);
}

async function getWithCookie(path: string, cookie?: string) {
  return fetch(`${BASE}${path}`, {
    headers: cookie ? { Cookie: cookie } : {},
    redirect: "manual",
  });
}

// ────── Test sections ──────

async function testPublicPages() {
  console.log("\n📄 Public pages");
  for (const path of [
    "/",
    "/login",
    "/signup",
    "/privacy",
    "/reset-password",
  ]) {
    const r = await getWithCookie(path);
    await expect(
      `GET ${path}`,
      r.status === 200,
      `expected 200, got ${r.status}`
    );
  }
}

async function testProtectedRedirect() {
  console.log("\n🔒 Protected route redirects to /login");
  const r = await getWithCookie("/dashboard");
  await expect(
    "GET /dashboard (no cookie) → 307",
    r.status === 307 || r.status === 302,
    `expected redirect, got ${r.status}`
  );
  const loc = r.headers.get("location") ?? "";
  await expect(
    "Redirect target is /login",
    loc.includes("/login") || loc.includes("/api/auth"),
    `got: ${loc}`
  );
}

async function testLoginEachRole() {
  console.log("\n🔑 Login per role");
  const cases = [
    {
      id: "admin@studennnn.local",
      pw: "Admin1234!",
      role: "ADMIN",
      label: "ผู้ดูแลระบบ",
    },
    {
      id: "teacher@studennnn.local",
      pw: "Teacher1234!",
      role: "TEACHER",
      label: "ครู",
    },
    { id: "60001", pw: "Student1234", role: "STUDENT", label: "นักเรียน" },
  ];

  for (const c of cases) {
    const cookie = await signin(c.id, c.pw, /*debug=*/ !cases.indexOf(c));
    await expect(
      `Login ${c.role} (${c.id})`,
      !!cookie,
      "no session cookie returned"
    );
    if (!cookie) continue;

    const r = await getWithCookie("/dashboard", cookie);
    const body = await r.text();
    await expect(
      `GET /dashboard as ${c.role} → 200`,
      r.status === 200,
      `got ${r.status}`
    );
    await expect(
      `/dashboard contains role label "${c.label}"`,
      body.includes(c.label),
      "label not found in body"
    );
  }
}

async function testWrongPasswordRejected() {
  console.log("\n🚫 Wrong password rejected");
  const cookie = await signin("admin@studennnn.local", "WrongPassword!");
  await expect(
    "Wrong password returns no session cookie",
    !cookie,
    "unexpectedly got a session cookie"
  );
}

async function testRateLimitLockout() {
  console.log("\n⏱️  Rate limit lockout (5 fails → locked)");

  // Use a unique identifier so we don't pollute admin's bucket
  const id = `ratelimit-test-${Date.now()}@example.com`;

  // First, ensure no existing bucket
  await db.rateLimitBucket
    .delete({ where: { id: `login:${id}` } })
    .catch(() => {});

  for (let i = 1; i <= 5; i++) {
    await signin(id, "wrong");
  }

  // The 5th attempt should set the bucket to count=5; 6th locks
  const bucket = await db.rateLimitBucket.findUnique({
    where: { id: `login:${id}` },
  });

  await expect("Rate limit bucket created", !!bucket, "no bucket found");
  if (bucket) {
    await expect(
      "Bucket count >= 5 after 5 attempts",
      bucket.count >= 5,
      `count=${bucket.count}`
    );
  }

  // Cleanup
  await db.rateLimitBucket
    .delete({ where: { id: `login:${id}` } })
    .catch(() => {});
}

async function testStudentSignup() {
  console.log("\n🎓 Student self-register");

  const newId = `8${Math.floor(Math.random() * 100000)
    .toString()
    .padStart(5, "0")}`;

  const r1 = await fetch(`${BASE}/api/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      studentId: newId,
      firstName: "Smoke",
      lastName: "Test",
      password: "smokepass1234",
      confirmPassword: "smokepass1234",
      consent: true,
      turnstileToken: "dummy-dev-token",
    }),
  });
  await expect(
    `POST /api/signup new student ${newId} → 201`,
    r1.status === 201,
    `got ${r1.status}: ${await r1.text()}`
  );

  // Verify user in DB
  const user = await db.user.findUnique({
    where: { identifier: newId },
    include: { student: true },
  });
  await expect(
    "User created in DB with STUDENT role",
    user?.role === "STUDENT" && user.student?.studentId === newId,
    JSON.stringify(user, null, 2)
  );

  // Duplicate signup → 409
  const r2 = await fetch(`${BASE}/api/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      studentId: newId,
      firstName: "Smoke",
      lastName: "Test",
      password: "smokepass1234",
      confirmPassword: "smokepass1234",
      consent: true,
      turnstileToken: "dummy-dev-token",
    }),
  });
  await expect(
    "Duplicate studentId → 409",
    r2.status === 409,
    `got ${r2.status}`
  );

  // Now login with the new student
  const cookie = await signin(newId, "smokepass1234");
  await expect(
    `Login as newly-registered student ${newId}`,
    !!cookie,
    "could not login after signup"
  );

  // Cleanup
  if (user) {
    await db.auditLog.deleteMany({ where: { actorId: user.id } });
    await db.student.delete({ where: { userId: user.id } });
    await db.user.delete({ where: { id: user.id } });
  }
}

async function testSignupValidation() {
  console.log("\n✏️  Signup validation");

  const bad = await fetch(`${BASE}/api/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      studentId: "abc",
      firstName: "",
      lastName: "X",
      password: "short",
      confirmPassword: "different",
      consent: false,
      turnstileToken: "",
    }),
  });
  await expect("Invalid signup → 400", bad.status === 400, `got ${bad.status}`);

  const body = (await bad.json()) as {
    error: { code: string; details: Record<string, string> };
  };
  await expect(
    "Returns validation_error code",
    body.error.code === "validation_error",
    body.error.code
  );
  await expect(
    "Reports per-field errors",
    Object.keys(body.error.details).length > 0,
    JSON.stringify(body.error.details)
  );
}

async function testForceResetRedirect() {
  console.log("\n🔄 Force reset password flow");

  // Set student 60001 to mustResetPwd=true
  await db.user.update({
    where: { identifier: "60001" },
    data: { mustResetPwd: true },
  });

  const cookie = await signin("60001", "Student1234");
  await expect("Login with mustResetPwd=true succeeds", !!cookie, "no cookie");
  if (!cookie) {
    // Reset and abort
    await db.user.update({
      where: { identifier: "60001" },
      data: { mustResetPwd: false },
    });
    return;
  }

  // GET /dashboard should redirect to /reset-password/force
  const r = await getWithCookie("/dashboard", cookie);
  await expect(
    "/dashboard redirects (force reset interception)",
    r.status === 307 || r.status === 302,
    `got ${r.status}`
  );
  const loc = r.headers.get("location") ?? "";
  await expect(
    "Redirect target is /reset-password/force",
    loc.includes("/reset-password/force"),
    `got: ${loc}`
  );

  // GET /reset-password/force should be 200
  const r2 = await getWithCookie("/reset-password/force", cookie);
  await expect(
    "/reset-password/force → 200",
    r2.status === 200,
    `got ${r2.status}`
  );

  // Cleanup
  await db.user.update({
    where: { identifier: "60001" },
    data: { mustResetPwd: false },
  });
}

async function testPhase2Join() {
  console.log("\n📚 Phase 2: Join course via class code");

  // Setup: ensure the demo course exists with a fresh student NOT yet enrolled
  const demoCode = "MATH4A-DEMO1";
  const course = await db.courseOffering.findUnique({
    where: { classCode: demoCode },
    select: { id: true },
  });
  if (!course) {
    fail(
      "Phase 2 setup",
      `Demo course code "${demoCode}" not in DB — run pnpm db:seed`
    );
    return;
  }

  // Use a unique signup student so we don't conflict
  const newId = `7${Math.floor(Math.random() * 100000)
    .toString()
    .padStart(5, "0")}`;
  const signupRes = await fetch(`${BASE}/api/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      studentId: newId,
      firstName: "Join",
      lastName: "Test",
      password: "joinpass1234",
      confirmPassword: "joinpass1234",
      consent: true,
      turnstileToken: "dummy-dev-token",
    }),
  });
  await expect(
    `Create test student ${newId}`,
    signupRes.status === 201,
    `signup got ${signupRes.status}`
  );

  const cookie = await signin(newId, "joinpass1234");
  await expect("Login as test student", !!cookie, "no cookie");
  if (!cookie) return;

  // Join with valid code
  const joinRes = await fetch(`${BASE}/api/join`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({ code: demoCode }),
  });
  const joinData = (await joinRes.json()) as {
    success?: boolean;
    courseName?: string;
    error?: { code: string };
  };
  await expect(
    "POST /api/join with valid code → 200",
    joinRes.status === 200,
    `got ${joinRes.status}: ${JSON.stringify(joinData)}`
  );
  await expect(
    "Response contains courseName",
    joinData.courseName === "คณิตศาสตร์ ม.4/2 ครูสมชาย",
    `got: ${joinData.courseName}`
  );

  // Verify enrollment row exists
  const user = await db.user.findUnique({
    where: { identifier: newId },
    select: { id: true },
  });
  if (user) {
    const enrolled = await db.enrollment.findFirst({
      where: { studentId: user.id, courseOfferingId: course.id },
    });
    await expect(
      "Enrollment row created in DB",
      !!enrolled,
      "no enrollment found"
    );
  }

  // Duplicate join → 409
  const dup = await fetch(`${BASE}/api/join`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({ code: demoCode }),
  });
  await expect("Duplicate join → 409", dup.status === 409, `got ${dup.status}`);

  // Invalid code → 404
  const bad = await fetch(`${BASE}/api/join`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({ code: "FAKE99-XXXX99" }),
  });
  await expect("Invalid code → 404", bad.status === 404, `got ${bad.status}`);

  // Malformed code → 400
  const malformed = await fetch(`${BASE}/api/join`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({ code: "no hyphen" }),
  });
  await expect(
    "Malformed code → 400",
    malformed.status === 400,
    `got ${malformed.status}`
  );

  // GET /teacher/courses as student → forbidden (redirect)
  const tcRes = await getWithCookie("/teacher/courses", cookie);
  await expect(
    "Student GET /teacher/courses → redirect (not allowed)",
    tcRes.status === 307 || tcRes.status === 302,
    `got ${tcRes.status}`
  );

  // Teacher login + create course flow
  const teacherCookie = await signin("teacher@studennnn.local", "Teacher1234!");
  if (!teacherCookie) {
    fail("Teacher login for course creation", "no cookie");
    return;
  }

  const tcOk = await getWithCookie("/teacher/courses", teacherCookie);
  await expect(
    "Teacher GET /teacher/courses → 200",
    tcOk.status === 200,
    `got ${tcOk.status}`
  );
  const tcBody = await tcOk.text();
  await expect(
    "Teacher courses page shows demo course",
    tcBody.includes("คณิตศาสตร์ ม.4/2") || tcBody.includes("MATH4A-DEMO1"),
    "demo course not listed"
  );

  // Cleanup test student
  if (user) {
    await db.auditLog.deleteMany({ where: { actorId: user.id } });
    await db.enrollment.deleteMany({ where: { studentId: user.id } });
    await db.student.delete({ where: { userId: user.id } });
    await db.user.delete({ where: { id: user.id } });
  }
}

async function testPhase3CourseTabs() {
  console.log("\n🎓 Phase 3: course tab shell + L1 visibility");

  const demoCode = "MATH4A-DEMO1";
  const course = await db.courseOffering.findUnique({
    where: { classCode: demoCode },
    select: { id: true },
  });
  if (!course) {
    fail(
      "Phase 3 setup",
      `Demo course "${demoCode}" missing — run pnpm db:seed`
    );
    return;
  }

  // ── Teacher 3 tabs ──────────────────────────────────────────────
  const teacherCookie = await signin("teacher@studennnn.local", "Teacher1234!");
  if (!teacherCookie) {
    fail("Teacher login (Phase 3)", "no cookie");
    return;
  }

  const tOverview = await getWithCookie(
    `/teacher/courses/${course.id}`,
    teacherCookie
  );
  await expect(
    "Teacher GET Overview → 200",
    tOverview.status === 200,
    `got ${tOverview.status}`
  );
  const tOverviewBody = await tOverview.text();
  await expect(
    "Teacher Overview shows class code",
    tOverviewBody.includes(demoCode),
    "demo code missing from overview"
  );
  await expect(
    "Teacher Overview links to /members tab",
    tOverviewBody.includes(`/teacher/courses/${course.id}/members`),
    "members link not present"
  );

  const tMembers = await getWithCookie(
    `/teacher/courses/${course.id}/members`,
    teacherCookie
  );
  await expect(
    "Teacher GET Members → 200",
    tMembers.status === 200,
    `got ${tMembers.status}`
  );
  const tMembersBody = await tMembers.text();
  await expect(
    "Teacher Members shows seed student (60001)",
    tMembersBody.includes("60001"),
    "studentId 60001 not rendered for teacher"
  );
  await expect(
    "Teacher Members shows remove affordance",
    tMembersBody.includes("นำออก"),
    "remove button label missing"
  );

  const tSettings = await getWithCookie(
    `/teacher/courses/${course.id}/settings`,
    teacherCookie
  );
  await expect(
    "Teacher GET Settings → 200",
    tSettings.status === 200,
    `got ${tSettings.status}`
  );
  const tSettingsBody = await tSettings.text();
  await expect(
    "Teacher Settings shows class code controls",
    tSettingsBody.includes("สร้างรหัสใหม่") &&
      (tSettingsBody.includes("ปิดรหัส") ||
        tSettingsBody.includes("เปิดรหัสอีกครั้ง")),
    "regen or toggle button missing"
  );

  // ── Student 2 tabs (60001 seeded in MATH4A-DEMO1) ───────────────
  const studentCookie = await signin("60001", "Student1234");
  if (!studentCookie) {
    fail("Student login (Phase 3)", "no cookie");
    return;
  }

  const sOverview = await getWithCookie(
    `/student/courses/${course.id}`,
    studentCookie
  );
  await expect(
    "Student GET own course Overview → 200",
    sOverview.status === 200,
    `got ${sOverview.status}`
  );
  const sOverviewBody = await sOverview.text();
  await expect(
    "L1: student Overview does NOT contain class code",
    !sOverviewBody.includes(demoCode),
    "class code leaked to student view"
  );

  const sMembers = await getWithCookie(
    `/student/courses/${course.id}/members`,
    studentCookie
  );
  await expect(
    "Student GET own course Members → 200",
    sMembers.status === 200,
    `got ${sMembers.status}`
  );
  const sMembersBody = await sMembers.text();
  await expect(
    "L1: student Members does NOT contain peer studentIds",
    !sMembersBody.includes("60001") ||
      sMembersBody.match(/60001/g)!.length === 0,
    "studentId 60001 found in student Members body (PII leak)"
  );

  // ── Role boundaries ─────────────────────────────────────────────
  const sToTeacher = await getWithCookie(
    `/teacher/courses/${course.id}`,
    studentCookie
  );
  await expect(
    "Student → /teacher/courses/[id] redirected",
    sToTeacher.status === 307 || sToTeacher.status === 302,
    `got ${sToTeacher.status}`
  );

  const sToSettings = await getWithCookie(
    `/teacher/courses/${course.id}/settings`,
    studentCookie
  );
  await expect(
    "Student → /teacher/courses/[id]/settings redirected",
    sToSettings.status === 307 || sToSettings.status === 302,
    `got ${sToSettings.status}`
  );

  // ── L1 gate: student tries to view another course ───────────────
  // Create a second course owned by teacher but never joined by 60001.
  // For smoke purposes we lazily look for any OTHER course in the DB.
  const otherCourse = await db.courseOffering.findFirst({
    where: { id: { not: course.id } },
    select: { id: true },
  });
  if (otherCourse) {
    const sForeign = await getWithCookie(
      `/student/courses/${otherCourse.id}`,
      studentCookie
    );
    await expect(
      "L1: student GET non-enrolled course → 404",
      sForeign.status === 404,
      `got ${sForeign.status}`
    );
  } else {
    pass("L1: non-enrolled course check (skipped — only 1 course seeded)");
  }
}

async function testPhase4Attendance() {
  console.log("\n📅 Phase 4: attendance + timetable + L1");

  const demoCode = "MATH4A-DEMO1";
  const course = await db.courseOffering.findUnique({
    where: { classCode: demoCode },
    select: { id: true, teacherId: true },
  });
  if (!course) {
    fail(
      "Phase 4 setup",
      `Demo course "${demoCode}" missing — run pnpm db:seed`
    );
    return;
  }

  // ── Teacher: attendance list + slot editor ──────────────────────
  const teacherCookie = await signin("teacher@studennnn.local", "Teacher1234!");
  if (!teacherCookie) {
    fail("Teacher login (Phase 4)", "no cookie");
    return;
  }

  const tAttn = await getWithCookie(
    `/teacher/courses/${course.id}/attendance`,
    teacherCookie
  );
  await expect(
    "Teacher GET /attendance → 200",
    tAttn.status === 200,
    `got ${tAttn.status}`
  );
  const tAttnBody = await tAttn.text();
  await expect(
    "Teacher Attendance shows 'เปิดคาบ' CTA",
    tAttnBody.includes("เปิดคาบ"),
    "open-session CTA missing"
  );
  await expect(
    "Teacher Attendance tab is reachable from course shell",
    tAttnBody.includes(`/teacher/courses/${course.id}`),
    "course shell missing"
  );

  const tSettings = await getWithCookie(
    `/teacher/courses/${course.id}/settings`,
    teacherCookie
  );
  await expect(
    "Teacher Settings shows timetable editor",
    (await tSettings.text()).includes("ตารางสอน"),
    "TimetableEditor card missing from Settings"
  );

  // Provision a one-off Session for the student-side smoke tests.
  // findOrCreate-style — if it exists, reuse. Avoids the back-edit window.
  const scheduledStart = new Date(Date.now() - 5 * 60 * 1000); // 5 min ago
  const scheduledEnd = new Date(Date.now() + 10 * 60 * 1000); // 10 min from now
  const session = await db.session.upsert({
    where: {
      courseOfferingId_scheduledStart: {
        courseOfferingId: course.id,
        scheduledStart,
      },
    },
    create: {
      courseOfferingId: course.id,
      scheduledStart,
      scheduledEnd,
      createdById: course.teacherId,
    },
    update: {},
    select: { id: true },
  });

  const tGrid = await getWithCookie(
    `/teacher/courses/${course.id}/attendance/${session.id}`,
    teacherCookie
  );
  await expect(
    "Teacher GET /attendance/[sessionId] → 200",
    tGrid.status === 200,
    `got ${tGrid.status}`
  );
  const tGridBody = await tGrid.text();
  await expect(
    "Teacher grid page shows cancel-session button",
    tGridBody.includes("ยกเลิกคาบ"),
    "cancel CTA missing"
  );
  await expect(
    "Teacher grid page shows submit button",
    tGridBody.includes("บันทึกการเช็คชื่อ"),
    "submit button missing"
  );

  // ── Student: attendance L1 view ─────────────────────────────────
  const studentCookie = await signin("60001", "Student1234");
  if (!studentCookie) {
    fail("Student login (Phase 4)", "no cookie");
    return;
  }

  const sAttn = await getWithCookie(
    `/student/courses/${course.id}/attendance`,
    studentCookie
  );
  await expect(
    "Student GET own /attendance → 200",
    sAttn.status === 200,
    `got ${sAttn.status}`
  );
  const sAttnBody = await sAttn.text();
  await expect(
    "Student attendance shows KPI 'อัตราการมาเรียน'",
    sAttnBody.includes("อัตราการมาเรียน"),
    "KPI heading missing"
  );
  await expect(
    "Student attendance shows 4-status counts (มา/สาย/ลา/ขาด)",
    sAttnBody.includes("มา") &&
      sAttnBody.includes("สาย") &&
      sAttnBody.includes("ลา") &&
      sAttnBody.includes("ขาด"),
    "status labels missing"
  );

  // ── L1: student cannot reach teacher attendance routes ──────────
  const sToTeacherAttn = await getWithCookie(
    `/teacher/courses/${course.id}/attendance`,
    studentCookie
  );
  await expect(
    "Student → /teacher/.../attendance redirected",
    sToTeacherAttn.status === 307 || sToTeacherAttn.status === 302,
    `got ${sToTeacherAttn.status}`
  );

  const sToTeacherGrid = await getWithCookie(
    `/teacher/courses/${course.id}/attendance/${session.id}`,
    studentCookie
  );
  await expect(
    "Student → /teacher/.../attendance/[sessionId] redirected",
    sToTeacherGrid.status === 307 || sToTeacherGrid.status === 302,
    `got ${sToTeacherGrid.status}`
  );

  // ── L1: non-member student attendance page → redirect ───────────
  const otherCourse = await db.courseOffering.findFirst({
    where: { id: { not: course.id } },
    select: { id: true },
  });
  if (otherCourse) {
    const sForeignAttn = await getWithCookie(
      `/student/courses/${otherCourse.id}/attendance`,
      studentCookie
    );
    await expect(
      "Student → non-enrolled /student/.../attendance redirected",
      sForeignAttn.status === 307 || sForeignAttn.status === 302,
      `got ${sForeignAttn.status}`
    );
  } else {
    pass("L1: non-enrolled attendance check (skipped — only 1 course seeded)");
  }

  // Cleanup the smoke Session (and any orphan AttendanceRecord from prior runs).
  await db.attendanceRecord.deleteMany({ where: { sessionId: session.id } });
  await db.session.delete({ where: { id: session.id } });
}

async function testPhase5Scoring() {
  console.log("\n📊 Phase 5: scoring + Term GPA + transcript");

  const demoCode = "MATH4A-DEMO1";
  const course = await db.courseOffering.findUnique({
    where: { classCode: demoCode },
    select: { id: true, teacherId: true, termId: true },
  });
  if (!course) {
    fail(
      "Phase 5 setup",
      `Demo course "${demoCode}" missing — run pnpm db:seed`
    );
    return;
  }

  // ── Teacher: Scores tab + per-item grid ─────────────────────────
  const teacherCookie = await signin("teacher@studennnn.local", "Teacher1234!");
  if (!teacherCookie) {
    fail("Teacher login (Phase 5)", "no cookie");
    return;
  }

  const tScores = await getWithCookie(
    `/teacher/courses/${course.id}/scores`,
    teacherCookie
  );
  await expect(
    "Teacher GET /scores → 200",
    tScores.status === 200,
    `got ${tScores.status}`
  );
  const tScoresBody = await tScores.text();
  await expect(
    "Teacher Scores shows '+ เพิ่มรายการคะแนน' CTA",
    tScoresBody.includes("เพิ่มรายการคะแนน"),
    "create CTA missing"
  );
  await expect(
    "Teacher Scores shows Σ weight pill",
    tScoresBody.includes("Σ น้ำหนัก"),
    "weight sum pill missing"
  );
  await expect(
    "Teacher Scores tab is reachable from course shell",
    tScoresBody.includes(`/teacher/courses/${course.id}`),
    "course shell missing"
  );

  // Provision a one-off ScoreItem so the per-item grid renders.
  // Uses a marker name so we can clean up at end.
  const SMOKE_NAME = `__smoke_${Date.now().toString(36)}`;
  const scoreItem = await db.scoreItem.create({
    data: {
      courseOfferingId: course.id,
      name: SMOKE_NAME,
      fullScore: 10,
      weight: 10000,
      position: 999,
    },
    select: { id: true },
  });

  const tGrid = await getWithCookie(
    `/teacher/courses/${course.id}/scores/${scoreItem.id}`,
    teacherCookie
  );
  await expect(
    "Teacher GET /scores/[scoreItemId] → 200",
    tGrid.status === 200,
    `got ${tGrid.status}`
  );
  const tGridBody = await tGrid.text();
  await expect(
    "Teacher score grid shows 'ทุกคนคะแนนเต็ม' bulk action",
    tGridBody.includes("ทุกคนคะแนนเต็ม"),
    "bulk-fill CTA missing"
  );
  await expect(
    "Teacher score grid shows 'บันทึกคะแนน' submit",
    tGridBody.includes("บันทึกคะแนน"),
    "submit CTA missing"
  );

  // Settings page should now have the read-only thresholds card.
  const tSettings = await getWithCookie(
    `/teacher/courses/${course.id}/settings`,
    teacherCookie
  );
  await expect(
    "Teacher Settings shows 'เกณฑ์เกรด' read-only card (P5-4c)",
    (await tSettings.text()).includes("เกณฑ์เกรด"),
    "GradeThresholdsCard missing from Settings"
  );

  // ── Student: Scores tab + /student/terms ────────────────────────
  const studentCookie = await signin("60001", "Student1234");
  if (!studentCookie) {
    fail("Student login (Phase 5)", "no cookie");
    return;
  }

  const sScores = await getWithCookie(
    `/student/courses/${course.id}/scores`,
    studentCookie
  );
  await expect(
    "Student GET own /scores → 200",
    sScores.status === 200,
    `got ${sScores.status}`
  );
  const sScoresBody = await sScores.text();
  await expect(
    "Student Scores shows 'คะแนนรวม' KPI label",
    sScoresBody.includes("คะแนนรวม"),
    "KPI heading missing"
  );

  const sTerms = await getWithCookie(`/student/terms`, studentCookie);
  await expect(
    "Student GET /student/terms → 200",
    sTerms.status === 200,
    `got ${sTerms.status}`
  );
  const sTermsBody = await sTerms.text();
  await expect(
    "Student /terms shows 'GPA ภาคเรียน' headline",
    sTermsBody.includes("GPA ภาคเรียน"),
    "GPA headline missing"
  );
  await expect(
    "Student /terms shows 'Print PDF' button",
    sTermsBody.includes("Print PDF"),
    "Print PDF CTA missing"
  );

  // ── L1: student blocked from teacher score routes ───────────────
  const sToTeacherScores = await getWithCookie(
    `/teacher/courses/${course.id}/scores`,
    studentCookie
  );
  await expect(
    "Student → /teacher/.../scores redirected (L1)",
    sToTeacherScores.status === 307 || sToTeacherScores.status === 302,
    `got ${sToTeacherScores.status}`
  );
  const sToTeacherGrid = await getWithCookie(
    `/teacher/courses/${course.id}/scores/${scoreItem.id}`,
    studentCookie
  );
  await expect(
    "Student → /teacher/.../scores/[id] redirected (L1)",
    sToTeacherGrid.status === 307 || sToTeacherGrid.status === 302,
    `got ${sToTeacherGrid.status}`
  );

  // ── L1: non-enrolled student → own scores route redirected ──────
  const otherCourse = await db.courseOffering.findFirst({
    where: { id: { not: course.id } },
    select: { id: true },
  });
  if (otherCourse) {
    const sForeignScores = await getWithCookie(
      `/student/courses/${otherCourse.id}/scores`,
      studentCookie
    );
    await expect(
      "Student → non-enrolled /student/.../scores redirected (L1)",
      sForeignScores.status === 307 || sForeignScores.status === 302,
      `got ${sForeignScores.status}`
    );
  } else {
    pass("L1: non-enrolled scores check (skipped — only 1 course seeded)");
  }

  // Cleanup the smoke ScoreItem (and any entries it might have collected).
  await db.scoreEntry.deleteMany({ where: { scoreItemId: scoreItem.id } });
  await db.scoreItem.delete({ where: { id: scoreItem.id } });
}

async function testAuditLog() {
  console.log("\n📝 Audit log verification");

  const recent = await db.auditLog.findMany({
    orderBy: { timestamp: "desc" },
    take: 20,
    select: { action: true, ipAddress: true },
  });

  const actions = recent.map((r) => r.action);

  await expect(
    "Audit log has LOGIN_SUCCESS entries",
    actions.includes("LOGIN_SUCCESS"),
    `recent: ${[...new Set(actions)].join(", ")}`
  );
  await expect(
    "Audit log has LOGIN_FAILED entries",
    actions.includes("LOGIN_FAILED"),
    `recent: ${[...new Set(actions)].join(", ")}`
  );
  await expect(
    "Audit log captures IP address",
    recent.some((r) => r.ipAddress),
    "no entries have ipAddress"
  );
}

// ────── Main ──────

async function main() {
  console.log("\n╭───────────────────────────────────╮");
  console.log("│  Studennnn Phase 1 Smoke Test     │");
  console.log("╰───────────────────────────────────╯");

  // Verify server up
  try {
    const r = await fetch(BASE);
    if (r.status !== 200) throw new Error(`Status ${r.status}`);
  } catch (e) {
    console.error(`\n❌ Dev server not reachable at ${BASE}`);
    console.error("   Run \`pnpm dev\` in another terminal first.");
    console.error(`   Error: ${e}`);
    process.exit(1);
  }

  // Clean state: clear any prior rate-limit buckets from this test/IP
  await db.rateLimitBucket.deleteMany({
    where: {
      OR: [
        { id: { startsWith: "signup:" } },
        { id: { startsWith: "login:ratelimit-test-" } },
      ],
    },
  });
  console.log("\n🧹 Cleared prior rate-limit buckets");

  await testPublicPages();
  await testProtectedRedirect();
  await testLoginEachRole();
  await testWrongPasswordRejected();
  await testStudentSignup();
  await testSignupValidation();
  await testRateLimitLockout();
  await testForceResetRedirect();
  await testPhase2Join();
  await testPhase3CourseTabs();
  await testPhase4Attendance();
  await testPhase5Scoring();
  await testAuditLog();

  console.log(`\n╭───────────────────────────────────╮`);
  console.log(
    `│  Results: ${passed} passed · ${failed} failed`.padEnd(36) + "│"
  );
  console.log(`╰───────────────────────────────────╯\n`);

  if (failed > 0) {
    console.log("Failures:");
    for (const f of failures) console.log(`  ✗ ${f}`);
    process.exit(1);
  }
}

main()
  .then(() => db.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await db.$disconnect();
    process.exit(1);
  });

/**
 * Production bootstrap — creates the REAL initial data for a live trial,
 * replacing the demo seed (prisma/seed.ts which uses @studennnn.local accounts).
 *
 * Idempotent: every write is an upsert, so re-running is safe. Re-running does
 * NOT overwrite an existing account's password/name (use the Admin
 * reset-password flow to change a password later).
 *
 * ─────────────────────────────────────────────────────────────
 * HOW TO RUN (against the PRODUCTION database)
 * ─────────────────────────────────────────────────────────────
 *   1. Edit the CONFIG block below with your real values.
 *   2. Make sure the schema is applied to the prod DB first:
 *        DATABASE_URL=<prod> pnpm prisma db push
 *   3. Run the bootstrap with the prod DATABASE_URL in scope. Either put the
 *      prod URL in .env.local temporarily, or create .env.production.local
 *      and run:
 *        pnpm dlx dotenv-cli -e .env.production.local -- pnpm tsx prisma/bootstrap.ts
 *      (or simply: pnpm db:bootstrap   — which reads .env.local)
 *
 * Passwords are NEVER printed. Set them in CONFIG and share each privately.
 * Set `mustResetPwd: true` to force a person to choose their own password on
 * first login (recommended for anyone other than yourself).
 */

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

// ════════════════════════ CONFIG — edit these ════════════════════════

const CONFIG = {
  /** The single admin account (you). Identifier can be an email or a username. */
  admin: {
    identifier: "admin@example.com",
    password: "CHANGE-ME-strong-password",
    firstName: "ผู้ดูแล",
    lastName: "ระบบ",
    mustResetPwd: false,
  },

  /** Active academic year + its terms. */
  academicYear: { name: "2568", active: true },
  terms: [
    {
      number: 1,
      name: "เทอม 1/2568",
      startDate: "2025-05-15",
      endDate: "2025-09-30",
      active: true,
    },
    {
      number: 2,
      name: "เทอม 2/2568",
      startDate: "2025-11-01",
      endDate: "2026-03-31",
      active: false,
    },
  ],

  /** Homeroom classes the school has. `name` must be unique within the year. */
  classes: [{ name: "ม.4/2", gradeLevel: "ม.4" }],

  /** Teacher accounts (e.g. พ่อ / แม่). `homeroom` is an optional class name. */
  teachers: [
    {
      identifier: "teacher1@example.com",
      password: "CHANGE-ME",
      firstName: "ชื่อครู",
      lastName: "นามสกุล",
      email: "teacher1@example.com",
      homeroom: "ม.4/2" as string | null,
      mustResetPwd: true,
    },
  ],

  /**
   * Course workspaces. Each links a teacher → class → term. `classCode` is the
   * code students type at /join; leave "" to auto-derive a stable code.
   */
  courseOfferings: [
    {
      name: "คณิตศาสตร์ ม.4/2",
      subjectCode: "MATH-M4",
      gradeLevel: "ม.4",
      creditHours: 1.5,
      teacherIdentifier: "teacher1@example.com",
      className: "ม.4/2",
      termNumber: 1,
      classCode: "", // "" = auto
    },
  ],

  /**
   * Optional initial students. Leave empty [] to let students self-register at
   * /signup and join a class with its code. Identifier is the student number.
   */
  students: [] as {
    studentId: string;
    password: string;
    firstName: string;
    lastName: string;
    className: string;
    mustResetPwd: boolean;
  }[],
};

// ══════════════════════════════════════════════════════════════════════

const db = new PrismaClient();
const BCRYPT_COST = 12;
const CONSENT_VERSION = "1.0";

/** Deterministic short uppercase code from a string (djb2 → base36). */
function deriveCode(seed: string): string {
  let h = 5381;
  for (let i = 0; i < seed.length; i++) h = (h * 33) ^ seed.charCodeAt(i);
  const base = (h >>> 0).toString(36).toUpperCase().padStart(6, "0");
  return `J${base}`.slice(0, 7); // 7 chars, letter-prefixed
}

async function main() {
  console.log("🚀 Bootstrapping production data…\n");

  // ── Admin ──────────────────────────────────────────────────
  await db.user.upsert({
    where: { identifier: CONFIG.admin.identifier },
    update: {},
    create: {
      role: "ADMIN",
      identifier: CONFIG.admin.identifier,
      passwordHash: await bcrypt.hash(CONFIG.admin.password, BCRYPT_COST),
      mustResetPwd: CONFIG.admin.mustResetPwd,
      consentedAt: new Date(),
      consentVersion: CONSENT_VERSION,
      admin: {
        create: {
          firstName: CONFIG.admin.firstName,
          lastName: CONFIG.admin.lastName,
        },
      },
    },
  });
  console.log(`✓ Admin: ${CONFIG.admin.identifier}`);

  // ── Academic year + terms ──────────────────────────────────
  const year = await db.academicYear.upsert({
    where: { name: CONFIG.academicYear.name },
    update: { isActive: CONFIG.academicYear.active },
    create: {
      name: CONFIG.academicYear.name,
      isActive: CONFIG.academicYear.active,
    },
  });
  const termByNumber = new Map<number, string>();
  for (const t of CONFIG.terms) {
    const term = await db.term.upsert({
      where: {
        academicYearId_number: { academicYearId: year.id, number: t.number },
      },
      update: { isActive: t.active },
      create: {
        academicYearId: year.id,
        number: t.number,
        name: t.name,
        startDate: new Date(t.startDate),
        endDate: new Date(t.endDate),
        isActive: t.active,
      },
    });
    termByNumber.set(t.number, term.id);
  }
  console.log(`✓ Year ${year.name} + ${CONFIG.terms.length} term(s)`);

  // ── Classes ────────────────────────────────────────────────
  const classByName = new Map<string, string>();
  for (const c of CONFIG.classes) {
    const cls = await db.class.upsert({
      where: { academicYearId_name: { academicYearId: year.id, name: c.name } },
      update: { gradeLevel: c.gradeLevel },
      create: {
        academicYearId: year.id,
        name: c.name,
        gradeLevel: c.gradeLevel,
      },
    });
    classByName.set(c.name, cls.id);
  }
  console.log(`✓ ${CONFIG.classes.length} class(es)`);

  // ── Teachers ───────────────────────────────────────────────
  const teacherUserByIdentifier = new Map<string, string>();
  for (const t of CONFIG.teachers) {
    const homeroomOfId = t.homeroom
      ? (classByName.get(t.homeroom) ?? null)
      : null;
    if (t.homeroom && !homeroomOfId) {
      throw new Error(
        `Teacher ${t.identifier} homeroom "${t.homeroom}" is not in CONFIG.classes`
      );
    }
    const user = await db.user.upsert({
      where: { identifier: t.identifier },
      update: {},
      create: {
        role: "TEACHER",
        identifier: t.identifier,
        passwordHash: await bcrypt.hash(t.password, BCRYPT_COST),
        mustResetPwd: t.mustResetPwd,
        consentedAt: new Date(),
        consentVersion: CONSENT_VERSION,
        teacher: {
          create: {
            firstName: t.firstName,
            lastName: t.lastName,
            email: t.email,
          },
        },
      },
    });
    teacherUserByIdentifier.set(t.identifier, user.id);
    if (homeroomOfId) {
      await db.teacher.update({
        where: { userId: user.id },
        data: { homeroomOfId },
      });
    }
  }
  console.log(`✓ ${CONFIG.teachers.length} teacher(s)`);

  // ── Students (optional) ────────────────────────────────────
  for (const s of CONFIG.students) {
    const classId = classByName.get(s.className);
    if (!classId)
      throw new Error(
        `Student ${s.studentId} class "${s.className}" is not in CONFIG.classes`
      );
    await db.user.upsert({
      where: { identifier: s.studentId },
      update: {},
      create: {
        role: "STUDENT",
        identifier: s.studentId,
        passwordHash: await bcrypt.hash(s.password, BCRYPT_COST),
        mustResetPwd: s.mustResetPwd,
        consentedAt: new Date(),
        consentVersion: CONSENT_VERSION,
        student: {
          create: {
            studentId: s.studentId,
            firstName: s.firstName,
            lastName: s.lastName,
            classId,
          },
        },
      },
    });
  }
  if (CONFIG.students.length)
    console.log(`✓ ${CONFIG.students.length} student(s)`);

  // ── Course offerings ───────────────────────────────────────
  const codes: { name: string; code: string }[] = [];
  for (const co of CONFIG.courseOfferings) {
    const teacherId = teacherUserByIdentifier.get(co.teacherIdentifier);
    const classId = classByName.get(co.className);
    const termId = termByNumber.get(co.termNumber);
    if (!teacherId)
      throw new Error(
        `CourseOffering "${co.name}" teacher "${co.teacherIdentifier}" not found`
      );
    if (!classId)
      throw new Error(
        `CourseOffering "${co.name}" class "${co.className}" not found`
      );
    if (!termId)
      throw new Error(
        `CourseOffering "${co.name}" term ${co.termNumber} not found`
      );
    const classCode =
      co.classCode.trim() ||
      deriveCode(`${co.subjectCode}|${co.className}|${co.termNumber}`);
    await db.courseOffering.upsert({
      where: { classCode },
      update: {},
      create: {
        teacherId,
        classId,
        termId,
        name: co.name,
        subjectCode: co.subjectCode,
        gradeLevel: co.gradeLevel,
        creditHours: co.creditHours,
        classCode,
        codeActive: true,
      },
    });
    codes.push({ name: co.name, code: classCode });
  }

  console.log(`✓ ${CONFIG.courseOfferings.length} course offering(s)`);
  console.log("\n✨ Bootstrap done. Class codes (give to students for /join):");
  for (const c of codes) console.log(`   ${c.code}  →  ${c.name}`);
  console.log(
    "\n(Passwords are not printed — they are the values you set in CONFIG.)"
  );
}

main()
  .then(() => db.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await db.$disconnect();
    process.exit(1);
  });

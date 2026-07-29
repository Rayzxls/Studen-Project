/**
 * Idempotent bootstrap for an explicitly selected live-trial database.
 *
 * This script creates only account and teacher-owned CourseOffering data.
 * Retired school setup entities and human-facing learner numbers are omitted.
 * Never run this script without reviewing CONFIG and the active DATABASE_URL.
 */

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const CONFIG = {
  admin: {
    identifier: "admin@example.com",
    password: "CHANGE-ME-strong-password",
    firstName: "ผู้ดูแล",
    lastName: "ระบบ",
  },
  teachers: [
    {
      identifier: "teacher1@example.com",
      password: "CHANGE-ME",
      firstName: "ชื่อครู",
      lastName: "นามสกุล",
      email: "teacher1@example.com",
    },
  ],
  courseOfferings: [
    {
      name: "คณิตศาสตร์ ม.4/2",
      subjectCode: "MATH-M4",
      learnerGroupLabel: "ม.4/2",
      academicPeriodLabel: "ภาคเรียนที่ 1 ปี 2569",
      creditHours: 1.5,
      teacherIdentifier: "teacher1@example.com",
      classCode: "",
    },
  ],
  students: [] as {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
  }[],
};

const db = new PrismaClient();
const BCRYPT_COST = 12;
const CONSENT_VERSION = "1.0";

function deriveCode(seed: string): string {
  let hash = 5381;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 33) ^ seed.charCodeAt(index);
  }
  const base = (hash >>> 0).toString(36).toUpperCase().padStart(6, "0");
  return `J${base}`.slice(0, 7);
}

function compatibilityStudentId(email: string): string {
  return `compat-${deriveCode(email.toLowerCase())}`;
}

async function main() {
  console.log("Bootstrapping Beagle Classroom...");

  await db.user.upsert({
    where: { identifier: CONFIG.admin.identifier },
    update: {},
    create: {
      role: "ADMIN",
      identifier: CONFIG.admin.identifier,
      passwordHash: await bcrypt.hash(CONFIG.admin.password, BCRYPT_COST),
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

  const teacherUserByIdentifier = new Map<string, string>();
  for (const teacher of CONFIG.teachers) {
    const user = await db.user.upsert({
      where: { identifier: teacher.identifier },
      update: {},
      create: {
        role: "TEACHER",
        identifier: teacher.identifier,
        passwordHash: await bcrypt.hash(teacher.password, BCRYPT_COST),
        consentedAt: new Date(),
        consentVersion: CONSENT_VERSION,
        teacher: {
          create: {
            firstName: teacher.firstName,
            lastName: teacher.lastName,
            email: teacher.email,
          },
        },
      },
    });
    teacherUserByIdentifier.set(teacher.identifier, user.id);
  }

  for (const student of CONFIG.students) {
    await db.user.upsert({
      where: { identifier: student.email.toLowerCase() },
      update: {},
      create: {
        role: "STUDENT",
        identifier: student.email.toLowerCase(),
        passwordHash: await bcrypt.hash(student.password, BCRYPT_COST),
        consentedAt: new Date(),
        consentVersion: CONSENT_VERSION,
        student: {
          create: {
            // Compatibility-only until the separately gated D0 schema reset.
            studentId: compatibilityStudentId(student.email), // dependency-gate-allow(student-number-auth-and-admin-flow): required synthetic compatibility value, never displayed or used for login; dependency-gate-allow(student-id-symbol-review): this symbol is temporary compatibility storage
            firstName: student.firstName,
            lastName: student.lastName,
          },
        },
      },
    });
  }

  const codes: { name: string; code: string }[] = [];
  for (const course of CONFIG.courseOfferings) {
    const teacherId = teacherUserByIdentifier.get(course.teacherIdentifier);
    if (!teacherId) {
      throw new Error(
        `CourseOffering "${course.name}" teacher "${course.teacherIdentifier}" not found`
      );
    }

    const classCode =
      course.classCode.trim() ||
      deriveCode(
        [
          course.subjectCode,
          course.learnerGroupLabel,
          course.academicPeriodLabel,
        ].join("|")
      );

    await db.courseOffering.upsert({
      where: { classCode },
      update: {},
      create: {
        teacherId,
        name: course.name,
        subjectCode: course.subjectCode || null,
        learnerGroupLabel: course.learnerGroupLabel || null,
        academicPeriodLabel: course.academicPeriodLabel || null,
        creditHours: course.creditHours,
        classCode,
        codeActive: true,
      },
    });
    codes.push({ name: course.name, code: classCode });
  }

  console.log(`Bootstrap complete: ${codes.length} course(s).`);
  for (const course of codes) {
    console.log(`${course.code} -> ${course.name}`);
  }
  console.log("Passwords are not printed; use the reviewed CONFIG values.");
}

main()
  .then(() => db.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await db.$disconnect();
    process.exit(1);
  });

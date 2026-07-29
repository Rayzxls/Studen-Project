import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

async function main() {
  console.log("Seeding Beagle Classroom...");

  const adminPassword = await bcrypt.hash("Admin1234!", 12);
  await db.user.upsert({
    where: { identifier: "admin@studennnn.local" },
    update: {},
    create: {
      role: "ADMIN",
      identifier: "admin@studennnn.local",
      passwordHash: adminPassword,
      consentedAt: new Date(),
      consentVersion: "1.0",
      admin: { create: { firstName: "ผู้ดูแล", lastName: "ระบบ" } },
    },
  });

  const teacherPassword = await bcrypt.hash("Teacher1234!", 12);
  const teacherUser = await db.user.upsert({
    where: { identifier: "teacher@studennnn.local" },
    update: {},
    create: {
      role: "TEACHER",
      identifier: "teacher@studennnn.local",
      passwordHash: teacherPassword,
      consentedAt: new Date(),
      consentVersion: "1.0",
      teacher: {
        create: {
          firstName: "สมชาย",
          lastName: "ใจดี",
          email: "teacher@studennnn.local",
        },
      },
    },
  });

  const studentPassword = await bcrypt.hash("Student1234", 12);
  await db.user.upsert({
    where: { identifier: "student@studennnn.local" },
    update: {},
    create: {
      role: "STUDENT",
      identifier: "student@studennnn.local",
      passwordHash: studentPassword,
      consentedAt: new Date(),
      consentVersion: "1.0",
      student: {
        create: {
          // Compatibility-only until the separately gated D0 schema reset.
          studentId: "compat-demo-student", // dependency-gate-allow(student-number-auth-and-admin-flow): required synthetic compatibility value, never displayed or used for login; dependency-gate-allow(student-id-symbol-review): this symbol is temporary compatibility storage
          firstName: "ชนากานต์",
          lastName: "ใจดี",
        },
      },
    },
  });

  const existingCourse = await db.courseOffering.findUnique({
    where: { classCode: "MATH4A-DEMO1" },
    select: { id: true },
  });
  if (!existingCourse) {
    await db.courseOffering.create({
      data: {
        teacherId: teacherUser.id,
        name: "คณิตศาสตร์ ม.4/2 ครูสมชาย",
        subjectCode: "MATH-M4",
        learnerGroupLabel: "ม.4/2",
        academicPeriodLabel: "ภาคเรียนที่ 1 ปี 2568",
        creditHours: 1.5,
        classCode: "MATH4A-DEMO1",
        codeActive: true,
      },
    });
  }

  console.log("Seed complete.");
  console.log("Admin: admin@studennnn.local / Admin1234!");
  console.log("Teacher: teacher@studennnn.local / Teacher1234!");
  console.log("Student: student@studennnn.local / Student1234");
  console.log("Course code: MATH4A-DEMO1");
}

main()
  .then(() => db.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await db.$disconnect();
    process.exit(1);
  });

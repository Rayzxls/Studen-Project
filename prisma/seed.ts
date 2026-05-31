import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

async function main() {
  console.log("🌱 Seeding...");

  // ════════════ Identity (Phase 1) ════════════

  const adminPwd = await bcrypt.hash("Admin1234!", 12);
  await db.user.upsert({
    where: { identifier: "admin@studennnn.local" },
    update: {},
    create: {
      role: "ADMIN",
      identifier: "admin@studennnn.local",
      passwordHash: adminPwd,
      mustResetPwd: false,
      consentedAt: new Date(),
      consentVersion: "1.0",
      admin: {
        create: { firstName: "ผู้ดูแล", lastName: "ระบบ" },
      },
    },
  });
  console.log("✓ Admin: admin@studennnn.local / Admin1234!");

  const teacherPwd = await bcrypt.hash("Teacher1234!", 12);
  const teacherUser = await db.user.upsert({
    where: { identifier: "teacher@studennnn.local" },
    update: {},
    create: {
      role: "TEACHER",
      identifier: "teacher@studennnn.local",
      passwordHash: teacherPwd,
      mustResetPwd: false,
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
  console.log("✓ Teacher: teacher@studennnn.local / Teacher1234!");

  const studentPwd = await bcrypt.hash("Student1234", 12);
  const studentUser = await db.user.upsert({
    where: { identifier: "60001" },
    update: {},
    create: {
      role: "STUDENT",
      identifier: "60001",
      passwordHash: studentPwd,
      mustResetPwd: false,
      consentedAt: new Date(),
      consentVersion: "1.0",
      student: {
        create: {
          studentId: "60001",
          firstName: "ชนากานต์",
          lastName: "ใจดี",
        },
      },
    },
  });
  console.log("✓ Student: 60001 / Student1234");

  // ════════════ Academic structure (Phase 2) ════════════

  // Academic Year
  const year2568 = await db.academicYear.upsert({
    where: { name: "2568" },
    update: { isActive: true },
    create: { name: "2568", isActive: true },
  });

  // Terms
  const term1 = await db.term.upsert({
    where: {
      academicYearId_number: { academicYearId: year2568.id, number: 1 },
    },
    update: { isActive: true },
    create: {
      academicYearId: year2568.id,
      number: 1,
      name: "เทอม 1/2568",
      startDate: new Date("2025-05-15"),
      endDate: new Date("2025-09-30"),
      isActive: true,
    },
  });
  await db.term.upsert({
    where: {
      academicYearId_number: { academicYearId: year2568.id, number: 2 },
    },
    update: {},
    create: {
      academicYearId: year2568.id,
      number: 2,
      name: "เทอม 2/2568",
      startDate: new Date("2025-11-01"),
      endDate: new Date("2026-03-31"),
      isActive: false,
    },
  });
  console.log("✓ Academic Year 2568 + 2 terms");

  // Subjects (with credit hours)
  const subjects = [
    {
      code: "MATH-M4",
      name: "คณิตศาสตร์ ม.4",
      gradeLevel: "ม.4",
      creditHours: 1.5,
    },
    {
      code: "ENG-M4",
      name: "ภาษาอังกฤษ ม.4",
      gradeLevel: "ม.4",
      creditHours: 1.5,
    },
    {
      code: "SCI-M4",
      name: "วิทยาศาสตร์ ม.4",
      gradeLevel: "ม.4",
      creditHours: 1.5,
    },
    {
      code: "THA-M4",
      name: "ภาษาไทย ม.4",
      gradeLevel: "ม.4",
      creditHours: 1.5,
    },
    {
      code: "SOC-M4",
      name: "สังคมศึกษา ม.4",
      gradeLevel: "ม.4",
      creditHours: 1.0,
    },
  ];
  for (const s of subjects) {
    await db.subject.upsert({
      where: { code: s.code },
      update: { name: s.name, creditHours: s.creditHours },
      create: s,
    });
  }
  console.log(`✓ ${subjects.length} subjects`);

  // Classes
  const class401 = await db.class.upsert({
    where: {
      academicYearId_name: { academicYearId: year2568.id, name: "ม.4/1" },
    },
    update: {},
    create: {
      academicYearId: year2568.id,
      name: "ม.4/1",
      gradeLevel: "ม.4",
    },
  });
  const class402 = await db.class.upsert({
    where: {
      academicYearId_name: { academicYearId: year2568.id, name: "ม.4/2" },
    },
    update: {},
    create: {
      academicYearId: year2568.id,
      name: "ม.4/2",
      gradeLevel: "ม.4",
    },
  });
  console.log("✓ Classes: ม.4/1, ม.4/2");

  // Link student 60001 → ม.4/2
  await db.student.update({
    where: { userId: studentUser.id },
    data: { classId: class402.id },
  });

  // Make teacher the homeroom of ม.4/2
  await db.teacher.update({
    where: { userId: teacherUser.id },
    data: { homeroomOfId: class402.id },
  });
  console.log("✓ Linked student to ม.4/2, teacher as homeroom");

  // Sample CourseOffering: ครูสมชาย สอนคณิต ม.4/2 เทอม 1
  const mathSubj = await db.subject.findUnique({ where: { code: "MATH-M4" } });
  if (mathSubj) {
    await db.courseOffering.upsert({
      where: {
        teacherId_subjectId_classId_termId: {
          teacherId: teacherUser.id,
          subjectId: mathSubj.id,
          classId: class402.id,
          termId: term1.id,
        },
      },
      update: {},
      create: {
        teacherId: teacherUser.id,
        subjectId: mathSubj.id,
        classId: class402.id,
        termId: term1.id,
        classCode: "MATH4A-DEMO1",
        codeActive: true,
      },
    });
    console.log(
      "✓ Sample CourseOffering: คณิตศาสตร์ ม.4/2 (code: MATH4A-DEMO1)"
    );
  }

  console.log("\n✨ Done\n");
  console.log("Test accounts:");
  console.log("  Admin:   admin@studennnn.local / Admin1234!");
  console.log(
    "  Teacher: teacher@studennnn.local / Teacher1234!  (homeroom ม.4/2)"
  );
  console.log(
    "  Student: 60001 / Student1234                       (in ม.4/2)"
  );
  console.log("\nDemo Class Code: MATH4A-DEMO1 (use at /join)");
}

main()
  .then(() => db.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await db.$disconnect();
    process.exit(1);
  });

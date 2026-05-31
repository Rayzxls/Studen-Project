import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

async function main() {
  console.log("🌱 Seeding...");

  // ────── Admin ──────
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
        create: {
          firstName: "ผู้ดูแล",
          lastName: "ระบบ",
        },
      },
    },
  });
  console.log("✓ Admin: admin@studennnn.local / Admin1234!");

  // ────── Teacher ──────
  const teacherPwd = await bcrypt.hash("Teacher1234!", 12);
  await db.user.upsert({
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

  // ────── Student (sample) ──────
  const studentPwd = await bcrypt.hash("Student1234", 12);
  await db.user.upsert({
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

  console.log("✨ Done");
}

main()
  .then(() => db.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await db.$disconnect();
    process.exit(1);
  });

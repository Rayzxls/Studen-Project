# Beagle Classroom - Classroom Management Web Application

ระบบจัดการห้องเรียนแบบ single-tenant ที่รวมงานหลักของครูและนักเรียนไว้ในพื้นที่เดียว:

- **Attendance** - เปิดคาบ เช็กชื่อ 4 สถานะ และดูสถิติรายวิชา
- **Scoring** - คะแนนรวมแบบ `sum(score) / sum(fullScore)` พร้อมเกรดรายวิชา
- **Assignments** - ครูมอบหมายงาน นักเรียนส่งข้อความ/ไฟล์/ลิงก์ และครูตรวจแบบต่อเนื่อง
- **Feed & Notifications** - ประกาศ เอกสาร การบ้าน คะแนน และการแจ้งเตือนของห้อง
- **Learning Results** - นักเรียนดูคะแนนและเกรดของตนเอง พร้อมหน้าพิมพ์/PDF ผ่านเบราว์เซอร์
- **Profile & Themes** - รูปประจำตัว ชื่อที่ใช้ในการเรียน รหัสผ่าน และธีม System/Light/Dark/Cream

ระบบยึดหลักว่า **ครูเป็นเจ้าของข้อมูลการสอน** และ **Admin เป็นผู้สังเกตการณ์แบบ read-only** สำหรับข้อมูลการเรียนการสอน ไม่กรอกคะแนน เช็กชื่อ หรือสร้างงานแทนครู

## Product Direction

Beagle Classroom เป็น Classroom Management System (CMS) สำหรับโรงเรียนเดียวในรุ่นปัจจุบัน โดยลดการสลับเครื่องมือของครูและทำให้นักเรียนเห็นเฉพาะข้อมูลที่ควรเห็น การขยายเป็น multi-tenant, subscription หรือ Global User เป็นงานอนาคตและยังไม่อยู่ใน production scope

## Roles

| Role | ทำได้ | ขอบเขตสำคัญ |
|------|-------|--------------|
| **Admin** | ดูภาพรวม ผู้ใช้ ห้องเรียน Audit Log และ Activity Review; import ครู/นักเรียน; reset password; export Audit CSV; moderation ที่กำหนด | เป็น read-only observer ของข้อมูลการสอน ห้ามกรอกคะแนน เช็กชื่อ สร้าง/แก้การบ้าน หรือสอนแทนครู |
| **Teacher** | สร้างและดูแล CourseOffering, สมาชิก, ฟีด, งาน, คะแนน, เช็กชื่อ, รหัสเชิญ และส่งออก CSV สรุปคะแนน/การเข้าเรียน | แก้ไขและส่งออกรายงานได้เฉพาะวิชาที่ตนเป็นเจ้าของ |
| **Student** | สมัคร/เข้าสู่ระบบ, เข้าร่วมวิชา, ดูฟีด, ส่งงาน, ดูคะแนน/เกรดและการเข้าเรียนของตน | L1 visibility: ห้ามเห็นคะแนน การเข้าเรียน งานส่ง หรือ private comment ของผู้อื่น |
| **Homeroom Teacher** | ดูภาพรวมชั้นประจำชั้นตามสิทธิ์ | เป็น attribute เพิ่มเติม ไม่ใช่ role ใหม่ |

## Current Scoring Language

- `ScoreItem` มี `fullScore` และไม่มีช่อง weight แยก
- คะแนนรวมรายวิชา = `sum(score) / sum(fullScore)` ของรายการที่ประกาศแล้ว
- คะแนนและเกรดรายวิชาเป็นผลลัพธ์หลักสำหรับนักเรียน
- Term GPA อาจคำนวณเพื่อรายงานรอง แต่ไม่ใช้เป็น KPI ขนาดใหญ่หรือ progress หลักบน Dashboard
- การประกาศคะแนนเป็น one-way; การแก้คะแนนหลังประกาศต้องมีเหตุผลและ Audit Log

## Tech Stack

- **Frontend:** Next.js 16 App Router, React, TypeScript, Tailwind CSS v4, Anuphan, lucide-react
- **Design system:** Calm Ledger v2 - ดู [ADR-0014](./docs/adr/0014-theme-calm-ledger-supersedes-ink-gold.md), [ADR-0028](./docs/adr/0028-theme-calm-ledger-v2-color-friendly-and-material.md) และ [ADR-0029](./docs/adr/0029-world-class-interactive-task-modulated-motion.md)
- **Backend:** Next.js Server Actions/API Routes, Prisma, Zod, NextAuth v5 Credentials
- **Database:** PostgreSQL on Neon
- **Private file storage:** Cloudflare R2 ผ่าน permission check และ signed/authenticated delivery เท่านั้น
- **Hosting:** Vercel
- **Product language:** ภาษาไทย

## Documentation Index

| ไฟล์ | ใช้เมื่อ |
|------|----------|
| [CLAUDE.md](./CLAUDE.md) | กติกาสำหรับ AI coding assistants |
| [CONTEXT.md](./CONTEXT.md) | คำศัพท์และความหมายของ domain ปัจจุบัน |
| [Architecture.md](./Architecture.md) | โครงสร้างระบบและ data model |
| [Security.md](./Security.md) | Authorization, PDPA, Audit และ file security |
| [Testing.md](./Testing.md) | กลยุทธ์และเส้นทางทดสอบ |
| [docs/PROPOSAL.md](./docs/PROPOSAL.md) | ข้อเสนอโครงงานที่ปรับให้ตรง product ปัจจุบัน |
| [docs/NEXT-DEVELOPMENT-PLAN.md](./docs/NEXT-DEVELOPMENT-PLAN.md) | Roadmap ที่ใช้วางลำดับงานต่อจากระบบปัจจุบัน |
| [Task.md](./Task.md) | Historical phase ledger; ไม่ใช่ roadmap ปัจจุบัน |
| [HANDOFF.md](./HANDOFF.md) | สถานะล่าสุดและบันทึกส่งต่องาน |
| [docs/adr/](./docs/adr/) | Architecture Decision Records |

## Quick Start

```bash
pnpm install
cp .env.example .env.local
pnpm dev
```

เปิด `http://localhost:3000`

> คำเตือน: การตั้งค่าปัจจุบันของโปรเจกต์อาจให้ local และ production ใช้ Neon ชุดเดียวกัน อ่าน [docs/DEPLOY.md](./docs/DEPLOY.md) ก่อนรันคำสั่งที่เปลี่ยน schema หรือข้อมูล

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Dev server |
| `pnpm build` | Production build |
| `pnpm start` | Run production build |
| `pnpm lint` | ESLint |
| `pnpm typecheck` | TypeScript check |
| `pnpm test` | Vitest unit/integration tests |
| `pnpm test:e2e` | Playwright E2E tests |

## Current Status

ระบบ Core หลักถูก deploy แล้ว โดย Release A0 Documentation Alignment และ A1 Report/Export v1 ปิดงานแล้ว งานถัดไปคือ **A2 Critical-path QA gate** ตาม [docs/NEXT-DEVELOPMENT-PLAN.md](./docs/NEXT-DEVELOPMENT-PLAN.md) ก่อนเริ่ม Lesson Workspace, Quiz หรือ AI

## License

Private - สำหรับการทดลองและใช้งานกับกลุ่มเป้าหมายของโครงการ

# Studennnn — Student Score, Attendance & Assignment Portal

ระบบจัดการห้องเรียนสำหรับโรงเรียนเดียว (single-tenant) ที่รวม:
- 📝 **Attendance** — เช็คชื่อรายคาบ
- 🎯 **Scoring** — กรอกคะแนนแบบ weighted + auto grade
- 📚 **Assignments** — สร้างการบ้าน, นักเรียนส่งงาน (text/file/link), ครูตรวจ + comment
- 💬 **Feed** — timeline ของห้องเรียน (เหมือน Google Classroom Stream)
- 📊 **Term Summary** — ผลการเรียนรายเทอม (print-ready transcript)

ออกแบบให้ **ครูเป็นผู้ใส่ข้อมูล** และ **Admin มีหน้าที่ตรวจสอบ** ไม่ใช่กรอกข้อมูลแทนใคร

## Vision

> ลดภาระ Admin ให้เหลือเพียงงาน audit และตรวจสอบข้อมูล โดยให้ครูจัดการห้องเรียนของตัวเองได้เต็มที่ และให้นักเรียนมีพื้นที่ดูคะแนน/ส่งงาน/รับ feedback ครบในที่เดียว

## Roles

| Role | สิ่งที่ทำได้ | สิ่งที่ทำไม่ได้ |
|------|--------------|------------------|
| **Admin** | ตรวจ audit log, ดูข้อมูลครู/นักเรียนทั้งหมด, import ครูผ่าน CSV, reset password (ครู), export log, moderate content | ไม่ใส่คะแนน, ไม่เช็คชื่อ, ไม่สร้าง assignment |
| **Teacher** | สร้าง CourseOffering, เช็คชื่อ, ใส่คะแนน, publish, สร้าง Assignment/Announcement/Material, ตรวจ submission, generate Class Code/QR, reset password (นักเรียนใน course) | ไม่เห็นห้องของครูคนอื่น |
| **Student** | สมัครเอง, join ห้องด้วย Class Code/QR/Link, ดูคะแนน (publish), ดูสถิติเข้าเรียน, ส่งงาน, comment, ดู Term Summary | ไม่เห็นข้อมูลคนอื่น |
| **Homeroom Teacher** (attribute) | + เห็นภาพรวมห้องประจำชั้น ทุกวิชา | — |

## Tech Stack

- **Frontend:** Next.js 16 (App Router) + TypeScript + Tailwind v4 + IBM Plex Sans Thai + lucide-react
- **Design system:** "Ink + Gold" (adopted from Father project) — ดู [docs/adr/0011](./docs/adr/0011-theme-ink-gold.md)
- **Backend:** Next.js API Routes + Prisma + Zod + NextAuth v5 (Phase 1+)
- **Database:** PostgreSQL (Neon) (Phase 1)
- **File Storage:** Cloudflare R2 (Phase 6)
- **Hosting:** Vercel
- **Language:** ไทยเท่านั้น

## Documentation Index

| ไฟล์ | เกี่ยวกับ |
|------|----------|
| [README.md](./README.md) | ภาพรวมโปรเจกต์ (ไฟล์นี้) |
| [CLAUDE.md](./CLAUDE.md) | คำสั่งสำหรับ AI coding assistants |
| [CONTEXT.md](./CONTEXT.md) | Glossary ของ domain terms |
| [Architecture.md](./Architecture.md) | Tech stack, data model, system design |
| [Security.md](./Security.md) | Auth, authorization, PDPA, audit, file security |
| [Task.md](./Task.md) | Implementation roadmap แบ่งเป็น phase |
| [Testing.md](./Testing.md) | Testing strategy + critical scenarios |
| [docs/adr/](./docs/adr/) | Architecture Decision Records |

## Quick Start

```bash
# 1. ติดตั้ง dependencies
pnpm install

# 2. ตั้งค่า env vars
cp .env.example .env.local

# 3. รัน dev server
pnpm dev
```

เปิด http://localhost:3000

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Dev server |
| `pnpm build` | Production build |
| `pnpm start` | Run production build |
| `pnpm lint` | ESLint |
| `pnpm typecheck` | TypeScript check |
| `pnpm format` | Prettier format |
| `pnpm test` | Vitest unit/integration tests |
| `pnpm test:e2e` | Playwright E2E tests |

## Current Phase

**Phase 0 — Scaffolding** ✅

Next phases:
- Phase 1: Auth & RBAC + Student self-register
- Phase 2: Academic data + CSV import + Class Code/QR/Link
- Phase 3-9: ดู [Task.md](./Task.md)

## License

Private — สำหรับใช้งานในโรงเรียนเป้าหมายเท่านั้น

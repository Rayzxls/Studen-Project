# CLAUDE.md — Instructions for AI Coding Assistants

ไฟล์นี้บอก Claude (และ AI tools อื่น) ว่าโปรเจกต์นี้ออกแบบยังไง และมีกฎอะไรที่ห้ามแหก

## โปรเจกต์โดยย่อ

ระบบจัดการคะแนน + เช็คชื่อ + การบ้าน + feed สำหรับโรงเรียนเดียว
อ่าน [README.md](./README.md) และ [CONTEXT.md](./CONTEXT.md) ก่อนเริ่มงาน

## หลักการสำคัญ (อย่าฝืน)

### 1. Admin ไม่ใช่ผู้ใส่ข้อมูล
- Admin ห้ามมี endpoint ที่ใส่คะแนน/เช็คชื่อ/สร้าง assignment
- Admin มีได้แค่: view/observer, audit log, CSV import ผู้ใช้ตาม flow ที่มี, reset password, export audit และ moderation ที่ระบุไว้
- ถ้าจะเพิ่ม feature ให้ Admin → ถามผู้ใช้ก่อน

### 2. ทุก mutation ที่กระทบข้อมูลนักเรียน = audit log
- การแก้คะแนนหลัง publish → **บังคับ** ใส่ `reason`
- การลบ comment → audit log
- การ Return / Re-grade submission → audit log
- ดู [Security.md § Audit](./Security.md) สำหรับ event ทั้งหมด

### 3. Authorization-first
- ทุก API route ต้อง check role + scope (ครูคนนี้เป็นเจ้าของ CourseOffering นี้จริงไหม?)
- ห้ามเชื่อ `userId` จาก client; ใช้ session เท่านั้น
- Permission ทุกกฎ ต้องมี test ใน `tests/integration/permissions/`
- **ไฟล์ใน R2:** ทุก request → check ผ่าน signed URL ที่ generate หลัง permission check เท่านั้น

### 4. L1 Visibility (นักเรียน)
- นักเรียนเห็นได้เฉพาะ: ของตัวเอง + metadata ห้อง + รายชื่อสมาชิก (ไม่มีคะแนน) + class-wide comments
- ❌ นักเรียนห้ามเห็น: คะแนนคนอื่น, attendance คนอื่น, submission คนอื่น, private comment ระหว่างครู↔เพื่อน

### 5. ไม่ทำ multi-tenant
- ห้ามมี `school_id` ใน schema
- ถ้าจะเพิ่มทีหลัง → discuss ก่อน

### 6. Assignment ↔ Score Item
- Assignment มี `scoreItemId` ที่เป็น nullable (FK)
- ถ้า `is_scored = true` → ตอนสร้าง assignment สร้าง Score Item ผูกอัตโนมัติ
- ลบ Assignment ที่ผูก ScoreItem ที่ publish แล้ว → block; ระบบไม่มี unpublish ต้องใช้ flow ลบ ScoreItem ที่มี Critical audit ตามกติกาเท่านั้น

## Coding Conventions

### TypeScript

- `strict: true`, `noUncheckedIndexedAccess: true`
- ห้าม `any` — ถ้าไม่มีทาง ให้ `unknown` แล้ว narrow
- ใช้ `import type` แยก type imports

### File Structure

```
/
├── app/                      # Next.js App Router
│   ├── (auth)/               # public routes (login, signup, reset)
│   ├── (admin)/              # admin-only
│   ├── (teacher)/            # teacher-only
│   ├── (student)/            # student-only
│   └── api/                  # API routes
├── components/
│   ├── ui/                   # shadcn primitives
│   ├── motion/               # bounded motion primitives by task tier
│   ├── feed/                 # feed cards, composer
│   ├── assignment/           # assignment UI
│   └── features/             # other domain components
├── lib/
│   ├── auth/                 # NextAuth config + permission utils
│   ├── db/                   # Prisma client + helpers
│   ├── scoring/              # sum-based score total, grade/GPA calc (PURE)
│   ├── storage/              # R2 client + signed URL gen
│   ├── feed/                 # feed query/aggregation
│   ├── notification/         # notification creation + delivery
│   └── validation/           # Zod schemas (shared client/server)
├── prisma/
│   ├── schema.prisma
│   └── seed.ts
└── tests/
    ├── unit/
    ├── integration/
    └── e2e/
```

### Naming

- Files: `kebab-case.ts` (`course-offering.ts`)
- Components: `PascalCase.tsx` (`AssignmentCard.tsx`)
- DB models: `PascalCase` singular (`CourseOffering`)
- API routes: REST-like (`/api/courses/[id]/assignments`)
- Zod schemas: `<Name>Schema` (`CreateAssignmentSchema`)

### Imports

- ใช้ `@/` alias สำหรับ root imports
- ห้าม relative path ยาวกว่า 2 ระดับ (`../../../`)

### Commits — Feature-by-Feature Discipline

- **กฎหลัก:** หลังทำงานเสร็จ **ทุกครั้ง**ที่มี diff ในไฟล์ใด ๆ → ต้อง review diff แล้ว commit ตามนั้นทันที **อย่าสะสม** uncommitted changes ข้าม feature
- Conventional Commits: `feat(scope): subject` · `fix(scope): subject` · `docs(scope): ...` · `chore(scope): ...`
- **1 commit = 1 concern** — แยก:
  - design system docs (PRODUCT/DESIGN/ADR) ออกจาก code implementation
  - tooling / harness config ออกจาก feature code
  - theme / token rewrite ออกจาก per-page rewrite (แม้จะคู่ implication กัน)
  - bug fix ออกจาก feature
- **Pre-commit check** ก่อนทุก commit:
  - `pnpm typecheck` — 0 errors
  - `pnpm lint` — 0 errors (warnings ใน vendor / `.github/skills/*` ignore ได้)
  - ถ้ามี mutation logic → unit/smoke test ที่เกี่ยวข้องผ่าน
- **Branch protection:** `main` รับ initial baseline push ได้ครั้งเดียวเท่านั้น (เมื่อ remote ว่าง) หลังจากนั้นทุก change เข้า main ผ่าน PR + CI
- **ห้าม** ใส่ co-author ที่ผู้ใช้ไม่ได้ขอ; ห้ามใส่ "Generated with Claude" footer ใน commit message
- ใช้ HEREDOC สำหรับ multi-line commit message เพื่อรักษา formatting

### Commit Workflow (ทุก session ทำตามนี้)

1. หลังเสร็จ task ใด ๆ → run `git status --short` ดู scope ของ diff
2. แยก groups ตามหลัก 1 commit = 1 concern
3. ก่อน commit แรกของ session — propose breakdown ให้ผู้ใช้ confirm ถ้า groups > 2
4. Commit groups เรียงตาม dependency (docs ก่อน implementation, token ก่อน per-page)
5. `git push` หลัง commit ทุก batch (ไม่ปล่อย local เกิน 1 batch)

## Critical Files (เปลี่ยนต้องระวัง)

| File | ทำไมสำคัญ |
|------|----------|
| `lib/scoring/*` | คำนวณ grade ของนักเรียนทั้งโรงเรียน — แตะแล้วต้อง run unit test ครบ |
| `lib/auth/permissions.ts` | Authorization matrix — ทุก route ใช้ |
| `lib/storage/signed-url.ts` | File access control — leak = นักเรียนเห็นไฟล์คนอื่นได้ |
| `prisma/schema.prisma` | Migration ทำ DB เปลี่ยน — ต้องผ่าน review |
| `lib/audit/log.ts` | Audit trail — ห้าม skip event critical |
| `lib/feed/aggregator.ts` | Privacy boundary — query ผิด = นักเรียนเห็นข้อมูลคนอื่น |

## สิ่งที่ห้ามทำ (Hard Rules)

- ❌ เก็บ password เป็น plain text หรือ MD5/SHA1
- ❌ ใช้ `dangerouslySetInnerHTML` กับ user input
- ❌ Query DB ด้วย raw SQL ที่มี string concatenation (ใช้ Prisma parameterized)
- ❌ Return PII ของนักเรียนใน API ที่ทุก role เรียกได้
- ❌ Log password / token / cookie / signed URL ลง console หรือ audit log
- ❌ Skip permission check ใน API route แม้แต่ครั้งเดียว
- ❌ Hard-code secret ในซอร์ส (ใช้ env vars)
- ❌ Cascade delete student ทิ้งคะแนน/submission เทอมก่อน (ใช้ soft delete + anonymize)
- ❌ Serve ไฟล์จาก R2 โดยตรง (public URL) — ใช้ signed URL เท่านั้น
- ❌ Trust file extension — ตรวจ MIME magic bytes
- ❌ Allow upload executable types (exe, bat, sh, js, html, svg with script)
- ❌ Push ตรงเข้า `main` (PR + CI ผ่านเท่านั้น)
- ❌ Return all Submission rows ของ Assignment ให้นักเรียน (เห็นแค่ของตัวเอง)
- ❌ Render private comment ใน class-wide feed query

## สิ่งที่ควรทำ (เสมอ)

- ✅ Validate input ด้วย Zod ที่ขอบ (API route input, form submit)
- ✅ ใช้ Prisma `select` เลือก field — ห้าม return ทั้ง object โดยเฉพาะ User
- ✅ ถ้า mutation → wrap ด้วย transaction (atomic)
- ✅ ถ้า authorization fail → return 403 ไม่ใช่ 404 (ยกเว้นจะหลบ enumeration)
- ✅ เขียน test คู่กับ feature ใหม่ (ไม่ใช่หลัง)
- ✅ ใช้ shadcn/ui components ก่อน เขียนเอง (consistency)
- ✅ Lazy-load 3D components (`dynamic(() => import('...'), { ssr: false })`)
- ✅ Generate signed URL **หลัง** permission check, expire ใน 5 นาที
- ✅ ไฟล์ใหญ่ → upload ตรงไป R2 จาก client (presigned PUT) ไม่ผ่าน server
- ✅ Strip metadata จากรูป (EXIF location, etc.) ก่อนเก็บ
- ✅ Polymorphic file attachment ใช้ FileAttachment table (`ownerType` + `ownerId`)

## Performance Budget

- Initial JS bundle: < 250 KB gzipped
- Interactive showcase: lazy-load เมื่อมี bundle เพิ่ม และต้องมี static/reduced-motion fallback
- Feed page: server-paginate 20 items, infinite scroll
- File upload: presigned PUT ตรงไป private R2, progress UI, max 20 MB; ห้ามสร้าง public file URL
- Lighthouse Performance: ≥ 80 บน 3G simulated
- ห้าม WebGL/ambient choreography บนหน้า data-heavy (กรอกคะแนน, เช็คชื่อ, ตรวจงาน, audit)

## Design System — Calm Ledger v2

กติกาปัจจุบันอยู่ใน [ADR-0014](./docs/adr/0014-theme-calm-ledger-supersedes-ink-gold.md), [ADR-0028](./docs/adr/0028-theme-calm-ledger-v2-color-friendly-and-material.md) และ [ADR-0029](./docs/adr/0029-world-class-interactive-task-modulated-motion.md) ส่วน ADR-0011 Ink + Gold เป็นประวัติที่ถูก supersede แล้ว

### Theme และสี

- Theme modes: `SYSTEM` (ค่าเริ่มต้น), `LIGHT`, `DARK`, `CREAM`
- ใช้ semantic CSS tokens จาก `app/globals.css`; ห้าม hardcode สีที่อ่านได้เฉพาะ light theme
- Blue = primary/action, green = success, orange = warning/due, red = destructive
- Course identity ใช้ palette 8 ช่องที่ระบบกำหนด ไม่สร้าง accent color ส่วนตัวต่อผู้ใช้
- ไม่ใช้ gold หรือ GPA เป็น hero/KPI หลัก และไม่ใช้ gradient เป็นปุ่มมาตรฐาน

### Typography และวัสดุ

- Font: **Anuphan** ผ่าน `--font-anuphan`
- น้ำหนักตัวอักษรหลักไม่เกิน 600; เว้นบรรทัดและระยะหายใจให้ภาษาไทยอ่านง่าย
- ใช้ class/component เดิม เช่น `.card`, `.btn-*`, `.input`, `.badge-*`, `.glass` ก่อนสร้าง pattern ใหม่
- Card หลักใช้ `rounded-2xl` ตามระบบเดิม; ห้ามซ้อน card เพื่อการตกแต่งโดยไม่มี hierarchy จริง
- Form, gradebook, attendance, review และ audit ต้องเป็น work surface ที่นิ่ง อ่านเร็ว และมี contrast ครบทุก theme

### Motion

- ใช้ task-modulated motion: feedback 80ms, controls 180ms, panel/page 280ms ตาม ADR-0029
- ห้าม animation ทำให้ตำแหน่งข้อมูลเปลี่ยนระหว่างกรอกคะแนน เช็กชื่อ ตรวจงาน หรืออ่านตาราง
- รองรับ `prefers-reduced-motion`; interaction สำคัญต้องใช้งานได้แม้ปิด motion
- 3D/WebGL ใช้เฉพาะประสบการณ์ที่เหมาะสมและต้อง lazy-load; ห้ามอยู่ใน critical path ของหน้าปฏิบัติงาน

### Mobile
- Student views = **mobile-first** (Tailwind default → adjust at `md:` breakpoint)
- Teacher gradebook + Admin audit = desktop-first
- Touch targets ≥ 44px (`min-h-11`)

### Print (transcript / report card)
- `@media print` stylesheet มีใน `globals.css` แล้ว
- A4, 12mm margin, hide buttons/forms/nav
- Tables full-width, border-collapse, font 11px

### Iconography
- ใช้ **lucide-react** เป็น default
- ใช้ icon ที่มีความหมายพร้อม tooltip เมื่อความหมายไม่ชัด; หลีกเลี่ยง emoji เป็นโครงสร้าง UI

## เมื่อไม่แน่ใจ

1. อ่าน [CONTEXT.md](./CONTEXT.md) ก่อน — มีคำตอบส่วนใหญ่
2. ถ้ายังไม่ชัด → ถามผู้ใช้ ห้าม guess feature
3. ถ้าเจอข้อขัดแย้งระหว่าง code กับ CONTEXT/ADR ที่ accepted → หยุดและรายงาน mismatch ก่อนแก้ ห้ามเดาเองว่าเอกสารเก่าหรือโค้ดถูกเสมอ

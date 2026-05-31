# CLAUDE.md — Instructions for AI Coding Assistants

ไฟล์นี้บอก Claude (และ AI tools อื่น) ว่าโปรเจกต์นี้ออกแบบยังไง และมีกฎอะไรที่ห้ามแหก

## โปรเจกต์โดยย่อ

ระบบจัดการคะแนน + เช็คชื่อ + การบ้าน + feed สำหรับโรงเรียนเดียว
อ่าน [README.md](./README.md) และ [CONTEXT.md](./CONTEXT.md) ก่อนเริ่มงาน

## หลักการสำคัญ (อย่าฝืน)

### 1. Admin ไม่ใช่ผู้ใส่ข้อมูล
- Admin ห้ามมี endpoint ที่ใส่คะแนน/เช็คชื่อ/สร้าง assignment
- Admin มีได้แค่: view, audit log, CSV import (ครูเท่านั้น), reset password, moderate comment
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
- ลบ Assignment ที่ผูก ScoreItem ที่ publish แล้ว → block (ต้อง unpublish ก่อน + audit log)

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
│   ├── 3d/                   # R3F components (lazy-loaded)
│   ├── feed/                 # feed cards, composer
│   ├── assignment/           # assignment UI
│   └── features/             # other domain components
├── lib/
│   ├── auth/                 # NextAuth config + permission utils
│   ├── db/                   # Prisma client + helpers
│   ├── scoring/              # weighted total, grade calc (PURE)
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

### Commits

- Conventional Commits: `feat(assignment): add submission versioning`
- 1 PR = 1 concern; อย่าผูก feature กับ refactor

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
- 3D scene: lazy-load เท่านั้น, ห้ามอยู่ใน critical path
- Feed page: server-paginate 20 items, infinite scroll
- File upload: chunked, progress UI, max 20 MB
- Lighthouse Performance: ≥ 80 บน 3G simulated
- ห้าม block render ด้วย R3F บนหน้า data-heavy (กรอกคะแนน, เช็คชื่อ, ตรวจงาน, feed)

## Design System — "Ink + Gold"

Adopted from Father project. ดู [ADR-0011](./docs/adr/0011-theme-ink-gold.md) สำหรับเหตุผล

### Palette (use these tokens, ห้ามใส่ hex ตรงๆ)

| Token | Value | ใช้กับ |
|-------|-------|--------|
| `ink` | `#0F172A` | text primary, primary button gradient |
| `ink-soft` | `#475569` | text secondary, captions |
| `accent` | `#B8860B` (gold) | KPI value, GPA, signature accent |
| `accent-soft` | `#FEF3C7` | badge bg, highlight |
| `bg` | `#f8fafc` / `#fafaf7` (warm) | page background |
| `surface` | `#ffffff` | card bg |
| `border` | `#e2e8f0` (slate-200) | card/input border |

❌ **ห้ามใช้** สีจัด (indigo, violet, purple, pink) เป็น primary accent — ขัด theme
✅ ใช้ rose/blue/emerald/amber **เฉพาะ semantic badges** (error/info/success/warn) ผ่าน `.badge-*` class

### Typography
- Font: **IBM Plex Sans Thai** (โหลดผ่าน `next/font/google`)
- Variable: `--font-plex`, fallback `system-ui, sans-serif`
- Headings: `tracking-tight font-bold`
- Body: weight 400, line-height generous (`leading-relaxed`)

### Component Classes (Tailwind `@layer components`)

ใช้ class เหล่านี้ก่อนเขียน utility เอง — copy จาก Father `globals.css`:

| Class | ใช้กับ |
|-------|--------|
| `.card` / `.card-flat` | container white + rounded-xl + soft shadow + hover lift |
| `.btn-primary` | dark gradient + gold shimmer on hover (signature) |
| `.btn-secondary` | white + slate border, hover lift |
| `.btn-ghost` | text-only, soft hover bg |
| `.btn-accent` | gold gradient |
| `.btn-danger` | rose-600 |
| `.btn-sm` | size modifier |
| `.input` | form input ที่ใช้ทุกที่ |
| `.badge-{admin/teacher/student/gold}` | role badges with ring border |
| `.table` | data table standard |
| `.stat` / `.stat-value-gold` | KPI cards |

### Utility Classes

| Class | ใช้กับ |
|-------|--------|
| `.text-gradient-gold` | animated gold gradient text (สำหรับ GPA, headline) |
| `.text-gradient-ink` | static dark gradient |
| `.mesh-bg` | hero section background (gold radial gradients) |
| `.glass` | backdrop-blur frosted surface |
| `.tilt-card` | 3D tilt with CSS vars `--rx --ry` (set via JS pointermove) |
| `.sheen` | hover sweep shine on cards |
| `.blob` | floating blob decoration (with animation: float / float-slow) |

### Animation Tokens

ใน `tailwind.config.ts` มี keyframes ใช้ได้ทันที:
- `animate-fade-in` (entry — 200ms)
- `animate-slide-up` (entry — 280ms)
- `animate-shimmer` (loading)
- `animate-float` / `animate-float-slow` (blobs)
- `animate-gradient-pan` (gold text)
- `animate-pulse-ring` (notification dot)
- `animate-bg-pan` (background subtle)

### 3D Strategy
- **WebGL/R3F** — เฉพาะ landing hero, login bg, 404, loading transitions
- **CSS-based "3D feel"** (tilt-card + perspective + mesh-bg + blob + sheen) — ใช้ในหน้าทั่วไปได้ ไม่กิน GPU
- หน้า production-critical (กรอกคะแนน, เช็คชื่อ, ตรวจงาน, audit log) = 2D ล้วน, density สูง

### Layout Rules
- Card spacing rhythm: 16 / 24 / 32 (Tailwind 4/6/8)
- Rounded: `rounded-xl` (12px) สำหรับ cards, `rounded-lg` (8px) สำหรับ buttons/inputs
- Border: 1px solid `border-slate-200` เริ่มต้นเสมอ — เพิ่มน้ำหนักเฉพาะ active state
- Shadow: `shadow-soft` default → `shadow-lift` on hover
- Focus ring: gold `rgba(184,134,11,0.35)` 3px (ตั้งไว้ใน `globals.css`)

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
- Emoji ใช้ได้ใน feed card "type indicator" (📝 📢 📚 🎯) แต่ห้ามใช้ใน UI structure

## เมื่อไม่แน่ใจ

1. อ่าน [CONTEXT.md](./CONTEXT.md) ก่อน — มีคำตอบส่วนใหญ่
2. ถ้ายังไม่ชัด → ถามผู้ใช้ ห้าม guess feature
3. ถ้าเจอข้อขัดแย้งระหว่าง docs กับ code → docs คือ source of truth; แจ้ง mismatch

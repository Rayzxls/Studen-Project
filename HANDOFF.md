# HANDOFF — Studennnn

## 🔥 LATEST UPDATE — 2026-06-13 · Beagle Classroom current state

> อ่าน section นี้ก่อน เพราะข้อมูลด้านล่างบางส่วนเป็น handoff เก่าจากหลาย phase และอาจไม่ตรงกับสถานะล่าสุดทั้งหมด

### Repo / branch state

- Repo หลักที่กำลังทำงาน: `D:\Studennnn`
- Commit ล่าสุดที่ปิดงานแล้ว: `028e2a5 feat(classroom): improve course feed and workflows`
- หลัง commit นี้ยังมีงานค้าง uncommitted 3 ไฟล์ เป็นงาน mobile FAB ล่าสุด:
  - `app/dashboard/page.tsx`
  - `app/teacher/courses/page.tsx`
  - `components/layout/student-bottom-nav.tsx`
- Validation ล่าสุดหลังปรับ FAB เหลือ 40px:
  - `npm.cmd run typecheck` ผ่าน
- Validation ก่อนหน้าในชุดงานเดียวกัน:
  - `npm.cmd run typecheck` ผ่าน
  - `npm.cmd run lint` ผ่านแบบมี warning เดิมจำนวนมาก แต่ไม่มี error
  - `npm.cmd run build` ผ่าน

### ✅ Health ล่าสุด (verified 2026-06-13 by Claude — รันจริง)

| เช็ค | ผล |
|------|-----|
| `pnpm typecheck` | **0 errors** |
| `pnpm lint` | **0 errors** · 255 warnings (baseline เดิม + 1 ใหม่ `c2 unused` จาก WIP FAB) |
| `pnpm build` | **ผ่าน** |
| `pnpm test` (unit) | **428/429 ผ่าน** — ดู "Known issue" ด้านล่าง |

**⚠️ Known issue — unit test fail 1 ตัว (ไม่ใช่ regression ของงานใหม่):**
`tests/unit/validation.test.ts > SignupStudentSchema > rejects without turnstile token`
— test เก่าคาดว่า `turnstileToken: ""` ต้อง reject แต่ schema ถูกตั้งใจแก้เป็น
`z.string().optional().default("")` ตั้งแต่ commit `e25421a` (แก้ signup deadlock ตอน Turnstile ไม่ได้ตั้ง key)
→ **ต้องแก้/ลบ test ให้ตรง schema ใหม่ ไม่ใช่แก้ schema** เป็น stale test ตกค้างเท่านั้น

### 🗂️ Feature ledger — งานถึงไหนแล้ว (commit → ฟีเจอร์, ใหม่→เก่า)

**DONE + committed บน `phase-11`:**

| Commit | ฟีเจอร์ | สถานะ verify |
|--------|---------|--------------|
| `028e2a5` | Course feed/workflow, assignment submission UX, file upload+preview (`/api/storage/files/[fileId]`), not-found page, link handling | typecheck/lint/build ผ่าน |
| `a958791` | Theme bootstrap render ผ่าน `next/script` (กัน flash) | — |
| `d0bdbf5` | ซ่อน class gallery ออกจาก admin dashboard | — |
| `ee7988b` | ครูสร้าง **class label** เองตอนสร้างวิชา (`lib/course/create-course.ts`) | — |
| `02c7f4b` | **Teacher** แยกหน้า scores / attendance ออกจาก overview | — |
| `f8a7871` `0ca9ece` `bd67bcf` | **Admin Observer View (read-only)** — `/admin/classes` index + `/admin/courses/[id]` (feed/assignments/attendance/members/scores) ⚠️ HANDOFF เก่าเขียนว่า "ยังไม่ implement" — **ตอนนี้ทำแล้ว** | — |
| `b91fb11` `f0c71de` `914a571` | Admin nav reorg + teachers page = management hub + `/admin/teachers/new` + student management actions | — |
| `c746bc0` `94778e3` `dc34c0d` | **Batch 1+2: Profile + Theme/Dark mode** (displayName fallback, avatar crop 512² upload/delete + audit, change password, 4 โหมด SYSTEM/LIGHT/DARK/CREAM, transition 180ms, ไม่ audit theme) | Claude verify ครบ + QA browser |
| `52165cb` `9dedb13` `898b3ee` `266a538` | Dashboard reshape 3 role, student assignment workspace, `SUBMISSION_WITHDRAWN` audit, per-course grade mental model | Claude verify |

**IN-PROGRESS (uncommitted, 3 ไฟล์):** mobile FAB nav — ทำเสร็จ typecheck ผ่าน ยังไม่ commit (ดู section ถัดไป)

**ยังไม่ทำ / debt ที่ Codex เลือกหยิบได้:**
- Profile/Theme = **0 test coverage** (47 test files ไม่มีตัวไหนครอบ `lib/profile/*`, `lib/theme/*`, presign PROFILE_IMAGE scope guard, displayName fallback)
- Teacher notification ตอนนักเรียน withdraw — ต้องเพิ่มค่าใน `NotificationKind` enum (Prisma migration)
- Dark mode QA — ยังไม่ไล่ contrast WCAG AA ทุกหน้า + หน้า `/login` ใน 4 โหมด
- `components/dashboard/teacher-hero.tsx` อาจไม่ถูกใช้แล้ว (เช็คก่อนลบ)
- Security: rotate DB password + admin password (หลุดในแชต)

### Mobile navigation decision ล่าสุด

ผู้ใช้ไม่ต้องการ mobile bottom nav แบบ 4 เมนูแล้ว:

- เอา `ฟีด / ห้องเรียน / ผลการเรียน / แจ้งเตือน` ออกจาก bottom nav
- ให้เหลือปุ่ม `+` กลางล่างจอเท่านั้น
- ขนาดล่าสุดที่ผู้ใช้ขอ: `40px`
- นักเรียนกด `+` → ไป `/join` เพื่อเข้าร่วมชั้นเรียน
- ครูกด `+` → ไป `/teacher/courses/new` เพื่อสร้างห้องเรียน
- หน้า `/dashboard` render FAB สำหรับทั้ง `STUDENT` และ `TEACHER`
- หน้า `/teacher/courses` render FAB สำหรับครูด้วย
- หน้า `/student/courses` ใช้ default student FAB อยู่แล้ว

Implementation:

- `components/layout/student-bottom-nav.tsx`
  - component เดิมชื่อ `StudentBottomNav` ถูกเปลี่ยนจาก 4-item nav เป็น single centered FAB
  - รับ prop `role?: "student" | "teacher"`
  - ใช้ `h-10 w-10` และ icon `h-5 w-5`
- `app/dashboard/page.tsx`
  - เพิ่ม mobile spacer และ FAB สำหรับ Student/Teacher
- `app/teacher/courses/page.tsx`
  - เพิ่ม FAB role teacher และ mobile spacer

### Product direction / decisions ที่ควรถือเป็น source ล่าสุด

- ระบบยังเป็น role-based: Student / Teacher / Admin
- ผู้ใช้อยากให้ UX ไม่งงระหว่างนักเรียนกับครู
- Student dashboard และ Teacher dashboard ควรเป็น professional operating dashboard ไม่ใช่ activity feed
- Course cards เป็น surface สำคัญกลาง Dashboard และ course list
- Admin ไม่ควรต้องสร้างห้องเรียนรายห้องแทนครู
- ครูควรสร้าง/จัดการห้องเรียนเอง
- Admin ควรเห็น overview และ observer/read-only view ของข้อมูลได้ เหมือนเป็นครูอีกคน แต่ซ่อน action ที่ทำไม่ได้
- Activity ล่าสุดไม่ควรอยู่ใน dashboard หลัก ให้ไปอยู่ใน Audit / Activity Review
- Profile/avatar ใช้รูปจริงได้ แต่ตอนนี้มี default/shared avatar ได้ก่อน
- Theme:
  - default เป็น System
  - ไม่มี accent color option
  - Dark mode ต้องระวัง contrast สีเทากับ text
- External URL/link ควรเปิด browser tab ใหม่ ไม่พา Beagle Classroom ไปหน้า external ใน tab เดิม
- Assignment detail:
  - Feed card ไม่ต้องโชว์รูปใหญ่
  - detail page ควรโชว์รายละเอียดงาน/รูป/ไฟล์เต็มกว่า feed
  - การส่งงานควร refresh/ให้ feedback ชัดเจนว่าส่งแล้ว

### Recent committed scope in `028e2a5`

Commit `028e2a5` รวมงานใหญ่หลายส่วน:

- Course feed UX และ workflow
- Assignment submission UX
- Teacher/student attachment upload and preview
- Preview modal / file preview improvements
- Link handling improvements
- Dashboard/course card changes
- Admin/teacher observer/read-only related improvements
- Profile/theme polish
- QA ผ่าน typecheck/lint/build ก่อน commit

ใช้คำสั่งนี้ดูรายละเอียดแทนการคัด diff ยาวในเอกสาร:

```bash
git show --stat 028e2a5
git show --name-only 028e2a5
```

### Next step ที่ Claude ควรทำทันที

1. ตรวจ 3 uncommitted files ด้านบน
2. QA mobile Student และ Teacher:
   - Student mobile dashboard เหลือ `+` เดียว → `/join`
   - Teacher mobile dashboard เหลือ `+` เดียว → `/teacher/courses/new`
   - ไม่มี bottom nav 4 เมนู
3. Run:

```bash
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run build
```

4. ถ้าผู้ใช้โอเค ให้ commit งาน mobile FAB ชุดนี้

### Suggested skills for Claude/Codex continuation

- `build-web-apps:frontend-testing-debugging` สำหรับ QA UI/mobile
- `browser:control-in-app-browser` สำหรับทดสอบ localhost และ screenshot
- `build-web-apps:react-best-practices` เมื่อแก้ React/Next component
- `grill-with-docs` เมื่อต้องคุย decision ใหม่และอัปเดตเอกสาร
- `diagnose` เมื่อเจอบัค UI/console/hydration

---

> เอกสารนี้ใช้สำหรับเริ่ม **session ใหม่** กับ AI assistant แล้วต่อยอดได้ทันที
> อ่านไฟล์นี้ + `CLAUDE.md` + `CONTEXT.md` ก่อนเริ่มงาน

อัพเดตล่าสุด: **2026-06-10** · branch `phase-11` (merged → `main`) · **LIVE บน production** (Vercel) · Codex changes ค้าง uncommitted

---

## ⚠️ START HERE — Session resume point (2026-06-10 · LIVE production trial)

### 🚀 Production (deployed, ใช้งานจริงได้)
- **URL:** `https://studen-project.vercel.app` (Vercel project `studen-project`, team `rayzxls' projects`)
- **DB:** Neon `neondb` (`ep-wild-scene-ao2ft9vq-pooler` · ap-southeast-1) — **dev = prod อันเดียวกัน** (ผู้ใช้เลือกใช้ตัวนี้เป็น prod)
- **Admin คนเดียว:** identifier `Rayzxls` / pwd `Rayzxls0088` (สร้างผ่าน `pnpm db:reset-admin` — DB ถูกล้างเหลือ admin เดียว)
- **Env บน Vercel:** `DATABASE_URL` (+`connect_timeout`), `AUTH_SECRET`, `AUTH_URL`, `NEXT_PUBLIC_APP_URL` · Turnstile/Upstash **ไม่ได้ตั้ง** (signup ทำงานได้เพราะแก้ให้ optional)
- **`main` = source of truth ของ deploy** (Vercel auto-deploy on push to main). phase-11 merged เข้า main ผ่าน PR #1/#2/#3

### งานที่ปิดไปแล้ว (merged → main, deployed)
- Immersive UI (mascot + classroom webp), Feed-default course shell, assignment submit-first-visit fix, **teacher reference links บน assignment** (+ `Assignment.linkUrls` JSON column — db push แล้ว), composer link attachments + redesign
- Deploy tooling: `prisma/bootstrap.ts` (`db:bootstrap`), `prisma/reset-to-admin.ts` (`db:reset-admin`), `docs/DEPLOY.md`
- Auth hotfixes (deployed): **Turnstile optional เมื่อไม่ตั้ง key** (client button + `verifyTurnstile` skip + `SignupStudentSchema.turnstileToken` optional) — แก้ signup deadlock

### ⏳ Codex changes — **ยัง uncommitted** (typecheck 0 · lint 0)
อีก agent (Codex) เขียนเพิ่มในเครื่อง ยังไม่ commit/ยังไม่ deploy:
- **withdrawSubmission** — นักเรียนยกเลิกการส่ง (`lib/assignment/submission.ts` + `withdrawSubmissionAction` + `components/assignment/withdraw-submission-button.tsx`). authz ครบ
  - ✅ **(2026-06-10) audit เพิ่มแล้ว:** `SUBMISSION_WITHDRAWN` (Important · เพิ่มเฉพาะ TS union — ไม่มี migration เพราะ `AuditLog.action` เป็น String) + sync label.ts/tier.ts/Security.md · block withdraw เมื่อสถานะ `RETURNED` (path ที่ถูกคือแก้แล้วส่งใหม่) · UI เปลี่ยนเป็น inline confirm panel (เลิกใช้ `window.confirm`)
  - ⏳ **teacher notification ยังไม่มี** — ต้องเพิ่มค่าใหม่ใน `NotificationKind` enum (Prisma migration) จึงตัดสินใจเลื่อน; ครูเห็นผลทาง review queue (งานหายจากคิวรอตรวจ) + audit log
- **Student Assignment Workspace** — รื้อ `app/student/courses/[id]/assignments/[assignmentId]/page.tsx` เป็น 2 โซน (โพสต์ครู+คอมเมนต์ห้อง / panel ส่งงาน). ensureSubmission + linkUrls เดิมยังอยู่
- **CommentsThread** variant `social` (IG-style) + composer
- **Landing**: ลบ `components/landing/hero-scene.tsx` + เอา R3F/WebGL ออกจาก `immersive-3d.tsx` → CSS cards (perf)
- **CONTEXT.md**: เพิ่ม domain — Admin Observer View, Submission Conversation/Answer, Student Assignment Workspace, Assignment Review Workspace
- ⚠️ **doc ล้ำหน้า code:** "Admin Observer View" + "Assignment Review Workspace" เขียนใน CONTEXT.md แต่ **ยังไม่ได้ implement** (diff ไม่มีหน้า teacher/admin)
- ⚠️ ไฟล์ขยะ untracked ควร `.gitignore`: `.codex/`, `next-dev-*.log`, `vite-dev-*.log`

### ✅ งานที่ปิดในเครื่องแล้ว (2026-06-10 — committed บน phase-11, รอ PR → main)
- **Assignment Review Workspace (teacher)** — master-detail 3 คอลัมน์ที่ `/teacher/courses/[id]/assignments/[assignmentId]` (`?filter=` + `?sid=`), `quickGradeAndAdvanceAction`/`returnAndAdvanceAction` redirect ไปคิวถัดไป, `components/assignment/review-panel.tsx`
- **Dashboard reshape ทั้ง 3 role** — operating dashboard ไม่ใช่ feed:
  - lib ใหม่ `lib/dashboard/action-center.ts` (student returned/due/recent-scores · teacher review-queue/attendance-today/class-health)
  - primitives ใหม่ `components/dashboard/primitives.tsx` (SectionHeader/MetricTile/ActionRow/CourseQuickLink/EmptyState) + `student-action-center.tsx` + `teacher-ops.tsx`
  - `/dashboard`: student = hero+summary chips + Action Center (ส่งคืน>งานต้องส่ง>feed) + aside (วันนี้/คะแนนล่าสุด/ห้องเรียน) · teacher = KPI 4 ตัว + Review Queue + Class Health + เช็คชื่อวันนี้ · admin = doorway
  - `/admin/dashboard`: operational alerts (ไม่มี timeline แล้ว) + MetricTile + งานผู้ดูแล/การตรวจสอบ · class cards คงเดิม
  - **หน้าใหม่ `/admin/activity`** (กิจกรรมในระบบ — แยกจาก Audit Log) + sidebar item · filter: ประเภท/วิชา/ช่วงเวลา · TODO: actor filter + pagination (รอ activity query module)
  - `components/dashboard/teacher-hero.tsx` ไม่ถูกใช้แล้ว (ยังไม่ลบ)

### ⏭️ NEXT
- PR phase-11 → main → auto-deploy
- withdraw: audit ✅ แล้ว — เหลือ teacher notification (ต้องเพิ่ม `NotificationKind` + migration ถ้าจะทำ)
- Activity Review: actor filter + pagination + ย้าย query ไป lib module
- Implement "Admin Observer View" ให้ตรง CONTEXT.md (หรือถอน doc ออกถ้ายังไม่ทำ)
- Perf: เว็บช้า — สาเหตุหลักคาดว่า Neon free-tier scale-to-zero (cold start) + Vercel↔Neon region + force-dynamic ทุกหน้า (ยังไม่ได้ตรวจ region จริง)
- หมุนรหัส: DB password + admin password หลุดในแชต → ควร rotate

---

## START HERE (เดิม) — Session resume point (2026-06-06 · branch `phase-11`, HEAD `f63b448`)

ทั้งหมดอยู่บน branch **`phase-11`** (pushed to origin, 59 commits ยังไม่ merge เข้า `main`). typecheck 0 · lint 0 (254 pre-existing warnings) · tests 429 passing. ยังไม่มี schema migration ใน Phase 11/12.

### สถานะล่าสุด — Beagle Classroom rebrand + landing + 3D polish

แอปถูก rebrand **Studennnn → Beagle Classroom** (UI surfaces ครบ; seed emails `@studennnn.local` ยังเป็น DB key เดิม โดยตั้งใจ).

**Brand assets** (`public/brand/`):
- `beagle-mark.png` — logo mark โปร่งใส (nav/footer ทุกหน้าผ่าน `BeagleLogo`)
- `icon.png` — squircle (favicon: `app/icon.png` 512 + `app/apple-icon.png` 180 + `app/favicon.ico`)
- `cloud-banner.webp` (25KB) — เมฆพาสเทล ใช้เป็น banner ของ admin class cards
- `beagle-avatar.webp` (164KB, โปร่งใส) — 3D beagle avatar ใน class cards
- `mark-512.png`, `wordmark.png` — เก็บไว้ (wordmark ไม่ได้ใช้; เรา typeset เอง)
- ไฟล์ `.tmp-logo-crop.py`/source PNGs ลบแล้ว

**Landing (`app/page.tsx` = Beagle Classroom):**
1. Hero = FloatingCards (CSS การ์ดลอย parallax + dotted bg + glow) — `components/landing/floating-cards.tsx`
2. `#overview` = รูป ChronoTask (`/landing/hero-cards.webp`) + `ProductMockup` กลาง — `components/landing/product-mockup.tsx`
3. `#features` = bento — `components/landing/showcase-bento.tsx`
4. Immersive 3D = R3F glass crystal + sparkles บนพื้นเข้ม — `components/landing/immersive-3d.tsx` + `hero-scene.tsx`
5. Roles · CTA · Footer

**Admin dashboard class cards** (`app/admin/dashboard/page.tsx` → `ClassCard`): profile-card style เหมือน reference — cloud banner + course-color tint, **3D beagle avatar** ใน gradient ring + float animation, divider stats, tilt + stagger.

### Logo prompts (ถ้าจะ regen) — อยู่ใน chat session นี้; Midjourney/DALL·E

### ⏭️ NEXT — ทำต่อได้เลย (ยังไม่ทำ)

| งาน | รายละเอียด |
|------|-----------|
| **Class detail header consistency** | `/admin/classes/[id]` header ยังเป็น gradient + house icon เก่า — ยังไม่ได้อัปเป็น cloud + beagle avatar ให้ตรงกับ dashboard card (ผู้ใช้ค้างถามว่าจะอัปไหม) |
| **Beagle avatar + cloud → student/teacher dashboard hero** | เอา mascot + เมฆ ไปใช้ที่ hero ของ /dashboard ให้ brand consistent |
| **Merge `phase-11` → `main`** | 59 commits ผ่าน PR + CI (ยังไม่ merge) |
| **Phase 9 cont.** | Hardening + Deploy (deferred) |
| **Phase 13** | `Class.colorSlot Int?` + `Student.heroBgPreset Int?` schema migration |
| **Phase 10 deferred** | per-class analytics + Audit CSV Thai column · composer multi-image · inline grade · 301 redirects |

### Tooling ติดตั้งใน session นี้ (เครื่อง dev)
- `uipro-cli` (global) + skill `.claude/skills/ui-ux-pro-max/` (search CLI ใช้ Python)
- Python 3.12 (winget) + Pillow + numpy (สำหรับ crop logo/แปลง webp)
- deps: `framer-motion` 12.40, `three` 0.184 + `@react-three/fiber` 9.6 + `@react-three/drei` 10.7 + `@types/three`

### Seed credentials (verify ในเบราว์เซอร์)
- Admin: `admin@studennnn.local` / `Admin1234!`
- Teacher: `teacher@studennnn.local` / `Teacher1234!` (homeroom ม.4/2)
- Student: `60001` / `Student1234`

### Motion system ที่ต้องรู้ (ADR-0028 + ADR-0029)
- Primitives: `components/motion/` = `Tilt3D` (CSS 3D, ห้ามใช้ใน data-entry/ห้ามใส่ใน grid item ที่เป็น inline `<a>` — ต้อง `block`), `EntryStagger` (framer), `AmbientBackground` (CSS blobs), `.springy`
- **บทเรียนสำคัญ:** `.card` บน `<a>` ที่ไม่ใช่ direct grid item + ไม่มี `flex`/`block` → จะกลายเป็น `display:inline` แล้วพื้นหลังแตก (ต้องใส่ `block`)
- R3F = landing เท่านั้น (lazy, ssr:false). อย่าใส่ WebGL หลาย canvas ในหน้าเดียว (limit ~16 + GPU)
- ทุก effect ต้อง respect `prefers-reduced-motion`

---

## Phase 12 Landing Page + Beagle Classroom rebrand (2026-06-06 · branch `phase-11`)

**Branch:** `phase-11` (pushed) — Phase 12 = R3F landing + rebrand. App is being renamed **Studennnn → Beagle Classroom** (family: beagle lovers + ครู/ข้าราชการครู). Rebrand applied on the landing page; **global rename across all `Studennnn` strings is a pending follow-up** (not yet done — login/dashboard/nav/footer/emails still say Studennnn).

### What Phase 12 ships

**Real 3D (ADR-0029 T1 Showcase).** Installed `three` + `@react-three/fiber` + `@react-three/drei` (landing-only, lazy via `next/dynamic ssr:false`). No WebGL bundle on authenticated pages.

- `components/landing/hero-scene.tsx` — R3F Canvas: floating glossy brand-coloured shapes (distorted icosahedron + sphere, rounded box, torus, dodecahedron) drifting via `<Float>`, leaning to the pointer, lit by an orbiting point light + city environment (liquid-glass read). Abstract, no model assets.
- `components/landing/hero-canvas.tsx` — client wrapper: lazy-loads HeroScene, gates on `prefers-reduced-motion`, always paints a static brand-gradient fallback.
- `components/landing/floating-cards.tsx` — ChronoTask-style product mini-cards (score 92%, attendance ring, due reminder, feed post, submissions 8/10) at varied depths, pointer-parallax + idle bob. Mobile-hidden, reduced-motion-off.
- `components/landing/showcase-bento.tsx` — Apple-style bento (col-span 4/2/2/4/3/3) of live-styled mocks of real surfaces (gradebook bars, 88% attendance ring, feed posts, course-colour grid, audit copy, role KPIs). Tilt3D per tile. **Plain grid, not EntryStagger** (so each Tilt3D is the direct grid item and col-spans resolve — same wrapper lesson as the dashboard cards).
- `components/landing/beagle-logo.tsx` — temporary SVG brand mark (beagle head + drop ears + graduation cap) + BeagleWordmark. **Swap for the AI-generated logo when ready** — API (className) stays the same. Logo prompt delivered in chat.
- `app/page.tsx` — full landing rewrite: glass nav, hero (Section 1), bento (Section 2), 3-role strip, saturated-blue closing CTA, footer.

### Bug fixed this phase (important pattern)

**Tilt3D + inline anchor clip.** Wrapping a `.card` `<a>` in Tilt3D removed its grid-item auto-blockification → the anchor reverted to `display:inline` → fragmented background + content spill (product owner screenshotted it). Fixed by adding the `block` utility to the student dashboard card anchor. Verified in-browser via preview MCP (logged in as seeded student). **Lesson: any `.card` anchor that is NOT a direct grid item and lacks `flex`/`block` needs an explicit `block`.**

Also: `@react-three/fiber` v9 augments global `JSX.IntrinsicElements` with three's elements, which made `React.ElementType` resolve `className` to `never` for dynamic `<Icon>` in setup-tabs + unified-composer. Fixed by typing those icon fields as `LucideIcon`.

### Phase 12 verifications

- `pnpm typecheck` = **0 errors** · `pnpm lint` = **0 errors** (254 warnings) · `pnpm test` = **429 passed**
- Verified in browser (preview MCP): hero WebGL canvas + floating cards + headline render; bento resolves to varied layout; logged-out landing reachable.

### Seed credentials (for browser verification)

- Admin: `admin@studennnn.local` / `Admin1234!`
- Teacher: `teacher@studennnn.local` / `Teacher1234!` (homeroom ม.4/2)
- Student: `60001` / `Student1234` (in ม.4/2)

### What's queued next

| Task | Status | Notes |
|------|--------|-------|
| Phase 12 — Landing + R3F | ✅ done | Beagle Classroom hero + bento |
| Global rename Studennnn → Beagle Classroom | ⏸ pending | Every remaining `Studennnn` string: login/dashboard/nav/footer/auth layout/emails/PRODUCT.md/seed |
| Real logo swap | ⏸ pending | Replace BeagleLogo SVG with AI-generated mark |
| Photographic banner assets | ⏸ pending | 8 course-slot WebP backgrounds for .card-hero (ADR-0028 follow-up) |
| Phase 13 — schema customization | ⏸ pending | Class.colorSlot + Student.heroBgPreset |
| Phase 9 cont. — Hardening + Deploy | ⏸ pending | — |

### Tooling installed this session

- `uipro-cli` (global) + `.claude/skills/ui-ux-pro-max/` skill — consulted for landing structure (bento showcase, product-demo patterns) + motion discipline
- Python 3.12 (winget) — runs the skill's search CLI
- `framer-motion` 12.40.0, `three` 0.184 + `@react-three/fiber` 9.6 + `@react-three/drei` 10.7 (+ `@types/three`)

---

## ⚠️ START HERE — Phase 11.8 + 11.9 World-class interactive ปิดครบ (2026-06-06 · branch `phase-11`)

**Branch:** `phase-11` (pushed to origin) — 12 commits on top of Phase 11.7

### Why these phases exist

Product owner pushback after Phase 11.7: (1) the course feed *"เหมือน Gmail ไม่ใช่ Instagram"*, and (2) the whole system *"ดูไม่มีอะไรเลย ไม่มีลูกเล่น Animation"* — wants *"ดูว้าว ดูหรู เป็น OS"* with 2D+3D interactivity from world-class sites. The product owner also asked to install `uipro-cli` (UI/UX Pro Max design-intelligence skill) which was done and consulted.

### Phase 11.8 — Instagram feed (1 commit)

| SHA | Commit |
|-----|--------|
| `0760659` | feat(feed): Instagram-style FeedCard with author header + day grouping |

FeedItem widened (bodyPreview / authorName / attachmentCount, all optional). FeedCard became a social post: avatar with Thai initials + author + relative time, ring-tinted type chip, 18px title + body preview, score-published blue callout, due/attachment meta chips, role-aware footer CTA. Day-bucket dividers (วันนี้/เมื่อวาน/weekday/Buddhist date). Filter row = iOS segmented control.

### Phase 11.9 — Interactive 2D/3D motion (11 commits)

| SHA | Commit |
|-----|--------|
| `90f6520` | docs(adr): ADR-0029 task-modulated 2D/3D motion budget |
| `…` | feat(motion): framer-motion + 3 primitives (Tilt3D, EntryStagger, AmbientBackground) |
| `…` | feat(dashboard): ambient blobs on student + teacher heroes |
| `…` | feat(dashboard): Tilt3D + EntryStagger on all course/class grids |
| `…` | feat(auth): ambient blob bg + spring card entry |
| `…` | feat(feed): EntryStagger reveal on feed posts |

**ADR-0029** — task-modulated motion budget extending ADR-0028. 4 tiers: T1 Showcase (landing, real 3D — deferred Phase 12), T2 Interactive (dashboards/shells/lists/feed/auth — CSS tilt + blobs + stagger), T3 Responsive (content detail — stagger + spring, no tilt), T4 Calm (grade entry/attendance/audit/forms — ADR-0028 unchanged). **Data-Entry-Is-Sacred Rule**: wow lives where users arrive, never where they work.

**Motion primitives** (`components/motion/`):
- `Tilt3D` — CSS 3D pointer-parallax, max 8°, touch-disabled, reduced-motion-safe, no JS lib
- `EntryStagger` — framer-motion fade-up reveal, 40ms stagger capped at 12, useReducedMotion-aware
- `AmbientBackground` — 3 drifting radial-gradient blobs (CSS @keyframes 22-30s), server component, system-colour tones

**Applied:** student hero + teacher hero ambient blobs; Tilt3D + EntryStagger on /admin/dashboard class grid, /dashboard teacher+student course grids, /teacher/courses list; auth layout blob bg + slide-up card; feed post stagger.

**Library:** framer-motion 12.40.0 (lazy, T2/T3 islands). `three`/R3F deferred to Phase 12 landing (no WebGL on authenticated pages).

### Phase 11.8+11.9 verifications

- `pnpm typecheck` = **0 errors** · `pnpm lint` = **0 errors** (254 warnings) · `pnpm test` = **429 passed**
- No schema migration. framer-motion added to client islands only — initial bundle budget (<250KB) respected.

### Tooling installed this session

- `uipro-cli` (global npm) + `.claude/skills/ui-ux-pro-max/` skill — consulted for motion discipline (reduced-motion High severity, parallax nausea, animate-1-2-elements-max). Python 3.12 installed (winget) to run its search CLI.

---

## ⚠️ START HERE — Phase 11.7 Course shell redesign ปิดครบ (2026-06-06 · branch `phase-11`)

**Branch:** `phase-11` (pushed to origin) — 36 commits on top of `phase-10`'s `84df1ee` (12 Phase 11 + 6 Phase 11.5 + 5 Phase 11D + 9 Phase 11.6 + 4 Phase 11.7)

### Phase 11.7 commit table

| SHA | Commit |
|-----|--------|
| `78be1cd` | feat(course): CourseShell as .card-hero + iOS segmented TabNav |
| `c8018d6` | feat(student): course overview KPI tiles as .card-tinted variants |
| `acc5a39` | feat(teacher): course overview KPI strip + ClassCodeCard below |

### Why Phase 11.7 exists

The product owner opened `/student/courses/[id]` after Phase 11.6 landed and pushed back: *"เหมือนคุณเปลี่ยนแค่นิดเดียวเอง... หลายหน้ายังเหมือนเดิม."* The screenshot showed a plain badge + h1 + subtitle header, an underline tab nav, and three flat white KPI cards — none of which carried the course identity or the iOS+Win11 vocabulary the earlier phases established. Phase 11.5 / 11.6 had migrated tokens and dashboards but never touched the **CourseShell**, which is the highest-traffic surface in the system (every teacher + student click into a course goes through it).

### What Phase 11.7 ships

**`components/course/course-shell.tsx`** — the plain `badge → h1 → subtitle` header is replaced with a `.card-hero` surface:

- Banner zone (120px) renders the course-slot gradient mesh from `getCourseGradientForClass(course.class.id)`. Same hash as `/admin/dashboard` ClassCard + `/dashboard` course lists + `/admin/classes/[id]` drill-down → every surface that shows the course shares the identity colour
- Eyebrow chip (`ห้องเรียน` / `รายวิชาที่สอน`) floats on the banner as a frosted `.glass-nav` pill (ADR-0028 § 5 hero info-bar glass scope)
- `BookOpen` icon avatar (white rounded-2xl + `shadow-card`) overlaps the banner edge — the iOS profile-card pattern recurring across the system
- Course name = weight-600 2xl/3xl semibold, tracking -0.03em
- TabNav sits along the bottom edge of the same card surface

The sticky context bar (back link + term name) opts in to `.glass-nav` so scrolled content blurs underneath the chrome.

**`components/course/tab-nav.tsx`** — the quiet Calm Ledger underline pill becomes an iOS-style **segmented control**:

- Whole nav sits inside a tinted track (`bg-black/[0.04] + p-1`)
- Active tab is a white rounded-xl pill with `--shadow-lift`, appearing to sit "above" the track surface
- Inactive tabs are text-on-track, no chrome
- 180ms `--spring-standard` transition on bg + shadow + colour
- Horizontal scroll on narrow viewports

**`lib/course/queries.ts`** — `getCourseOfferingForTeacher` + `getCourseOfferingForStudent` widen `class` select to include `id`. Plus `app/student/courses/[id]/assignments/page.tsx` (inline DB read) gets the same widening.

**`app/student/courses/[id]/page.tsx`** — three flat `.card` KPI tiles become `.card-tinted` variants tinted by status:

- **อัตรามาเรียน** — rate ≥ 85% = green tile, 70-84% = orange, < 70% = red. The card literally turns colour to telegraph attendance health at a glance.
- **คะแนนรวม (เผยแพร่)** — blue tinted when published items exist, neutral card when none.
- **การบ้านที่ต้องทำ** — green when 0 (with `CheckCircle2` + "ส่งครบแล้ว"), orange when > 0.

Every leading number wraps in `<AnimatedStat>` (counts up from 0 on mount, snaps under reduced-motion). Each tile gains a 14px lucide icon in the eyebrow row + a semibold 3xl figure with -0.02em tracking + a soft `opacity-60` unit suffix.

The `ตารางเรียน` card title gains a small rounded-lg blue-tinted icon chip in place of the bare lucide icon — matches the soft icon-pill pattern from the dashboard hero KPIs.

**`app/teacher/courses/[id]/page.tsx`** — the single "สมาชิก N คน" link card becomes a 3-tile KPI strip matching the student overview shape:

- **สมาชิก** — blue tinted (info), AnimatedStat for active member count
- **งานรอตรวจ** — orange tinted when > 0 (action needed), neutral `.card` when 0. The tile colour itself telegraphs whether there's something to do.
- **การบ้านในห้อง** — blue tinted (info), AnimatedStat for total assignment count

ClassCodeCard moves below the KPI strip — the QR/code surface is a teacher tool not a status indicator, so it sits below the at-a-glance status row. Adds `db.submission.count` + `db.assignment.count` to the existing `Promise.all` so the page still server-renders in one Server Component pass.

### Phase 11.7 verifications

- `pnpm typecheck` = **0 errors**
- `pnpm lint` = **0 errors** (254 pre-existing warnings)
- `pnpm test` (unit) = **429 passed**
- No schema migration. CourseShell prop widens but every caller compiles unchanged because they spread course directly from the now-widened query return.

### What's queued next

| Task | Status | Notes |
|------|--------|-------|
| Phase 11.7 — Course shell redesign | ✅ done | Every course tab on teacher + student now lands on .card-hero + segmented TabNav |
| Phase 12 — Landing page | ⏸ pending | Now ready — theme is final, dashboards + course shell + admin all consistent |
| Phase 13 — Course colour schema customization | ⏸ pending | `Class.colorSlot Int?` migration + admin override UI · `Student.heroBgPreset Int?` for hero bg picker |
| Phase 10 deferred follow-ups | ⏸ pending | Per-class analytics + Audit CSV Thai column · Composer multi-image · Inline grade · 301 redirects |

---

## Phase 11.6 Per-page polish sweep (2026-06-06 · branch `phase-11`)

**Branch:** `phase-11` (pushed to origin) — Phase 11.6 initial 9 commits on top of Phase 11D

### Phase 11.6 commit table

| SHA | Commit |
|-----|--------|
| `443171d` | feat(scoring): score-item dialogs sweep to ADR-0028 system palette |
| `85526b4` | feat(teacher): gradebook + score entry pages sweep to system palette |
| `3671cbc` | feat(teacher): attendance + assignment + submission sweep to system palette |
| `5221d79` | feat(admin): user drilldown + setup tabs + audit + classes sweep |
| `93bdddb` | feat(student): term-summary palette sweep + GPA CountUp animation |
| `6e69e7d` | feat(theme): bulk system-palette sweep — all remaining dialogs + forms + course pages |

### What Phase 11.6 ships (every surface in the system palette)

Visual debt from Phase 11.5's checklist closes out. The sweep migrates every inline Tailwind `rose-` / `amber-` / `emerald-` colour call across **45 component + page files** to the ADR-0028 system palette:

```
rose-*     -> red-*       (destructive, danger, error)
amber-*    -> orange-*    (warning, in-progress, near-deadline)
emerald-*  -> green-*     (success, published, completed)
```

**Hand-written sweeps (6 commits, 14 files):**

- `components/scoring/{publish-score-item-dialog,create-score-item-form,delete-score-item-dialog}.tsx` — destructive trigger, one-way warning, error/success blocks. Removes the `border-rose-200` stroke (ADR-0028 cards default to flat tinted), shifts validation hints.
- `components/scoring/score-grid.tsx` — published warning, error/success callouts, late + retroactive-edit inline badges.
- `app/teacher/courses/[id]/scores/{page,[scoreItemId]}.tsx` — published badge + per-row mini-badge migrate to green; section-level "เผยแพร่ครบ" chip.
- `components/attendance/grid.tsx` — STATUS_ACTIVE map (PRESENT/LATE/EXCUSED/ABSENT) migrates emerald/amber/blue/rose → green/orange/blue/red, back-edit warning to orange, error/success blocks.
- `app/teacher/courses/[id]/attendance/{page,[sessionId]}.tsx` — cancelled badge + reason text → red.
- `app/teacher/courses/[id]/assignments/page.tsx` + `[assignmentId]/page.tsx` — STATUS_LABEL map for SUBMITTED/LATE_SUBMITTED/RETURNED migrates to green/orange/red.
- `app/teacher/courses/[id]/assignments/[assignmentId]/submissions/[submissionId]/page.tsx` — current-version border + chip + ส่งสาย badge.
- `components/admin/{setup-tabs,reset-password-card}.tsx` — every validation hint, delete-button hover, success callout (reveal-once temp password) migrates. The "เก็บไว้แจ้งผู้ใช้" hint shifts amber → orange.
- `app/admin/{audit/page,audit/[id]/page,users/[id]/page,classes/[id]/page}.tsx` — tierBadgeClass helper rebinds CRITICAL/IMPORTANT to red/orange. RoleBadge collapses from saturated 3-colour map (purple/blue/amber) to the neutral `.badge` class per ADR-0028 § 2 No-Saturated-Role-Colour Rule. /admin/classes/[id] header replaces flat amber gradient with the `.card-hero` pattern matching /admin/dashboard — same course-slot gradient mesh so the drill-down inherits the colour.
- `components/scoring/term-summary-view.tsx` — GPA value picks up AnimatedStat with `decimals=2` on the screen path; print path keeps static `formatGpa()`. Status chips (จบเทอมแล้ว / ปัจจุบัน / ยังไม่จบเทอม) and progress bar migrate.
- `components/dashboard/animated-stat.tsx` — new `decimals` prop renders fixed-precision decimals via `.toFixed()` for GPA + percentage surfaces.

**Bulk sweep (1 commit, 31 files):**

One-shot Node script walked 31 remaining surfaces with a fixed mapping table (deleted post-sweep). The script produced 172 token replacements across:

- 4 assignment dialogs (create + grade + return + submit-version)
- 3 announcement dialogs (create + edit + delete)
- 3 material dialogs (create + edit + delete)
- 4 comment surfaces (composer + edit + moderate-delete + delete)
- 4 attendance helpers (timetable-editor + student-stats + create-session-form + cancel-session-dialog)
- 2 course shell dialogs (remove-member + class-code-controls)
- class-picker recent-classes star (amber-500 → orange-500)
- copy-button toast colours
- feed unified-composer
- 4 student course pages (overview / scores / assignments list + detail)
- 2 admin import (page + form)
- 1 teacher courses new form

### Phase 11.6 verifications

- `pnpm typecheck` = **0 errors**
- `pnpm lint` = **0 errors** (254 pre-existing warnings)
- `pnpm test` (unit) = **429 passed**
- No schema migration. No new test cases.

### Remaining inline matches (intentional)

`grep -rln 'rose-|amber-|emerald-'` against app/ + components/ shows only:

- `prose-sm` — Tailwind typography plugin class on material/announcement view pages (substring match on `rose-` is a false positive)
- `--color-course-rose-{50,500}` + `--color-course-amber-{50,500}` in `globals.css` — ADR-0028 § 2 course slot tokens (intentional name; rose/amber here are course identity slots, not status colours)

The system now contains zero unintended Tailwind-default rose/amber/emerald inline colour calls. Every status surface across teacher + student + admin reads through the ADR-0028 4-colour system palette.

### What's queued next

| Task | Status | Notes |
|------|--------|-------|
| Phase 11.6 — per-page polish sweep | ✅ done | 45 files migrated, 0 unintended Tailwind defaults remain |
| Phase 12 — Landing page | ⏸ pending | Real screenshots from theme final · photographic banner asset commission |
| Phase 13 — Course colour schema customization | ⏸ pending | `Class.colorSlot Int?` migration + admin override UI · `Student.heroBgPreset Int?` for hero bg picker |
| Phase 10 deferred follow-ups | ⏸ pending | Per-class analytics + Audit CSV Thai column · Composer multi-image upload pipeline · Inline grade input on submission view · 301 redirects |

### Compat shims still resident in `app/globals.css`

ADR-0014's Ink+Gold orphan shims (`.mesh-bg`, `.blob`, `.sheen`, `.glass`, `.tilt-card`, `.text-gradient-*`, `.perspective-*`, `.preserve-3d`, `.card-dark` aubergine fallback) remain as no-ops. Each shim retires when the last consumer page is migrated; no page in app/ currently references them (last sweep verified via grep).

---

## Phase 11D Dashboards on new theme (2026-06-06 · branch `phase-11`)

**Branch:** `phase-11` (pushed to origin) — Phase 11D initial 4 commits on top of Phase 11.5

### Phase 11D commit table

| SHA | Commit |
|-----|--------|
| `114fad7` | feat(dashboard): getTeacherTodaySchedule + getStudentTodaySchedule helpers |
| `1373420` | feat(teacher): /dashboard hero with 4 KPI tiles + today schedule |
| `0e141a4` | feat(admin): wire AnimatedStat to dashboard KPI values |
| `c995375` | feat(student): today's class panel above DueSoon |

### What Phase 11D ships (dashboards reach full polish)

**`lib/dashboard/queries.ts`** gains `getTeacherTodaySchedule` + `getStudentTodaySchedule` — read TimetableSlot rows for the current `dayOfWeek` + active Term, scoped to a teacher's CourseOfferings or a student's active enrollments. Returns the same `TodayClass` shape from both so UI doesn't branch on role. `classId` included for CourseColorChip marker integration. No Session materialization required — planned timetable, not the materialised reality.

**`components/dashboard/animated-stat.tsx`** — small client leaf that wraps an integer KPI with `useCountUp` + `formatCountUp`. Single component reusable across all three role dashboards. Respects `prefers-reduced-motion` (snaps to target) and SSR (renders target instantly on first paint).

**`components/dashboard/teacher-hero.tsx`** — server component matching ADR-0028 § 8 medium vibrancy for teachers:
- `.card-hero` outer with soft blue-tinted radial banner (NOT saturated `.card-accent` — that's student-only)
- "พื้นที่ทำงานของคุณ" pill chip sitting over the banner edge in the iOS profile-card avatar-overlap pattern
- Semibold 3xl greeting + body subtitle summarising today's first slot
- KPI strip uses `.panel-inset` with 4 tiles: วิชาที่สอน / นักเรียนทั้งหมด / งานรอตรวจ / คาบ-สัปดาห์
- งานรอตรวจ flips to `text-orange-700` when > 0 (system warning)
- AnimatedStat counts every value up from 0 on initial paint
- ตารางวันนี้ list with CourseColorChip marker per row

**`components/dashboard/student-today-panel.tsx`** — compact "วันนี้" panel above `DueSoonWidget`. Renders nothing when no slots today. Same row shape as TeacherHero's ScheduleRow (marker + course name + room + monospace time range). Colour identity carries through from the dashboard course grid chips.

**`/admin/dashboard`** — 4 `KpiCard` values (ครู / นักเรียน / ห้องเรียน / Critical Audit 7d) animate via AnimatedStat on hydration. SSR renders the final number for crawlers; rAF animation only runs after hydration.

### Phase 11D verifications

- `pnpm typecheck` = **0 errors**
- `pnpm lint` = **0 errors** (254 pre-existing warnings)
- `pnpm test` (unit) = **429 passed**
- No schema migration. No new test cases (KPI presentation only — business logic unchanged).

### What's queued next

| Task | Status | Notes |
|------|--------|-------|
| Phase 11D — Dashboards on new theme | ✅ done | Teacher hero + KPI + today schedule · Admin CountUp · Student today panel |
| Phase 11.6 — per-page polish sweep | ⏸ pending | Teacher gradebook + attendance grid + submission view + score dialogs + admin audit detail + classes drill-down + student term summary — see Visual debt below |
| Phase 12 — Landing page | ⏸ pending | Real screenshots from theme final · photographic banner asset commission |
| Phase 13 — Course colour schema customization | ⏸ pending | `Class.colorSlot Int?` migration + admin override UI · `Student.heroBgPreset Int?` for hero bg picker |

### Visual debt (Phase 11.6 sweep targets)

Surfaces that still ship inline Tailwind defaults instead of the system palette — work as-is via token auto-shift, but lack ADR-0028 polish:

- Teacher gradebook entry grid (`/teacher/courses/[id]/scores`)
- Attendance grid (`/teacher/courses/[id]/attendance`)
- Submission view (`/teacher/courses/[id]/assignments/[id]/submissions/[id]`)
- Score item create/publish dialogs
- Admin audit detail (`/admin/audit/[id]`)
- Admin user drill-down (rose tokens in reset-password card)
- Admin setup tabs (amber tokens)
- Per-class drill-down (`/admin/classes/[id]`)
- Student term summary (`/student/courses/[id]/scores`, `/student/terms`) — GPA card pre-CountUp

---

## Phase 11.5 System-wide chrome sweep (2026-06-06 · branch `phase-11`)

**Branch:** `phase-11` (pushed to origin) — Phase 11.5 initial 6 commits on top of Phase 11's foundation

### Phase 11.5 commit table (system-wide sweep)

| SHA | Commit |
|-----|--------|
| `bb2525e` | feat(theme): TopNav opts in to .glass-nav frosted chrome |
| `1cb2bdd` | feat(admin): AdminSidebar blue active state + iOS soft indicator |
| `953f0b1` | feat(theme): course colour chips on /dashboard course lists |
| `d955b28` | feat(teacher): course colour markers + status badge on /teacher/courses |
| `690253b` | feat(feed): align feed surfaces to ADR-0028 status colour system |
| `514ce84` | feat(student): mobile glass-nav bottom navigation |

### What Phase 11.5 ships (chrome reaches every page)

**TopNav** opts in to `.glass-nav` — every authenticated page now shows scrolled content blurring under a frosted top bar instead of a flat strip. Single-line change because the heavy lifting moved into globals.css when the utility landed in Phase 11.

**AdminSidebar** swaps the legacy black-fill active item for the iOS Settings.app pattern: `bg-blue-50 + text-blue-700` plus a 2px blue-500 vertical bar on the left edge. Hover for inactive items shifts to `bg-black/[0.03]` (lighter). All transitions rebind to the system spring tokens. Affects every admin surface (8+ pages — /dashboard, /setup, /teachers, /students, /import, /audit, /classes/[id], /users/[id], plus future admin routes).

**CourseColorChip integration** rolls out to four list contexts via role-modulated rendering:
- Teacher `/dashboard` course grid + `/teacher/courses` overview — `variant="marker"` (4px coloured left bar)
- Student `/dashboard` course grid — `variant="chip"` (full coloured pill with class name)
- `class.id` is the hash input, so every CourseOffering of the same homeroom shares a colour — keeps "วิทยาศาสตร์ ม.4 = teal" stable across all sections

`lib/course/enrollment.ts` — `listTeacherCourses` + `listStudentCourses` now select `class.id` alongside `class.name`. No schema change; just a wider select.

**Feed surfaces** align to ADR-0028 status colours:
- DueSoonWidget urgency callout becomes `.card-tinted card-tinted-orange` (replaces amber-200/amber-50 inline border)
- CourseFeedView feed-row icon decor: ANNOUNCEMENT amber → orange, MATERIAL emerald → green, SCORE_PUBLISHED purple → blue (Purple is not part of the 4-colour system per ADR-0028 Q2.a), ASSIGNMENT keeps blue
- `ส่งภายใน` due-date strip switches amber-700 → orange-700
- UnifiedComposer FormError + field error blocks swap rose → red tokens

**StudentBottomNav** (new) — fixed-bottom 4-item glass nav for STUDENT role on mobile only. Items: ฟีด / ห้องเรียน / ผลการเรียน / แจ้งเตือน. Active state shifts to `text-blue-700` + heavier icon stroke (iOS HIG pattern). Includes `env(safe-area-inset-bottom)` for iOS notched devices. Mounts inside `/dashboard` page with a 20px md:hidden spacer below the last section so the trailing card clears the bar.

### Phase 11.5 verifications

- `pnpm typecheck` = **0 errors**
- `pnpm lint` = **0 errors** (254 pre-existing warnings)
- `pnpm test` (unit) = **429 passed**
- No schema migration. No Prisma changes.

### Visual debt — what still looks legacy

Per-page polish that ADR-0028 deliberately deferred to Phase 11D / 11.6:

- Teacher gradebook entry grid (`/teacher/courses/[id]/scores`) — still uses Tailwind defaults inline
- Attendance grid (`/teacher/courses/[id]/attendance`) — same
- Submission view (`/teacher/courses/[id]/assignments/[id]/submissions/[id]`) — status colours still inline rose/emerald
- Score item create / publish dialogs — form errors not yet shifted to red-* tokens
- Admin audit detail (`/admin/audit/[id]`) — tier badges still rose/amber inline
- Admin user drill-down + setup tabs — partial sweep (reset-password card has rose; setup tabs have amber)
- Per-class drill-down (`/admin/classes/[id]`) — still uses pre-ADR-0028 chrome
- Student term summary (`/student/courses/[id]/scores` + `/student/terms`) — GPA rendering still pre-CountUp

These all WORK with the new tokens (auto-shift on `.card / .btn-primary / .input / .badge`) but the inline `bg-rose-*` / `bg-amber-*` / `bg-emerald-*` / `bg-purple-*` are still Tailwind defaults rather than the system palette.

---

## Phase 11 Theme migration foundation (2026-06-06 · branch `phase-11`)

**Branch:** `phase-11` (pushed to origin) — Phase 11 initial 12 commits on top of `phase-10`'s `84df1ee`

### Phase 11 commit table

| SHA | Commit |
|-----|--------|
| `42fe3cf` | docs(adr): ADR-0028 Calm Ledger v2 color-friendly + material (extends 0014) |
| `056915e` | docs(design): DESIGN.md v2 sync — color-friendly + material (ADR-0028) |
| `459ffd8` | feat(theme): token rewrite — neutral chrome shift + system + course palettes |
| `d133b55` | feat(theme): restore @layer components + 7 new utility classes (ADR-0028) |
| `ea0beb1` | feat(theme): course slot resolution + CourseColorChip + gradient mesh |
| `f74c5bd` | feat(theme): BottomSheet wrapper opt-in to .sheet (Pattern 7 mobile) |
| `0daa210` | feat(theme): useCountUp hook + formatCountUp Thai locale formatter |
| `6bc9350` | feat(auth): align Login/Signup/Join/ForceReset error+success blocks to system colors |
| `8e1605b` | feat(admin): dashboard class cards as .card-hero per reference image (ADR-0028) |
| `fd0e5cd` | feat(student): /dashboard student hero as .card-accent blue (ADR-0028) |

### What shipped

**ADR-0028 — Calm Ledger v2 (extends ADR-0014).** Locked through a multi-round /impeccable grill that started from the product owner's pain "Project จืดมาก ไม่มีสีสัน หมองหม่นมาก" and landed at (B) Extend Calm Ledger: keep the chrome philosophy (off-white body, Anuphan single family, pill geometry, rounded-2xl cards), add three vectors on top — 4-colour iOS-style system palette, 8-slot course identity palette, and material depth via .card-hero + .panel-inset + scoped frosted glass.

**Token rewrite (`app/globals.css`).** Body bg shifts `#F5F5F5` → `#F2F2F7` (iOS systemGroupedBackground). Tailwind v4 `@theme` block gains System Blue/Green/Orange/Red (50/500/600/700), 8 course colour slots (rose/coral/amber/lime/teal/sky/indigo/violet @ 50/500), motion tokens (`--ease-spring` + 3 duration tiers 80/180/280ms), and glass tokens (desktop 20px blur / mobile 12px / body-tinted bg + opaque fallback). Aubergine retired. `prefers-reduced-motion` fallback shifts from 0.01ms instant → 100ms ease-out.

**7 new utility classes.** `.card-accent` (4 saturated), `.card-tinted` (4 subtle), `.card-hero` (banner + content split with hover translateY), `.panel-inset` (subordinate stats strip — NOT a nested card), `.glass-nav` (frosted sticky chrome with `@supports` fallback), `.sheet` (mobile bottom-sheet variant on native `<dialog>` via `@media max-width: 768px`), `.springy` (press-feedback scale 0.98 utility).

**Modified primitives.** `.btn-primary` swaps black → System Blue + inset white-15 top highlight + spring press feedback. `.btn-tinted` is new (soft blue alternative). `.input` focus shifts black 2px → blue 2px + outer blue/20 glow (reduced-motion drops glow but keeps ring). Status badges gain `.badge-success/.badge-warn/.badge-danger/.badge-info` variants; role badges stay neutral grayscale per ADR-0014 inheritance.

**Course identity system (`lib/theme/course-color.ts` + `components/course/course-color-chip.tsx`).** `getCourseSlot(classId)` hashes via djb2 → slot 0-7. `getCourseSlotGradient(slot)` returns a CSS background composed of three offset radial gradients used as the banner zone of `.card-hero`. `<CourseColorChip variant="chip|marker|dot">` renders the three role-modulated shapes ADR-0028 § 8 specifies.

**Three critical sweeps.** (1) Login + Signup + Join + ForceReset auth pages — error blocks shift Tailwind rose-* → system red-50/red-700, success states pick up green-50/green-700 where semantically meaningful. (2) `/admin/dashboard` class cards rebuild as `.card-hero` matching the product owner's iOS-profile-card reference image — course-slot gradient banner, glass year-chip, white avatar circle overlap, panel-inset stats strip. ADR-0028 § 8 Gallery Exception in action. (3) `/dashboard` student greeting becomes `.card-accent card-accent-blue` with the arrow-circle CTA in System Blue tones. Teacher and admin keep the calm text greeting (Phase 11D will deepen teacher).

**New libraries.** `lib/hooks/use-count-up.ts` — rAF-driven number animation with `prefers-reduced-motion` snap. `formatCountUp(value)` for Thai locale formatting. `components/layout/bottom-sheet.tsx` — forwardRef wrapper around `<dialog>` that bakes in the `.sheet` class for greenfield dialogs (existing dialogs opt in by adding `sheet` to className).

### Phase 11 verifications

- `pnpm typecheck` = **0 errors**
- `pnpm lint` = **0 errors** (254 pre-existing warnings, was 256 — slight reduction from auth sweep cleanup)
- `pnpm test` (unit) = **429 passed** (+10 from Phase 10C baseline: +8 course-color, +2 formatCountUp)
- `pnpm test:integration` — not re-run (theme migration is pure CSS/JSX; lib/scoring + permissions + audit untouched; existing 172 integration tests still cover the same surface)
- No schema migration. No Prisma changes.

### What's queued next

| Task | Status | Notes |
|------|--------|-------|
| Phase 11 — Theme migration iOS+Win11 | ✅ done | Calm Ledger v2 per ADR-0028 |
| Phase 11D — Dashboards on new theme | ⏸ pending | Teacher hero + 4 KPI cards · Student full hero + Today's class + Due Soon + Course grid · CountUp wired · 6 preset bg picker in Student Settings (localStorage) |
| Phase 12 — Landing page | ⏸ pending | Real screenshots from theme final · photographic banner asset commission |
| Phase 13 — Course colour schema customization | ⏸ pending | `Class.colorSlot Int?` migration + admin override UI |

### Deferred from Phase 10 (still non-blocking)

- Per-class analytics + Audit CSV Thai column (Phase 10B follow-up — `lib` helpers in place)
- Composer multi-image upload pipeline (Phase 10C deferred)
- Inline grade input on submission view (Phase 10C deferred)
- 301 redirects from old list landings → `/feed?type=` (Phase 10C deferred)

### Compat shims still resident in `app/globals.css`

ADR-0014's compat shims for retired Ink+Gold utilities remain as no-ops since Phase 11 ships chrome + 3 critical pages only. Each shim retires as the last consumer page is migrated under Phase 11D or later:

- `.mesh-bg`, `.blob`, `.sheen`, `.glass` (Ink+Gold non-frosted, distinct from `.glass-nav`), `.tilt-card`, `.text-gradient-gold`, `.text-gradient-ink`, `.perspective-*`, `.preserve-3d`
- `.card-dark` (aubergine) — falls back to `.card-tinted-blue` for any leftover consumer; grep confirmed no app/* page references it post-Phase-11

---

## Phase 10 ปิดครบทั้ง 3 sub-phase (2026-06-05 · branch `phase-10`)

**Branch:** `phase-10` (pushed to origin) — 18 commits on top of `main`'s `15f31a9` (Phase 9 P9-4 close-out)

### Phase 10A · Foundation (8 commits)

7 commits documented in this section's earlier revision (ADR-0024 sum-based scoring · ADR-0027 audit rendering · schema cutover · lib/scoring + lib/audit + lib/dashboard). Verifications: 413 unit + 172 integration passing post-cutover.

### Phase 10B · Admin surface (8 commits)

| SHA | Commit |
|-----|--------|
| `c9067ca` | docs(adr): ADR-0025 Course Feed tab + ADR-0026 admin user drill-down |
| `8b8d879` | feat(auth): temp-password.ts pure generator for Admin reset flow |
| `128a7e0` | feat(admin): setup CRUD lib + teacher single-add + reset-password lib |
| `e1eb6d4` | feat(admin): /admin/setup × 4 tabs (Year/Term/Class/Teacher single-add) |
| `5ce69bc` | feat(admin): /admin/users/[id] drill-down + reset-password (ADR-0026) |
| `d49e796` | feat(admin): /admin/audit verbose Thai sentence rendering (Q9 + ADR-0027) |
| `f1c8057` | feat(admin): dashboard Class Cards + /admin/classes/[id] drill-down (Q3/Q6) |

**What shipped:**
- **`/admin/setup` × 4 tabs** — AcademicYear / Term / Class / single-Teacher CRUD with delete-block policy (Q8c) + reveal-once temp-password for the teacher add path.
- **`/admin/users/[id]`** — full non-secret profile drill-down (identity / auth meta / relationships / last 50 audits) + reset-password reveal-once UI per ADR-0026 § 2. passwordHash is in DB but never on the wire. Self-reset is blocked for attribution.
- **`/admin/audit`** — list page now renders the **verbose Thai sentence** per row (ADR-0027 + Q9 lock) via the Phase 10A `renderAuditLog` helper. Actor name resolved through Teacher/Student/Admin sub-rows. Technical enum literal accessible on hover for ops.
- **`/admin/dashboard`** — Class Cards grid (Q6 lock: Card = Class, not CourseOffering). KPI row uses `lib/dashboard/queries.getAdminStats` (Phase 10A shared module); Critical-audits-last-7d gets a rose ring when count > 0.
- **`/admin/classes/[id]`** — per-class drill-down with course list + roster (links to `/admin/users/[id]` for both teachers and students). Per-class analytics (rankings + CSV export) deferred to task #8 — non-blocking.

**Admin sidebar** gains "ตั้งค่าโครงสร้าง" nav item between "ภาพรวม" and "ครู". Teacher/Student list pages link names → `/admin/users/[id]` drill-down.

### Phase 10C · Course Feed redesign (1 commit · multi-feature)

| SHA | Commit |
|-----|--------|
| `ab06cca` | feat(course): Phase 10C — Course Feed tabs + unified composer (ADR-0025) |

**What shipped:**
- **Tab nav reshape** per ADR-0025: teacher 8→6 tabs, student 7→5 tabs. การบ้าน / เอกสาร / ประกาศ list tabs dropped from nav; detail routes survive. **"ฟีด" is the new first tab (default landing)**.
- **`/(teacher|student)/courses/[id]/feed`** — chronological stream with type-chip filter row (ทั้งหมด · ประกาศ · การบ้าน · เอกสาร · คะแนนที่เผยแพร่). Server-rendered chips via `?type=` URL param (no client filter state). Insta-style FeedCard with kind-colored icon tile + Buddhist-short due dates for Assignment rows.
- **`lib/feed/getCourseFeed`** — new function that reuses the Phase 7 multi-query union scoped to one course + optional FeedKind filter. The cross-course `getUserFeed` (dashboard) is unaffected; both delegate to a shared `aggregateFeed` helper.
- **`lib/feed/resolveCourseFeedHref`** — role-aware variant of the Phase 7 navigation resolver. Teacher feed rows link to `/teacher/...`, student rows to `/student/...`.
- **`<UnifiedComposer>`** Pattern-7 dialog (teacher only) with content-type chip selector — ประกาศ / การบ้าน / เอกสาร. Each sub-form posts to its own Server Action (composeAnnouncementAction / composeAssignmentAction / composeMaterialAction); the chip choice just routes the submit. Assignment form has the isScored toggle that reveals the fullScore field (ADR-0024 — no weight input ever again).

**Deferred follow-ups (non-blocking, in next session):**
- Multi-image carousel attachment in the composer (presign + commit form-state wiring — ADR-0021 unchanged; the slot is reserved in the dialog).
- Inline grade input on per-submission view (replaces the Phase 6 grade modal — UX upgrade, not semantic change).
- 301 redirect from old `/courses/[id]/assignments` (etc.) list landings → `/feed?type=assignment`. Current behaviour: the URL still resolves to the legacy list page which is still wired to lib reads — harmless co-existence during the transition.

### Phase 10 verifications

- `pnpm typecheck` = **0 errors**
- `pnpm test` (unit) = **419 passed** (+6 temp-password cases on top of the 413 post-Phase-10A baseline)
- `pnpm lint` = 0 errors (256 pre-existing warnings)
- `pnpm test:integration` (live Neon) = **172 passed** post-deflake (Phase 10A run)
- Schema applied to Neon dev DB via `prisma db push` (Phase 10A weight drop + targetLabel add)

### What's queued next

| Task | Status | Notes |
|------|--------|-------|
| Phase 10A — Foundation | ✅ done | — |
| Phase 10A follow-up — Test rewrite | ✅ done | — |
| Phase 10B — Admin surface | ✅ done | — |
| Phase 10B follow-up — Per-class analytics + Audit CSV Thai column | ⏸ pending | Non-blocking; lib helpers in place |
| Phase 10C — Course Feed redesign | ✅ done | Composer multi-image + inline grade deferred per commit body |
| Phase 11 — Theme migration iOS+Win11 (`/impeccable` grill first) | ⏸ pending | Now ready to start |
| Phase 11D — Dashboards on new theme | ⏸ pending | Blocked by 11 |
| Phase 12 — Landing Page (post-theme) | ⏸ pending | Blocked by 11D |

---

### Phase 10A · Foundation — original commit table

(retained below — the Phase 10A ADR-0024/0027 cutover details still authoritative)

**Branch:** `phase-10` (pushed to origin) — Phase 10A initial 8 commits on top of `main`'s `15f31a9` (Phase 9 P9-4 close-out)

| SHA | Commit |
|-----|--------|
| `d435ef8` | docs(adr): ADR-0024 sum-based scoring supersedes weight invariant |
| `0e5b060` | docs(adr): mark 0017 superseded + 0018 partially superseded by 0024 |
| `686eb68` | docs(context): rewrite Scoring § for sum-based formula |
| `33aa2e9` | refactor(scoring): cutover to sum-based scoring (29 files, –386 LoC net) |
| `d0634f7` | chore(prisma,audit): add AuditLog.targetLabel + 13 Phase 10 audit events |
| `9b27977` | feat(audit): label.ts + render.ts helpers + ADR-0027 |
| `e38d352` | feat(dashboard): lib/dashboard/queries.ts shared role KPI module |

**What changed (foundation only — no UI yet):**

- **ADR-0024** — Sum-based scoring formally supersedes ADR-0017 weight invariant. `weight` column dropped from `ScoreItem`. Course grade = `Σscore / ΣfullScore × 100`. `fullScore` alone encodes per-item influence (Quiz fullScore=10 vs Midterm fullScore=50 → Midterm carries 5× the weight automatically). ADR-0018's field-class B narrows to `{fullScore}` only; class A and C unchanged.
- **ADR-0027** — Audit log gains `AuditLog.targetLabel String?` denormalised snapshot column captured at fire time (per emitter). Verbose Thai sentence renderer in `lib/audit/render.ts` + per-event noun map in `lib/audit/label.ts`. ADR-0025 (Course Feed tab) and ADR-0026 (admin user drill-down) deferred to their respective phase entries per "natural editing path" convention.
- **13 new audit events added to `AuditEvent` union** for Phase 10B Admin CRUD surface + analytics export: `ACADEMIC_YEAR_{CREATED,UPDATED,DELETED}`, `TERM_{CREATED,UPDATED,DELETED}`, `CLASS_{CREATED,UPDATED,DELETED}`, `HOMEROOM_ASSIGNED`, `TEACHER_CREATED_SINGLE`, `PASSWORD_RESET_BY_ADMIN`, `CLASS_ANALYTICS_EXPORTED`. No fire sites yet — they land with Phase 10B.
- **`lib/dashboard/queries.ts`** — Shared KPI module: `currentTerm()`, `getTeacherStats`, `getStudentStats`, `getAdminStats`. Phase 10A ships lib only; UI consumers land in Phase 11D once the iOS+Win11 theme migration provides final visual tokens (Phase 11).

### Phase 10A grill summary (Phase 10 plan covers 10A + 10B + 10C)

Phase 10 origin = Q1-Q11 grill (~2h conversation). Top locked decisions:
1. **Admin password viewing** = NEVER — bcrypt-only. Admin drill-down + password-reset-with-temp-reveal flow lands in 10B.
2. **Weight removed** — sum-based scoring per ADR-0024 (this phase, ✅)
3. **Father reference** = `C:\Users\Rayz\Father` (external project, not in repo)
4. **Course Feed tab** = unified Feed landing for `/(teacher|student)/courses/[id]` with type-chip composer (announcement/assignment/material) + multi-image carousel. Replaces 3 separate tabs. ADR-0025 lands at 10C entry.
5. **No GIF uploads** — kept ADR-0021 blocklist intact, multi-image carousel covers Insta-style feel
6. **Admin Class Cards dashboard** — Card = Class (homeroom), not CourseOffering. Drill-down per-Class → per-CourseOffering score rankings + class-level aggregate attendance. CSV export of analytics audited (`CLASS_ANALYTICS_EXPORTED`)
7. **Audit log** — denormalised `targetLabel` snapshot + verbose Thai sentence rendering (ADR-0027, this phase ✅)
8. **`/admin/setup` × 4 tabs** for AcademicYear/Term/Class/single-Teacher CRUD (lands in 10B)
9. **Dashboards Father-style** — hero + 4 stats + today's schedule (teacher) + Due Soon + Feed + Course grid (student). NO GPAX. Lands in Phase 11D after theme migration.
10. **Revised order from Q-revised:** 10A → 10B → 10C → 11 (theme) → 11D (dashboards on new theme) → 12 (Landing Page). User decision because: Landing Page needs real screenshots; theme migration changes visual tokens before dashboard polish makes sense.

### Phase 10A verifications

- `pnpm typecheck` = **0 errors**
- `pnpm test` = **413 passed** (was 384 + 13 new audit-render + 8 new dashboard slot-minute + restructured 8 scoring-calc + restructured scoring-format)
- `pnpm lint` = 0 errors · 256 pre-existing warnings (vendor + .github/skills/* + a few unused-imports in legacy tests)
- Schema applied to Neon dev DB via `prisma db push --accept-data-loss` (3 dev `ScoreItem.weight` values dropped, pre-launch per Q11b)

### Phase 10A follow-up (task #7 — in_progress as of this commit)

Integration tests `tests/integration/permissions/{score-item-lifecycle, assignment-coupling}.test.ts` rewritten for sum-based shape — test names + bodies + audit-payload assertions now reflect ADR-0024 instead of weight-based invariant. `scoring-l1-and-gpa.test.ts`, `score-entry.test.ts`, `submission-flow.test.ts` were already semantically correct after the mechanical weight strip — comments updated where misleading.

Test count on live Neon will land at ~135 integration cases (same as Phase 9 — re-shaped, not added).

### What's blocked / next

| Task | Status | Blocks |
|------|--------|--------|
| Phase 10A — Foundation | ✅ done | — |
| Phase 10A follow-up (test rewrite) | 🚧 in_progress | 10B, 10C |
| Phase 10B — Admin surface | ⏸ pending | 11 |
| Phase 10C — Course Feed redesign | ⏸ pending | 11 |
| Phase 11 — Theme migration iOS+Win11 (`/impeccable` grill first) | ⏸ pending | 11D |
| Phase 11D — Dashboards on new theme | ⏸ pending | 12 |
| Phase 12 — Landing Page (real screenshots, post-theme) | ⏸ pending | — |

### Pre-Phase-10 baseline (everything below is still authoritative)

Phase 1-2-3-4-5-6-7-8-9 closure tables, hot-fix history, and Pattern catalogue (Patterns 1-14) follow below — Phase 10A's rules of engagement deliberately stay aligned with them:
- Pattern 2 (authz inside `$transaction`)
- Pattern 3 (TX_OPTS on every transaction)
- Pattern 4 (DB-layer L1 projection)
- Pattern 6 (no `.bind()` on Server Actions; hidden form fields for context ids)
- Pattern 7 (native `<dialog>` deferred-close)
- Pattern 8 (`"use server"` async exports only)
- Pattern 10 (audit events past-tense)
- Pattern 14 (active ∪ ever-marked grid union)

### Phase 1-2-3-4-5-6 — ปิดครบ ✅

อ่าน 3 ไฟล์เรียงนี้ก่อนแตะอะไร:
1. **`HANDOFF.md`** (ไฟล์นี้ — START block + Patterns section)
2. **`CLAUDE.md`** — hard rules + coding conventions
3. **`CONTEXT.md`** — domain glossary (อย่าใช้คำนอก glossary นี้)

ADR ที่ต้องเข้าใจก่อนแตะ feature:
- `docs/adr/0012-workspace-model-no-subject-template.md` — CourseOffering = workspace, no Subject template
- `docs/adr/0013-enrollment-soft-delete-and-rejoin-restore.md` — soft-delete + auto-restore + kill switch
- `docs/adr/0014-theme-calm-ledger-supersedes-ink-gold.md` — Calm Ledger pivot (supersedes 0011)
- `docs/adr/0015-lazy-session-materialization.md` — Session created on demand, no cron, no eager batch
- `docs/adr/0016-sparse-attendance-and-enrollment-fk.md` — sparse rows + Enrollment FK + active∪ever-marked grid
- `docs/adr/0017-weight-invariant-basis-points-and-publish-gate.md` — ScoreItem.weight = integer basis points 0..10000; publish-gate Σ === 10000 strict; PURE calc.ts
- `docs/adr/0018-publish-is-a-contract-no-unpublish-and-field-class-edit-rules.md` — publishedAt one-way; field-class A/B/C edit dispatch; SCORE_EDIT_AFTER_PUBLISH + SCORE_DELETE_AFTER_PUBLISH escape hatches
- `docs/adr/0019-assignment-scoreitem-coupling-atomic-no-default-weight.md` — Assignment ↔ ScoreItem synchronous atomic coupling; ครูระบุ weight + fullScore ใน dialog (no default); 3-state toggle dispatch
- `docs/adr/0020-submission-lifecycle-workflow-signals-vs-score-of-record.md` — Submission lifecycle; RETURN = workflow signal ไม่แตะ ScoreEntry; isLate per-version; status เดินหน้าเสมอ
- `docs/adr/0021-file-upload-pipeline-presigned-staging-magic-byte-verify-exif-strip.md` — R2 pipeline: presigned PUT + staging → commit verify → permanent; magic-byte enforcement; SVG blocked; EXIF strip via sharp; signed URL strategy hybrid

### Phase 3 — DONE end-to-end (all 9 sub-tasks + 4 manual-QA hotfixes)

| Task | Status | SHA(s) |
|------|--------|--------|
| P3-1 schema (Enrollment soft-delete fields + index) | ✅ | `1a73d1e` |
| P3-2 lib/course/enrollment lifecycle (rename audit family → COURSE_MEMBER_* · removeMember · restoreByRejoin · getActiveMembers · enrollByClassCode refactor · tighten list queries) | ✅ | `da44ade`, `b8cbe58` |
| P3-3 lib/auth course-scoped helpers (can.ownsCourse, can.isActiveCourseMember, assert.*) + 9 new unit tests | ✅ | `e0014cb` |
| P3-4 components/course/{course-shell, tab-nav} scaffold | ✅ | `32270da` |
| P3-5 teacher tabs (Overview migration · Members + remove dialog · Settings + Class Code controls) | ✅ | `5a6432e`, `0d4cff8`, `3b12a52` |
| P3-6 student tabs (Overview + dashboard links · Members L1-filtered) | ✅ | `9e549bc`, `b0e5fa0` |
| P3-7 integration permission tests (real Neon DB, 22 cases) | ✅ | `a4ca88e` |
| P3-8 smoke-test.ts +13 Phase 3 checks | ✅ | `0db1339` |
| P3-9 docs update (Task.md + HANDOFF) | ✅ | `41ff537`, this commit |
| **Hotfix 1** — drop non-async export in "use server" file | ✅ | `7e35a7a` |
| **Hotfix 2** — native `<dialog>` close + centering under Next 16 + React 19 + Turbopack | ✅ | `4d0f0f5` |
| **Hotfix 3** — drop `.bind()` on Server Actions (session lost under Auth.js beta) | ✅ | `bb53d8a` |
| **Hotfix 4** — TX_OPTS for Neon cold-start + serialize integration tests | ✅ | `6879564` |

### Phase 4 — DONE end-to-end (all 9 sub-tasks)

| Task | Status | SHA(s) |
|------|--------|--------|
| P4-1 schema (TimetableSlot + Session + AttendanceRecord + AttendanceStatus) + ADR-0015 + ADR-0016 + CONTEXT.md glossary + `SESSION_CANCELLED` audit + Security.md tier update | ✅ | `43e8a8e` |
| P4-2 lib/attendance lifecycle (constants · timetable CRUD + pure `detectOverlap` · `findOrCreateSession` race-safe via P2002 recovery · `cancelSession` audit · `bulkMarkAttendance` upsert with back-edit detection · `getAttendanceGridForTeacher` active∪ever-marked · `getAttendanceStatsForStudent` L1 projection) | ✅ | `02886be` |
| P4-3 `can.mutateSession` + `assert.canMutateSession` returning `{session, sessionRow}` + 5 unit tests (86 → 91) | ✅ | `bc3cbc0` |
| P4-4 teacher UI (Attendance tab + list page + grid page + Server Actions + create-session-form + grid component + cancel-session-dialog + Thai+Buddhist Intl helpers) | ✅ | `f352f24` |
| P4-5 student attendance tab (L1 view · `getStudentSessionAttendance` query · StudentAttendanceStatsView KPI + timeline) | ✅ | `b94490f` |
| P4-6 timetable editor in Settings (TimetableEditor card · `createSlotAction` + `deleteSlotAction` · overlap rejection mapped to field error) | ✅ | `0f670b8` |
| P4-7 integration tests (4 files, 49 cases · 22 → 71 total) + fixtures cleanup updated for AttendanceRecord onDelete:Restrict | ✅ | `ad7de4c` |
| P4-8 smoke checks (+13 against live dev · 57 → 72 total) | ✅ | `547bee6` |
| P4-9 docs (this commit) | ✅ | — |

### Phase 5 — DONE end-to-end (all sub-tasks + Q-grill ADRs + 1 lib bug caught by P5-7)

| Task | Status | SHA(s) |
|------|--------|--------|
| Grill ADR-0017 (weight basis points + publish gate) | ✅ | `5db9852` |
| Grill ADR-0018 (publish one-way + field-class edit rules) | ✅ | `33c562f` |
| CONTEXT.md Phase 5 glossary updates (Score Item · Publish · Grade · Term GPA · Term Status) | ✅ | `ac992ea` |
| Dashboard footer phase pointer hotfix (was stuck on Phase 2) | ✅ | `20f95d7` |
| P5-1 schema (ScoreItem + ScoreEntry + ScoreItemSource enum) | ✅ | `54dfcc7` |
| P5-2a `lib/scoring/*` PURE (constants · format · calc · term-gpa · term-status) + 4 test files (+59 unit cases) | ✅ | `fc5a768` |
| P5-2b `lib/scoring/*` DB-touching (score-item · score-entry · queries) + audit enum past-tense rename | ✅ | `76e944a` |
| P5-3 `can.mutateScoreItem` + `assert.canMutateScoreItem` + 6 unit tests (cross-predicate consistency with mutateSession) | ✅ | `e48942a` |
| P5-4a Teacher Scores tab + Score Item list + create dialog (live Σ pill, % → bp conversion) | ✅ | `425bc74` |
| P5-4b Per-ScoreItem grid + bulk save (dual-layout Pattern 13 · empty-cell skip semantic · post-publish reason gate triggered only on value changes) | ✅ | `c369a77` |
| P5-4c Publish + Delete dialogs + Settings `เกณฑ์เกรด` read-only card | ✅ | `890b8d5` |
| P5-5a Student Scores tab (L1 projection via Pattern 4, published items only, weighted preview) | ✅ | `35ce4ac` |
| P5-5b `/student/terms` + `/student/terms/[termId]` + TermPicker + Print button + dashboard link | ✅ | `61dc5a1` |
| P5-5c Print stylesheet polish + transcript footer (พิมพ์เมื่อ + reference code) | ✅ | `4b3367d` |
| P5-7 integration tests (3 files, 45 cases · 71 → 116 total) + caught + fixed L1 Forbidden guard bug | ✅ | `de9012e` |
| P5-8 smoke checks (+16 against live dev · 72 → 88 total) | ✅ | `710cc78` |
| P5-9 docs (this commit) | ✅ | — |

**P5-6 ScoreItemTemplate** — deferred per Q5 grill lock; reserved for a future phase once teachers report demand for template-copy across CourseOfferings.

### What "shipped" means today

- **Teacher course detail** — 5 tabs (ภาพรวม · สมาชิก · เช็คชื่อ · คะแนน · ตั้งค่า):
  - Overview: ClassCodeCard + member count link
  - Members: active-only list + "นำออก" dialog (reason 5–500, audit `COURSE_MEMBER_REMOVED`)
  - **Attendance**: Session list + "+ เปิดคาบ" dialog + per-Session grid (Pattern 13 dual-layout) + back-edit reason gate (>24h) + cancel-session dialog · `SESSION_CANCELLED` / `ATTENDANCE_BACK_EDIT` audits
  - **Scores (Phase 5)**: Score Item list + Σ น้ำหนัก pill (green @ 10000bp / amber otherwise) · `+ เพิ่มรายการคะแนน` dialog · per-row Publish + Delete dialogs · per-item grid (Pattern 13 dual-layout) with bulk `ทุกคนคะแนนเต็ม` + post-publish reason gate that triggers ONLY on value changes (not note-only) · empty-cell skip semantic at the action layer
  - Settings: regenerate code, activate-toggle, set/clear expiry — each with its own audit event · **TimetableEditor card** · **`เกณฑ์เกรด` read-only card** (Q5 lock: editor deferred, runtime `gradeFor()` already accepts `gradeRulesJson` overrides so future enablement is UI-only)
- **Student course detail** — 4 tabs (ภาพรวม · เพื่อนร่วมห้อง · เช็คชื่อ · คะแนน):
  - L1 visibility enforced at the Prisma SELECT layer — no classCode, no peer studentIds, no enrolledAt on the wire
  - **Attendance L1 view**: KPI "อัตราการมาเรียน %" + 4-status count tiles + per-Session timeline showing own status only
  - **Scores L1 view (Phase 5)**: weighted total preview over published portion · per-course grade (only when fully published) · published items + own values only · Lock card surfacing unpublished item count
  - Dashboard student cards now LINK to `/student/courses/[id]`
- **Student top-level — `ผลการเรียน` (Phase 5)** at `/student/terms` (default = active term) + `/student/terms/[termId]` (history):
  - Term GPA headline · 3-state badge `EMPTY | IN_PROGRESS | COMPLETED` (one-way per ADR-0018) · progress bar (publishedItems / totalItems)
  - Transcript table: วิชา · ครู · หน่วยกิต · % · เกรด · GPA footer row
  - TermPicker dropdown (when student has > 1 historical term)
  - **Print PDF** via `window.print()` — A4 stylesheet hides chrome/forms/btns, prints transcript-style with print-only footer "พิมพ์เมื่อ … · เอกสารอ้างอิง: <studentId/termSuffix>"
- **Auto-restore on rejoin** — removed student using the same class code triggers `restoreByRejoin` inside `enrollByClassCode`, audit `COURSE_MEMBER_RESTORED_BY_REJOIN`. Permanent block = deactivate code in Settings (ADR-0013 § 2 kill switch)
- **Session lifecycle (Phase 4)** — lazy materialization via `findOrCreateSession` (race-safe), soft-cancel via `cancelSession` (audit `SESSION_CANCELLED` Critical tier with reason ≥ 5), sparse `AttendanceRecord` with `editCount` + back-edit reason gate (`ATTENDANCE_BACK_EDIT` Important tier when >24h elapsed AND a row changes/creates)
- **ScoreItem lifecycle (Phase 5)** — strict basis-point weight invariant (ADR-0017 § Decision 1, `WEIGHT_SUM_BP = 10000`, no tolerance, no auto-distribute) · publish is a one-way door (ADR-0018, no `unpublishScoreItem` function exists) · post-publish field edits dispatch by class A (cosmetic, free) / B (`fullScore` / `weight`, `reason ≥ 5` + `SCORE_EDIT_AFTER_PUBLISH` audit + Σ revalidation in tx + fullScore-shrink-vs-entries gate) / C (`source`, immutable — `field_immutable_after_publish`) · post-publish delete requires reason + `SCORE_DELETE_AFTER_PUBLISH` Critical-tier audit + explicit ScoreEntry cascade in tx

### Audit event additions

Phase 3 (CLASS_CODE + COURSE_MEMBER families, past-tense — zero migration since no fire site existed for the old verb form):
- `COURSE_MEMBER_JOINED` (replaces `STUDENT_JOINED_COURSE`)
- `COURSE_MEMBER_REMOVED` (new — was reserved as `STUDENT_REMOVED_FROM_COURSE`, never fired)
- `COURSE_MEMBER_RESTORED_BY_REJOIN` (new)
- `CLASS_CODE_REGENERATED` (renamed from `CLASS_CODE_REGENERATE`)
- `CLASS_CODE_DEACTIVATED` / `CLASS_CODE_REACTIVATED` (new)
- `CLASS_CODE_EXPIRY_SET` (new — covers both set and clear via before/after)

Phase 4 (attendance family):
- `SESSION_CANCELLED` (new · Critical tier · with reason ≥ 5)
- `ATTENDANCE_BACK_EDIT` (existing in enum, first fire site this phase · Important tier · with reason ≥ 5 when scheduledStart > 24h ago AND a row changes/creates)

Phase 5 (scoring family, past-tense per Pattern 10 — enum cleaned to drop pre-publish events that we explicitly do NOT log):
- `SCORE_ITEM_PUBLISHED` (new · Important tier · after-payload includes name/weight/fullScore/publishedAt)
- `SCORE_EDIT_AFTER_PUBLISH` (existing in enum, first fire sites this phase · Important tier · with reason ≥ 5) — fires from class-B field edits in `updateScoreItem` AND from value-changing `bulkUpsertScoreEntries` calls on a published ScoreItem (single audit row per batch)
- `SCORE_DELETE_AFTER_PUBLISH` (existing in enum, first fire site this phase · Critical tier · with reason ≥ 5)
- **Removed from enum**: `SCORE_ITEM_CREATE`, `SCORE_ITEM_DELETE`, `SCORE_ITEM_PUBLISH` (verb-form). Renamed `SCORE_ITEM_PUBLISH → SCORE_ITEM_PUBLISHED`. Zero migration — no fire site existed.

**Verbose tier (NOT logged)** — TimetableSlot CRUD (Q11C), normal in-window attendance writes, **pre-publish ScoreItem CUD** (ADR-0018 § Negative consequences — teachers freely build the gradebook in draft state), normal in-window ScoreEntry writes on draft items.

Security.md § 7 reflects all of these.

### Patterns established this phase (MUST follow in Phase 4+)

These are battle-tested through 4 hotfix cycles. Don't re-derive — use these:

#### 1. Pure `can.*` + DB-touching `assert.*` (lib/auth)
Predicates in `lib/auth/permissions.ts` are **pure sync, no I/O** — testable in `tests/unit/permissions.test.ts` style. DB lookups live in `assert.*` (`lib/auth/guards.ts`). Course-scoped asserts return `{session, course}` / `{session, enrollment}` (divergent from simple asserts which return `Session` alone) — saves callers a duplicate fetch. **Phase 4-5 mutations:** add `assert.canMarkAttendance(sessionId)`, `assert.canEditScoreItem(itemId)` etc. in the same pattern.

#### 2. Authorization INSIDE the `$transaction`
Closes TOCTOU between auth check and mutation. Pattern in `lib/course/enrollment.removeMember` + `lib/course/class-code.*`:
```ts
await db.$transaction(async (tx) => {
  const entity = await tx.entity.findUnique({ where: {id}, select: {teacherId, ...} });
  if (!entity) throw new NotFound();
  if (entity.teacherId !== actorUserId) throw new Forbidden();
  await tx.entity.update({...});
  await audit({...}, tx);  // ← include audit inside tx
}, TX_OPTS);
```

#### 3. **TX_OPTS = `{ maxWait: 10_000, timeout: 15_000 }` on EVERY $transaction**
Prisma's default `maxWait` (2s) is too short for Neon cold-start. Always pass `TX_OPTS` as 2nd arg to `db.$transaction(...)`. Const lives at top of `lib/course/enrollment.ts` and `lib/course/class-code.ts`. **Phase 4+ mutation lib files:** define your own `TX_OPTS` const + apply.

#### 4. DB-layer projection for L1 visibility
`getActiveMembersForStudent` strips `studentId`/`enrolledAt` at the Prisma `select`, not via caller `.map(strip)`. Defense in depth — data physically never leaves DB. **Pattern for Phase 5 (scoring) + 6 (assignments):** any "students see X about peers" query needs a `*ForStudent` projection that returns only L1-safe fields.

#### 5. `_tabs.ts` per role
`app/teacher/courses/[id]/_tabs.ts` + `app/student/courses/[id]/_tabs.ts` each export a `<role>CourseTabs(id)` function. Underscore prefix keeps Next.js from routing it. **Phase 4-7:** extend the existing arrays when adding tabs (Attendance, Scores, Assignments, Feed).

#### 6. Server Actions: NO `.bind()`, use hidden form field for context IDs
Under Next 16 + Auth.js v5 beta, `.bind(null, courseId)` intermittently drops the session cookie. Pattern:
```tsx
// Client
<form action={formAction}>
  <input type="hidden" name="courseId" value={courseId} />
  <input type="hidden" name="otherContextId" value={...} />
</form>

// Server action
export async function myAction(_prev, formData) {
  const session = await requireRole(["TEACHER"]);
  const courseId = String(formData.get("courseId") ?? "");
  if (!courseId) return { error: "missing_course_id" };
  ...
}
```

#### 7. Native `<dialog>` — explicit centering + defer-close
```tsx
<dialog
  className="fixed inset-0 m-auto h-fit w-[calc(100%-2rem)] max-w-md ..."
>
```
Default centering breaks when `w-full` is set. After action success:
```ts
useEffect(() => {
  if (!state.ok) return;
  setTimeout(() => {
    const d = dialogRef.current;
    if (!d) return;
    d.close();
    d.removeAttribute("open");
  }, 0);
}, [state.ok]);
```
The `setTimeout(_, 0)` + `removeAttribute('open')` belt-and-braces is needed because synchronous `close()` in the same commit cycle as Server Action result sometimes doesn't take.

#### 8. `"use server"` files — async function exports ONLY
Next 16 strictly enforces "A 'use server' file can only export async functions". No types alone (use `export type` is fine, only TYPE-only exports), no const objects, no helper functions exported. Helper functions stay internal.

#### 9. React 19 `set-state-in-effect` lint rule
Don't call `setState` inside `useEffect` based on action result. DOM side effects (`dialogRef.current?.close()`) are fine. To reset form state, rely on the row unmounting after revalidation OR use uncontrolled inputs.

#### 10. Audit event naming — past-tense, namespaced family
COURSE_MEMBER_*, CLASS_CODE_*, and (Phase 4) attendance families established. Past-tense (`SESSION_CANCELLED`, `ATTENDANCE_BACK_EDIT`) not verb form. **Phase 5:** create SCORE_* family — `SCORE_ITEM_PUBLISHED` (replaces `SCORE_ITEM_PUBLISH`), `SCORE_EDIT_AFTER_PUBLISH` (with reason ≥ 5), `SCORE_DELETE_AFTER_PUBLISH`.

#### 11. Time zones — store UTC, render via Intl with Buddhist calendar (Phase 4)
All `DateTime` columns are UTC instants (Postgres `TIMESTAMPTZ`, Prisma `Date`). Conversion to/from "Asia/Bangkok wall-clock" is centralised in `lib/attendance/format.ts`:
- `formatThaiDate(d)` / `formatSessionHeader(start, end)` — `Intl.DateTimeFormat("th-TH-u-ca-buddhist", { timeZone: "Asia/Bangkok", … })` → "วันพุธที่ 3 มิ.ย. 2569 · 13:00–14:00 น."
- `bangkokDateTimeToUtc(dateStr, timeStr)` — converts a `YYYY-MM-DD` + `HH:mm` pair entered in a Bangkok-local form back to a UTC `Date`. Bangkok is fixed +07:00 (no DST), so the math is direct: subtract 7h after building the wall-clock as if UTC.
- `dayOfWeekForDateString` / `todayInBangkok` — server-safe, no manual TZ math.

**Phase 5 implication:** Term GPA + Score Item published timestamps follow the same posture. Don't pass `new Date(localString)` into the lib — always go through the format helper.

#### 12. `useState` lazy initializer to dodge React 19 purity lint (Phase 4)
React 19's `react-hooks/purity` rule flags `Date.now()` inside `useMemo`. For values that are stable for the lifetime of the component (e.g. "is this Session past the 24h back-edit threshold?"), capture once at mount:
```tsx
const [isBackEdit] = useState(
  () => Date.now() - new Date(scheduledStartIso).getTime() > THRESHOLD_MS
);
```
The initializer runs once. **Phase 5+** any client-side time-of-render derived flag (e.g. "is this Score Item published in the future?", "is this Submission past deadline?") uses the same pattern.

#### 13. Mobile/desktop dual-layout via CSS toggle (Phase 4)
Teacher attendance grid renders BOTH a vertical card list (`md:hidden`) and a table (`hidden md:block`) from the same component, swapping by Tailwind breakpoint at CSS layer. Avoids SSR hydration mismatch from JS breakpoint detection. Bundle hit is the duplicate markup, which is small for ≤50-row grids. **Phase 5 scoring grid:** apply same posture — desktop-first table, mobile vertical card per student.

#### 14. Sparse semantics + "active ∪ ever-marked" union (Phase 4 · ADR-0016)
The grid query for a Session is NOT "active members at this moment". It's:
```sql
SELECT enrollment FROM enrollment
  WHERE courseOfferingId = $1
    AND (removedAt IS NULL OR EXISTS(SELECT 1 FROM attendanceRecord WHERE ...))
```
Removed-then-marked rows persist with `opacity-60` + read-only badge. **Phase 5+** any "what rows do I show for this `<event>` of a course?" follows the same union when soft-deletion intersects with student-data writes (ScoreEntry, Submission). The bare `removedAt IS NULL` filter is wrong for historical event views.

### Test commands (post-P3-7 script split)

| Command | Scope | DB needed? | Time |
|---------|-------|------------|------|
| `pnpm test` | `tests/unit/**` (156 cases · 12 files) | no | ~5s |
| `pnpm test:integration` | `tests/integration/**` (116 cases · 11 files) | yes — uses DATABASE_URL via `.env.local` | ~290s |
| `pnpm test:all` | both | yes | ~295s |
| `pnpm exec dotenv -e .env.local -- tsx scripts/smoke-test.ts` | E2E HTTP smoke (88 checks · live dev server required) | yes | ~60s |

**Total verifications post-Phase 5:** 156 unit + 116 integration + 88 smoke = **360**.

`pnpm test` (CI script) stays unit-only so the existing GitHub Actions
job needs no env changes. Devs run `pnpm test:integration` locally
before pushing changes that touch lib/course/*. Adding a Postgres
service container (or pointing CI at a dedicated Neon branch) to the
test-unit job is a clean follow-up — not blocking.

### CI status — green ✅

All commits since `c46b7c4` have passed 3/3 jobs (Lint/Typecheck, Unit Tests, Build). Pre-commit hooks (prettier + eslint + husky stash backup) catch issues before they hit CI.

### Commit discipline rule (CLAUDE.md § Commits) — held throughout this phase

- Every diff → review + commit ตามนั้น (ไม่สะสมข้าม feature)
- 1 commit = 1 concern
- Pre-commit: `pnpm typecheck` + `pnpm lint` 0 errors
- Propose breakdown ก่อนเริ่ม commit แรกของ session ถ้า groups > 2
- HEREDOC สำหรับ multi-line message, no Co-Authored-By, no "Generated with Claude" footer

### Known deferrals (Phase 1-2-3 spec ที่ defer ไป)

ไม่มีอะไร blocking — list นี้ documented เพื่อ honesty:

| Item | Original phase | Status | Why deferred |
|------|----------------|--------|--------------|
| Playwright E2E tests | Phase 1, 2 (planned) | Defer → Phase 9 § 9b | smoke-test.ts (57 checks) + integration (22 cases) ครอบคลุม 90%; E2E expensive to maintain pre-launch |
| gitleaks pre-commit hook | Phase 0 (planned) | Defer → Phase 9 § 9b | Solo dev, low credential leak risk; Phase 9 hardening sweep |
| Testcontainers | Phase 0 (planned) | **Dropped** | Superseded by Neon-based integration tests (working great) |
| Upstash Redis rate limit | Phase 1 (planned) | Defer → Phase 9 | `RateLimitBucket` (in-DB) works fine; Phase 9 migrate |
| Cloudflare R2 | Phase 0 + 6 (planned) | As-planned → **Phase 6** | Required first time in Assignment file upload |
| Sentry / Vercel deploy | Phase 0 (planned) | As-planned → Phase 9 | Pre-launch only |
| GitHub branch protection on `main` | Phase 0 | **User-side TODO** | Can't config from code — verify in GitHub Settings before Phase 4 push if you haven't |

### Phase 6 — DONE end-to-end (all sub-tasks + 3 grilled ADRs + atomic ScoreItem coupling)

| Task | Status | SHA(s) |
|------|--------|--------|
| Grill ADR-0019 (Assignment ↔ ScoreItem atomic + no default weight) | ✅ | `3bb3b84` |
| Grill ADR-0020 (Submission lifecycle workflow signals vs score-of-record) | ✅ | `2fe6e35` |
| Grill ADR-0021 (file upload pipeline · signed URL strategy hybrid) | ✅ | `49eb1e8` |
| CONTEXT.md Phase 6 glossary updates (§ Admin · § Comment Moderation · § Assignment · § Submission Status · § FileAttachment · § Signed URL) | ✅ | `e5ca04d` |
| P6-1 schema (Assignment + Submission + SubmissionVersion + FileAttachment + Comment models + 4 enums) | ✅ | `e427a08` |
| P6-2a `lib/assignment/*` PURE (constants · status · validation) + 62 unit tests | ✅ | `143fe23` |
| P6-2b `lib/assignment/assignment.ts` (atomic ScoreItem coupling + toggle 3-state dispatch) + audit enum rename + FK SetNull | ✅ | `ca523b8` |
| P6-2c `lib/assignment/submission.ts` (submitVersion + returnSubmission + gradeSubmission) | ✅ | `fb8f493` |
| P6-2d `lib/assignment/comment.ts` (createComment + editComment + selfDeleteComment + moderateDeleteComment Q5 matrix) | ✅ | `61c3d40` |
| P6-3a `lib/storage/*` PURE (keys + jwt) + 55 unit tests | ✅ | `41f90aa` |
| P6-3b R2 client + sign (presigned PUT/GET 300 s) + verify (file-type magic-byte) | ✅ | `0cd3485` |
| P6-3c image pipeline (sharp re-encode + EXIF strip + HEIC/HEIF transcode) | ✅ | `300634f` |
| P6-3d presign + commit orchestration (3-step staging → permanent flow) | ✅ | `fe200c9` |
| P6-4 `can.* + assert.*` (mutateAssignment + submitTo + viewSubmission + moderateComment + uploadToAssignment) + 26 unit tests | ✅ | `4fced10` |
| P6-5a teacher UI: list + create dialog + action | ✅ | `9e9ecf7` |
| P6-5b teacher UI: detail + grade dialog + return dialog + Pattern 14 active∪ever-submitted grid | ✅ | `c85f30d` |
| P6-6 student UI: list + detail + submit form + version history + RETURNED banner | ✅ | `88cf510` |
| P6-7 integration tests (+19 cases · assignment-coupling + submission-flow + L1 boundary) | ✅ | `49c1ef8` |
| P6-8 smoke checks (+10 against live dev · teacher tab + student tab + L1 boundary + auth boundary) | ✅ | `2530479` |
| P6-9 docs (this commit) | ✅ | — |

### What "shipped" means today (post-Phase-6)

- **Teacher course detail — 6 tabs** (ภาพรวม · สมาชิก · เช็คชื่อ · คะแนน · **การบ้าน** · ตั้งค่า):
  - **Assignments (Phase 6)**: list ordered DESC by createdAt · per-row scored-badge + published-ScoreItem badge + submission-closed badge + overdue tinted rose · "+ เพิ่มการบ้าน" Pattern-7 dialog with conditional weight (%) + fullScore inputs when `isScored=true` (per ADR-0019 § 2 no default). Detail page = Pattern-14 active ∪ ever-submitted union (removed students show opacity-60 + badge) + per-row grade dialog (with ADR-0018 reason-after-publish gate that mounts only when needed) + return dialog (comment body = audit reason per ADR-0020 § 4)
- **Student course detail — 5 tabs** (ภาพรวม · เพื่อนร่วมห้อง · เช็คชื่อ · คะแนน · **การบ้าน**):
  - **Assignments (Phase 6)** L1-projected: list joins OWN Submission row only (NOT_SUBMITTED sentinel when no row) · detail surfaces RETURNED banner when teacher returned + own ScoreEntry when linked ScoreItem published + PRIVATE comments thread + own version history (DESC by versionNumber, current version highlighted) + submit form for text + links (file upload deferred per P6-3d note)
- **R2 file pipeline ready**: presign + commit + magic-byte + EXIF-strip + sharp transcode are fully implemented and unit-tested (55 cases). Teacher upload to Assignment brief works through `assert.canUploadTo("ASSIGNMENT", id)`. Student upload to SubmissionVersion follows a small schema patch (SubmissionVersion.fileAttachmentIds + FileOwnerType.SUBMISSION) when the UI surfaces it — documented as a Phase 7 prerequisite in P6-3d commit message.

### Audit event additions (Phase 6 family · past-tense per Pattern 10)

- `SUBMISSION_RETURNED` (new · Important tier · reason = private comment body ≥ 5 chars per ADR-0020 § 4)
- `ASSIGNMENT_UPDATED` (new · Important only when `isScored: true → false` toggle with reason ≥ 5; verbose tier for normal field edits, not logged)
- `COMMENT_MODERATED` (new · Important when Teacher · **Critical when Admin × PRIVATE** per CONTEXT § Comment Moderation Q5 escalation)
- `FILE_UPLOADED` (new · Important · payload omits URL string per CLAUDE.md hard rule — only ids + mime + size)
- `FILE_REJECTED` (new · Important · categories: `magic_byte_mismatch` / `mime_not_whitelisted` / `size_exceeds` / `permission_denied`)
- `FILE_DELETED` (new · Important · owner removal or moderator delete)
- `FILE_INFECTED_BLOCKED` (Critical · enum reserved, no fire site in Phase 6 — AV deferred to Phase 9 hardening sweep)
- **Removed from enum** (replaced renamed or dropped — zero migration, no prior fire sites): `ASSIGNMENT_CREATE` / `ASSIGNMENT_EDIT` / `ASSIGNMENT_DELETE` / `ASSIGNMENT_GRADE` / `ASSIGNMENT_RETURN` / `FILE_UPLOAD`. The verbose-tier per-action events (CREATE / DELETE / GRADED pre-publish / VERSION_CREATED / COMMENT_EDITED / COMMENT_SELF_DELETED) are not in the enum because they are intentionally not logged — same posture Phase 5 used for pre-publish ScoreItem CUD.

### Test commands (post-P6-7 update)

| Command | Scope | DB needed? | Time |
|---------|-------|------------|------|
| `pnpm test` | `tests/unit/**` (299 cases · 16 files) | no | ~6 s |
| `pnpm test:integration` | `tests/integration/**` (135 cases · 13 files) | yes — uses DATABASE_URL via `.env.local` | ~330 s |
| `pnpm test:all` | both | yes | ~336 s |
| `pnpm exec dotenv -e .env.local -- tsx scripts/smoke-test.ts` | E2E HTTP smoke (~98 checks · live dev server required) | yes | ~70 s |

**Total verifications post-Phase 6:** 299 unit + 135 integration + ~98 smoke = **~532**.

### Phase 9 (P9-1..4) — CLOSED (2026-06-05 · `1a96338` → `b6da021`)

Phase 9 split into two halves by user choice (Q1 = (3) "A + E"):
**A — E2E tests + E — Polish carryover** land now; **B/C/D — security
hardening · performance · deploy infra** defer to a follow-on phase
so the feature surface stays nice and small.

**P9-1 — Notification payload enrichment (`1a96338`)**

`SubmissionGradedPayload` + `SubmissionReturnedPayload` gain
`assignmentId`. `CommentRepliedPayload` gains `entityOwnerId` (for
SUBMISSION = parent Assignment id; for the others = ownerId verbatim).
`lib/notification/navigation` consumes the new ids to deep-link
SUBMISSION_GRADED / RETURNED to assignment detail and
COMMENT_REPLIED to the commented entity. Also lights up
MATERIAL_POSTED / ANNOUNCEMENT_POSTED → student detail routes that
P7-8 shipped (was a course-root fallback). +6 unit tests
(395 → 401).

**P9-2 — PRIVATE composer on Submission (`5bfc6ec`)**

`<CommentsThread>` grows a `revalidatePath?` override so SUBMISSION
threads can point the post-action revalidate at the page they
actually sit on (the assignment id can't be reconstructed from
ownerType + ownerId alone). Student Submission detail drops the
Phase-6 read-only PRIVATE comment card and mounts the real thread
+ composer. A new teacher per-submission page at
`/teacher/courses/[id]/assignments/[aid]/submissions/[sid]` hosts
the same thread, plus a read-only version-history card. The
assignment grid gains a "ดูข้อความ →" link per row to reach it.

**P9-3 — Playwright E2E (`b6da021`)**

Suite at `tests/e2e/` with 2 critical-flow specs:
- **01 announcement → feed → reply** — teacher posts an
  Announcement; student sees it in the dashboard User Feed; clicks
  through to the detail page (P7-8 student detail); posts a
  CLASS_WIDE reply that lands in the thread.
- **02 material → bell → deep-link** — teacher posts a Material;
  student's bell popover surfaces the row; clicking deep-links to
  the student Material detail (the P9-1 navigation upgrade).

Helpers anchor on Thai text ("ออกจากระบบ") because the bell popover
also renders a submit button inside the navbar form. Config keeps
the suite serial (shared Neon dev DB) and reuses the dev server
the developer is already running.

`pnpm test:e2e` is the entry point (uses `dotenv -e .env.local`).

Drive-by: `lib/feed/navigation.ts` flipped MATERIAL / ANNOUNCEMENT
from course-root fallback → entity detail URL (same gap P9-1 fixed
in `lib/notification/navigation.ts`). 2 existing unit cases flipped
expectations; no net unit-count change.

**Phase 9 (P9-1..4) sub-task SHAs:**

| Sub-task | SHA |
|---|---|
| P9-1 enrich notification payloads + nav deep-links + 6 unit tests | `1a96338` |
| P9-2 PRIVATE composer on Submission + teacher per-submission page | `5bfc6ec` |
| P9-3 Playwright config + 2 critical-flow specs + lib/feed nav follow-up | `b6da021` |
| P9-4 close-out — HANDOFF + phase table | this commit |

**Verifications post-Phase 9 (P9-1..4):** 401 unit + 171 integration +
~133 smoke + 2 E2E = ~707 total checks.

**Deferred to a future hardening phase (was Phase 9 B/C/D + remaining
polish):**

- **B — Security hardening:** gitleaks pre-commit hook · Sentry
  error tracking · OWASP-style sanity sweep · file-upload AV (the
  `FILE_INFECTED_BLOCKED` audit event is reserved but no scanner is
  wired)
- **C — Performance hardening:** Lighthouse / axe-core audit · bundle
  size budget · Upstash Redis rate-limit migration (currently in-DB
  `RateLimitBucket`) · cross-browser Playwright projects (Firefox +
  WebKit)
- **D — Deploy infra:** Vercel project config · env var wiring · R2
  bucket / IAM · branch protection on main · observability hooks
- **E (residual):** Admin dashboard tier-count widgets (carried
  from Phase 8) · enrich Notification with `(tier, timestamp DESC)`
  schema index once row count crosses ~1M

---

### Phase 8 — CLOSED (2026-06-05 · `ff492b1` + `4a1a82f`)

Phase 8 ships the **admin-facing read surface for the audit log**
accumulated since Phase 1. 3-question mini-grill locked design
before code:

- Q1 = A: pure-helper `lib/audit/tier.ts` for tier dispatch — no
  schema migration, no DB column. `tierFor(action)` for the per-
  action default; `tierForRow({action, actorRole, beforeScope})`
  applies the CONTEXT § Comment Moderation Q5 escalation (Admin ×
  PRIVATE × COMMENT_MODERATED → CRITICAL).
- Q2 = A: shareable URL drill-down at `/admin/audit/[id]` — browser
  back works, bookmarkable for forensic. Per-event detail page
  shows tier badge + timestamp + actor + target + IP/UA + reason
  + side-by-side before/after JSON.
- Q3 = C: core (tier + filter + drill-down) + CSV export ship in
  Phase 8; dashboard summary widgets dropped to Phase 9 polish.

**Viewer upgrade (`app/admin/audit/page.tsx`):** Tier column with
Critical/Important/Verbose badge, 3 new filters (Tier dropdown ·
Actor identifier substring · Target type/id substring), Bangkok-
local datetime-range filter (from / to) converted to UTC at the
edge, "ดู →" link per row, "ดาวน์โหลด CSV" button forwarding the
filter querystring.

**Drill-down (`app/admin/audit/[id]/page.tsx`):** Read-only forensic
surface. No delete affordance (Security.md § 7 — Admin
ไม่สามารถลบ audit log ผ่าน UI).

**CSV export (`app/admin/audit/export/route.ts`):** GET handler
returns RFC-4180-compliant CSV (UTF-8 + CRLF + double-quote-escape),
capped at 50 000 rows, with `Content-Disposition: attachment` +
`X-Audit-Row-Count` / `X-Audit-Truncated` headers. Each export
writes one `ADMIN_AUDIT_EXPORTED` Important audit row capturing the
filter snapshot — audit of the audit reader.

**Verifications post-Phase 8:** 395 unit (+11) + 171 integration +
~133 smoke (+11) = ~699 total.

**Phase 8 sub-task SHAs:**

| Sub-task | SHAs |
|---|---|
| P8-1 lib/audit/tier.ts pure helper + 11 unit tests + ADMIN_AUDIT_EXPORTED event | `ff492b1` |
| P8-2 viewer upgrade + drill-down detail + CSV export route + 11 smoke checks | `4a1a82f` |
| P8-3 close-out + HANDOFF | this commit |

**Deferred to Phase 9:**
- Dashboard summary widgets — count cards "Critical last 7 days",
  "Important last 7 days" on `/admin/dashboard`
- Optional `tier` column in the AuditLog schema (Phase 9 hardening
  sweep — index on `(tier, timestamp DESC)` would speed the viewer
  WHERE clause once row count crosses ~1M)

---

### Phase 7 — CLOSED (2026-06-05 · final `757f4ad` + P7-10 close-out)

| Sub-task | Status | SHA |
|---|---|---|
| Grill Q1–Q13 + ADR-0022 + ADR-0023 + CONTEXT.md updates | ✅ | `43df25f` · `fa11175` · `7eb65e7` |
| P7-0a schema — SubmissionVersion.fileAttachmentIds + FileOwnerType rename | ✅ | `00de7ae` |
| P7-0b storage routes — /api/storage/{presign,commit} + SUBMISSION dispatch | ✅ | `f419f38` |
| P7-0c student submit-version-form file upload UI | ✅ | `099a116` |
| P7-0d integration + smoke + auth-first reorder | ✅ | `4fc81b4` |
| P7-1 schema — Notification + Material + Announcement + partial unique | ✅ | `9b4912c` |
| P7-2 lib/notification + wire fan-out into 7 existing mutation sites | ✅ | `acfccbd` |
| P7-3 lib/material + lib/announcement + CommentOwnerType plug-in | ✅ | `73a7684` |
| P7-4 notification read routes + lib/feed/aggregator + scope query | ✅ | `b64a786` |
| P7-5 Bell UI navbar + dropdown (lib helpers · bell components · shared TopNav · migrate 6 surfaces) | ✅ | `a2615ed` · `9d82121` · `996532c` |
| P7-6 Dashboard User Feed + Due Soon Widget (student-only) | ✅ | `4ab67af` · `ca23943` |
| P7-7 Teacher Material + Announcement UI (tabs · CRUD · Pattern-7 dialogs) | ✅ | `0eb99a5` |
| P7-8 Student M+A views + shared CommentsThread on 6 detail pages | ✅ | `af91dde` · `e2eb851` |
| P7-9 Integration tests — fan-out + suppress + comment moderation | ✅ | `ffd7b89` |
| P7-10 Close-out — dashboard footer · final smoke sweep · HANDOFF roll-up | ✅ | `07ad363` |

**Verifications post-P7-9:** 384 unit + 171 integration (+23) + ~124 smoke = ~679 checks

**Lib layer essentially done.** All 9 NotificationKinds have wired event sources end-to-end:

| Kind | Source mutation | Fan-out helper |
|---|---|---|
| `SCORE_ITEM_PUBLISHED` | `publishScoreItem` | broadcast |
| `SCORE_ENTRY_EDITED` | `bulkUpsertScoreEntries` (post-publish, value change) | targetedMany |
| `ASSIGNMENT_POSTED` | `createAssignment` | broadcast |
| `MATERIAL_POSTED` | `createMaterial` | broadcast |
| `ANNOUNCEMENT_POSTED` | `createAnnouncement` | broadcast |
| `SUBMISSION_GRADED` | `gradeSubmission` (markGraded=true) | targeted |
| `SUBMISSION_RETURNED` | `returnSubmission` (merges with private comment) | targeted |
| `COMMENT_REPLIED` | `createComment` (PRIVATE → targeted, CLASS_WIDE → thread) | targeted/thread |
| `CLASS_CODE_JOINED` | `enrollByClassCode` | targeted |

Suppress hooks:
- `removeMember` → suppressNotificationsForRemovedMember (in-tx)
- `restoreByRejoin` → unsuppressNotificationsOnRestore (in-tx)
- `deleteScoreItem` / `softDeleteMaterial` / `softDeleteAnnouncement` → suppressNotificationsForDeletedEntity (in-tx)

Read surface:
- `lib/notification.listNotificationsForRecipient(cursor)` — bell dropdown query
- `lib/notification.countUnreadNotifications` — badge count
- `lib/notification.markNotificationRead` — click row
- `lib/notification.markAllNotificationsRead` — "ทำเครื่องหมายว่าอ่านทั้งหมด"
- `lib/feed.getUserFeed(session, cursor?)` — dashboard User Feed
- `lib/feed.getCourseScopeForUser(session)` — single L1 boundary, reused by widget

API routes (auth-first posture):
- `POST /api/notification/[id]/read`
- `POST /api/notification/read-all`
- `POST /api/storage/presign` (P7-0b)
- `POST /api/storage/commit` (P7-0b)

**P7-5 — what shipped (2026-06-04 · `996532c`)**

Bell + shared TopNav are live across every role-facing surface. 15-question
grill locked the design tree before code (Q1 surface = shared TopNav · Q2
admin = no bell · Q3 = server-render eager · Q4 = HTML popover (not Pattern
7 dialog) · Q5 = server-resolved href, fallback to course root for
MATERIAL/ANNOUNCEMENT/SUBMISSION_*/COMMENT_REPLIED · Q6 = Server Action +
redirect · Q7 = time DESC + opacity-60 read + black dot unread · Q8 =
hybrid 7d relative/absolute · Q9 = per-kind lucide icons + Thai preview ·
Q10 = illustrated empty + top-right mark-all conditional · Q11 = cap 20
no load-more · Q12 = replace headers · Q13 = file structure middle-ground
· Q14 = no audit · Q15 = stack TopNav above CourseShell's course bar).

**New files (`a2615ed`):** `lib/notification/{navigation,preview,time-format}.ts`
pure helpers; their 42 unit tests (330 → 372).

**New files (`9d82121`):** `components/notification/{bell,bell-icon,relative-time,actions}.tsx`.
Bell is a Server Component fetching count + 20-row list via P7-4 read
surface, builds per-row href + preview server-side, renders an HTML
`popover` panel (browser-native open/close — no JS state). Per-row form
posts to `markReadAndNavigate` server action that marks read + redirects.

**New files / migrations (`996532c`):** `components/layout/top-nav.tsx`
shared Server Component (logo + bell + sign-out, `showBell` prop for
admin = false, `showRoleBadge` prop for admin layout). Replaces inline
headers on `app/admin/layout.tsx`, `app/dashboard/page.tsx`,
`app/teacher/courses/page.tsx`, `app/teacher/courses/new/page.tsx`,
`components/scoring/student-terms-shell.tsx`, and stacks above
CourseShell's existing course-context bar (Q15). 13 CourseShell call
sites updated to pass `session` (uses `guard.session` where applicable).

**Drive-by:** P7-4 had a typecheck-only drift in
`tests/integration/permissions/feed-aggregator.test.ts` `mkSession`
helper (missing `mustResetPwd`); fixed forward in commit `a2615ed`.

**Known follow-ups for P7-6+:**
- Enrich `SubmissionGradedPayload` / `SubmissionReturnedPayload` /
  `CommentRepliedPayload` with `assignmentId` / `entityOwnerId` at fan-out
  time so the bell can deep-link to the assignment detail page (today
  these fall back to the course's assignments list).
- After P7-7 / P7-8 land Material + Announcement UI, the navigation
  resolver's `MATERIAL_POSTED` / `ANNOUNCEMENT_POSTED` cases can switch
  from course-root fallback to the entity detail URL.
- Phase 5/6 teacher login + Phase 7 storage student login in
  `scripts/smoke-test.ts` still cascade-fail on rate-limit lockout from
  earlier sections. The new bell section preempts this with a
  `db.rateLimitBucket.deleteMany({where:{id:{startsWith:"login:"}}})`
  at its top; the same pattern would unbreak the other sections.

**P7-6 — what shipped (2026-06-05 · `ca23943`)**

Student dashboard now surfaces two state-derived sections above the
existing "ห้องเรียนของฉัน" grid (3-question mini-grill before code:
Q1 = A cap 20 no load-more · Q2 = A vertical stack Due Soon top · Q3 =
B student-only feed).

- **Due Soon Widget** — amber-tinted card listing Assignments due
  within 24 h whose own Submission status is NOT_SUBMITTED or DRAFT,
  sorted dueAt ASC, max 5. Hides itself when empty (an empty "ใกล้ส่ง"
  card next to a populated feed is more confusing than no card).
- **User Feed** — illustrated empty state or up to 20 rows merged
  across Assignment / Material / Announcement / ScoreItem(published)
  via the P7-4 aggregator. Reuses the bell's `NotificationIcon` +
  `RelativeTime` so both surfaces share one icon map + one Pattern-12
  time helper. Per-row href + preview resolved server-side via
  `lib/feed/{navigation,preview}`.

Teacher dashboard intentionally has neither (creator role; bell
already covers CLASS_CODE_JOINED + COMMENT_REPLIED). Admin dashboard
unchanged (no NotificationKind targets ADMIN).

**New files (`4ab67af`):** `lib/feed/{navigation,preview}.ts` pure
helpers + `lib/assignment/due-soon.ts` DB query. 12 new unit tests
(372 → 384). Due-Soon DB query covered by smoke + P7-9 integration.

**New files / changes (`ca23943`):**
`components/feed/{due-soon-widget,user-feed}.tsx` Server Components
+ `app/dashboard/page.tsx` integration + 5 smoke checks.

**Known follow-ups for P7-7+:**
- `nextCursor` from `getUserFeed` is unused — future `/feed` full-page
  route can pick it up if 20 isn't enough.
- After P7-7 / P7-8 land Material + Announcement UI, the feed's
  navigation resolver's `MATERIAL` / `ANNOUNCEMENT` cases switch from
  course-root fallback to entity detail URL.
- The "อยู่ระหว่างพัฒนา" footer card on dashboard still says "Phase
  ปัจจุบัน: 5" — cosmetic; will update wholesale at P7-10 close-out.

**P7-7 — what shipped (2026-06-05 · `0eb99a5`)**

Teacher course detail gains 2 new tabs ("เอกสาร" + "ประกาศ") between
"การบ้าน" and "ตั้งค่า" — 8 tabs total. 3-question mini-grill locked
design before code:
- Q1 = A: separate tabs per content-type (canonical per CONTEXT)
- Q2 = A: list page + click-through to detail (matches Assignment shape)
- Q3 = B: comments thread DEFERRED to P7-8 so it ships alongside the
  student view + integration test in one cohesive landing

**Material UI** (`/teacher/courses/[id]/materials/...`)
- List page · Pattern-7 create dialog (title + body + linkUrls)
- Detail page · edit/delete affordances · markdown-ish body render
- `MATERIAL_DELETED` Important audit on soft-delete (lib cascade-
  suppresses `MATERIAL_POSTED` notifications)
- title REQUIRED, body OPTIONAL

**Announcement UI** (`/teacher/courses/[id]/announcements/...`)
- Mirrors Material shape with title flip: title OPTIONAL, body
  REQUIRED. List page falls back to body excerpt as headline when
  title is null; detail page renders "ประกาศไม่มีหัวข้อ" placeholder.
- `ANNOUNCEMENT_DELETED` Important audit on soft-delete

**Smoke (+7 checks):** materials list 200 + heading + create btn ·
announcements list 200 + create btn · 8-tab nav contains เอกสาร +
ประกาศ · L1 boundary (student → /teacher/.../materials → 302/307).

**Known follow-ups for P7-8:**
- Class-wide comments thread on Material/Announcement detail pages
  (teacher composer + student view + L1 thread fan-out via
  `COMMENT_REPLIED`)
- Student view of Material/Announcement at `/student/courses/[id]/
  materials` + `/student/courses/[id]/announcements` (after which the
  bell + feed `MATERIAL_POSTED` / `ANNOUNCEMENT_POSTED` navigation can
  switch from course-root fallback to entity detail URL)
- "อยู่ระหว่างพัฒนา" footer card on dashboard still says "Phase
  ปัจจุบัน: 5" — cosmetic; wholesale update at P7-10 close-out

**P7-8 — what shipped (2026-06-05 · `e2eb851`)**

Student side of Material + Announcement now exists, and the shared
`<CommentsThread />` component lands on all six teacher/student ×
Assignment/Material/Announcement detail pages. 3-question mini-grill
locked design before code:
- Q1 = A: single reusable Server Component driven by `ownerType` prop
- Q2 = A: CLASS_WIDE thread on all 3 content types (Assignment included,
  not just M+A — single cohesive landing)
- Q3 = A: full edit/delete affordances (author 5-min edit · author
  self-delete · moderator delete with reason)

**Student tabs.** `_tabs.ts` gains เอกสาร + ประกาศ in the same position
the teacher uses; tab nav stays consistent across roles.

**Student Material + Announcement** (`/student/courses/[id]/...`)
- Read-only mirrors of teacher pages; L1 via
  `assert.isActiveCourseMember`. Soft-deleted entities 404.
- Detail pages each host `<CommentsThread />` (the same thread teacher
  sees on the corresponding teacher detail).

**Shared `<CommentsThread />` component family** (af91dde):
- `components/comment/comments-thread.tsx` Server Component fetches the
  thread inline + resolves moderator-ness; renders per-row affordances
  (author edit pencil · author self-delete · moderator delete dialog)
- Client islands: `composer.tsx` (with autoreset on success),
  `edit-comment-dialog.tsx` (Pattern 7), `delete-comment-button.tsx`
  inline, `moderate-delete-dialog.tsx` (reason ≥ 5)
- Server Actions cover all 4 lib paths (create / edit / selfDelete /
  moderateDelete); each accepts a `revalidate` hidden field
  reconstructed by the thread component from
  `(rolePrefix, courseId, ownerType, ownerId)`
- Soft-deleted comments render an italic "ข้อความนี้ถูกลบ" placeholder
  so chronology stays intact

**Six detail pages now host the thread:**
- Teacher Material + Announcement (P7-7 placeholder replaced)
- Teacher + Student Assignment detail (CLASS_WIDE thread appended
  below the existing submission grid / version history)
- Student Material + Announcement detail (newly created in P7-8)

**Smoke (+9 checks):** student materials list 200 + heading + tab ·
student announcements list 200 + tab · material detail thread heading
+ composer fields present · teacher material detail thread replaces
the P7-7 placeholder (conditional on existing demo Material).

**Known follow-ups for P7-9:**
- PRIVATE composer on Submission detail (teacher reply + student
  reply on returned submissions) — Phase 6 ships read-only PRIVATE
  comments; the full composer ships with P7-9 integration sweep
- Notification fan-out broader integration tests (multi-recipient
  COMMENT_REPLIED, dedup, suppress-on-delete cascades)
- "อยู่ระหว่างพัฒนา" footer card on dashboard still says "Phase
  ปัจจุบัน: 5" — wholesale update at P7-10 close-out

**Phase 7 — final roll-up (2026-06-05)**

Phase 7 closes with the Bell + dashboard Feed + Due Soon Widget +
teacher and student Material/Announcement UIs + shared CommentsThread
on all 6 detail pages + 23 new integration tests covering the fan-out
+ suppress + moderation seams. **Two ADRs landed during the phase:**

- **ADR-0022** — Notification storage model + in-tx fan-out +
  partial-unique dedup + suppress on entity-soft-delete + snapshot
  payload posture.
- **ADR-0023** — User Feed = multi-query union at the application
  layer + course-scope resolver as the single L1 boundary + Course
  Feed surface deferred to Phase 8.

**Every P7 SHA in chronological order:**

| Sub-task | SHAs |
|---|---|
| Grill + ADRs + CONTEXT updates | `43df25f` · `fa11175` · `7eb65e7` |
| P7-0a..d Phase-6 carry-over (file upload UI) | `00de7ae` · `f419f38` · `099a116` · `4fc81b4` |
| P7-1 schema (Notification + Material + Announcement) | `9b4912c` |
| P7-2 lib/notification + 7 mutation-site fan-out wirings | `acfccbd` |
| P7-3 lib/material + lib/announcement | `73a7684` |
| P7-4 notification read routes + lib/feed | `b64a786` |
| P7-5 Bell UI navbar + shared TopNav + migrate 6 surfaces | `a2615ed` · `9d82121` · `996532c` · `6018b4f` |
| P7-6 Dashboard User Feed + Due Soon Widget | `4ab67af` · `ca23943` · `70ae78a` |
| P7-7 Teacher Material + Announcement UI | `0eb99a5` · `7809c05` |
| P7-8 Student M+A views + shared CommentsThread on 6 detail pages | `af91dde` · `e2eb851` · `2000222` |
| P7-9 Integration tests — fan-out + suppress + comment moderation | `ffd7b89` · `757f4ad` |
| P7-10 Close-out — footer + sweep + HANDOFF | this commit |

**Verifications post-Phase 7:** 384 unit + 171 integration (+23) +
~124 smoke (+30 since post-P7-4 baseline) = ~679 total.

**Pre-existing smoke flakes** (NOT regressions — same on `main` before
P7-5): Phase 5/6 teacher login + Phase 7 storage student login hit
the rate-limit cascade from `testRateLimitLockout`. The bell + feed +
material/announcement sections defensively `db.rateLimitBucket.
deleteMany({where:{id:{startsWith:"login:"}}})` at section start to
sidestep; the same prefix-clear would unbreak the other sections in
a future cleanup commit.

**Deferred items carried into Phase 8 / 9:**
- PRIVATE composer on Submission detail (teacher reply + student
  reply on returned submissions). Phase 6 still has read-only PRIVATE
  comment display; the composer ships alongside Phase 8 admin audit
  tools or as a Phase 9 polish item.
- Enrich `SubmissionGradedPayload` / `SubmissionReturnedPayload` /
  `CommentRepliedPayload` with `assignmentId` / `entityOwnerId` so
  the bell + feed can deep-link to assignment detail instead of the
  list fallback.
- After Material/Announcement get their student-side detail routes
  in P7-8 (already done), the feed + notification navigation
  resolvers can switch from course-root fallback to entity detail
  URL — small follow-up.

---

**P7-9 — what shipped (2026-06-05 · `ffd7b89`)**

Three new integration test files lock the Phase-7 lib seams against a
real Neon DB; integration tests 148 → 171 (+23).

- **`notification-comment-fan-out.test.ts`** (+15 cases) — CLASS_WIDE
  thread rule (prior commenters ∪ entity author − self) on ASSIGNMENT
  + MATERIAL · PRIVATE on SUBMISSION = "other party" only · scope ↔
  ownerType invariant rejects PRIVATE×ASSIGNMENT and CLASS_WIDE×
  SUBMISSION · 5-min self-edit window (backdate `createdAt` 6 min
  → Conflict) · non-author edit rejected · self-delete works past
  the window and is Verbose · teacher moderate-delete writes
  COMMENT_MODERATED Important with `actorRole=TEACHER` + reason ·
  foreign teacher rejected · reason < 5 chars rejected · ANNOUNCEMENT
  thread smoke-check (drain broadcast row first, then assert
  COMMENT_REPLIED targets the author).

- **`notification-material-announcement.test.ts`** (+5 cases) —
  MATERIAL_POSTED / ANNOUNCEMENT_POSTED broadcasts cover active
  enrollments only (removed students excluded · author excluded ·
  partial unique index honored — re-inserting same `(recipient,kind,
  source)` is a no-op) · softDeleteMaterial / softDeleteAnnouncement
  cascade-suppress the matching notification rows (rows preserved,
  `suppressedAt` set) + write *_DELETED Important audit with reason.

- **`notification-enrollment-suppress.test.ts`** (+3 cases) — `removeMember`
  marks every Notification of (removed student × this course) as
  suppressed in the same tx · other students' rows in the same
  course untouched · re-joining via the same class code calls
  `restoreByRejoin` → un-suppresses (`suppressedAt = null`) those
  rows so bell history comes back alive.

**Drive-by:** `_fixtures.ts` cleanup already drained Notification by
`courseOfferingId` (added in P7-2), so no fixture change needed.

**Known follow-ups for P7-10 close-out:**
- "อยู่ระหว่างพัฒนา" footer card on dashboard still says "Phase
  ปัจจุบัน: 5" — cosmetic; update at P7-10.
- PRIVATE composer on Submission detail (teacher reply + student
  reply on returned submissions) — deferred from P7-8, may land
  in Phase 8 or as a P7-10 stretch.
- Enrich SubmissionGraded/Returned/CommentReplied snapshot payloads
  with `assignmentId` / `entityOwnerId` so bell + feed can deep-link
  instead of falling back to course root.

**Next session resume point — Phase 8:** Admin Audit Tools. The
audit log already accumulates Important + Critical events across all
phases (see `lib/audit/log.ts` + Security.md § 7). Phase 8 adds the
admin-facing read surface (filterable audit viewer · per-event drill-
down · CSV export · moderator dashboards). No new lib mutations
expected; mostly UI + read queries + permission checks.

CONTEXT § Admin already locks the moderation matrix and the
"Admin × PRIVATE comment = Critical-tier audit" escalation; Phase 8
will surface those tiers cleanly in the audit viewer.

Phase 6 carryover (now historical):



Schema to add:
- `Notification` (recipientId, kind enum, payloadJson, readAt?, createdAt)
- `Material` + `Announcement` (Phase 7a — teacher-posted content; reserved slots in FileOwnerType + CommentOwnerType enums are ready)

Phase 7 prerequisites carried over from Phase 6 (documented in P6-3d commit message and Task.md § Deferred):
- Add `SubmissionVersion.fileAttachmentIds Json @default("[]")` column
- Add `FileOwnerType.SUBMISSION` enum value (so files can attach to a Submission parent scope rather than a specific Version that doesn't yet exist at upload time)
- Remove the `files_not_yet_supported` guard from `lib/assignment.submitVersion`
- Wire `lib/storage.presignUpload` + `lib/storage.commitUpload` into a new `/api/storage/presign` + `/api/storage/commit` route pair
- Update student `submit-version-form.tsx` to accept files via a presign + PUT + commit handshake before submitVersion

Phase 7 recommended sub-task breakdown:
- P7-1 schema (Notification + Material + Announcement) + the Phase-6-deferred SubmissionVersion.fileAttachmentIds column + FileOwnerType.SUBMISSION
- P7-2 `lib/notification/*` PURE + DB-touching (event dispatch + delivery in-app)
- P7-3 `lib/material/*` + `lib/announcement/*` (mirror lib/assignment shape)
- P7-4 `/api/storage/presign` + `/api/storage/commit` route handlers + integration with lib/auth.canUploadTo for ASSIGNMENT + SUBMISSION dispatch
- P7-5 `lib/feed/aggregator.ts` (CONTEXT § Feed Activity Types — query union over Assignment / Material / Announcement / Score Published / Comments)
- P7-6 Notification bell UI (navbar component + badge count + recent list)
- P7-7 Material + Announcement UI (teacher post + student read)
- P7-8 Student file upload UI (drag-and-drop + progress + presign/commit handshake; replaces the "files_not_yet_supported" branch in submitVersion)
- P7-9 Integration tests (notification fan-out + feed aggregator L1 + file upload happy path)
- P7-10 Smoke checks + docs close-out

Patterns to inherit verbatim (Patterns 1-14 unchanged from Phase 5; Phase 6 reaffirmed each):
- Pattern 1: pure `can.*` + DB-touching `assert.*` returning `{session, row}` divergent shape
- Pattern 2: authz inside `$transaction` for every mutation
- Pattern 3: `TX_OPTS` on every transaction
- Pattern 4: DB-layer projection for L1 visibility (Phase 7 student feed query)
- Pattern 5: extend `_tabs.ts` per role (insert "ฟีด" if a per-course feed tab lands; otherwise notifications live in navbar)
- Pattern 6: hidden form fields, no `.bind()`
- Pattern 7: native `<dialog>` with explicit centering + deferred close (Phase 7 Material / Announcement create dialogs)
- Pattern 8: `"use server"` async exports only
- Pattern 9: avoid `setState`-in-effect
- Pattern 10: past-tense audit family — `NOTIFICATION_DELIVERED` (Verbose, not logged), `MATERIAL_CREATED` / `ANNOUNCEMENT_CREATED` (Verbose), `FEED_VIEWED` (Verbose if logged at all)
- Pattern 11: store UTC, render Buddhist + Asia/Bangkok via Intl
- Pattern 12: `useState` lazy initializer for "is this notification read?" / "is feed item older than 24h?" client-side flags
- Pattern 13: dual-layout (mobile cards + desktop table) for feed list — Phase 7 may relax to single-layout if feed is mobile-first
- Pattern 14: active ∪ ever-engaged enrollment union (e.g. ever-commented-on-this-feed-item) for any historical feed view

Critical files that Phase 7 will add:
- `lib/notification/*` — Verbose tier; CLAUDE.md gotcha — do not log signed URL or session token in payloadJson
- `lib/feed/aggregator.ts` — Phase 4 § Q11C posture: query union not denormalised; L1 boundary at the Prisma SELECT layer
- `lib/material/*` + `lib/announcement/*` — mirror lib/assignment shape but no scored coupling

**Phase 6 — Assignment + Submission + Comments + R2 file upload** (Task.md § Phase 6)

Schema to add:
- `Assignment` (per CourseOffering — title, description, dueAt?, allow_text/file/link, attachments, is_scored, score_item_id?, submission_closed)
- `Submission` (Enrollment × Assignment — unique)
- `SubmissionVersion` (version_number, text_content?, attachments[], links[], submitted_at, is_late, is_current)
- `SubmissionStatus` enum: NOT_SUBMITTED · DRAFT · SUBMITTED · LATE_SUBMITTED · RETURNED · GRADED
- `FileAttachment` (polymorphic — `owner_type` enum ASSIGNMENT/MATERIAL/ANNOUNCEMENT/SUBMISSION/COMMENT, `owner_id`, r2_key, mime, size)
- `Comment` (polymorphic scope — CLASS_WIDE on Assignment/Material/Announcement, PRIVATE on Submission)

ScoreItem ↔ Assignment coupling (CLAUDE.md hard rule):
- If `Assignment.is_scored = true` → atomically create a `ScoreItem` with `source = ASSIGNMENT_LINKED` and link FK
- `source = ASSIGNMENT_LINKED` is the class-C immutable case per ADR-0018 — to "delete the link", delete the ScoreItem (Critical audit) which cascades the unlink
- Deleting an Assignment that owns a published ScoreItem → block (Phase 6 entry must add `assert.canDeleteAssignmentNotPublishedScoreItem` or similar)

Library to add (mirror `lib/scoring/*` layout):
- `lib/assignment/*` — constants, validation, assignment.ts (create/update/delete + ScoreItem coupling), submission.ts (submit/return/grade), comment.ts
- `lib/storage/*` — R2 client, signed-URL gen post permission-check, presigned PUT for client→R2 direct upload, MIME magic-byte verify, EXIF strip

Permissions:
- `can.mutateAssignment(session, course)` + `assert.canMutateAssignment(assignmentId)` → `{session, assignment: {courseOfferingId, scoreItemId?, …}}`
- `can.submitTo(session, assignment, enrollment)` + `assert.canSubmitTo(submissionId)` for resubmit flows
- `can.viewSubmission(session, submission)` — student sees own; teacher sees all for owned course; admin moderation TBD

UI to add:
- Teacher: **การบ้าน** tab on course shell (between คะแนน + ตั้งค่า) — list + create dialog + per-assignment grid (submissions × status) + grade flow (writes to linked ScoreItem)
- Student: **การบ้าน** tab — list of assignments + submit form (text + file upload + link) + version history + status badges
- Comment composer (class-wide vs private) on Assignment/Submission detail pages

Patterns to inherit verbatim (Patterns 1-14 above):
- Pattern 1: `assert.canMutateAssignment(id)` returning `{session, assignment}` divergent shape
- Pattern 2: authz inside `$transaction` for every mutation; ScoreItem-coupling atomic with Assignment in the same tx
- Pattern 3: `TX_OPTS` on every transaction
- Pattern 4: DB-layer projection for L1 — students see ONLY their own Submission, never peer rows
- Pattern 5: extend teacher `_tabs.ts` (insert "การบ้าน" between "คะแนน" and "ตั้งค่า")
- Pattern 6: hidden form fields for context IDs; no `.bind()` on Server Actions
- Pattern 7: native `<dialog>` with explicit centering + deferred close (Pattern 7 from Phase 4 is the canonical form)
- Pattern 8: `"use server"` async exports only
- Pattern 9: avoid `setState`-in-effect (uncontrolled inputs or row remount via revalidate)
- Pattern 10: past-tense audit family — `ASSIGNMENT_CREATED`, `ASSIGNMENT_GRADED`, `SUBMISSION_RETURNED`, `COMMENT_MODERATED`, `FILE_UPLOAD`, `FILE_INFECTED_BLOCKED`
- Pattern 11: store UTC, render Buddhist + Asia/Bangkok via Intl (dueAt formatter)
- Pattern 12: `useState` lazy initializer for "is past deadline?" / "is current version?" flags
- Pattern 13: dual-layout grid (mobile cards + desktop table) for the submission grid
- Pattern 14: active ∪ ever-submitted enrollment union for the submission grid

**Recommended P6 sub-task breakdown** (mirrors P5 structure — 9 sub-tasks):
- P6-1 schema migration (Assignment · Submission · SubmissionVersion · SubmissionStatus enum · FileAttachment polymorphic · Comment polymorphic) + ADRs for the coupling decisions surfaced in grill
- P6-2 `lib/assignment/*` — constants, validation, assignment.ts (CRUD + ScoreItem coupling + Phase 5 invariants), submission.ts (submit/resubmit/return/grade), comment.ts
- P6-3 `lib/storage/*` — R2 client setup, signed URL helpers, presigned PUT, MIME magic-byte verification, EXIF strip
- P6-4 `can.mutateAssignment` + `assert.*` + permissions test cases (Pattern 1, mirror Phase 5 P5-3)
- P6-5 teacher Assignment tab + create dialog + submission grid + grade flow + comment composer
- P6-6 student Assignment tab + submit form (text + file via presigned PUT) + version history view + comment composer (private)
- P6-7 integration tests (Assignment-ScoreItem coupling · Submission grading flow · L1 projection · R2 mock or test-bucket)
- P6-8 smoke checks (~10 new): teacher Assignment tab · student submit flow · L1 boundary · file upload
- P6-9 docs close-out (HANDOFF + Task.md + ADR files)

**Grill before code** — Phase 6 has non-obvious branches that should be locked first via `/grill-with-docs`:

1. **Assignment ↔ ScoreItem atomicity** — `is_scored=true` creates a linked ScoreItem in the same tx; what if create succeeds and link fails? Use Pattern 2 transaction with cascade rollback. What weight does the auto-created ScoreItem get? Teacher must set it before publish — block publish until weight is set?
2. **Resubmission semantics** — `RETURNED` → student resubmits → new `SubmissionVersion` row with `is_current=true`; old row stays for audit. What if teacher already graded before returning? Score Entry stays at old value or resets to null?
3. **Late submission scoring** — `LATE_SUBMITTED` after deadline — does the linked Score Entry still accept the grade? Default behavior + opt-out toggle?
4. **File upload security** — `magic-byte verification on server vs client-side validation only`; SVG with embedded script — block entirely or sanitize? Max file size + chunk threshold?
5. **Comment moderation lifecycle** — teacher can `COMMENT_MODERATED` (delete + audit) any class-wide comment; can admin moderate teacher comments? Per Comment.scope (CLASS_WIDE vs PRIVATE)?
6. **R2 signed URL TTL** — 5 minutes per CLAUDE.md hard rules; verify against R2 ergonomics for large downloads. Re-issue on each page render or cache for 5min?

Recommend grilling Q1 + Q2 + Q4 first (highest blast radius). Q3 + Q5 + Q6 can be locked inline during P6-2 / P6-3 implementation.

---

## 🎯 Project TL;DR

**Studennnn** = ระบบจัดการห้องเรียนสำหรับโรงเรียนเดียว (single-tenant)
รวม Google Classroom + ระบบเกรดมาตรฐาน Thai school

**3 roles:**
- **Admin** — ตรวจ audit / นำเข้า CSV / จัดการบัญชี (ไม่ใส่ข้อมูลแทนใคร)
- **Teacher** — สร้างวิชา (workspace) / เช็คชื่อ / ใส่คะแนน / ตรวจการบ้าน
- **Student** — สมัครเอง / เข้าห้องด้วยรหัส / ดูคะแนน / ส่งงาน

**Design:** **Calm Ledger** theme (ADR-0014 supersedes 0011) — Anuphan font (Cadson Demak), off-white + true black + aubergine surface
**Language:** ไทย 100%

---

## 📦 Tech Stack

| Layer | Stack |
|-------|-------|
| Framework | **Next.js 16** (App Router) |
| Runtime | Node 22 |
| Package mgr | **pnpm 10** |
| Language | TypeScript strict |
| Styling | **Tailwind v4** (CSS-based @theme) + custom `globals.css` |
| Font | **IBM Plex Sans Thai** |
| Icons | lucide-react |
| 3D | React Three Fiber (lazy, Phase 9) |
| Animation | Framer Motion (Phase 9) + Tailwind keyframes |
| Combobox | `cmdk` (ClassPicker) |
| QR | `qrcode.react` |
| Forms | React Server Actions + Zod |
| Validation | **Zod 4** |
| ORM | **Prisma 6** (downgraded from 7 due to breaking config changes) |
| Auth | **NextAuth v5 beta** (Credentials provider) |
| Password | bcryptjs (cost 12) |
| Rate limit | In-DB `RateLimitBucket` (Phase 9 migrate to Upstash Redis) |
| CSV | papaparse |
| DB | **PostgreSQL** on **Neon** (Singapore region) |
| Hosting (target) | Vercel |
| Testing | Vitest + jsdom + Playwright (Phase 9 E2E) |
| Lint/Format | ESLint 9 + Prettier + Husky + lint-staged |

**Not yet integrated** (planned in later phases):
- Cloudflare R2 (file storage, Phase 6)
- Upstash Redis (rate limit, Phase 9)
- Sentry (monitoring, Phase 9)
- Vercel deployment

---

## ✅ Phase Progress

| Phase | Description | Status |
|-------|-------------|--------|
| **0** | Scaffolding (Next 16 + Tailwind v4 + Father design) | ✅ DONE |
| **1** | Auth & RBAC + Self-register + Force reset + Audit | ✅ DONE |
| **2a** | Academic schema + Workspace model + Class Code + Join | ✅ DONE |
| **2b** | Teacher pages (list/create/detail + QR + ClassPicker) | ✅ DONE |
| **2c** | Admin pages (list/students/teachers + CSV import + audit viewer) | ✅ DONE |
| **2.5** | Calm Ledger theme pivot (ADR-0014) + Anuphan + landing rebuild + touch-up ทุก surface | ✅ DONE |
| **3** | Course tabs (Overview · Members · Settings) + soft-delete + restoration | ✅ DONE (P3-1..9 all complete · 22 integration tests pass) |
| **4** | Attendance (TimetableSlot · Session lazy materialization · sparse AttendanceRecord · back-edit audit) | ✅ DONE (P4-1..9 all complete · 91 unit + 71 integration + 72 smoke pass) |
| **5** | Scoring + Term GPA + Print transcript (ADR-0017 + ADR-0018) | ✅ DONE (P5-1..9 all complete · 156 unit + 116 integration + 88 smoke pass · ScoreItemTemplate deferred) |
| **6** | Assignment + Submission + Comments + R2 file upload | ✅ DONE (P6-1..9 all complete · 299 unit + 135 integration + 98 smoke pass · 3 ADRs locked) |
| **7** | Feed + Notifications + Bell + Class-wide Comments | ✅ DONE (P7-0..10 all complete · 384 unit + 171 integration + ~124 smoke pass · 2 ADRs locked) |
| **8** | Admin Audit Tools (tier badges · drill-down · CSV export) | ✅ DONE (P8-1 + P8-2 · 395 unit + 171 integration + ~133 smoke pass · 11 new smoke checks) |
| **9 (partial)** | E2E + polish (P9-1..4: payload enrich · PRIVATE composer · Playwright · close-out) | ✅ DONE (B+C+D hardening + deploy deferred to Phase 10) |

---

## 🚀 Quick Start (fresh clone, fresh session)

```bash
# 1. Install
pnpm install

# 2. Verify env (already set up)
#    .env.local has DATABASE_URL + AUTH_SECRET (do NOT commit)

# 3. Generate Prisma client + verify schema in sync
pnpm db:generate

# 4. Run dev
pnpm dev

# 5. Verify tests
pnpm typecheck   # 0 errors expected
pnpm test        # 77 tests should pass
pnpm lint        # 0 errors, 0 warnings

# 6. Smoke test (run dev in another terminal first)
pnpm exec dotenv -e .env.local -- tsx scripts/smoke-test.ts
# Expected: 44 passed · 0 failed
```

---

## 🔑 Test Accounts (from seed)

| Role | Identifier | Password | Notes |
|------|-----------|----------|-------|
| Admin | `admin@studennnn.local` | `Admin1234!` | — |
| Teacher | `teacher@studennnn.local` | `Teacher1234!` | Homeroom ของ ม.4/2 |
| Student | `60001` | `Student1234` | อยู่ ม.4/2, enrolled ใน MATH4A-DEMO1 |

**Demo class code:** `MATH4A-DEMO1` (เข้าได้ผ่าน `/join` หรือ `/join?code=MATH4A-DEMO1`)

**21 classes seeded:** ป.1/1 — ม.6/2 (ใช้ทดสอบ ClassPicker)

---

## 🗂️ File Structure

```
D:\Studennnn\
├── app/                          # Next.js App Router (16 routes)
│   ├── (auth)/                  # Group: login, signup, join, reset-password
│   ├── admin/                   # Admin pages
│   │   ├── dashboard/           # KPIs + recent activity
│   │   ├── teachers/            # List + search + paginate
│   │   ├── students/            # List + class filter
│   │   ├── import/              # CSV import landing
│   │   │   └── teachers/        # 3-stage flow (upload → preview → commit)
│   │   ├── audit/               # Audit log viewer
│   │   └── layout.tsx           # Sidebar nav + role guard
│   ├── teacher/courses/         # Teacher workspace
│   │   ├── page.tsx             # List
│   │   ├── new/                 # Create with ClassPicker
│   │   └── [id]/                # Detail + QR + members
│   ├── dashboard/               # Role-aware landing (after login)
│   ├── privacy/                 # PDPA Policy
│   └── api/                     # API routes
│       ├── auth/[...nextauth]/  # NextAuth
│       ├── signup/              # Student self-register
│       ├── join/                # Enroll via code
│       └── admin/import/teachers/{preview,commit}/
├── components/
│   ├── class-code-card.tsx      # QR + copy link card
│   ├── class-picker.tsx         # ⭐ cmdk combobox with search/group/recent
│   ├── pagination.tsx           # Reusable pagination
│   ├── copy-button.tsx          # Clipboard helper
│   ├── turnstile-widget.tsx     # CAPTCHA wrapper
│   └── admin-sidebar.tsx
├── lib/
│   ├── auth/                    # NextAuth config, password, permissions, guards, rate-limit
│   ├── admin/                   # CSV import, list queries, temp-password
│   ├── course/                  # class-code gen, category, enrollment, queries, create
│   ├── audit/log.ts             # 30+ event types
│   ├── db/client.ts             # Prisma singleton
│   ├── errors.ts                # Typed HTTP errors
│   ├── utils/request.ts         # IP/UA capture
│   └── validation/              # Zod schemas (shared client/server)
├── prisma/
│   ├── schema.prisma            # Full schema (ADR-0012 workspace model)
│   ├── seed.ts                  # Idempotent (upsert pattern)
│   └── migrations/              # init_auth only — Phase 2 used db:push
├── scripts/
│   ├── smoke-test.ts            # E2E HTTP suite (44 checks)
│   ├── check-audit.ts           # CLI to inspect audit log
│   └── reset-courses.ts         # One-off DB cleanup utility
├── tests/
│   ├── setup.ts                 # vitest setup (@testing-library/jest-dom)
│   └── unit/                    # 8 files: password, permissions, validation, errors, smoke, class-code, category, csv-import (77 tests)
├── docs/adr/                    # ADRs 0011 + 0012 (others pending)
├── middleware.ts                # Secure headers + CSP + auth
├── .env.local                   # gitignored (real secrets)
├── .env.example                 # template
└── *.md                         # README, CLAUDE, CONTEXT, Architecture, Security, Task, Testing
```

---

## 📜 Architecture Decisions (ADRs)

ADRs ที่ **เขียนเป็นไฟล์แล้ว** (in `docs/adr/`):

| # | Title | File |
|---|-------|------|
| 0011 | Theme: Ink + Gold (adopted from Father) | `0011-theme-ink-gold.md` |
| 0012 | Workspace Model: Teacher-Owned CourseOffering (no Subject) | `0012-workspace-model-no-subject-template.md` |
| 0013 | Enrollment Soft-Delete + Auto-Restore by Rejoin | `0013-enrollment-soft-delete-and-rejoin-restore.md` |
| 0014 | Theme pivot: Calm Ledger supersedes Ink + Gold | `0014-theme-calm-ledger-supersedes-ink-gold.md` |
| 0015 | Lazy Session Materialization (no cron, no eager batch) | `0015-lazy-session-materialization.md` |
| 0016 | Sparse AttendanceRecord + Enrollment FK + Grid Membership Rule | `0016-sparse-attendance-and-enrollment-fk.md` |

ADRs ที่ **ตัดสินใจแล้วแต่ยังไม่ได้เขียนเป็นไฟล์** (จดไว้ใน Architecture.md § Key Decisions):

| # | Decision | Where |
|---|----------|-------|
| 0001 | Single-tenant (no `school_id`) | Discussed in interview, ADR file TBD |
| 0002 | Student auth via Student ID (not email) | — |
| 0003 | Admin = super user (full data access, logged) | — |
| 0004 | Score weight invariant = 100% (Phase 5) | — |
| 0005 | 3D เฉพาะจุด — Level A (R3F) + Level B (CSS) | Architecture.md |
| 0006 | Soft delete + anonymize (PDPA) | Security.md |
| 0007 | Assignment ↔ ScoreItem coupling (Phase 6) | Architecture.md |
| 0008 | L1 Visibility (student เห็นแค่ของตัวเอง) | Security.md |
| 0009 | Comment polymorphic (Phase 6) | Architecture.md |
| 0010 | Submission versioning (Phase 6) | Architecture.md |

> 💡 **Action item ในอนาคต:** เขียน ADR ที่ค้าง (0001-0010) เป็นไฟล์ใน `docs/adr/` เพื่อ knowledge transfer

---

## 🔐 Security Posture (Phase 1-2 baseline)

- ✅ Password: bcrypt cost 12, min 8 (student) / 12 (teacher/admin), common-password reject
- ✅ Session: httpOnly cookie, JWT, 4h sliding / 12h absolute
- ✅ Rate limit: 5 login fails → 30-min lockout (in-DB)
- ✅ CAPTCHA: Cloudflare Turnstile on signup (test keys ใน dev)
- ✅ PDPA: Privacy Policy + consent tracking + soft delete + anonymize
- ✅ CSP: secure headers + nosniff + DENY frame
- ✅ Audit: IP + UA capture for all events (7 active event types)
- ✅ Authorization: requireAuth/requireRole/can/assert pattern
- ✅ CSRF: NextAuth handles

**Deferred:**
- CAPTCHA after 3 failed logins (Phase 9)
- File upload security (Phase 6 — R2 + MIME magic byte)
- OWASP ZAP scan (Phase 9 pre-launch)

---

## 🧪 Test Coverage

**Unit tests:** 77 passing across 8 files
- `password.test.ts` (10) — bcrypt + common pwd + per-role rules
- `permissions.test.ts` (12) — pure `can.*` predicates
- `validation.test.ts` (12) — Zod schemas
- `errors.test.ts` (9) — HttpError + errorResponse
- `class-code.test.ts` (15) — generator + validator + normalizer
- `category.test.ts` (8) — grade-level → category
- `csv-import.test.ts` (10) — parse + dedupe + DB mock
- `smoke.test.ts` (1) — smoke

**Smoke tests:** 44 passing (scripts/smoke-test.ts — HTTP against live dev)
- Public pages, protected redirects, login per role, signup flow, rate limit, force reset, join flow, audit log

**E2E (Playwright):** configured but no tests yet (Phase 9)

---

## ⚠️ Known Tech Debt

| Item | Severity | Note |
|------|----------|------|
| `middleware.ts` → `proxy.ts` | Low | Next 16 deprecation warning; works fine |
| Phase 2 used `db push` not migrations | Low (dev only) | Production needs proper migrations Phase 9 |
| Prisma client EPERM on Windows | Low | Kill node procs before `db:generate`; retry works |
| `force-reset` requires Prisma consent env var | Low | Use `scripts/reset-courses.ts` pattern instead |
| No E2E Playwright tests yet | Medium | Smoke covers main flows; Playwright Phase 9 |
| CAPTCHA only on signup, not login fails | Low | Rate limit handles worst case; add Phase 9 |
| Subject removed (ADR-0012) — no cross-class report | Documented | Use `subjectCode` field if needed |
| ADRs 0001-0010 not yet in `docs/adr/` | Low | Architecture.md documents them; write files when time |

---

## 🪧 Important Gotchas (Windows / Prisma 6 / Next 16)

1. **Prisma client EPERM on regen** — When dev server is running, `pnpm db:generate` fails to rename DLL. Solution:
   ```powershell
   Get-Process node | Stop-Process -Force
   pnpm db:generate
   ```

2. **`prisma db push --force-reset` blocked** — Prisma 6 added safety check requiring `PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION` env var. Workaround: use `scripts/reset-courses.ts` to clear data first, then plain `pnpm db:push`.

3. **CSRF for HTTP login testing** — NextAuth v5 returns MULTIPLE `authjs.csrf-token` Set-Cookie headers; must dedupe by name (last-write-wins) when building Cookie header. See `scripts/smoke-test.ts` → `cookiesFromSetCookie()`.

4. **dotenv-cli prefix needed for CLI** — Next.js auto-loads `.env.local` at runtime, but Prisma CLI / tsx scripts need `pnpm exec dotenv -e .env.local --` prefix. Already wrapped in `db:migrate`, `db:seed`, `db:studio`, `db:push`, `db:generate`.

5. **Tailwind v4 limitations** — Can't use `@apply` with custom component class chains. Use multi-selector for shared base styles (see `.btn` group in `globals.css`).

6. **Force reset password flow** — After password change, JWT still has `mustResetPwd=true` → would loop. Mitigation: `signOut()` after change, user logs in fresh.

7. **Workspace model (ADR-0012)** — No `Subject` table. CourseOffering owns `name`, `subjectCode?`, `gradeLevel`, `creditHours` directly. Don't add back without re-discussing trade-offs.

---

## 🗃️ DB Schema At-A-Glance

### Identity
- `User` (role, identifier, passwordHash, mustResetPwd, isActive, deletedAt, consentedAt)
- `Admin` (userId, firstName, lastName)
- `Teacher` (userId, firstName, lastName, email, homeroomOfId?)
- `Student` (userId, studentId, firstName, lastName, classId?, anonymized)
- `UserSession` (tokenHash, expiresAt, revokedAt)

### Academic
- `AcademicYear` (name "2568", isActive)
- `Term` (number, name, startDate, endDate, isActive)
- `Class` (name "ม.4/2", gradeLevel "ม.4", homeroomTeacher)
- `CourseOffering` ⭐ (teacherId, classId, termId, **name, subjectCode?, gradeLevel, creditHours**, classCode, codeActive)
- `Enrollment` (studentId × courseOfferingId — unique)

### Audit & Infra
- `AuditLog` (timestamp, actor, action, target, before/after JSON, ipAddress, reason)
- `RateLimitBucket` (`<action>:<id>` key, count, resetAt, lockedAt)

**No tables yet for:** Attendance (Phase 4), ScoreItem/ScoreEntry (Phase 5), Assignment/Submission/Comment (Phase 6), Notification (Phase 7), FileAttachment (Phase 6)

---

## 📚 Commit History

```
43ce355  feat(admin): teachers/students list + CSV import with preview/commit flow + audit page
c3d270b  feat(ux): ClassPicker combobox (cmdk) with search + recent + homeroom badge
1579004  feat(adr-0012): workspace model - drop Subject template
1f3159b  chore: clean up unused vars
83f03b6  feat(phase2): academic schema + class code + join flow + teacher pages
c614abc  test: phase 1 smoke test script (33 e2e checks passing)
23bec00  feat(auth): force reset password flow + unit tests (44 passing)
0be7869  feat(auth): student self-register + permissions + audit IP capture + privacy page
bf24ecd  feat(auth): phase 1 - prisma schema + nextauth v5 + login/dashboard
580e05d  chore: phase 0 scaffolding - Next.js 16 + Tailwind v4 + Ink+Gold design system
```

---

## 🎯 What's Next — Phase 3 Suggested Plan

**Phase 3 — Course Tabs + Members (~2-3 วัน)**

ตอนนี้ teacher course detail page (`/teacher/courses/[id]`) มีแค่ QR + members list flat
Phase 3 จะแบ่งเป็น tab structure ที่ extensible:

```
┌─── Course: คณิตศาสตร์ ม.4/2 ครูสมชาย ─────┐
│ [Overview] [Members] [Attendance] [Scores] │  ← Tabs
│ [Assignments] [Feed] [Settings]            │
└────────────────────────────────────────────┘
```

**Scope:**
- [ ] Tab navigation component (reusable for both teacher and student views)
- [ ] Student-facing course page (`/student/courses/[id]`) with L1 visibility
- [ ] Members tab — show roster, teacher can "remove from course"
- [ ] Permission tests: student เห็น roster (no scores), ครูเห็นทุกอย่าง
- [ ] Smoke test: course detail accessible to enrolled student, blocked for others

**DoD:** ครู+นักเรียนเปิดหน้า course เดียวกัน, tab navigate ได้, Members tab ทำงาน

---

## 💬 How to Resume in a New Session

Paste this into the new session as your first message:

> ผมทำงานต่อจาก project Studennnn ที่ `D:\Studennnn`
> อ่าน `HANDOFF.md` + `CLAUDE.md` + `CONTEXT.md` ก่อนเริ่ม
> ตอนนี้ Phase 0-5 เสร็จแล้ว (156 unit + 116 integration + 88 smoke = 360 verifications passing)
> อยากทำต่อ: [ระบุ Phase หรือ feature ที่อยากทำ]

หรือถ้าจะ verify state ก่อน:

```bash
cd D:\Studennnn
pnpm typecheck && pnpm test && pnpm lint
# ทั้ง 3 อันต้องผ่านหมด

# Optional: smoke test (need pnpm dev in another terminal)
pnpm dev  # terminal 1
pnpm exec dotenv -e .env.local -- tsx scripts/smoke-test.ts  # terminal 2
```

ถ้าทุกอันผ่าน = state ตรงกับ HANDOFF.md → ต่อได้เลย

---

## 📂 Documentation Index

| File | Purpose |
|------|---------|
| [README.md](./README.md) | Project overview, quick start |
| [HANDOFF.md](./HANDOFF.md) | **ไฟล์นี้** — session resume guide |
| [CLAUDE.md](./CLAUDE.md) | Coding rules + design system + hard rules |
| [CONTEXT.md](./CONTEXT.md) | Glossary (domain terms, no implementation) |
| [Architecture.md](./Architecture.md) | Tech stack, schema, design decisions |
| [Security.md](./Security.md) | Auth, authorization, PDPA, audit, rate limit |
| [Task.md](./Task.md) | Roadmap Phase 0-9 (mark progress as you go) |
| [Testing.md](./Testing.md) | Testing strategy |
| [docs/adr/](./docs/adr/) | Architecture Decision Records (2 written, 10 pending) |

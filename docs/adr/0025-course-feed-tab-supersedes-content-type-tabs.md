# ADR-0025 — Course Feed Tab as Default Landing Supersedes Content-Type Tabs

## Status

Accepted — 2026-06-05 (Phase 10C entry) — **Supersedes [ADR-0023](./0023-feed-aggregator-query-union-course-feed-deferred.md) § Course Feed deferral**. ADR-0023's other decisions (User Feed multi-query union at application layer, course-scope resolver as the single L1 boundary, snapshot semantics) remain authoritative.

## Context

ADR-0023 (Phase 7) deferred a per-CourseOffering Feed surface because the assumption at the time was that the User Feed (cross-course) on the Dashboard, plus the Bell, plus the existing per-content-type tabs (การบ้าน / เอกสาร / ประกาศ) covered the user need.

Phase 10 grill Q4 surfaced that the assumption was wrong against the actual product owner's intent:

> "หน้า courses หน้าแรก … ควรเป็นหน้า Feed และหน้า Feed ผมอยากได้ ให้อารมเหมือนกับ Social Media สำหรับคุณครู มีเมนูสร้างในนั้น … จริงๆเราไม่ต้องทำให้เป็นหลายหน้าก็ได้ Feel มันจะคล้ายๆ กับ Google Classroom"

The vision is **one chronological surface** per course where the teacher creates everything via one composer, and the student scrolls everything in one stream. The split-by-content-type tab layout fights that intent. Grill Q4 = D unanimously: a Feed tab becomes the new default landing, the three content-type list tabs (การบ้าน / เอกสาร / ประกาศ) disappear from the tab nav, and the existing detail routes stay.

## Decision

### 1. Tab structure changes

Teacher course tabs: **8 → 6**
```
Before: ภาพรวม · สมาชิก · เช็คชื่อ · คะแนน · การบ้าน · เอกสาร · ประกาศ · ตั้งค่า
After:  ภาพรวม · ฟีด · สมาชิก · เช็คชื่อ · คะแนน · ตั้งค่า
```

Student course tabs: **5 → 4**
```
Before: ภาพรวม · เพื่อนร่วมห้อง · เช็คชื่อ · คะแนน · การบ้าน
After:  ภาพรวม · ฟีด · เพื่อนร่วมห้อง · เช็คชื่อ · คะแนน
```

(The Material / Announcement student tabs were never sub-routed under a single nav slot — they lived alongside การบ้าน as menu links from the dashboard. This ADR cleans that up by routing all three content types through Feed.)

**Default landing flips** from ภาพรวม → Feed. Teachers and students who click into a course see the chronological stream first; the Overview tab remains for course metadata (class code QR, schedule summary, recent stats) but is no longer the entry point.

### 2. Feed surface — `/(teacher|student)/courses/[id]/feed`

A new Server Component page that renders:
- A **type-chip filter row** at the top: `ทั้งหมด · ประกาศ · การบ้าน · เอกสาร · คะแนนที่เผยแพร่`. Default = ทั้งหมด.
- A **chronological list** of items, paginated 20 at a time (infinite scroll), reusing `lib/feed/aggregator` with a course-scope filter applied (the Q4 lock confirms ADR-0023's aggregator is the correct read path; the only new flag is a `courseOfferingId` argument that narrows the cross-course union to one course).
- A **composer dialog launcher** (teacher only — Pattern 7) at the top of the list: "+ สร้างใหม่".
- Each row is an existing-style FeedCard (reusing the Phase 7 user-feed card component family) with the row's content-type-specific affordances:
  - Assignment row → "ส่งงาน" / "ดู submissions" link
  - Material row → "ดาวน์โหลด" link
  - Announcement row → no action; CLASS_WIDE comments thread inline
  - ScoreItem published row → "ดูคะแนน" link to the Scores tab anchored on this item

### 3. Unified composer — type chip → form swap

The composer Pattern-7 dialog opens with a top-row chip selector for content type:

```
┌──────────────────────────────────────────┐
│  สร้างใหม่              [ ✕ ]            │
│                                          │
│   [ 📢 ประกาศ ] [ 📝 การบ้าน ] [ 📄 เอกสาร ] │
│                                          │
│   ╶── form for selected type ──╴         │
│   …                                      │
│                                          │
│            [ ยกเลิก ]  [ โพสต์ ]         │
└──────────────────────────────────────────┘
```

The form body swaps based on chip. Each type's form reuses its existing field set (Phase 6 Assignment / Phase 7 Material / Announcement) — the underlying create lib functions stay identical. The dialog is purely a UX wrapper that re-routes to the right `createAssignment` / `createMaterial` / `createAnnouncement` call.

Multi-image carousel attachment (Phase 10 Q5 = A) is shared across all three forms: a 1..10-image picker + drag-drop + URL paste field. No GIF (ADR-0021 unchanged).

### 4. Detail routes survive intact

The Phase 6/7 detail routes
- `/(teacher|student)/courses/[id]/assignments/[aid]`
- `/(teacher|student)/courses/[id]/materials/[mid]`
- `/(teacher|student)/courses/[id]/announcements/[aid]`
- `/teacher/courses/[id]/assignments/[aid]/submissions/[sid]` (Phase 9 P9-2)

continue to exist and are reachable from Feed cards. The composer / list landing changes, not the detail surfaces. The Phase 7 CommentsThread component continues to mount on each detail page.

### 5. Inline grade input replaces the modal grade dialog

Q4 grill lock: when a teacher clicks into a submission from the Feed (or from the assignment detail), the per-submission view shows an **inline number input + save button** instead of opening a Phase 6 modal grade dialog. The grade dialog's reason-after-publish gate stays (ADR-0018), implemented inline rather than in a popup. Same Server Action backend, smaller-surface UX.

## Consequences

### Positive

- **Matches the product owner's Google-Classroom-shaped mental model.** One surface per course, one composer for everything, chronological order.
- **Less navigation cost.** Teacher posts a homework → student scrolls feed → answers → teacher grades inline. No tab-hopping between การบ้าน list / detail / submission grid.
- **Reuses the Phase 7 aggregator and card components.** The User Feed on the Dashboard and the new Course Feed render with the same primitives; consistency is automatic.
- **Detail routes are unchanged** — Phase 6/7/9 work is preserved. The ADR is a UX re-shaping, not a re-implementation.
- **ScoreItem published events appear in Feed** for the first time at the per-course scope (the Phase 7 aggregator already includes them at the cross-course scope). Students get "new graded item available" surfacing inside the course context, not just on the dashboard.

### Negative

- **Removes the bookmarkable "/teacher/courses/[id]/assignments" list landing.** Teachers who pinned that URL get a 404 (or a redirect to Feed). Mitigation: HTTP 301 from the old landing path to `/feed?type=assignment`.
- **The chip filter is JS-shallow** — server-rendered initial state respects the query param `?type=`, but switching chips client-side does a router.replace, which on slow connections is briefly blank. Acceptable; the filter is a UX shortcut, not a critical-path.
- **Composer dialog is now type-conditional** — slightly more form-state plumbing than three separate dialogs. Mitigation: the existing Phase 6/7 `<form action={action}>` boundaries are reused verbatim per branch; only the wrapping dialog's chip selector is new.
- **The User Feed on the dashboard and the per-course Feed now overlap.** A teacher seeing "new assignment in Math 4/2" on the dashboard AND on the Math 4/2 Feed could feel redundant. Acceptable: each surface answers a different question (what's new across all courses vs. what's the history of this one course).

### Rejected Alternatives

- **Keep all three list tabs AND add a Feed tab (Q4 option C).** Code duplication (one Feed query + three tab queries); cognitive load (four tabs covering overlapping content). Worse posture than D.
- **Keep tabs, remove Feed (status quo / Q4 option B).** Tighter to ADR-0023's original assumption but loses the product owner's vision.
- **Single timeline without filter chips.** Rejected because a teacher reviewing late submissions needs to scope to assignments; a student preparing for class needs to scope to materials. The chips are cheap and useful.
- **Defer to Phase 11 (post-theme migration).** The Feed is function-heavy, not visual; it can ship on the current Calm Ledger theme and re-skin trivially when Phase 11 lands. Decoupling Feed shipping from theme work lets the product owner see the Course Feed sooner.

## References

- [ADR-0023](./0023-feed-aggregator-query-union-course-feed-deferred.md) — partially superseded (Course Feed deferral undone; aggregator + L1-boundary decisions still authoritative)
- [ADR-0019](./0019-assignment-scoreitem-coupling-atomic-no-default-weight.md) — Assignment ↔ ScoreItem coupling; composer's "การบ้าน" branch invokes `createAssignment` exactly as the Phase 6 dialog did
- [ADR-0021](./0021-file-upload-pipeline-presigned-staging-magic-byte-verify-exif-strip.md) — composer attachment pipeline unchanged; multi-image carousel uses the same presign / commit flow
- Phase 10 grill Q4 (this ADR's origin)
- HANDOFF.md § Phase 7 — Bell + User Feed + CommentsThread surfaces this Feed reuses

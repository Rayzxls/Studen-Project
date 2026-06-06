# ADR-0029 — World-Class Interactive: Task-Modulated 2D/3D Motion Budget (Extends ADR-0028)

## Status

Accepted — 2026-06-06 (Phase 11.9 entry) — **Extends [ADR-0028](./0028-theme-calm-ledger-v2-color-friendly-and-material.md)**. Partially relaxes ADR-0028 § 6 (which retired tilt/parallax/decorative motion) by introducing a **task-modulated motion budget**: high interactivity on consumption/identity surfaces, strict calm on data-entry surfaces. ADR-0028's tokens, colour system, glass scope, and spring curve remain in force.

## Context

ADR-0028 shipped a coherent colour-friendly theme but kept ADR-0014's "motion is state feedback only, no decoration" discipline. After Phases 11–11.8 landed, the product owner reviewed the result and pushed for a different bar, verbatim:

> "ผมอยากให้มันดูว้าว ดูหรู ดูเป็นระบบปฏิบัติการมากกว่านี้ คุณสามารถทำให้มันเป็น 3D ได้... ผมเป็นคนที่ชอบ UX/UI ที่มี Interactive สวยๆ ชอบลูกเล่นของ UI ชอบความที่มี 2D 3D จากที่ผมได้เข้าไปท่องเว็บระดับโลกมามากมาย ผมเลยอยากให้เว็บของผมมีความสวยแบบนั้นบ้าง"
> "ขอให้มันเข้าธีมและมีความสวยงามอยู่บ้าง และมี Interactive กับผู้ใช้ในระดับที่ผู้ใช้รู้ว่ามีการตอบสนอง"

The direction is explicit and locked: **world-class interactive feel, tasteful 2D + 3D, the user must feel the interface respond to them**. This is a deliberate pivot away from ADR-0028 § 6's blanket "no decorative motion".

The UI/UX Pro Max design intelligence (installed via `uipro-cli` at the product owner's request, skill at `.claude/skills/ui-ux-pro-max/`) was consulted and returned three constraints that shape this ADR rather than contradict it:

- **Reduced motion is High severity** — every effect needs a `prefers-reduced-motion` path
- **Parallax / scroll-jacking causes nausea** — use sparingly, always gated by the motion query
- **"Animate 1–2 key elements per view maximum"** — the wow comes from a few well-chosen moments, not from animating everything

The tension to resolve: the product owner wants wow, but PRODUCT.md Design Principle #1 ("เครื่องมือที่หายไปในงาน" — the tool disappears into the task) and the data-heavy teacher/admin surfaces (grade entry of 40 students, attendance grids, 500-row audit logs) demand speed and calm. A teacher tabbing through a grade grid must not fight tilt or parallax.

## Decision

### 1. Task-modulated motion budget — 4 tiers

Every surface is assigned a motion tier. The tier dictates how much interactive motion is permitted. This is the central decision of ADR-0029.

| Tier | Name | Motion budget | Surfaces |
|---|---|---|---|
| **T1** | Showcase | Real GPU 3D (R3F/WebGL), animated mesh, parallax, full choreography | Landing page (`/`) |
| **T2** | Interactive | CSS 3D tilt, animated gradient/blob backgrounds, entry stagger, spring hover | Dashboards (`/dashboard`, `/admin/dashboard`), course shells, course/class lists, feed, auth |
| **T3** | Responsive | Entry stagger, spring hover-lift, micro press feedback. No tilt, no parallax, no ambient bg motion | Content detail pages (announcement/material/assignment detail), members lists |
| **T4** | Calm | State feedback only (ADR-0028 § 6 unchanged). No tilt, no stagger, no ambient motion | Grade entry grid, attendance grid, submission review, audit log + detail, admin setup/CRUD, admin user lists, CSV import, course settings, course-create form, privacy |

**The Data-Entry-Is-Sacred Rule.** Any surface whose primary job is entering or auditing student data is T4. Wow lives on the surfaces a student or teacher *arrives at* (dashboards, course home, feed), never on the surfaces where they *work* (grids, forms, audit). This is the line that keeps PRODUCT.md Principle #1 intact while satisfying the wow brief.

### 2. Motion primitives (4 reusable components)

Built once, applied per tier. All respect `prefers-reduced-motion` by collapsing to a static or 100ms-crossfade fallback.

- **`<Tilt3D>`** (T1/T2) — CSS `perspective` + `rotateX/rotateY` driven by pointer position via a ref-held `--rx --ry` CSS variable. Max 8° rotation. Returns to 0 on pointer-leave with `--spring-standard`. Touch devices: tilt disabled (pointer:coarse), press-scale only. Reduced-motion: no transform at all.
- **`<EntryStagger>`** (T1/T2/T3) — wraps a list; children fade-up (8px translate) on mount with a 40ms stagger between items, capped at 12 staggered items then the rest appear instantly (so a 500-row list doesn't choreograph for 20 seconds). Reduced-motion: instant, no translate. Reveal enhances an already-visible default (no visibility gating — the content renders server-side, the animation only adds entrance).
- **`<AmbientBackground>`** (T1/T2) — 2–3 slowly-drifting radial-gradient blobs behind a hero surface, in the surface's own course/system colour at low opacity. CSS `@keyframes` drift over 18–24s. Reduced-motion: static gradient, no drift.
- **`<SpringPress>`** / `.springy` (all tiers including T4) — press-scale 0.97 feedback on tap. This is the one interactive motion permitted everywhere, including T4, because it is direct user-response feedback (the user pressed; the element acknowledges), not decoration. Already shipped in ADR-0028 § 9.

### 3. Library choice

- **`framer-motion`** — for `<EntryStagger>` and any orchestrated reveal. Lazy-imported in client components only; tree-shaken so server-rendered pages don't pull it. Industry standard, declarative, reduced-motion aware via its own `useReducedMotion()` hook.
- **CSS-only** for `<Tilt3D>` and `<AmbientBackground>` — perspective transforms + keyframe drift need no JS library; a tiny pointer-move handler sets CSS vars. Keeps these effects off the JS critical path.
- **`three` / `@react-three/fiber`** — **deferred to Phase 12 (landing page only)**. The T1 showcase 3D scene lands with the landing page, not in this phase. Phase 11.9 ships T2/T3 (CSS 3D + framer-motion), which deliver most of the perceived wow without a WebGL bundle on every authenticated page.

### 4. What stays exactly as ADR-0028

- The iOS spring curve `cubic-bezier(0.32, 0.72, 0, 1)` is the easing for every new effect — no new curves.
- Colour system (System 4 + Course 8), glass scope, typography, geometry — unchanged.
- T4 surfaces are byte-for-byte the ADR-0028 § 6 motion discipline.
- `prefers-reduced-motion` remains non-optional on every effect (now reinforced by the UI/UX Pro Max High-severity finding).

## Consequences

### Positive

- Delivers the product owner's locked "world-class interactive" direction with a defensible discipline (tier budget) rather than scattering motion everywhere
- The "animate 1–2 key elements per view" rule from the design-intelligence skill is encoded structurally: T2 pages get a hero ambient bg + a tilt/stagger card grid (that's the 1–2), not five competing animations
- Data-entry surfaces stay fast — the teacher grading 40 students never meets a tilt
- Primitives are reusable and reduced-motion-correct once, so per-page application is cheap and consistent
- No WebGL bundle ships to authenticated pages in this phase (R3F deferred to landing)

### Negative

- `framer-motion` adds ~30KB gzipped to client bundles that import it (T2/T3 islands only, lazy); the performance budget in CLAUDE.md (< 250KB initial) is respected because it's not in the critical path, but it is a new dependency to maintain
- Four motion tiers add a classification burden: every new page must be assigned a tier. Mitigated by the Data-Entry-Is-Sacred rule making most assignments obvious
- The tilt/stagger effects are visible debt if a future maintainer disables `prefers-reduced-motion` handling — the primitives must be used, not hand-rolled per page
- Partially relaxing ADR-0028 § 6 means the "no decorative motion" line is now nuanced rather than absolute; the tier table is the new source of truth and must be kept current

### Rejected alternatives

- **Wow everywhere, including grids** — directly violates PRODUCT.md Principle #1 and the skill's "animate 1–2 elements max"; a tilting grade grid is user-hostile
- **R3F/WebGL on dashboards in Phase 11.9** — ships a heavy bundle to every login; the CSS-3D tilt + framer-motion stagger deliver ~80% of the perceived wow at ~10% of the bundle cost. Real 3D is reserved for the landing page where the bundle is justified
- **A single global "motion intensity" toggle instead of tiers** — too coarse; the whole point is that different surfaces have different jobs
- **GSAP + ScrollTrigger for parallax** — the skill explicitly flags scroll-jacking as a nausea/High-severity issue; we use bounded pointer-parallax (tilt) and ambient drift instead of scroll-driven motion

### Follow-ups

- Phase 12 — landing page T1 showcase with R3F scene (`three` + `@react-three/fiber` + `drei`), lazy-loaded with `<Suspense>` + static-image fallback
- Per-surface tier assignments are recorded in DESIGN.md § Motion Tiers (companion edit) and must be updated when new pages land
- Revisit `framer-motion` bundle impact after Phase 11.9 ships; if a T3 page only needs entry stagger, consider a CSS-only stagger to drop the dependency from that route

## References

- Extended ADR: `docs/adr/0028-theme-calm-ledger-v2-color-friendly-and-material.md`
- UI/UX Pro Max skill (installed via `uipro-cli` per product owner request): `.claude/skills/ui-ux-pro-max/` — consulted for motion discipline (reduced-motion High severity, parallax nausea, animate-1-2-elements-max)
- Product owner direction: this session (world-class interactive + 2D/3D brief)
- Companion edits: `DESIGN.md` (§ Motion Tiers + primitives), `components/motion/*` (Tilt3D, EntryStagger, AmbientBackground), `package.json` (framer-motion)
- PRODUCT.md Design Principle #1 (เครื่องมือที่หายไปในงาน) — the constraint that produces the T4 tier

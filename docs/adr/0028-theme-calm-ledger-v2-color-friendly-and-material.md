# ADR-0028 — Theme "Calm Ledger v2" Color-Friendly + Material (Extends ADR-0014)

## Status

Accepted — 2026-06-05 (Phase 11 entry) — **Extends [ADR-0014](./0014-theme-calm-ledger-supersedes-ink-gold.md)** (does NOT supersede). ADR-0014's discipline (Anuphan single family, weight-600 ceiling, pill geometry, rounded-2xl cards, off-white body, no decorative motion utilities) remains in force. This ADR adds a colour system, a glass/material vocabulary, and a 3-tier motion system on top.

## Context

ADR-0014 ("Calm Ledger") was adopted 2026-05-31 and shipped through Phase 10 (10A foundation, 10B admin surface, 10C course feed). After six days of use the product owner reviewed the result and flagged a single concrete pain:

> "ผมต้องการ Layout หรือ ธีมสีโดยรวมให้มันสดใสกว่านี้ เพราะตอนนี้ Project จืดมาก ไม่มีสีสัน หมองหม่นมาก ผมชอบ iOS เพราะเขาทำให้เป็นมิตรกับ user และสีสันสดใส เหมาะสำหรับวัยรุ่นยุคนี้ และผมชอบ Windows 11 เพราะ Interactive ของ Windows 11 ทำให้ผมรู้สึกว่ามีความ Smooth"

The pain is real and was diagnosed correctly: ADR-0014's discipline (off-white + true black + one aubergine accent + neutral role badges + no system colours) reads as "premium quiet" for adult fintech but lands as "หมองหม่น/dull" for the actual primary audience — Thai secondary school students who live on iOS and respond to vibrancy.

The product owner explicitly rejected a full theme reset (ADR-0014 had only just landed) and locked the framing as **(B) Extend Calm Ledger** — keep the chrome philosophy (off-white body, pill buttons, rounded-2xl cards, Anuphan single family, true black text), but introduce colour through two disciplined vectors plus material depth and motion borrowed from iOS and Windows 11 design languages.

The reference image the product owner attached during the grill (iOS-style profile card with sky/cloud banner, circular avatar overlap, inset stats strip, soft shadows) sets the visual bar: vibrant in the hero/banner zone, calm in the data zone, layered by stacking surfaces rather than heavy drop shadows, smooth on interaction.

### What was rejected before the decision crystallised

- **Full replacement of ADR-0014** — 5 days old, would be brand whiplash; the rationale is not "Calm Ledger is wrong" but "Calm Ledger lacks colour vector and material depth for the student-facing surfaces"
- **iOS or Windows 11 native chrome skin** — both are OS chrome, not web app vocabularies; web emulation of Windows Mica is impossible (no wallpaper sampling) and pure iOS-Settings-in-a-browser-tab reads as "system pane stuck in Chrome"
- **Dark mode in Phase 11** — defer; Thai school audience runs light 95%+, dark would double the migration surface
- **Per-day or per-mood hero colour** — gimmicky, fights identity
- **Pink + purple in the system colour palette** — 6 system colours risks EdTech-loud slop; 4 disciplined colours (iOS Settings.app uses exactly this set) reads as system, not toy

## Decision

### 1. System colour palette (4 colours, semantic only)

Four iOS-style system colours carry interaction state and status across every role. Course identity and decoration use a separate palette (§ 2 below).

| Token | OKLCH (500) | Hex | Role |
|---|---|---|---|
| `--blue-500` | `oklch(0.62 0.20 250)` | `#0A84FF` | Primary action, links, focus, selection, "ส่ง"/"published" status |
| `--green-500` | `oklch(0.72 0.18 145)` | `#34C759` | Success, "ส่งแล้ว", "มาเรียน" |
| `--orange-500` | `oklch(0.74 0.18 65)` | `#FF9500` | Warning, "ใกล้กำหนดส่ง", "สาย" |
| `--red-500` | `oklch(0.62 0.22 25)` | `#FF3B30` | Destructive, "เลยกำหนด", "ขาดเรียน", critical audit |

Each colour ships in three weights: `-50` (tinted background), `-500` (saturated surface or marker), `-700` (text-on-tinted-bg). Body text on saturated `-500` requires the large-text threshold (≥18px or bold ≥14px) for green and orange; body-size text on those colours must use `-700` against `-50`.

**System Blue replaces true black as the primary action colour across every role.** `btn-primary` becomes blue for admin, teacher, and student alike. True black remains exclusive to body text, headings, and a small handful of structural moments (logo, divider strokes). This is the single biggest visual shift of ADR-0028.

### 2. Course identity colour (8 slots, content-level)

Each `Class` resolves deterministically to one of 8 course colour slots via `hash(class.id) % 8`. Phase 11 ships hash-derived only; admin override via a `Class.colorSlot Int?` column is **deferred to Phase 13**.

| Slot | Name | OKLCH (500) | Hex (500) | OKLCH (50 tinted) | Hex (50) |
|---|---|---|---|---|---|
| 0 | rose | `oklch(0.70 0.16 15)` | `#F56C7C` | `oklch(0.97 0.025 15)` | `#FEF1F3` |
| 1 | coral | `oklch(0.72 0.15 35)` | `#F58E6E` | `oklch(0.97 0.025 35)` | `#FEF3EE` |
| 2 | amber | `oklch(0.78 0.14 70)` | `#E8A646` | `oklch(0.97 0.03 70)` | `#FDF6E8` |
| 3 | lime | `oklch(0.78 0.16 130)` | `#94C944` | `oklch(0.97 0.03 130)` | `#F2FAEA` |
| 4 | teal | `oklch(0.70 0.13 180)` | `#3CB4AC` | `oklch(0.97 0.02 180)` | `#EBFAF8` |
| 5 | sky | `oklch(0.72 0.13 220)` | `#5EAEDB` | `oklch(0.97 0.02 220)` | `#EEF7FC` |
| 6 | indigo | `oklch(0.62 0.16 270)` | `#7A7AE5` | `oklch(0.97 0.02 270)` | `#EFF0FE` |
| 7 | violet | `oklch(0.65 0.16 305)` | `#B574D6` | `oklch(0.97 0.025 305)` | `#F8EEFB` |

Each slot also exposes a **gradient mesh** function (`getCourseSlotGradient(slot)`) that returns a CSS `radial-gradient` composition matching the slot hue — used as the banner zone of `.card-hero`. This is the Phase 11 stand-in for the photographic banner asset in the product owner's reference image; Phase 11D may upgrade to curated photographic backgrounds while keeping the slot API stable.

**Course colour is content-level, not chrome.** It appears as:
- Full chip in student-facing surfaces (feed, dashboard course grid)
- 4px left marker on teacher-facing list rows
- Banner gradient mesh on Class card hero surfaces (`/admin/dashboard`, `/teacher/courses/[id]`, `/student/courses/[id]` headers)
- A small coloured dot in admin admin-list contexts where space is tight

System colours and course colours are visually distinguishable: system colours are higher chroma + standard hues (Blue 250°, Green 145°, Orange 65°, Red 25°), course colours sit at medium chroma + 8 evenly-spaced hues. A user encountering a coloured chip should be able to read "this is content category" (course) vs "this is state" (system) by saturation profile alone.

### 3. Body background shift

`--bg` moves from `#F5F5F5` (true neutral) → `#F2F2F7` (iOS systemGroupedBackground — chroma 0.005 toward blue). The shift is intentionally small: it preserves ADR-0014's off-white discipline while introducing the subtlest blue undertone that makes System Blue pop without making the surface feel tinted. Surface white (`#FFFFFF`) and true black ink are unchanged.

### 4. Card variants — Aubergine retired

`.card-dark` (the aubergine `#2B2644` surface) is removed from the system. Aubergine never settled into a coherent role and was used in only one place in shipped code; replacing it with system-colour surfaces matches the new colour vector and removes the "where do I use aubergine" question.

New card vocabulary:

| Class | Visual | Use case |
|---|---|---|
| `.card` | White surface, rounded-2xl, hairline border, hover lift | Default container (unchanged from ADR-0014) |
| `.card-accent` | Saturated system colour surface (4 variants), white text | Hero CTAs, celebration moments, status banners that need volume |
| `.card-tinted` | Soft tinted bg (50-weight), colour-700 text (4 variants) | Callouts, info panels, status surfaces that need to stay calm |
| `.card-hero` | Banner zone (gradient mesh or photo) + content zone, soft drop shadow, optional avatar overlap | Class card on admin dashboard, course header on course page, student dashboard hero |
| `.panel-inset` | Inset rounded panel sitting inside a parent card, subtle bg tint, no shadow | Stats strip inside `.card-hero` (matches the inset KPI strip in the product owner's reference image) |

`.card-hero` and `.panel-inset` together encode the iOS layered-depth pattern: depth comes from stacking subordinate surfaces, not from heavy drop shadows.

### 5. Material glass scope (strict)

Frosted glass appears in exactly four places. Anywhere else is a violation of this ADR.

| Surface | Treatment |
|---|---|
| Sticky top nav | `.glass-nav` — frosted bg over scrolled content |
| Mobile bottom nav (student only) | `.glass-nav` — always-on frosted |
| Sheet/modal backdrop | Body blur when sheet open |
| Hero info bar inside `.card-hero` | Optional frosted strip overlay on banner (the bottom strip in product owner's reference image) |

Glass is **not** used on cards, sidebars, data tables, form inputs, or anything that contains body-size text being read. The blur strength is hybrid:

- Desktop: `backdrop-filter: blur(20px) saturate(180%)` (iOS strength)
- Mobile: `backdrop-filter: blur(12px) saturate(150%)` (Win11 strength — protects Android GPU)

When `backdrop-filter` is unsupported, fall back to `rgba(255, 255, 255, 0.95)` solid via `@supports` query.

Windows 11 Mica is intentionally not emulated. Mica derives its tint from the OS desktop wallpaper — the web has no equivalent input. Translating Mica into web means rendering iOS-style frosted glass at lower blur strength, which is what the mobile branch above does.

### 6. Motion — iOS spring 3-tier

A single curve (`cubic-bezier(0.32, 0.72, 0, 1)` — iOS UIView spring) at three duration ceilings. Universal across the system per the product owner's Q6 lock; the duration ceiling guards against the lock breaking flow in data entry surfaces.

| Tier | Duration | Curve | Applied to |
|---|---|---|---|
| `--spring-micro` | 80ms | iOS spring | Button press scale (0.97→1), checkbox toggle, switch thumb |
| `--spring-standard` | 180ms | iOS spring | Tab switch, hover lift, dropdown open, chip filter swap, dialog backdrop fade |
| `--spring-large` | 280ms | iOS spring | Sheet slide-in, modal open, page transition, accordion expand |

Form input focus does **not** spring. Focus uses a 100ms instant border swap; spring on a focus border ring would make rapid Tab-Enter data entry (teacher grade entry, attendance grid) feel laggy.

`prefers-reduced-motion: reduce` collapses every spring to `100ms ease-out`. Not instant — instant is jarring; 100ms preserves "change happened here" without choreography.

### 7. Pattern 7 dialog — CSS @media split (centered desktop, sheet mobile)

The native `<dialog>` element remains the implementation primitive (Pattern 7 — Phase 3 hotfix for Next 16 + React 19 + Turbopack). A new `.sheet` class on the dialog applies a `@media (max-width: 768px)` rule that:

1. Repositions the dialog to the bottom edge of the viewport
2. Replaces the centered-modal entry animation with a slide-up via `--spring-large`
3. Adds a translucent body backdrop with blur (per § 5 scope)
4. Caps height at 90vh + adds rounded-top-2xl corners

Desktop unchanged — centered modal continues as ADR-0014/Pattern 7. The split is CSS-only; no JS branching, no separate component, no duplicate state.

### 8. Role-modulated rendering

Visual vibrancy and density scale by role, but the underlying token system is identical. This is a rendering decision, not a token decision.

| Role | Vibrancy | Course colour exposure | Chrome |
|---|---|---|---|
| **Student** | Maximum | Full chips, hero gradient mesh banners, tinted KPI cards by status | Mobile-first, glass bottom nav, large touch targets |
| **Teacher** | Medium | 4px left marker on course list rows, status colours only on chips, calm card chrome | Desktop-first, no decorative gradient on chrome |
| **Admin** | Low (default) | Coloured dot or small chip in lists, neutral grayscale role badges (unchanged from ADR-0014) | Dense, audit-lens, critical-audit red ring preserved |

**Exception — gallery views.** When admin or teacher views a *list of things* (`/admin/dashboard` class cards, course pages, etc.) where glanceable visual differentiation aids scanning, full `.card-hero` treatment with course-slot gradient mesh banners is permitted. This is the explicit exception the product owner surfaced via the reference image — admin scanning 30-40 classes benefits from the same vibrancy student gets on the feed, because the task is visual scanning, not data entry.

### 9. New utility classes (7 total)

```
.glass-nav        sticky frosted nav (top + mobile-bottom)
.sheet            mobile bottom-sheet variant of <dialog>
.card-accent      saturated coloured card (4 variants per system colour)
.card-tinted      subtle tinted card (4 variants per system colour)
.card-hero        banner-zone + content-zone card with course slot gradient
.panel-inset      inset stats strip inside a parent card
.springy          button press scale 0.97→1 via --spring-micro
```

Plus modified primitives:
- `.btn-primary` — switches from `bg-black` to `bg-blue-500` with subtle inset white-15 highlight along the top edge (iOS pressed-glass feel)
- `.btn-tinted` — new soft-blue variant (`bg-blue-50 text-blue-700`) for soft secondary actions where `.btn-secondary` white is too quiet
- `.input` — focus ring shifts from black 2px to blue 2px + subtle blue/20 glow (iOS pressed-state feel; respects `prefers-reduced-motion` by dropping the glow)

### 10. CountUp number animation

KPI numbers in dashboards animate from 0 → target via `useCountUp(target, duration=600ms)`. ease-out-quart curve, rAF-driven. `prefers-reduced-motion: reduce` short-circuits to render the target instantly. Bounded to **dashboard KPI cards only** — not used in tables, not used on the feed, not used as a decoration.

## Consequences

### Positive

- The "หมองหม่น" diagnosis is addressed by the smallest possible change: 4 system colours + 8 course colours layered on top of ADR-0014's structure. No existing component is rewritten — only `.btn-primary`/`.input` focus/`.card-dark` change, and `.card-dark` was used in one place
- iOS Settings-style System Blue as universal primary action gives the product the "native iOS feel" the product owner identified without skinning the chrome as iOS
- Course slot colour gives each class an identity that students will associate with the subject ("วิทยาศาสตร์ = teal, ศิลปะ = rose"), turning the dashboard from a list into a map
- Role-modulated rendering keeps the teacher data-entry experience calm — the data-heavy surfaces ADR-0014 protected (gradebook, audit log, attendance grid) keep their neutral chrome
- Anuphan, weight-600 ceiling, no-uppercase eyebrows, rounded-full pills, rounded-2xl cards, 65-75ch line length — all unchanged. The discipline that made ADR-0014 readable carries forward
- Glass scope is small and named — frosted nav, sheet backdrop, hero info bar, nothing else. The "glassmorphism everywhere" 2024 SaaS trap is structurally avoided

### Negative

- Aubergine `#2B2644` is retired with no equivalent; pages or designs that wanted "a dark moment of contrast" must reach for `.card-accent` blue or a `.card-hero` with darker gradient mesh instead
- The compat shims in `app/globals.css` left over from ADR-0014 (`.mesh-bg`, `.blob`, `.sheen`, `.glass`, `.tilt-card`, `.text-gradient-gold`, etc.) continue to exist as no-ops; ADR-0028 does not remove them because the Phase 11 scope is chrome + 3 critical pages only (Login, Admin Dashboard, Student Dashboard placeholder) — Phase 11D and later phases will retire shims as each surface is touched
- The 8 course colour slots are hash-derived; admins cannot pick "this class is the rose class" until Phase 13 ships the schema column + override UI. The hash is deterministic and stable across deploys (`hash(class.id) % 8`), so the assignment is consistent — just not configurable
- The product owner's reference image used photographic 3D-rendered sky/cloud banners; Phase 11 ships CSS gradient mesh as the stand-in. Visual gap closes when Phase 11D or later commissions the photographic asset set
- System Blue replacing true black on primary actions weakens the "audit gravity" feel ADR-0014 gave admin surfaces; the compensation is that admin primary buttons are rare (most admin pages are read-only), and System Blue still reads as serious next to grayscale role badges and neutral chrome

### Rejected alternatives

- **Pink + purple in the system palette (6 colours)** — would cross the line into EdTech loud (PRODUCT.md anti-reference: "EdTech ไทยเดิม — สีส้ม+ฟ้า+เหลือง loud"); 4 system colours matches iOS Settings.app's discipline
- **Per-role primary action colour (admin black, teacher black, student blue)** — fragments the design system into 3 variants for one token; the product owner picked universal blue (Q3.b lock)
- **Photographic banner assets shipped in Phase 11** — adds asset sourcing + curation + license review; defer to Phase 11D and ship CSS gradient mesh first as a working visual
- **Schema column for course colour customization in Phase 11** — would add a migration for a configurability question with no current user demand; hash-derived is good enough until a teacher complains
- **Universal native bottom sheet instead of @media split** — desktop ครู+admin use keyboard inside Pattern 7 dialogs; sheet-from-bottom on desktop wastes vertical real estate and breaks the keyboard mental model
- **Tilt3D ported from Father project to dashboard hero** — ADR-0014 retired tilt, motion-as-decoration; bringing it back as the dashboard signature would contradict the discipline this ADR is supposed to preserve

### Follow-ups

- Phase 11D — teacher dashboard hero + 4 KPI cards, student dashboard full hero + today's class + Due Soon + Course grid, CountUp wired to all KPI values, per-course chips rolled out across feed + dashboard, optional 6-preset student hero bg picker (localStorage in 11D, schema in 13)
- Phase 12 — landing page with photographic banner asset set, optional Win11 Fluent reveal cursor light, real screenshots of the new theme
- Phase 13 — `Class.colorSlot Int?` schema column + admin override UI in `/admin/setup` → Class tab; `Student.heroBgPreset Int?` schema column + persistence promotion from localStorage
- Surface-by-surface compat shim cleanup — remove `.mesh-bg`/`.blob`/`.sheen`/`.glass`/`.tilt-card`/`.text-gradient-*` from `app/globals.css` as the last page consuming each shim is migrated
- Photographic banner asset commission — 8 abstract 3D-rendered backgrounds matching the 8 course colour slots, served as WebP from R2 or `/public`, swapped into `.card-hero` via the same slot API

## References

- Extended ADR: `docs/adr/0014-theme-calm-ledger-supersedes-ink-gold.md`
- Phase 11 grill transcript: this session (Q0 framing → Q1-Q6 colour locks → Q4-sub/Q5-sub/Q6-sub refinement → mid-grill ref image → final plan)
- Product owner reference image: iOS-style profile card with sky/cloud banner, circular avatar overlap, inset stats strip (attached during mid-grill, anchors `.card-hero` and `.panel-inset` shape)
- Companion edits same commit batch: `DESIGN.md` (rewritten §2/§4/§5/§6 + new §7 motion + §8 role matrix), `.impeccable/design.json` (synced), `app/globals.css` (token rewrite + 7 new utility classes + modified primitives), `lib/theme/course-color.ts` (new — slot resolution + gradient mesh function), `components/ui/course-color-chip.tsx` (new), `components/ui/bottom-sheet.tsx` (new), `lib/hooks/use-count-up.ts` (new), targeted page sweeps for Login + Admin Dashboard + Student Dashboard placeholder
- Anuphan font and IBM Plex Sans Thai font configuration in `app/layout.tsx` unchanged
- Compat shims for retired Ink+Gold utilities remain in `app/globals.css` until per-surface migration retires the last consumer

---
name: Studennnn
description: ระบบจัดการห้องเรียนสำหรับโรงเรียนไทย — Calm Ledger v2 theme (ADR-0028 extends ADR-0014)
colors:
  bg: "#f2f2f7"
  surface: "#ffffff"
  ink: "#000000"
  ink-soft: "rgba(0,0,0,0.70)"
  ink-mute: "rgba(0,0,0,0.50)"
  ink-faint: "rgba(0,0,0,0.25)"
  hairline: "rgba(0,0,0,0.08)"
  hairline-strong: "rgba(0,0,0,0.16)"
  blue-50: "#eff6ff"
  blue-500: "#0a84ff"
  blue-700: "#1e40af"
  green-50: "#ecfdf5"
  green-500: "#34c759"
  green-700: "#15803d"
  orange-50: "#fff7ed"
  orange-500: "#ff9500"
  orange-700: "#c2410c"
  red-50: "#fef2f2"
  red-500: "#ff3b30"
  red-700: "#b91c1c"
courseColors:
  rose: { 500: "#f56c7c", 50: "#fef1f3" }
  coral: { 500: "#f58e6e", 50: "#fef3ee" }
  amber: { 500: "#e8a646", 50: "#fdf6e8" }
  lime: { 500: "#94c944", 50: "#f2faea" }
  teal: { 500: "#3cb4ac", 50: "#ebfaf8" }
  sky: { 500: "#5eaedb", 50: "#eef7fc" }
  indigo: { 500: "#7a7ae5", 50: "#eff0fe" }
  violet: { 500: "#b574d6", 50: "#f8eefb" }
typography:
  display:
    fontFamily: "var(--font-anuphan), system-ui, sans-serif"
    fontSize: "clamp(2.5rem, 5vw, 4rem)"
    fontWeight: 600
    lineHeight: 1.05
    letterSpacing: "-0.04em"
  headline:
    fontFamily: "var(--font-anuphan), system-ui, sans-serif"
    fontSize: "clamp(2rem, 4vw, 3rem)"
    fontWeight: 500
    lineHeight: 1.1
    letterSpacing: "-0.03em"
  title:
    fontFamily: "var(--font-anuphan), system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 500
    lineHeight: 1.3
    letterSpacing: "-0.02em"
  body:
    fontFamily: "var(--font-anuphan), system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "var(--font-anuphan), system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 500
    lineHeight: 1.4
rounded:
  xl: "12px"
  "2xl": "16px"
  "3xl": "24px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
  "2xl": "48px"
motion:
  curve: "cubic-bezier(0.32, 0.72, 0, 1)"
  micro: "80ms"
  standard: "180ms"
  large: "280ms"
  reducedMotion: "100ms ease-out"
glass:
  blurDesktop: "blur(20px) saturate(180%)"
  blurMobile: "blur(12px) saturate(150%)"
  bg: "rgba(242,242,247,0.72)"
  fallback: "rgba(255,255,255,0.95)"
components:
  button-primary:
    backgroundColor: "{colors.blue-500}"
    textColor: "{colors.surface}"
    rounded: "{rounded.full}"
    padding: "10px 28px"
    highlight: "inset 0 1px 0 rgba(255,255,255,0.15)"
  button-primary-hover:
    backgroundColor: "#0070EB"
    textColor: "{colors.surface}"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.full}"
    padding: "10px 28px"
  button-tinted:
    backgroundColor: "{colors.blue-50}"
    textColor: "{colors.blue-700}"
    rounded: "{rounded.full}"
    padding: "10px 28px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink-soft}"
    rounded: "{rounded.full}"
    padding: "10px 24px"
  button-danger:
    backgroundColor: "{colors.red-500}"
    textColor: "{colors.surface}"
    rounded: "{rounded.full}"
    padding: "10px 28px"
  card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.2xl}"
    padding: "28px"
  card-accent:
    backgroundColor: "{colors.{blue|green|orange|red}-500}"
    textColor: "{colors.surface}"
    rounded: "{rounded.2xl}"
    padding: "28px"
  card-tinted:
    backgroundColor: "{colors.{blue|green|orange|red}-50}"
    textColor: "{colors.{blue|green|orange|red}-700}"
    rounded: "{rounded.2xl}"
    padding: "28px"
  card-hero:
    bannerHeight: "120px"
    bannerBackground: "course-slot gradient mesh"
    contentBackground: "{colors.surface}"
    rounded: "{rounded.3xl}"
    shadow: "0 8px 32px rgba(0,0,0,0.06)"
  panel-inset:
    backgroundColor: "rgba(0,0,0,0.025)"
    rounded: "{rounded.xl}"
    padding: "16px"
    shadow: "inset 0 1px 0 rgba(0,0,0,0.04)"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.xl}"
    padding: "10px 16px"
    focusRing: "ring-2 {colors.blue-500} + glow rgba(10,132,255,0.20)"
  badge:
    backgroundColor: "rgba(0,0,0,0.05)"
    textColor: "{colors.ink}"
    rounded: "{rounded.full}"
    padding: "2px 10px"
---

# Design System: Studennnn — Calm Ledger v2

## 1. Overview

**Creative North Star: "Calm Ledger v2 — friendly, layered, smooth."**

Studennnn keeps the discipline of a premium private-banking app — off-white body, true black ink, Anuphan single-family typography, pill geometry, rounded-2xl cards — and adds back the colour and material depth that ADR-0014 stripped out. The chrome stays calm; the content carries colour. The interaction layer borrows the iOS spring curve at three durations and the iOS frosted-glass vocabulary in four named places. Windows 11's contribution is the sense of smooth, layered depth, achieved by stacking subordinate surfaces rather than emulating Mica.

The result reads as a system that an iOS-fluent Thai teenager opens without thinking "this is an old school portal" and a Thai homeroom teacher uses for fifty student grade entries without thinking "this is fighting me." The product owner's pain that ADR-0028 addresses, verbatim: *"ผมต้องการ Layout หรือ ธีมสีโดยรวมให้มันสดใสกว่านี้ เพราะตอนนี้ Project จืดมาก ไม่มีสีสัน."*

The system continues to reject four neighbourhoods PRODUCT.md calls out by name: government ERP (Bootstrap 3, Tahoma, desktop-only), Thai EdTech default (orange+blue+yellow loud + mascots + Cordia), Google Classroom Material (generic), and generic AI-SaaS landing slop. Premium fintech as a family — Halo, Linear, Stripe Sessions — remains the aesthetic lane. iOS Settings.app is the colour-and-interaction reference, not the chrome reference.

This system **extends ADR-0014** via ADR-0028. It does NOT supersede.

**Key Characteristics**
- Off-white body (`#F2F2F7` — iOS systemGroupedBackground), true black ink, white card surfaces
- **System Blue** (`#0A84FF`) as universal primary action across every role
- 4-colour iOS-style system palette (Blue / Green / Orange / Red) for interaction state + status semantics
- 8-slot course identity palette resolved by `hash(class.id)` — rose / coral / amber / lime / teal / sky / indigo / violet
- Single typeface (Anuphan — Cadson Demak), weight 600 ceiling, negative letter-spacing on display/headline/title
- Pill geometry for actions (`rounded-full`), 2xl for cards (`16px`), 3xl for `.card-hero` (`24px`)
- Material depth via layered surfaces (`.card-hero` banner+content split, `.panel-inset` stats strip) — not heavy shadows
- Frosted glass strictly scoped: top nav, mobile bottom nav, sheet backdrop, hero info bar
- Motion = iOS spring curve at three duration tiers (80 / 180 / 280ms), form-focus instant, reduced-motion → 100ms ease-out
- Role-modulated rendering: student maximum vibrancy / teacher 4px markers + status colours / admin neutral with gallery exception

## 2. Colors: System + Course + Off-White

The system layers in three parts:

1. **Neutral chrome** — off-white body, white surfaces, true black ink, hairline borders — carries the calm
2. **System colours** (4) — Blue, Green, Orange, Red — carry interaction state and status semantics
3. **Course colours** (8 slots) — rose, coral, amber, lime, teal, sky, indigo, violet — carry per-class identity

### Neutral chrome

| Token | Value | Use |
|---|---|---|
| `--bg` | `#F2F2F7` | Body background — iOS systemGroupedBackground (shifted from ADR-0014's `#F5F5F5`) |
| `--surface` | `#FFFFFF` | Card backgrounds, inputs, sheet bg |
| `--ink` | `#000000` | Primary text, headings, structural strokes |
| `--ink-soft` | `rgba(0,0,0,0.70)` | Body paragraph text |
| `--ink-mute` | `rgba(0,0,0,0.50)` | Captions, eyebrows, metadata |
| `--ink-faint` | `rgba(0,0,0,0.25)` | Placeholder hints, disabled |
| `--hairline` | `rgba(0,0,0,0.08)` | Invisible borders, ring on inputs |
| `--hairline-strong` | `rgba(0,0,0,0.16)` | Hover ring, focus accent fallback |

### System colours (4 — semantic only)

Each colour has three weights: `-50` (tinted bg), `-500` (saturated surface or marker), `-700` (text on tinted bg).

| Colour | Hex (500) | OKLCH | Hex (50) | Hex (700) | Role |
|---|---|---|---|---|---|
| **Blue** | `#0A84FF` | `oklch(0.62 0.20 250)` | `#EFF6FF` | `#1E40AF` | Primary action, link, focus, selection, published status |
| **Green** | `#34C759` | `oklch(0.72 0.18 145)` | `#ECFDF5` | `#15803D` | Success, ส่งแล้ว, มาเรียน |
| **Orange** | `#FF9500` | `oklch(0.74 0.18 65)` | `#FFF7ED` | `#C2410C` | Warning, ใกล้กำหนดส่ง, สาย |
| **Red** | `#FF3B30` | `oklch(0.62 0.22 25)` | `#FEF2F2` | `#B91C1C` | Destructive, เลยกำหนด, ขาดเรียน, critical audit |

**Contrast verification (white text on -500):** Blue 4.8:1 ✅, Green 3.4:1 ⚠ (large text only), Orange 3.2:1 ⚠ (large text only), Red 4.6:1 ✅. **Body-size text on saturated Green or Orange must use `-700` against `-50` tinted background.**

### Course colours (8 slots — content identity)

Each `Class.id` resolves deterministically to one slot via `hash(id) % 8`. Phase 11 ships hash-derived only; admin override defers to Phase 13.

| Slot | Name | -500 Hex | -50 Hex |
|---|---|---|---|
| 0 | rose | `#F56C7C` | `#FEF1F3` |
| 1 | coral | `#F58E6E` | `#FEF3EE` |
| 2 | amber | `#E8A646` | `#FDF6E8` |
| 3 | lime | `#94C944` | `#F2FAEA` |
| 4 | teal | `#3CB4AC` | `#EBFAF8` |
| 5 | sky | `#5EAEDB` | `#EEF7FC` |
| 6 | indigo | `#7A7AE5` | `#EFF0FE` |
| 7 | violet | `#B574D6` | `#F8EEFB` |

Each slot also exposes a **gradient mesh** via `getCourseSlotGradient(slot)` — a CSS `radial-gradient` composition used as the banner zone of `.card-hero`. Phase 11 stand-in for photographic banner; Phase 11D may swap to curated WebP assets while keeping the slot API stable.

### Named rules

**The System-Blue-Is-Action Rule.** `#0A84FF` is the primary action surface across every role — admin, teacher, student. True black is reserved for text, headings, and structural strokes. Aubergine is retired.

**The Course-Colour-Is-Content Rule.** Course colour appears on content (chips, hero banners, list markers), never on chrome (nav, sidebar, primary buttons, body background). A red `.card-accent` is a system-red status surface, not the "red course."

**The Saturation-Distinguishes-Layer Rule.** System colours are higher chroma (`0.18-0.22`); course colours are medium chroma (`0.13-0.16`). A user reads a saturated chip as "state" and a softer chip as "content category" by saturation alone, without learning the palette.

**The True-Black-For-Text Rule.** Primary text and headings stay `#000000` exact. No `slate-900`, no `#1a1a1a`. Almost-black softening reads as indecision.

**The No-Saturated-Role-Colour Rule.** Admin / Teacher / Student badges remain neutral grayscale, unchanged from ADR-0014. Role differentiation moves to placement and labels; system colours are reserved for state, course colours for content category. (ADR-0028 keeps this rule from ADR-0014.)

## 3. Typography

Unchanged from ADR-0014. Anuphan single family, weight 600 ceiling, negative letter-spacing on display/headline/title, body line-height ≥ 1.6.

**Display / Headline / Title / Body / Label:** Anuphan (`var(--font-anuphan)`, fallback `system-ui, sans-serif`).
**Mono:** `ui-monospace, SFMono-Regular` for student IDs and class codes only.

### Hierarchy
- **Display** (weight 600, `clamp(2.5rem, 5vw, 4rem)`, letter-spacing `-0.04em`, line-height 1.05): Hero h1
- **Headline** (weight 500, `clamp(2rem, 4vw, 3rem)`, letter-spacing `-0.03em`): Section h2
- **Title** (weight 500, `1.5rem`, letter-spacing `-0.02em`): Card titles
- **Body** (weight 400, `1rem`, line-height 1.6): Default body. Cap prose at 65-75ch.
- **Label** (weight 500, `0.875rem`): Eyebrows, captions. No uppercase by default.
- **Mono** (weight 400, `0.875rem`): Student IDs, class codes.

### Named rules (unchanged from ADR-0014)

**The Anuphan-Only Rule.** No serif. No second display font. **The 600-Ceiling Rule.** Weight 600 is the heaviest. **The No-Uppercase-Eyebrow Rule.** Section eyebrows stay sentence case. **The Negative-Tracking-Floor Rule.** Display ≥ `-0.04em`, headline `-0.03em`, title `-0.02em`. **The Thai Line-Height Rule.** Body line-height ≥ 1.6.

## 4. Elevation and Material Depth

Two complementary systems: **shadow elevation** (cards lift on hover, hero card sits with soft drop shadow) and **material layering** (subordinate surfaces stacked inside parents to create depth without shadow weight).

### Shadow vocabulary

- **Resting (`shadow-none`):** Cards default flat. Their `rounded-2xl` + hairline border carry the affordance.
- **Hover lift (`shadow-lift`):** `0 4px 24px rgba(0,0,0,0.06), 0 2px 6px rgba(0,0,0,0.04)`. Cards lift on hover via `--spring-standard`.
- **Featured (`shadow-card`):** `0 8px 32px rgba(0,0,0,0.06)`. Reserved for `.card-hero` and large featured surfaces.
- **Inset (`shadow-inset`):** `inset 0 1px 0 rgba(0,0,0,0.04)`. Subtle inner highlight for `.panel-inset` stats strip.

### Material layering — the depth pattern

`.card-hero` + `.panel-inset` together encode the iOS layered-depth move. A `.card-hero` is a single card with two zones: a coloured banner zone at the top, a white content zone below. Inside the content zone, a `.panel-inset` strip sits as a subordinate surface — same parent card, lower visual elevation, slight inner-shadow hint that it's recessed. The product owner's reference image shows this exact pattern: bold sky/cloud banner, content area below, KPI stats strip inset within the content area.

This is the answer to "how do you add depth without heavy shadows." Stack surfaces, don't elevate them.

### Glass material (strict scope)

Frosted glass appears in exactly four places. Anywhere else is a violation of ADR-0028.

| Surface | Treatment |
|---|---|
| Sticky top nav | `.glass-nav` over scrolled content |
| Mobile bottom nav (student only) | `.glass-nav` always-on |
| Sheet backdrop | Body blur when `.sheet` open |
| Hero info bar | Optional frosted strip overlay on `.card-hero` banner |

**Blur strength is hybrid:**
- Desktop: `backdrop-filter: blur(20px) saturate(180%)` — iOS strength
- Mobile: `backdrop-filter: blur(12px) saturate(150%)` — Win11 strength, protects Android GPU

**Fallback:** `@supports not (backdrop-filter: blur(1px))` → solid `rgba(255,255,255,0.95)`.

**Never** on: cards (other than the hero info bar), sidebars, data tables, form inputs, body text containers.

### Named rules

**The Flat-By-Default Rule.** Resting cards have no shadow; rounded-2xl + hairline carry the affordance.
**The Material-By-Layering Rule.** Depth comes from stacked surfaces (`.card-hero` + `.panel-inset`), not from drop shadow weight.
**The Glass-Is-Chrome-Only Rule.** Frosted glass lives on nav, sheet backdrop, hero info bar — never on cards or content surfaces.

## 5. Components

### Buttons

All pills (`rounded-full`). Padding `10px 28px` standard, `6px 18px` `.btn-sm`. Weight 500. Press feedback via `.springy` class (scale 0.97→1 over `--spring-micro`).

- **Primary (`.btn-primary`):** `bg-blue-500 text-white` with inset white-15 highlight along top edge (iOS pressed-glass feel). Hover darkens to `#0070EB`. Active applies `.springy` scale. **Universal across every role.**
- **Secondary (`.btn-secondary`):** `bg-white text-black ring-1 ring-black/10`. Hover `ring-black/20`. Neutral fallback when primary is taken.
- **Tinted (`.btn-tinted`):** `bg-blue-50 text-blue-700`. Soft secondary for "ดูทั้งหมด" / "ไปที่ห้องเรียน" — quieter than `.btn-primary`, more visible than `.btn-ghost`.
- **Ghost (`.btn-ghost`):** `text-black/70 hover:text-black hover:bg-black/[0.05]`. Tertiary.
- **Danger (`.btn-danger`):** `bg-red-500 text-white hover:bg-red-700`. Destructive only.

### The arrow-circle pattern (signature)

Black pill with trailing white circular badge containing an arrow. Used for hero CTA and landing-page section CTAs. With ADR-0028, the pill body switches from `bg-black` to `bg-blue-500` to match the new primary; the trailing circle remains `bg-white`. Arrow translates `1.5px` right on group-hover.

### Cards

| Class | Shape | Surface | Use |
|---|---|---|---|
| `.card` | rounded-2xl | white | Default container |
| `.card-accent` | rounded-2xl | system colour -500 | Saturated hero CTAs, celebration moments |
| `.card-tinted` | rounded-2xl | system colour -50 | Soft callouts, status banners |
| `.card-hero` | rounded-3xl | banner zone (course slot gradient) + content zone (white) | Class card, course header, dashboard hero |
| `.panel-inset` | rounded-xl | `rgba(0,0,0,0.025)` + inner shadow | Subordinate strip inside `.card-hero` content zone |
| `.card-image` | rounded-2xl | full-bleed background image | Landing surfaces (Phase 12) |

`.card-dark` (aubergine) is **removed**. Pages still referencing it must migrate to `.card-accent` blue or another system colour.

### Inputs

- **Shape:** `rounded-xl` (12px)
- **Resting:** `bg-white` + `ring-1 ring-black/10`
- **Hover:** `ring-black/20`
- **Focus:** `ring-2 ring-blue-500` + outer subtle glow `rgba(10,132,255,0.20)` (iOS pressed-state feel). `prefers-reduced-motion: reduce` drops the glow but keeps the ring.
- **Placeholder:** `text-black/40` (5.7:1 on white ✅)

### Badges

- **Shape:** `rounded-full`, padding `2px 10px`, text 12px weight 500
- **Default:** `bg-black/[0.05] text-black ring-1 ring-black/[0.08]`
- **Status variants:** `.badge-success` green-tinted, `.badge-warn` orange-tinted, `.badge-danger` red-tinted, `.badge-info` blue-tinted — all use `-50` bg + `-700` text
- **Role variants** (`admin`, `teacher`, `student`): **All neutral grayscale.** Unchanged from ADR-0014.
- **Behaviour:** Static. No hover.

### Tables

Unchanged from ADR-0014. Wrapper `rounded-2xl bg-white`, header 13px weight 500 `text-black/50` no uppercase, rows `border-black/5` divider with `bg-black/[0.02]` hover, cell padding `12px 16px`.

### Stats (KPI cards)

- **Container:** `.stat` = `rounded-2xl bg-white p-6` with `shadow-lift` on hover
- **Label:** 12px weight 500 `text-black/60`. No uppercase.
- **Value:** 36-40px weight 600 tracking `-0.02em`. Default `text-black`; `.card-tinted` variant uses the colour `-700` shade.
- **CountUp:** Wire `useCountUp(target, 600ms)` on initial render. `prefers-reduced-motion: reduce` → instant.

### Modals — Pattern 7 dialog + sheet variant

Native `<dialog>` element remains the implementation primitive (Pattern 7 — Phase 3 hotfix). Two presentations:

- **Desktop (default):** Centered modal. Backdrop fade via `--spring-standard`. Content fade-in.
- **Mobile (`@media max-width: 768px`, opt-in via `.sheet` class):** Bottom sheet. Slides up via `--spring-large`. Body backdrop blur. Rounded-top-2xl. Cap height at 90vh. Optional swipe-to-dismiss (Phase 11D).

Same `<dialog>` element, CSS-only branching. No separate JS, no duplicate state.

### Hero card surface (signature)

`.card-hero` carries the product's signature visual move. Structure:

```
┌─────────────────────────┐  rounded-3xl
│  Banner zone (120px)    │  course slot gradient mesh
│   (optional avatar      │
│    circle overlap ─────┐│
└────────────────────────┼┘
│  Content zone (white)  ││
│  - Title                │  bold name
│  - Subtitle             │  small supporting
│  ┌──────────────────┐  │
│  │ Panel inset      │  │  subordinate KPI strip
│  │ (stats grid)     │  │
│  └──────────────────┘  │
│  - CTA / action row     │
└─────────────────────────┘
shadow: 0 8px 32px rgba(0,0,0,0.06)
```

Banner gradient is the course slot's mesh (8 slots, hash-derived). Phase 11D may swap to photographic WebP backgrounds; the slot API is stable.

## 6. Motion

Single curve (`cubic-bezier(0.32, 0.72, 0, 1)` — iOS UIView spring) at three duration tiers, universal across the system.

| Tier | Token | Duration | Applied to |
|---|---|---|---|
| Micro | `--spring-micro` | 80ms | Button press scale (0.97→1), checkbox toggle, switch thumb |
| Standard | `--spring-standard` | 180ms | Tab switch, hover lift, dropdown open, chip filter swap, dialog backdrop fade |
| Large | `--spring-large` | 280ms | Sheet slide-in, modal open, page transition, accordion expand |

**Form input focus does NOT spring.** Focus uses a 100ms instant border swap to avoid lag in rapid Tab-Enter data entry (teacher gradebook, attendance grid).

**Reduced motion:** `prefers-reduced-motion: reduce` collapses every spring to `100ms ease-out`. Not instant — instant is jarring; 100ms preserves "change happened" without choreography.

**CountUp** runs on rAF ease-out-quart at 600ms. Reduced-motion short-circuits to render target instantly. Bounded to dashboard KPI cards only.

### Named rules

**The Spring-Curve-Is-Universal Rule.** Single iOS spring curve everywhere — no Material easing, no custom curves per surface, no bouncy elastic.
**The Form-Focus-Is-Instant Rule.** Input focus border swaps in 100ms ease-out, never sprung. Data entry surfaces depend on this.
**The Reduced-Motion-Is-Not-Instant Rule.** 100ms ease-out preserves change-happened signal. Instant transitions disorient users with vestibular sensitivity *less* than slow ones.

## 7. Role Modulation Matrix

Same tokens, different rendering by role. This is a rendering decision, not a token decision.

| Aspect | Admin | Teacher | Student |
|---|---|---|---|
| Vibrancy default | Low | Medium | Maximum |
| Course colour exposure | Coloured dot or small chip in lists; **exception:** full `.card-hero` on `/admin/dashboard` class cards (gallery view) | 4px left marker on course list rows, status colours on chips | Full chips on feed, hero gradient mesh banners, tinted KPI cards |
| Chrome | Dense, audit-lens; critical audit red ring preserved | Desktop-first calm workspace | Mobile-first, glass bottom nav, large touch targets |
| Role badge | Neutral grayscale | Neutral grayscale | Neutral grayscale |
| Primary action | System Blue | System Blue | System Blue |
| Sheet vs modal | Centered modal (desktop keyboard flow) | Centered modal (desktop keyboard flow) | Sheet on mobile, modal on desktop |

**The Gallery-Exception Rule.** When admin or teacher views a *list of things* where glanceable visual differentiation aids scanning (admin dashboard class cards, teacher courses overview), the full `.card-hero` treatment with course-slot gradient mesh banner is permitted regardless of the role's default vibrancy setting. The task is visual scanning, not data entry.

## 8. Do's and Don'ts

### Do
- **Do** anchor every page in true black text (`#000000`) on off-white body (`#F2F2F7`) or white surface (`#FFFFFF`)
- **Do** use System Blue (`#0A84FF`) for all primary actions across every role
- **Do** use course slot colours on content (chips, hero banners, list markers), never on chrome
- **Do** use `rounded-full` for pills, `rounded-2xl` for cards, `rounded-3xl` for `.card-hero`
- **Do** apply negative letter-spacing on display + headline + title (`-0.04em` to `-0.02em`)
- **Do** keep weight 600 as the heaviest ceiling — no weight 700 anywhere
- **Do** use Anuphan for everything. Single family.
- **Do** layer subordinate surfaces (`.panel-inset` inside `.card-hero`) for depth, not heavier shadows
- **Do** keep frosted glass to the four named places: top nav, mobile bottom nav, sheet backdrop, hero info bar
- **Do** use iOS spring curve at the three duration tiers; form focus stays instant
- **Do** wrap motion in `prefers-reduced-motion: reduce` → 100ms ease-out (not instant)
- **Do** verify body-size text contrast — Green-500 and Orange-500 only support large text in white; body must use -700 on -50
- **Do** apply `.card-hero` to admin dashboard class cards (gallery exception)

### Don't
- **Don't** use almost-black softening (`#1a1a1a`, `slate-900`). Primary text is `#000000` exactly.
- **Don't** use aubergine. ADR-0028 retires it.
- **Don't** use weight 700 (bold) anywhere. 600 is the ceiling.
- **Don't** use uppercase tracked eyebrows. Sentence-case 0.875rem weight 500.
- **Don't** use saturated semantic colours for role badges. Role badges are neutral grayscale.
- **Don't** use gradient text. (Impeccable absolute ban; ADR-0014 ban preserved.)
- **Don't** use frosted glass on cards, sidebars, data tables, form inputs, or body text containers.
- **Don't** spring a form input focus ring. 100ms instant border swap.
- **Don't** add a second display font.
- **Don't** uppercase Thai script.
- **Don't** use `border-left` greater than 1px as a coloured stripe (Impeccable absolute ban).
- **Don't** nest cards inside cards. (`.panel-inset` inside `.card-hero` is a subordinate panel, not a nested card — visually distinct, lower elevation, not tappable.)
- **Don't** put body text on saturated `.card-accent` Green or Orange. Use large text or switch to `.card-tinted` + `-700` text.
- **Don't** style like government ERP, Thai EdTech default, Google Classroom Material, or AI-SaaS slop. (PRODUCT.md anti-references.)
- **Don't** emulate Windows 11 Mica directly. Web has no wallpaper to sample. Translate Mica intent into iOS-style frosted glass at lower blur strength.

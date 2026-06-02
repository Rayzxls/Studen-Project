---
name: Studennnn
description: ระบบจัดการห้องเรียนสำหรับโรงเรียนไทย — Calm Ledger theme (ADR-0014)
colors:
  bg: "#f5f5f5"
  surface: "#ffffff"
  ink: "#000000"
  ink-soft: "#4d4d4d"
  ink-mute: "#808080"
  accent: "#2b2644"
  accent-text: "#ffffff"
  border: "#ebebeb"
  rose-danger: "#be123c"
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
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.surface}"
    rounded: "{rounded.full}"
    padding: "10px 28px"
  button-primary-hover:
    backgroundColor: "#1f1f1f"
    textColor: "{colors.surface}"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.full}"
    padding: "10px 28px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink-soft}"
    rounded: "{rounded.full}"
    padding: "10px 24px"
  button-danger:
    backgroundColor: "{colors.rose-danger}"
    textColor: "{colors.surface}"
    rounded: "{rounded.full}"
    padding: "10px 28px"
  card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.2xl}"
    padding: "28px"
  card-dark:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.surface}"
    rounded: "{rounded.2xl}"
    padding: "28px"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.xl}"
    padding: "10px 16px"
  badge:
    backgroundColor: "#0000000d"
    textColor: "{colors.ink}"
    rounded: "{rounded.full}"
    padding: "2px 10px"
---

# Design System: Studennnn — Calm Ledger

## 1. Overview

**Creative North Star: "The Calm Ledger"**

Studennnn looks and feels like a premium private-banking app stripped of any flourish, paired with a leather-bound family ledger left open on a quiet desk. Off-white surface, true black ink, one deep aubergine reserved for the moment of contrast. The interface holds itself with the discipline of a financial product, applied to the domain of a school's daily record-keeping.

The system explicitly rejects four neighbourhoods that PRODUCT.md calls out by name: government ERP (Bootstrap 3, Tahoma, desktop-only), Thai EdTech default (orange+blue+yellow, mascots, Cordia), Google Classroom Material (generic), and generic AI-SaaS landing slop (gradient hero, hero-metric template, eyebrow uppercase every section, isometric vectors). Premium fintech as a family — Halo, Linear, Stripe Sessions, well-crafted Sequoia portfolio — is the lane we live in, not the lane we avoid.

This theme **supersedes** ADR-0011 Ink + Gold via ADR-0014.

**Key Characteristics**
- Quiet · Premium · Modern
- Tri-tonal: off-white body, true black ink, deep aubergine reserved for contrast moments
- Single typeface (Anuphan — Cadson Demak, Latin + Thai) at three weights
- Tight negative letter-spacing on all display + headline (`-0.04em` to `-0.02em`)
- Pill geometry for actions (`rounded-full`), 2xl for cards (`16px`), 3xl for featured surfaces (`24px`)
- No gradient text, no shimmer, no float, no tilt, no glass — motion is colour transitions and gentle shadow only
- Hero surfaces lean on full-bleed media (image/video) inside `rounded-2xl` cards, not CSS scenery
- Mobile-first for student surfaces; desktop-first for teacher gradebook + admin audit

## 2. Colors: The Off-White Discipline

A three-step achromatic system anchored by one chromatic accent. Saturation is rare on purpose.

### Primary
- **Off-White** (`#F5F5F5`): The body of every page and section. The default canvas. Not warm, not cool — neutral on purpose so the aubergine accent reads with maximum contrast.
- **True Black** (`#000000`): Primary text, primary button surface, logo, navigation. No "almost-black" softening. The system commits to the corner.

### Secondary
- **Aubergine** (`#2B2644`): The single chromatic accent. Used as a **surface** (card background, dark hero panel) — never as a button colour, never as an icon tint outside of dark-mode mirrors of the primary button. Aubergine appears on 1-2 surfaces per page maximum.

### Neutral
- **70% Ink** (`#4D4D4D` solid, or `rgba(0,0,0,0.7)` over white): Default body text, paragraph content, supporting prose. Verify contrast on tinted backgrounds.
- **50% Ink** (`#808080` solid, or `rgba(0,0,0,0.5)`): Eyebrows, captions, secondary metadata, marquee items.
- **Surface White** (`#FFFFFF`): Card backgrounds, input fields, mobile-frame mockups. Never a full page background.
- **Hairline** (`#EBEBEB`, or `rgba(0,0,0,0.08)`): Almost-invisible card borders, ring on inputs and ghost buttons. Default border weight is "barely there."

### Semantic (rare — error/destructive only)
- **Danger Rose** (`#BE123C`): `btn-danger`, error messages, destructive action confirmation. Not used for role identity (role badges are neutral in this system).

### Named Rules

**The Aubergine-Is-Surface Rule.** Aubergine (`#2B2644`) is a *card background colour*. It is never a button, never an icon, never a chart series. When you reach for aubergine on a button, you're misreading the system — reach for true black instead. One or two aubergine cards per page is the ceiling.

**The True-Black Rule.** No `#1a1a1a`, no `#0f0f0f`, no `slate-900`. Primary text and primary button surface are `#000000` exactly. Almost-black softening reads as indecision in this aesthetic family.

**The No-Saturated-Role-Colour Rule.** Admin / Teacher / Student badges are neutral grayscale, not rose/blue/emerald. Role differentiation moves to placement, label text, and surrounding metadata — not chroma. (Supersedes the Ink+Gold semantic colour scheme from ADR-0011.)

## 3. Typography

**Display / Headline / Title / Body / Label:** Anuphan (`var(--font-anuphan)`, fallback `system-ui, sans-serif`). One family. Latin and Thai script at uniform weight stress — Cadson Demak designed the pair, so วรรณยุกต์ stacking matches the cap-height rhythm without the fight Plex Thai used to lose.

**Mono:** `ui-monospace, SFMono-Regular` for student IDs and class codes only.

**Character:** Tight modern fintech. Negative tracking, medium-weight ceiling (600 max), confident size jumps with `clamp()` on display. The Halo recipe's "tight tracking, modest weight" doctrine — applied to a system that has to hold Thai script convincingly at the same time.

### Hierarchy
- **Display** (weight 600, `clamp(2.5rem, 5vw, 4rem)`, letter-spacing `-0.04em`, line-height 1.05): Hero h1 — "ห้องเรียนของคุณ" / "Studennnn"
- **Headline** (weight 500, `clamp(2rem, 4vw, 3rem)`, letter-spacing `-0.03em`): Section h2 — "ทำความรู้จัก Studennnn"
- **Title** (weight 500, `1.5rem` / 24px, letter-spacing `-0.02em`): Card titles
- **Body** (weight 400, `1rem` / 16px, line-height 1.6): Default body. Cap at 65–75ch on prose. Use `rgba(0,0,0,0.7)` (#4D4D4D) for soft body, true black for emphasis.
- **Label** (weight 500, `0.875rem` / 14px): Eyebrows, captions. **No uppercase by default.** Halo's eyebrows are sentence case; Studennnn's follow.
- **Mono** (weight 400, `0.875rem`): Student IDs ("60001"), class codes ("MATH4A-A8K2"). Monospace for fixed-width alignment in tables.

### Named Rules

**The Anuphan-Only Rule.** No serif. No second display font. No Inter, no Plex, no Geist alongside. Anuphan carries display, body, and label across every page. A second font would dilute the Thai+Latin balance Cadson Demak engineered into this family.

**The 600-Ceiling Rule.** Weight 600 (semibold) is the heaviest weight used anywhere in the system, including display h1. Weight 700 (bold) is forbidden. Bold reads as shouty; semibold reads as confident.

**The No-Uppercase-Eyebrow Rule.** Section eyebrows ("USD Halo in Practice" → "Studennnn ในการใช้งาน") stay sentence case at 0.875rem weight 500. Tracked uppercase eyebrows are the Impeccable absolute ban and the saturated-AI grammar; this system avoids them.

**The Negative-Tracking-Floor Rule.** Display tracking ≥ `-0.04em`, headline `-0.03em`, title `-0.02em`. Body and label stay at 0. The negative tracking IS the fintech-premium voice — flat tracking on a display heading reads as default Inter.

**The Thai Line-Height Rule.** Body line-height ≥ 1.6 (`leading-relaxed`). Thai วรรณยุกต์ and สระบน sit above the baseline; cramped leading makes them collide.

## 4. Elevation

Flat-by-default with subtle responsive lift on interactive cards. The system reads as paper-flat on the off-white surface. Shadow appears only as feedback for interactivity, not as ambient identity. This is a deliberate **reversal** of the Ink+Gold "ambient soft baseline" rule.

### Shadow Vocabulary
- **Resting (`shadow-none`):** Cards default to no shadow. Their `rounded-2xl` corners and subtle hairline border carry the affordance.
- **Hover Lift (`shadow-lift`):** `0 4px 24px rgba(0,0,0,0.06), 0 2px 6px rgba(0,0,0,0.04)`. Cards lift on hover over 200ms ease-out. Lift is subtle — premium-fintech, not Material Design 6dp.
- **Featured (`shadow-card`):** `0 8px 32px rgba(0,0,0,0.06)`. Reserved for hero-card-style elevated surfaces (the hero rounded-2xl panel, large featured cards in product galleries).

### Named Rules

**The Flat-By-Default Rule.** No shadow on resting cards. The `rounded-2xl` corner + `1px rgba(0,0,0,0.08)` hairline carry the affordance. Reach for shadow only on hover, focus, or for deliberately-elevated featured surfaces.

**The 200ms Transition Rule.** Shadow and colour transitions run 200ms ease-out. Same number Ink+Gold used; the floor of premium-feel.

## 5. Components

### Buttons

All buttons are **pills** (`rounded-full`). Pad horizontally, modest vertical. The pill shape is the system's primary signal of "interactive element."

- **Shape:** `rounded-full`
- **Primary:** `bg-black text-white`, padding `10px 28px`, weight 500, hover `bg-[#1f1f1f]`. The default action.
- **Secondary:** `bg-white text-black ring-1 ring-black/10`, hover `ring-black/20`. For supporting actions where primary is taken.
- **Ghost:** `text-black/70 hover:text-black hover:bg-black/[0.05]`. Tertiary. No ring.
- **Danger:** `bg-rose-600 text-white hover:bg-rose-700`. Destructive only.
- **Small (`btn-sm`):** Padding `6px 18px`, text 13px. Inline table actions.

### The Arrow-Circle Pattern (signature)

The signature CTA variant — a black pill with a trailing **white circular badge** containing an arrow:

```
[  เข้าสู่ระบบ  (→) ]
```

Used for the hero CTA and the "Meet" / "Use cases" section CTAs. Structure: `bg-black text-white pl-8 pr-2 py-2 rounded-full inline-flex items-center gap-3`, with trailing `<span class="bg-white rounded-full p-2"><ArrowRight class="text-black"/></span>`. On hover: arrow translates `1.5px` right via group-hover.

### Cards

- **Shape:** `rounded-2xl` (16px). Featured: `rounded-3xl` (24px).
- **Default (`.card`):** `bg-white`, padding `28px` (`p-7`). Optional hairline `ring-1 ring-black/[0.04]` for definition on the off-white body — usually unnecessary.
- **Dark (`.card-dark`):** `bg-[#2B2644] text-white`. The aubergine variant. Reserved for 1-2 surfaces per page maximum (per The Aubergine-Is-Surface Rule).
- **Image (`.card-image`):** Full-bleed background image, padding `28px`, content positioned with `flex flex-col justify-between min-h-80`. Text on image needs verification of contrast — usually a `text-black` heading top-left + `text-black/70` body bottom-left, planned against the image's lighter regions.
- **Hover:** subtle lift (`shadow-lift`) over 200ms. No tilt, no sheen, no glow.

### Inputs

- **Shape:** `rounded-xl` (12px). Less round than buttons — inputs are fields, not actions.
- **Resting:** `bg-white ring-1 ring-black/10`, no visible border-stroke. The ring carries the affordance.
- **Hover:** `ring-black/20`.
- **Focus:** `ring-2 ring-black`, no shadow ring. (Black focus ring replaces the Ink+Gold focus ring.)
- **Placeholder:** `text-black/40`. Verify contrast ≥ 4.5:1 — at 0.4 alpha on white, that's 5.7:1, ✅.

### Badges

- **Shape:** `rounded-full`, padding `2px 10px`, text 12px weight 500.
- **Default:** `bg-black/[0.05] text-black ring-1 ring-black/[0.08]`. Neutral.
- **Variants** (`admin`, `teacher`, `student`): **All neutral**. Role differentiation moves to label text and placement, not chroma. (Supersedes the saturated-rose-blue-emerald scheme.)
- **Behaviour:** Static. No hover.

### Tables

- **Wrapper:** `rounded-2xl bg-white`, no visible border.
- **Header:** small text 13px weight 500, `text-black/50`, no uppercase, no tracking.
- **Rows:** 1px `border-black/5` divider, hover `bg-black/[0.02]`.
- **Cell padding:** `12px 16px`.

### Stats (KPI cards)

- **Container:** `.stat` = `rounded-2xl bg-white p-6` with `shadow-lift` on hover.
- **Label:** 12px weight 500 `text-black/60`. **No uppercase.**
- **Value:** 36-40px weight 600 tracking `-0.02em` black. Plain. No gradient, no aubergine, no signature treatment.
- **Note:** The "GPA signature treatment" question is open — `stat-value-gold` is removed. Until a new equivalent is decided, GPA renders as plain bold black with the surrounding card carrying the weight.

### Hero Card (signature surface)

The landing hero is a `rounded-2xl` full-bleed media card (`overflow-hidden`, `relative`, `h-[calc(100vh-96px)]` desktop). Background = image or video, autoplay/muted/playsInline if video. Foreground content positioned `relative z-10 p-12 pt-36` — heading top-left, body + CTA below.

### Brand Marquee — Removed

The Halo recipe's "Brand Marquee" and "Backed By" sections are **omitted** from this system. Studennnn has no peer-brand list to legitimize against (single-tenant per school, not a B2B platform competing in a marketplace). Per ADR-0014 follow-up.

## 6. Do's and Don'ts

### Do:
- **Do** anchor every page in true black (`#000000`) text on Off-White (`#F5F5F5`) or Surface White (`#FFFFFF`)
- **Do** reach for Aubergine (`#2B2644`) only as a card surface, only 1-2 times per page (The Aubergine-Is-Surface Rule)
- **Do** use `rounded-full` for buttons and pills, `rounded-2xl` for cards, `rounded-3xl` for featured / hero card
- **Do** apply negative letter-spacing on display + headline + title (`-0.04em` to `-0.02em`) — the tracking IS the voice
- **Do** keep weight 600 as the heaviest ceiling. No weight 700 anywhere.
- **Do** use Anuphan (Cadson Demak) for everything. Pair sizes 0.875 / 1 / 1.5 / 2 / 2.5+ rem.
- **Do** use the **arrow-circle pill** (black pill with trailing white circle + arrow) as the signature CTA on hero, "Meet" section, "Use cases" section
- **Do** keep resting cards flat (`shadow-none`); lift only on hover with the `shadow-lift` token
- **Do** use full-bleed media (image/video) inside `rounded-2xl` hero card — not CSS scenery, not blob, not mesh-bg
- **Do** wrap motion in `prefers-reduced-motion: reduce`. Hover lifts, fade-in entries collapse to instant.
- **Do** verify text contrast ≥ 4.5:1 on every text-on-image surface. Image cards require manual contrast planning per image.

### Don't:
- **Don't** use "almost-black" softening (`#1a1a1a`, `slate-900`). Primary text is `#000000` (The True-Black Rule).
- **Don't** put Aubergine on a button. Aubergine is a surface, not an action (The Aubergine-Is-Surface Rule).
- **Don't** use weight 700 (bold) anywhere. 600 is the ceiling.
- **Don't** use uppercase tracked eyebrows above sections. Halo doesn't. Studennnn doesn't. (Impeccable absolute ban + reinforces 2026 trend avoidance.)
- **Don't** use saturated semantic colours (rose/blue/emerald/amber) for role identification. Admin/Teacher/Student badges are grayscale. Rose is reserved for danger/destructive only.
- **Don't** use gradient text. No `text-gradient-gold`, no rainbow, no clipped-gradient h1. (Impeccable absolute ban; removed from globals.css.)
- **Don't** use shimmer, float, tilt, mesh-bg, blob, sheen, glass, or any Ink+Gold motion utility. Removed from globals.css per ADR-0014.
- **Don't** add a second display font. Anuphan carries everything.
- **Don't** uppercase Thai script. Thai has no case.
- **Don't** style like government ERP / Bootstrap 3 / Thai EdTech default / Google Classroom Material (PRODUCT.md anti-references).
- **Don't** style like generic AI-SaaS slop — gradient hero, hero-metric template, isometric vector, `01 / 02 / 03` numbered scaffolding (PRODUCT.md anti-reference, refined in ADR-0014).
- **Don't** use `border-left` greater than 1px as a colored stripe (Impeccable absolute ban).
- **Don't** nest cards inside cards. Nested cards are always wrong.
- **Don't** put body text on tinted backgrounds without verifying 4.5:1 contrast. The off-white-on-off-white trap is the AI design tell of 2026.

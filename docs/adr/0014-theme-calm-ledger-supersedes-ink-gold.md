# ADR-0014 — Theme "Calm Ledger" Supersedes Ink + Gold (ADR-0011)

## Status

Accepted — 2026-05-31 · **Supersedes ADR-0011**

## Context

ADR-0011 (Ink + Gold) was adopted in Phase 0 — ported from the Father project. After three months of build and the first landing-page craft pass under `/impeccable craft`, the user reviewed the result and pivoted: the academic Lab Notebook north star didn't carry the modern fintech-premium register they actually wanted.

The new direction is anchored in a specific recipe (the "Halo / USD Halo" landing reference): off-white body, black-pill primary actions, deep aubergine card surface, tight-tracked single-family display + body, full-bleed image/video heroes, rounded-2xl card geometry, no decorative gradients. Premium calm fintech, not lab academia.

This is not a refinement of Ink + Gold. The two systems have incompatible:
- **Base palette** — `#f8fafc` warm paper → `#F5F5F5` cool off-white
- **Accent strategy** — Lamp Gold rare-and-meaningful → no chromatic accent at all (black + aubergine carry the system)
- **Type** — IBM Plex Sans Thai academic → Anuphan tight modern fintech
- **Component geometry** — `rounded-lg` (8px) buttons → `rounded-full` pills
- **Signature interaction** — gold sheen sweep on btn-primary → no sheen, no shimmer, no gradient (just clean color transitions)
- **Motion library** — float, shimmer, bg-pan, gradient-pan, sheen → removed; only fade-in + crossfade survive

A graceful supersession needs to be recorded, not a silent rewrite.

## Decision

### 1. Adopt "Calm Ledger" as the new theme name

Working name `Calm Ledger` — bridges the fintech-premium aesthetic with Studennnn's domain (record-keeping for grades and attendance). Avoids trademark collision with "Halo" while honouring the recipe source.

### 2. Replace tokens wholesale

| Layer | Old (Ink + Gold) | New (Calm Ledger) |
|-------|------------------|-------------------|
| Body bg | `#f8fafc` Quiet Paper | `#F5F5F5` Off-White |
| Primary text | `#0f172a` Archive Ink | `#000000` True Black |
| Soft text | `#475569` Ink-Soft | `rgba(0,0,0,0.7)` 70% Black |
| Mute text | — | `rgba(0,0,0,0.5)` 50% Black |
| Accent | `#b8860b` Lamp Gold | `#2B2644` Aubergine (surface, not button) |
| Primary button | dark gradient + gold sheen | `#000000` pill, white text, hover `#1f1f1f` |
| Card surface | white + soft shadow + lift | white `rounded-2xl` OR aubergine `#2B2644` OR full-bleed image |
| Border | `#e2e8f0` slate-200 | `rgba(0,0,0,0.08)` 8% black, mostly invisible |

### 3. Replace font

Drop IBM Plex Sans Thai → adopt **Anuphan** (Cadson Demak, free, Latin+Thai with matching fintech-premium tight tracking). Anuphan handles Thai script natively at the same weight-stress as the Latin, which Plex never quite did.

Single family for display + headline + title + body + label. Mono fallback unchanged (`ui-monospace`).

### 4. Drop signature utilities that don't fit

Removed from `globals.css`:
- `.text-gradient-gold`, `.text-gradient-ink` (no gradient text in the new system)
- `.mesh-bg` (warm paper hero with gold radials — wrong aesthetic family)
- `.tilt-card`, `.perspective-1000/1500`, `.preserve-3d` (3D tilt — too playful)
- `.blob` (decorative float)
- `.sheen` (hover sweep)
- `.glass` (backdrop-blur frosted)
- `.stat-value-gold` (gold gradient stat)

Removed keyframes: `shimmer`, `float`, `float-slow`, `gradient-pan`, `pulse-ring`, `bg-pan`.

Kept: `@keyframes fade-in`, `@keyframes slide-up`, A4 print stylesheet, `prefers-reduced-motion` guard, focus-visible (recoloured to black 3px ring).

### 5. Component class rebuild

Buttons: all variants become `rounded-full` pills. Primary = black, secondary = white with subtle ring, ghost = text-only, danger = rose. The gold accent button is gone — featured CTAs use plain `btn-primary` and earn weight through size, not chroma.

Cards: `rounded-2xl` (16px) up from `rounded-xl` (12px). Two variants: `.card` (white surface), `.card-dark` (aubergine `#2B2644` surface with white text). No `.sheen` overlay.

Badges: `rounded-full`, neutral grayscale (`bg-black/5 text-black ring-black/10`) instead of saturated semantic colours. Role differentiation moves to typography and layout, not chroma.

Inputs: `rounded-xl` (12px), `ring-1 ring-black/10` instead of border-stroke, focus = `ring-2 ring-black`.

### 6. Apply globally, accept some visual debt

Per user direction "ทั้งโปรเจค" — `app/globals.css` is rewritten so `app/page.tsx`, `app/login`, `app/(auth)/*`, `app/admin/*`, `app/teacher/*` all consume new tokens immediately. Pages that previously relied on signature Ink+Gold motifs (`mesh-bg` headers, `text-gradient-gold` headlines, gold focus rings) will look bare on first refresh — this is acceptable as a temporary state and will be touched up surface-by-surface.

## Consequences

### Positive

- Studennnn's identity is now distinctive and current (per `/impeccable critique` mental model: avoids both first-order "Material Google Classroom" reflex AND second-order "editorial-magazine Plex+gold" trap)
- One typeface (Anuphan), one accent (aubergine surface only, not button), one button shape (pill) — radically simpler maintenance surface
- New tokens align with the Halo recipe verbatim, so `/impeccable craft` outputs against the new DESIGN.md will be coherent without per-task overrides
- Anuphan handles Thai+Latin at uniform weight — no more Plex's pairing tension

### Negative

- Existing pages built against Ink+Gold lose their signature (gold focus, mesh-bg headers, text-gradient-gold metrics) on first refresh — visual debt
- `stat-value-gold` is gone; pages using it fall back to plain bold black — GPA loses its signature treatment until a new equivalent ships (TBD: aubergine numeric, hand-lettered SVG, or other)
- `mesh-bg` decoration on `/teacher/courses/*` headers disappears — those headers may look flat; revisit during Phase 3 craft
- The badge colour-coding (rose/blue/emerald for admin/teacher/student) collapses to neutral grayscale; role differentiation moves to placement and labels. Functional, but less glance-able. Acceptable trade for aesthetic consistency.
- ADR-0011's "academic gravitas" rationale is lost; PRODUCT.md brand personality needs revision (handled separately in PRODUCT.md edit alongside this ADR)
- `components/landing/lab-notebook-scene.tsx` (built same session) is deleted — wasted effort, but the user saw the result before pivoting, which is exactly what `/impeccable craft` is supposed to enable

### Rejected Alternatives

- **Keep Ink + Gold, write a "premium" variant** — would carry two design systems forever; user wants one
- **Adopt Halo recipe verbatim including TT Norms Pro paid font** — no Thai glyphs in TT Norms Pro; would force a font-pair fallback and double-load every page
- **Adopt Halo aesthetic but keep "Lab Notebook" north star metaphor in DESIGN.md** — the metaphor cues warm paper + ink marginalia, which contradicts off-white cool minimal — narrative would fight the visuals

### Follow-ups

- Surface-by-surface touch-up: `/teacher/courses/[id]` page (was `mesh-bg`), admin dashboard cards (was `.stat-value-gold`), login page (was Ink+Gold form)
- Revisit role-badge differentiation strategy if neutral grayscale proves too low-contrast in practice
- Decide on a new "GPA signature treatment" replacing `stat-value-gold` — defer to Phase 5 scoring craft

## References

- Superseded ADR: `docs/adr/0011-theme-ink-gold.md`
- Companion edits same commit: `PRODUCT.md` (brand personality + anti-references), `DESIGN.md` (full rewrite), `.impeccable/design.json` (full rewrite), `app/globals.css` (rewrite), `app/layout.tsx` (font swap), `app/page.tsx` (landing rewrite)
- Deleted: `components/landing/lab-notebook-scene.tsx` (no longer used)
- Halo recipe source: user prompt 2026-05-31 (kept in this session's transcript)

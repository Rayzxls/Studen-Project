# Image Prompts — Landing Page Media

> ส่งใส่ Midjourney / SDXL / Flux / Imagen แล้วเอามาแทน placeholder gradient ใน `app/page.tsx`
>
> หา marker `PLACEHOLDER` ในไฟล์เพื่อหา 3 จุดที่ต้องเปลี่ยน

---

## 🎯 รูปที่ต้องการ — 3 ใบ

### 1. Hero Background (ใหญ่สุด — full-bleed ใน rounded-3xl card)

**Location ในโค้ด:** `app/page.tsx` → `{/* ─── BACKGROUND PLACEHOLDER ─── */}` ใน hero card

**Dimensions:** ratio ~16:9 หรือ 21:9, target **2880 × 1620 px** (จะถูก crop ตาม viewport)

**Brief:**
รูป premium fintech-academic ที่สื่อความเป็น "ห้องเรียน / workspace ครู" แบบ Studennnn — ต้องไม่ใช่ photo ของห้องเรียนจริง (PDPA) และไม่ใช่ generic Thai EdTech illustration

**Prompt template (Midjourney/Flux):**
```
Soft off-white minimalist composition, premium private banking app aesthetic
applied to academic context. Abstract architectural geometry — clean planes
in cream/off-white #F5F5F5, deep aubergine #2B2644 as a single accent
volume on the right side. Faint paper texture. Notebook spine or ledger
binding suggested at the left edge through subtle ridge geometry, not literal.
No people. No text. No school logos. No props (no pens, no pencils, no
chalkboards). Editorial calm. Linear / Stripe Sessions vibe. Negative space
60% of frame.

Lighting: soft, indirect, evening warm. Single low-angle light source from
right creating gentle shadow gradient.

Style: photographic still-life, 50mm lens, f/4, shallow depth on aubergine
volume, the rest in soft focus. NOT 3D render. NOT illustration.

Aspect: 21:9 ultrawide, 2880x1620, no border, full bleed.

— No SaaS gradient hero. No isometric vectors. No people. No 3D crypto coins.
No marketing buzzword visual metaphors. No glowing orbs.
```

**Why this brief:** PRODUCT.md anti-references say "no SaaS slop, no Thai EdTech default, no Google Classroom Material." DESIGN.md North Star = "Calm Ledger" (premium private-banking + family ledger metaphor). The off-white + aubergine palette = literal Calm Ledger tokens.

---

### 2. Info Card 1 — "เกรดอัปเดต ทันทีที่ครูบันทึก" (col-span-2 light card)

**Location ในโค้ด:** `app/page.tsx` → Info Section → `{/* PLACEHOLDER — see image-prompts.md → "Info Card 1" */}`

**Dimensions:** ratio ~3:2, target **1800 × 1200 px**

**Brief:**
รูปนุ่ม ๆ ที่สื่อ "real-time grade update" แบบ premium fintech — สื่อความเป็น "ของที่เคลื่อนไหวต่อเนื่อง สดใหม่" โดยไม่ literal เกินไป

**Prompt template:**
```
Soft cream-to-pale-lilac gradient composition. Floating ribbon or paper
strip in mid-air, gently curving, suggesting a continuous stream of numbers
or short notations — text not legible, just texture. The ribbon catches
the same low soft light, with subtle iridescence at one edge.

Off-white #F5F5F5 dominant, faint aubergine #2B2644 vignette in lower-right
corner. No bright colours. No people. No literal numbers. No clock or
notification icons.

Lighting: soft window light. Editorial product photography aesthetic.

Style: photographic still-life, soft focus background, sharp focus on
ribbon edge. NOT illustration. NOT 3D abstract shapes.

Aspect: 3:2, 1800x1200, full bleed.

— No SaaS gradient orbs. No abstract data visualization. No graphs.
No icons. No screenshots.
```

---

### 3. Use Cases Featured — "ครูเจ้าของห้อง" (rounded-3xl, min-h-720)

**Location ในโค้ด:** `app/page.tsx` → Use Cases Section → `{/* PLACEHOLDER — see image-prompts.md → "Use Cases featured" */}`

**Dimensions:** ratio ~2:3 (portrait), target **1200 × 1800 px** (จะถูก crop ตาม viewport responsive)

**Brief:**
รูป premium-fintech mood สำหรับ "ครูเจ้าของห้อง" — dark aubergine surface กับ subtle warmth สื่อ workspace ของคนที่มี ownership

**Prompt template:**
```
Deep aubergine #2B2644 surface with single warm amber pinpoint light in
upper-right — like a desk lamp seen from across a dim room. Subtle ridges
or fabric texture suggesting a bound ledger or leather portfolio surface.
The surface fills 85% of the frame, with one corner gently softening into
a slightly lighter aubergine.

No people. No text. No school props. No screens. No notebooks visible.
Just the surface, the single warm light, and the texture.

Lighting: single warm 2700K pinpoint at upper-right, falloff to deep
aubergine shadow lower-left.

Style: photographic, macro lens, f/2.8, extremely shallow depth — the
warm light pin is the only sharp point. Editorial luxury product photography.

Aspect: 2:3 portrait, 1200x1800, full bleed.

— No SaaS dashboard mockup. No people. No literal classroom. No technology
visible. No glow effects. Strictly material-and-light photography aesthetic.
```

---

## 📐 Output specs

- **Format:** WebP (preferred) หรือ JPG, quality 85+
- **Color space:** sRGB
- **Save ที่:** `public/landing/`
  - `public/landing/hero-bg.webp`
  - `public/landing/info-card-1.webp`
  - `public/landing/use-cases-teacher.webp`

## 🔄 After generation — Swap into the page

หา comment `PLACEHOLDER` 3 จุดใน `app/page.tsx`. แทน `<div style={{ background: "linear-gradient(...)" }} />` ด้วย:

```tsx
<img
  src="/landing/hero-bg.webp"
  alt=""
  aria-hidden
  className="absolute inset-0 h-full w-full object-cover"
/>
```

(Same pattern for the other 2 cards — เปลี่ยนแค่ src.)

ถ้าจะใส่ video แทน image ทีหลัง:
```tsx
<video
  src="/landing/hero-bg.mp4"
  autoPlay
  muted
  loop
  playsInline
  className="absolute inset-0 h-full w-full object-cover"
/>
```

## ⚠️ Anti-reference checklist (ต่อรูปแต่ละใบ)

ก่อนยอมรับรูปที่ generate มา check ว่ารูปไม่:

- [ ] ไม่ใช่ SaaS gradient hero (purple/blue/cyan glowing orbs)
- [ ] ไม่ใช่ isometric vector illustration
- [ ] ไม่มี people / hands / faces (PDPA + ไม่เกี่ยวกับ specific school)
- [ ] ไม่มี text legible หรือ logo
- [ ] ไม่มี literal classroom props (blackboard, desks, books วาง)
- [ ] ไม่ใช่ Thai EdTech default (orange + ฟ้า + yellow smiley feel)
- [ ] Off-white #F5F5F5 หรือ aubergine #2B2644 dominant ในรูป — สีอื่น ๆ น้อยมาก
- [ ] ไม่มี neon / saturated brand colors

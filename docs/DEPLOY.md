# Deploy Guide — Beagle Classroom (trial สำหรับครอบครัว)

คู่มือนี้พาขึ้น production สำหรับการทดลองใช้วงเล็ก (พ่อ/แม่ + นักเรียนไม่กี่คน)
ขั้นที่ขึ้นต้นด้วย 🧑‍💻 = **คุณต้องทำเอง** (สมัคร cloud / กรอก secret / กด deploy)
ขั้นที่ขึ้นต้นด้วย 🤖 = ผม (assistant) ช่วยทำให้ได้

---

## 0. ตัดสินใจก่อน: เปิด signup สาธารณะไหม?

- **แนะนำสำหรับ trial:** ปิด signup สาธารณะ → ให้ **admin สร้างบัญชีให้ทุกคน** (ผ่าน bootstrap + หน้า admin)
  → ไม่ต้องตั้ง **Turnstile (CAPTCHA)** และ **Upstash (rate-limit)** เลย
- ถ้าจะเปิดให้นักเรียนสมัครเอง: ต้องมี Turnstile + Upstash keys (ดูตาราง env)

---

## 1. 🧑‍💻 สมัคร services (ฟรี tier พอสำหรับ trial)

| Service | ใช้ทำอะไร | ได้อะไรมา |
|---------|-----------|-----------|
| **Neon** (neon.tech) | Postgres production (แยกจาก dev) | `DATABASE_URL` |
| **Cloudflare R2** (dash.cloudflare.com → R2) | เก็บไฟล์ที่นักเรียนส่ง | `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_PUBLIC_URL` |
| **Vercel** (vercel.com) | hosting + HTTPS อัตโนมัติ | โดเมน `*.vercel.app` |

> R2 ฟรี 10 GB — เกินพอ สร้าง bucket 1 อัน (เช่น `beagle-classroom-prod`) + API token แบบ **Object Read & Write**

### 1.1 🧑‍💻 ตั้ง CORS ให้ R2 bucket (สำคัญ — ไม่งั้นอัปโหลดไฟล์พัง)

นักเรียนอัปโหลดไฟล์ผ่าน **presigned PUT จากเบราว์เซอร์ตรงไป R2** → bucket ต้องอนุญาต CORS
ที่ R2 bucket → Settings → CORS policy ใส่ (เปลี่ยน origin เป็นโดเมน Vercel ของคุณ):

```json
[
  {
    "AllowedOrigins": ["https://YOUR-APP.vercel.app"],
    "AllowedMethods": ["PUT", "GET"],
    "AllowedHeaders": ["content-type"],
    "MaxAgeSeconds": 3600
  }
]
```

---

## 2. 🧑‍💻 สร้าง AUTH_SECRET

```bash
openssl rand -base64 32
```
เก็บค่าที่ได้ไว้ใส่ env (ห้ามใช้ค่าเดียวกับ dev)

---

## 3. Push schema เข้า prod DB

> โปรเจกต์ใช้ `prisma db push` มาตลอด (ไม่ใช้ migration files) — ทำตามนั้น

```bash
# ใส่ prod DATABASE_URL ชั่วคราว แล้ว push
DATABASE_URL="<prod-neon-url>" pnpm prisma db push
```
ผลลัพธ์ควรขึ้น "Your database is now in sync"

---

## 4. สร้างข้อมูลจริง (แทน seed demo)

1. 🤖/🧑‍💻 แก้ `prisma/bootstrap.ts` ส่วน `CONFIG` ให้เป็นค่าจริง:
   - `admin` = บัญชีคุณ (identifier + รหัสผ่าน + ชื่อ)
   - `teachers` = พ่อ/แม่ (ตั้ง `mustResetPwd: true` ให้เขาตั้งรหัสเองตอน login แรก)
   - `academicYear` / `terms` / `classes` / `courseOfferings` ตามจริง
   - `students` = ใส่เลย หรือเว้น `[]` ให้นักเรียน join ด้วย class code ทีหลัง
2. 🧑‍💻 รัน (ชี้ DATABASE_URL ไป prod):
   ```bash
   # วิธีง่าย: ใส่ prod url ใน .env.local ชั่วคราว แล้ว
   pnpm db:bootstrap
   ```
   จะพิมพ์ **class code** ของแต่ละวิชาออกมา (เอาให้นักเรียนใช้ที่ `/join`)
   *รหัสผ่านจะไม่ถูกพิมพ์* — เป็นค่าที่คุณตั้งใน CONFIG

> bootstrap เป็น idempotent — รันซ้ำได้ ไม่ทับบัญชีเดิม (เปลี่ยนรหัสผ่านภายหลังใช้หน้า admin reset)

---

## 5. 🧑‍💻 Deploy ขึ้น Vercel

1. Vercel → New Project → import repo นี้ → เลือก branch (`phase-11` หรือ merge เข้า `main` ก่อน)
2. ใส่ **Environment Variables** (ตารางข้างล่าง) ใน Project Settings → Environment Variables
3. กด Deploy
4. ได้โดเมน `https://YOUR-APP.vercel.app` → กลับไปแก้ `AUTH_URL` + `NEXT_PUBLIC_APP_URL` เป็นโดเมนนี้ → **Redeploy**
5. กลับไปอัปเดต **R2 CORS** (ข้อ 1.1) ให้ตรงโดเมนจริง

### Environment Variables

| ตัวแปร | จำเป็น? | หมายเหตุ |
|--------|---------|----------|
| `DATABASE_URL` | ✅ | Neon prod |
| `AUTH_SECRET` | ✅ | `openssl rand -base64 32` |
| `AUTH_URL` | ✅ | `https://YOUR-APP.vercel.app` |
| `NEXT_PUBLIC_APP_URL` | ✅ | เหมือน AUTH_URL |
| `R2_ACCOUNT_ID` / `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` / `R2_BUCKET_NAME` / `R2_PUBLIC_URL` | ✅ | ไฟล์ที่นักเรียนส่งเก็บที่นี่ (code throw ถ้าไม่ครบ) |
| `UPSTASH_REDIS_REST_URL` / `_TOKEN` | ⬜ | เฉพาะถ้าเปิด signup สาธารณะ (rate-limit) |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` / `TURNSTILE_SECRET_KEY` | ⬜ | เฉพาะถ้าเปิด signup สาธารณะ (CAPTCHA) |
| `SENTRY_DSN` / `SENTRY_AUTH_TOKEN` | ⬜ | monitoring (optional) |
| `NODE_ENV` | auto | Vercel ตั้ง `production` ให้เอง |

---

## 6. Smoke test หลัง deploy (ไล่ตามนี้)

- [ ] เปิดโดเมน → หน้า landing โหลด
- [ ] login เป็น **admin** → เห็น dashboard + รายชื่อห้อง/ครู
- [ ] login เป็น **ครู** → เปิดวิชา → สร้างการบ้าน (ลองแนบลิงก์) + ตั้งคะแนน + เช็คชื่อ
- [ ] นักเรียน join ด้วย class code ที่ `/join` (หรือ login บัญชีที่ bootstrap สร้าง)
- [ ] นักเรียน **ส่งงานพร้อมแนบไฟล์** → ยืนยันไฟล์อัปโหลดขึ้น R2 ได้ (เช็ค CORS!)
- [ ] ครูเห็นงานที่ส่ง → ให้คะแนน → เผยแพร่ → นักเรียนเห็นคะแนน

---

## หมายเหตุ / ข้อจำกัดที่ทราบ (ยัง defer)

- **ครูแนบไฟล์/รูป ในกล่องสร้างงาน** ยัง disabled ("เร็วๆ นี้") — ครูแนบได้แค่ **ลิงก์**
  (นักเรียน *ส่ง* ไฟล์ได้ปกติ) → ถ้าจำเป็นค่อยทำ file-upload pipeline เพิ่ม
- ปุ่มย้อนกลับ 2 จุด (`/student/terms/[termId]`, หน้า detail นักเรียน) ยังไม่ขัดเกลา
- Email: ไม่มี (notification เป็น in-app) → ลืมรหัสผ่าน = admin reset ให้ (มี temp-reveal)

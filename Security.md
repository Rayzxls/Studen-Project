# Security.md

Security baseline + PDPA compliance สำหรับ Studennnn

> ระบบเก็บข้อมูล **เยาวชน** → PDPA strict ขึ้น

---

## 1. Authentication

### Identifiers

| Role | Identifier | Source |
|------|-----------|--------|
| Admin | email | manual create (seed/db) |
| Teacher | email | CSV import by Admin |
| Student | **Student ID** | **Self-register** via `/signup` |

### Student Self-Register Flow

```
1. Student → /signup
2. กรอก: Student ID, ชื่อ, นามสกุล, password, confirm
3. CAPTCHA (Cloudflare Turnstile)
4. Validate: Student ID format (regex), uniqueness, password policy
5. Consent: PDPA Privacy Policy checkbox (mandatory)
6. POST /api/signup
   - Rate limit: 5 / hour / IP
   - Create User + Student row
   - Send notification to Admin (Important audit event)
   - Auto-login
7. Redirect → /join (must enter Class Code to access any course)
```

**Why this is safe (ไม่ใช่ free-for-all):**
- ใครสมัครก็ได้ **แต่ไม่มี access ห้องเรียนใดๆ** จนกว่าจะมี Class Code
- Class Code อยู่ในมือครู — เป็น gating mechanism
- Admin เห็นรายชื่อ student ที่สมัครแต่ไม่ enroll → flag spam ได้

### Password Policy

- **Hash:** bcrypt, cost factor = **12**
- **Min length:** 8 (student) / 12 (teacher/admin)
- **ไม่บังคับ complexity**
- **ตรวจ common password list** (top 10000) — reject ถ้าเจอ
- **No forced rotation**

### Initial / Reset Password

- ครู (CSV import): `TempPass-{8 random}` → ส่ง email ครู
- Student reset โดยครู: `Reset-{8 random}` → ครูแจ้งนักเรียนด้วยตนเอง
- `mustResetPwd = true` → บังคับเปลี่ยนตอน login ครั้งถัดไป

### Password Reset Permission

| Actor | รีเซ็ตให้ใครได้ |
|-------|----------------|
| Self | ตัวเอง (email link ครู/admin, in-app เปลี่ยน student) |
| Teacher | Student ที่ enrolled ใน CourseOffering ของตัวเอง |
| Admin | Teacher ทุกคน + Student ทุกคน |

ทุก reset → audit log

### Session

- **JWT in httpOnly cookie** (SameSite=Lax, Secure in prod)
- **CSRF token** (NextAuth handles)
- **Idle timeout:** 4 ชม. (sliding)
- **Absolute timeout:** 12 ชม.
- **Concurrent sessions:** อนุญาต (track in `UserSession` table → revocable)

### Brute Force Protection

- 5 failed / 15 min / (IP+identifier) → lock 30 min
- 10 failed / hour / IP → IP block
- CAPTCHA หลัง 3 failed (Turnstile)
- Audit log ทุก fail + lock

---

## 2. Authorization Matrix

ทุก service → `permissions.assert*()` ก่อน mutation/read

### Domain Permissions

| Action | Admin | Teacher (own course) | Teacher (other) | Student (self in course) | Student (other) |
|--------|:-----:|:--------:|:-----:|:----:|:----:|
| View course feed | ✅ | ✅ | ❌ | ✅ | ❌ |
| View course members (names) | ✅ | ✅ | ❌ | ✅ | ❌ |
| Create CourseOffering | ❌ | ✅ (self only) | ❌ | ❌ | ❌ |
| Regenerate Class Code | ❌ | ✅ | ❌ | ❌ | ❌ |
| Join course (use code) | ❌ | ❌ | ❌ | ✅ (any valid code) | n/a |
| **Score** |||||
| Create/Edit Score Item | ❌ | ✅ | ❌ | ❌ | ❌ |
| Publish Score Item | ❌ | ✅ | ❌ | ❌ | ❌ |
| View own Score Entry (published) | ✅ | ✅ | ❌ | ✅ | ❌ |
| View Score Entry (unpublished) | ✅ | ✅ | ❌ | ❌ | ❌ |
| Edit Score Entry **after publish** | ❌ | ✅ + reason | ❌ | ❌ | ❌ |
| **Attendance** |||||
| Record Attendance | ❌ | ✅ | ❌ | ❌ | ❌ |
| View own Attendance | ✅ | ✅ | ❌ | ✅ | ❌ |
| Back-edit > 24h | ❌ | ✅ (audit) | ❌ | ❌ | ❌ |
| **Assignment & Submission** |||||
| Create Assignment | ❌ | ✅ | ❌ | ❌ | ❌ |
| Edit Assignment before any submission | ❌ | ✅ | ❌ | ❌ | ❌ |
| Edit Assignment after submissions | ❌ | ✅ limited (text only, not duedate) | ❌ | ❌ | ❌ |
| Delete Assignment | ❌ | ✅ (if not graded) | ❌ | ❌ | ❌ |
| View Assignment | ✅ | ✅ | ❌ | ✅ | ❌ |
| Submit / Resubmit | ❌ | ❌ | ❌ | ✅ (own) | ❌ |
| View own Submission | ✅ | ✅ | ❌ | ✅ | ❌ |
| View other's Submission | ✅ | ✅ (own course) | ❌ | ❌ | ❌ |
| Grade / Return Submission | ❌ | ✅ (own course) | ❌ | ❌ | ❌ |
| Re-grade | ❌ | ✅ + reason | ❌ | ❌ | ❌ |
| **Feed Content** |||||
| Create Announcement / Material | ❌ | ✅ | ❌ | ❌ | ❌ |
| Edit own Announcement / Material | ❌ | ✅ | ❌ | ❌ | ❌ |
| Delete Announcement / Material | ❌ | ✅ | ❌ | ❌ | ❌ |
| **Comments** |||||
| Post class-wide comment | ❌ | ✅ | ❌ | ✅ | ❌ |
| Post private comment on submission | ❌ | ✅ (own course) | ❌ | ✅ (own submission) | ❌ |
| Edit own comment (within 5 min) | ✅ | ✅ | ✅ | ✅ | ✅ |
| Hide/moderate comment | ✅ (any) | ✅ (own course) | ❌ | ❌ | ❌ |
| **Files** |||||
| Upload file (assignment) | ❌ | ✅ | ❌ | ❌ | ❌ |
| Upload file (submission) | ❌ | ❌ | ❌ | ✅ | ❌ |
| Download file | ✅ | ✅ (own course) | ❌ | ✅ (if can view parent) | ❌ |
| **Admin-specific** |||||
| View any audit log | ✅ | ❌ | ❌ | ❌ | ❌ |
| Create Teacher (CSV import) | ✅ | ❌ | ❌ | ❌ | ❌ |
| View any user's full data | ✅ (logged) | ❌ | ❌ | ❌ | ❌ |

### L1 Visibility Enforcement

- ❌ **ห้าม** API ใดๆ return Score Entry / Attendance Record / Submission ของคนอื่น ให้ Student
- ❌ **ห้าม** Comment list return private comments ที่ไม่ใช่ของ viewer
- ✅ Members list: return เฉพาะ `firstName`, `lastName`, `studentId` (no email, no scores)

### Implementation Rule

- ❌ ห้าม trust `userId` จาก request body — ใช้ session เท่านั้น
- ❌ ห้าม return PII โดยไม่ผ่าน projection (`select`)
- ✅ ทุก permission case มี test
- ✅ Permission test = merge gate

---

## 3. Input Validation

- **Zod ที่ทุก API entry**
- Schema shared client + server
- ❌ ห้าม `JSON.parse(body)` ตรงๆ
- ✅ ทุก field มี max length

### Special Validations

| Field | Rule |
|-------|------|
| Student ID | regex `^\d{4,10}$` |
| Email | RFC 5322 simple, max 254 |
| Score | `0 ≤ score ≤ fullScore`, max 2 decimal |
| Weight (Score Item) | sum per CourseOffering = 100 (transactional) |
| Class Code | uppercase alphanumeric + hyphen, 8-12 chars, unique |
| Reason | min 5 chars, max 500 |
| Assignment title | 1-200 chars |
| Assignment description | max 10,000 chars (markdown) |
| Comment | 1-2000 chars |
| URL (link attachment) | valid URL + max 2000, blocked schemes (javascript:, data:) |
| File name | sanitize (strip `../`, control chars, max 255) |
| CSV row | column count + each cell validated |

---

## 4. File Upload Security

### Constraints

| Setting | Value |
|---------|-------|
| Max file size | **20 MB / file** |
| Max files / submission | **5** |
| Max files / assignment | **10** (ครูแนบประกอบ) |
| Storage quota / CourseOffering | **500 MB** (กัน abuse) |
| Allowed MIME (Day 1) | PDF, JPG, PNG, WebP, DOCX, XLSX, PPTX, TXT, ZIP |
| Blocked extensions | `.exe .bat .sh .cmd .scr .js .html .htm .svg .vbs .ps1` |

### Upload Hardening

1. **Presigned PUT** — server ออก URL หลัง permission check, expire 5 นาที, single-use
2. **MIME magic byte check** — หลัง upload, server fetch 64 KB → verify magic bytes match claimed MIME
3. **File rename** — เก็บใน R2 ด้วย `cuid + sanitized-name` ห้ามใช้ filename ดิบ
4. **Strip metadata** — รูป → ลบ EXIF (location, device)
5. **Virus scan** — ClamAV via queue (Day 1: PENDING → CLEAN by default; Phase 2: real scan)
6. **Block download** — ถ้า `virusScanStatus = INFECTED`
7. **Path traversal** — sanitize ทุก filename, ห้าม `..`, `/`, null byte

### Download (signed URL)

```
Client requests file URL
   ↓
Server checks permission (assertCanViewParent)
   ↓
Generate presigned GET URL (expire 5 min)
   ↓
Return URL → Client fetches directly from R2
```

- ❌ ห้าม cache signed URL ใน client storage นอกจาก in-memory ระหว่าง view
- ❌ ห้าม log signed URL ใน audit/console
- ✅ Re-generate ทุกครั้งที่ user request

---

## 5. Rate Limiting (Upstash Redis)

| Action | Limit | Window |
|--------|-------|--------|
| Login attempt | 5 | 15 min / (IP+id) |
| Signup | 5 | 1 hour / IP |
| Password reset request | 3 | 1 hour / account |
| Join course (class code) | 10 | 1 hour / student |
| API (auth) general | 100 | 1 min / user |
| API (unauth) | 20 | 1 min / IP |
| CSV import | 1 | 5 min / admin |
| Score bulk save | 10 | 1 min / teacher |
| Assignment create | 20 | 1 hour / teacher |
| Comment post | 30 | 1 min / user |
| File upload (presign) | 20 | 1 hour / user |
| Audit log view | 30 | 1 min / admin |

Response = 429 + `Retry-After`

---

## 6. Data Protection (PDPA)

### Minimal Data

เก็บเท่าที่จำเป็น:
- ✅ ชื่อ-นามสกุล (ครู, นักเรียน)
- ✅ Student ID
- ✅ Email (ครู, admin)
- ✅ Class membership
- ✅ Attendance + Score + Submission content
- ❌ ไม่เก็บ: เลขบัตรประชาชน, วันเกิด, ที่อยู่, รูปโปรไฟล์, ข้อมูลสุขภาพ

### Submission File = Personal Data

ไฟล์ที่นักเรียน upload = personal data
- เก็บ owner mapping ชัด (FileAttachment.uploadedBy)
- ลบเมื่อ student anonymized / retention หมด
- ห้าม share R2 bucket public

### Consent

- Sign-up → consent checkbox บังคับ (PDPA Privacy Policy)
- เก็บ `consentedAt`, `consentVersion`

### Data Subject Rights

| Right | Implementation |
|-------|----------------|
| Access | `/profile/export` → JSON + ZIP ไฟล์ submission |
| Rectification | แก้ชื่อ, email ตัวเองได้ (confirm) |
| Erasure | Soft delete + anonymize (see below) |
| Portability | JSON + CSV export |
| Object | request via admin |

### Soft Delete + Anonymize

ลบ Student:
1. `User.deletedAt = now()`, `isActive = false`
2. `Student.firstName = "Anonymous-{id}"`, `lastName = ""`
3. `Student.anonymized = true`
4. ลบไฟล์ submission ทั้งหมดของคนนี้จาก R2 + soft mark `FileAttachment` deleted
5. แทน text content ของ Submission → `[redacted]`
6. คะแนน + attendance คงไว้ (ผูก enrollment id, no PII)
7. Audit: `STUDENT_ANONYMIZED`

หลัง retention 2 ปี → hard delete

### Encryption

- **At rest:** Neon + R2 default
- **In transit:** HTTPS only (HSTS `max-age=31536000`)
- **Backups:** Neon daily snapshot 7 days

### DPO

- Admin คนแรก = DPO
- ติดต่อที่ `/privacy#contact`
- Response SLA: 30 วัน

### Breach Notification

- แจ้ง PDPC ภายใน 72 ชั่วโมง
- แจ้ง data subject ถ้ากระทบ
- Process: `docs/runbooks/incident.md` (TBD)

---

## 7. Audit Log

### Critical events

- `SCORE_EDIT_AFTER_PUBLISH` (with reason)
- `SCORE_DELETE_AFTER_PUBLISH`
- `PASSWORD_RESET_BY_OTHER`
- `ROLE_CHANGE`
- `USER_CREATED_BY_ADMIN` / `STUDENT_SELF_REGISTERED`
- `USER_LOCKED`
- `STUDENT_ANONYMIZED`
- `COURSE_MEMBER_REMOVED` (with reason — ADR-0013)
- `SESSION_CANCELLED` (with reason — ADR-0015)
- `CONSENT_GRANTED` / `CONSENT_WITHDRAWN`
- `ASSIGNMENT_DELETED_WITH_SUBMISSIONS`
- `COMMENT_MODERATED` (hidden by teacher/admin)
- `FILE_INFECTED_BLOCKED`

### Important events

- `LOGIN_SUCCESS`, `LOGIN_FAILED`
- `SCORE_ITEM_CREATE/DELETE/PUBLISH`
- `ATTENDANCE_BACK_EDIT` (>24h from Session.scheduledStart, with reason — ADR-0016)
- `CSV_IMPORT`
- `CLASS_CODE_REGENERATED`
- `CLASS_CODE_DEACTIVATED` / `CLASS_CODE_REACTIVATED` (ADR-0013 kill switch)
- `CLASS_CODE_EXPIRY_SET` (clearing → before:{expiry}, after:{expiry: null})
- `ADMIN_VIEW_STUDENT_DATA` (เข้าดูข้อมูลรายคน)
- `ASSIGNMENT_CREATE/EDIT/DELETE`
- `ASSIGNMENT_GRADE/RETURN`
- `SUBMISSION_WITHDRAWN` (นักเรียนถอนงานออกจากคิวรอตรวจ — history preserved)
- `COURSE_MEMBER_JOINED`
- `COURSE_MEMBER_RESTORED_BY_REJOIN` (ADR-0013)
- `FILE_UPLOAD` (large only? — log all to keep storage attribution)

### Not logged (verbose)

- Page views (Vercel Analytics)
- Normal attendance/score writes (visible in current row)
- Comment create (visible in DB row; only moderation logged)

### Schema (see Architecture)

### Retention

- 2 ปีการศึกษา → archive
- Hard delete หลัง 5 ปี

### Tamper Resistance

- Admin **ไม่สามารถลบ** audit log ผ่าน UI
- DB-direct deletion = operational emergency + incident record
- Phase 2: append-only with hash chain

---

## 8. Secure Headers (CSP, HSTS, etc.)

```ts
const headers = {
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' challenges.cloudflare.com",
    // dev only: 'unsafe-eval' for R3F HMR
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: *.r2.cloudflarestorage.com",
    "font-src 'self' data:",
    "connect-src 'self' *.neon.tech *.upstash.io *.r2.cloudflarestorage.com",
    "frame-src challenges.cloudflare.com",
    "frame-ancestors 'none'",
    "form-action 'self'",
  ].join('; '),
};
```

---

## 9. Other Hardening

| Concern | Mitigation |
|---------|------------|
| SQL Injection | Prisma parameterized |
| XSS | React escapes; rich text ใช้ Tiptap + sanitize-html allowlist |
| CSRF | NextAuth token + SameSite=Lax |
| Open Redirect | Whitelist redirect URLs |
| Clickjacking | X-Frame-Options DENY + CSP frame-ancestors none |
| MIME Sniffing | X-Content-Type-Options nosniff |
| Dependency vulns | Dependabot + `pnpm audit` ใน CI |
| Secrets | gitleaks pre-commit + Vercel env vars |
| Mass assignment | Prisma `select` projection |
| Timing attack on auth | constant-time (bcrypt) |
| Enumeration | Login error generic |
| IDOR (files) | Permission check ทุก signed URL gen |
| Resource exhaustion | Storage quota + rate limit |
| ZIP bomb | Reject ZIP > 20 MB; don't auto-extract |

---

## 10. Incident Response (skeleton)

1. **Contain** — disable user, revoke sessions, rotate keys ที่ถูก leak
2. **Assess** — audit log, scope
3. **Notify** — DPO → Admin → PDPC 72 ชม → data subject
4. **Remediate** — fix root cause, force password reset
5. **Postmortem** — `docs/incidents/YYYY-MM-DD.md`

---

## 11. Security Testing

ดู [Testing.md](./Testing.md)

- Permission matrix test (CI gate)
- Dependency scan ทุก commit
- OWASP ZAP scan ก่อน production launch
- File upload fuzzing (malicious filenames, large files, fake MIME)
- Pen test ก่อน live (optional)

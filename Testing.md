# Testing.md

Testing strategy สำหรับ Studennnn

> หัวใจสำคัญที่สุด: **scoring math** ผิด = นักเรียนทั้งโรงเรียนเกรดผิด, **authorization** ผิด = privacy/PDPA พัง
> สองอันนี้ได้ test coverage มากที่สุด

---

## 1. Testing Pyramid

```
        ┌────────────┐
        │   E2E      │  ~5%   (Playwright)
        │  10-15 ฉาก  │
        ├────────────┤
        │  Integ.    │  ~25%  (Vitest + Testcontainers Postgres)
        │  API + DB  │
        ├────────────┤
        │   Unit     │  ~70%  (Vitest)
        │  pure fn   │
        └────────────┘
```

| Layer | ใช้กับ | Tool |
|-------|--------|------|
| Unit | Pure functions (scoring, grade, validation, utils) | Vitest |
| Integration | API routes + Prisma + real Postgres + R2 mock | Vitest + Testcontainers + miniO |
| E2E | Critical user journeys | Playwright |

---

## 2. Unit Tests

### Must-cover modules

| Module | Why |
|--------|-----|
| `lib/scoring/weighted-total.ts` | Math correctness across edge cases |
| `lib/scoring/grade.ts` | Boundary conditions (50.0, 49.999, etc.) |
| `lib/scoring/validate-weights.ts` | Sum = 100 invariant |
| `lib/storage/mime-check.ts` | Magic byte verification (don't trust client MIME) |
| `lib/validation/schemas.ts` | All Zod schemas tested |
| `lib/auth/password.ts` | Hash, verify, common password rejection |
| `lib/feed/aggregator.ts` (sort/merge logic, mocked DB) | Order + filter correctness |
| `lib/assignment/grade.ts` | Score Entry propagation logic |

### Edge cases to test

**Scoring:**
- All Score Items unpublished → weighted total = 0
- 1 item published, others not → only published counts
- Score = 0/10 → weighted contribution = 0
- Score = 10/10 → weighted contribution = full weight
- Weight sum = 99.99 (float precision) → reject
- Grade boundary: exactly 50.0 → grade 1.0; 49.99 → grade 0

**MIME check:**
- PDF disguised as `.exe` extension → still PDF, accept
- EXE disguised as `.pdf` → reject
- ZIP bomb (small file, claims large) → reject
- Empty file → reject

---

## 3. Integration Tests

ทดสอบ API route + service + real DB + mocked R2

### Setup

```typescript
// tests/integration/setup.ts
beforeAll(async () => {
  testDb = await startTestcontainerPostgres();
  await runMigrations(testDb);
});

beforeEach(async () => {
  await truncateAllTables(testDb);
  await seedBaseFixtures();  // 1 admin, 2 teachers, classes, subjects
});
```

### Key suites

**Auth:**
- Login → JWT cookie set
- Login wrong pw → 401
- 5 wrong → lockout (30 min)
- Signup → User + Student created
- Signup duplicate Student ID → 409
- Signup without CAPTCHA → reject

**Course Code & Join:**
- Valid code → enrolled
- Invalid code → 404
- Code deactivated → 410
- Already enrolled + retry → 409
- Wrong role tries to join → 403

**Scoring:**
- Create Score Item with weight sum = 100 → ok
- Create exceeds 100 → reject
- Publish → Score Entry visible to student
- Unpublished → student gets 404 on query
- Edit after publish without reason → 400
- Edit after publish with reason → audit log created

**Assignment:**
- Teacher creates scored Assignment → ScoreItem created with same name
- Student submits → SubmissionVersion v1 created
- Student resubmits → SubmissionVersion v2, v1 retained, v2 = current
- Teacher returns → status = RETURNED, student can resubmit
- Teacher grades → Score Entry created (draft)
- Teacher publishes → student sees in feed + score view
- Delete Assignment with submissions → 400 (with override + audit)
- Late submission → `isLate = true`, status = LATE_SUBMITTED

**File upload:**
- Presign with valid params → URL returned
- Presign for course you don't own → 403
- Confirm with mismatched MIME → reject, delete from R2
- Storage quota exceeded → 413
- Download with valid permission → signed URL
- Download without permission → 403

**Comments:**
- Class-wide comment on Assignment → visible to all enrolled
- Private comment on Submission → only teacher + that student see
- Edit own comment within 5 min → ok
- Edit after 5 min → 403
- Teacher hides comment → audit log + visible only to admin

**Audit:**
- All Critical events appear in DB
- Audit log not deletable through API
- Filter + pagination works

---

## 4. Permission Matrix Tests ⭐ (CI gate)

นี่คือ test ที่**สำคัญที่สุด** — ต้องผ่าน 100% ก่อน merge

```typescript
// tests/integration/permissions/matrix.test.ts
const cases: PermissionCase[] = [
  // Course feed
  { role: 'admin',           action: 'view_course_feed',  scope: 'any',        expect: 'allow' },
  { role: 'teacher_owner',   action: 'view_course_feed',  scope: 'own',        expect: 'allow' },
  { role: 'teacher_other',   action: 'view_course_feed',  scope: 'other',      expect: 'deny'  },
  { role: 'student_enrolled',action: 'view_course_feed',  scope: 'enrolled',   expect: 'allow' },
  { role: 'student_other',   action: 'view_course_feed',  scope: 'other',      expect: 'deny'  },

  // Scoring
  { role: 'student_enrolled', action: 'view_score_entry',    scope: 'own_published',   expect: 'allow' },
  { role: 'student_enrolled', action: 'view_score_entry',    scope: 'own_unpublished', expect: 'deny'  },
  { role: 'student_enrolled', action: 'view_score_entry',    scope: 'other_published', expect: 'deny'  },
  { role: 'teacher_owner',    action: 'edit_score_entry',    scope: 'unpublished',     expect: 'allow' },
  { role: 'teacher_owner',    action: 'edit_score_entry',    scope: 'published',       expect: 'allow_with_reason' },

  // Submissions
  { role: 'student_enrolled', action: 'view_submission', scope: 'own',   expect: 'allow' },
  { role: 'student_enrolled', action: 'view_submission', scope: 'other', expect: 'deny'  },
  { role: 'teacher_owner',    action: 'view_submission', scope: 'any_in_own_course', expect: 'allow' },
  { role: 'teacher_other',    action: 'view_submission', scope: 'any', expect: 'deny' },

  // Comments
  { role: 'student_enrolled', action: 'view_class_wide_comment', scope: 'own_course',   expect: 'allow' },
  { role: 'student_enrolled', action: 'view_private_comment',    scope: 'own_thread',   expect: 'allow' },
  { role: 'student_enrolled', action: 'view_private_comment',    scope: 'other_thread', expect: 'deny'  },

  // Files
  { role: 'student_enrolled', action: 'download_file', scope: 'own_submission',         expect: 'allow' },
  { role: 'student_enrolled', action: 'download_file', scope: 'other_submission',       expect: 'deny'  },
  { role: 'student_enrolled', action: 'download_file', scope: 'assignment_material',    expect: 'allow' },
  { role: 'student_other',    action: 'download_file', scope: 'assignment_other_course', expect: 'deny' },

  // Admin
  { role: 'admin',  action: 'view_any_audit_log',       scope: 'any', expect: 'allow' },
  { role: 'teacher', action: 'view_any_audit_log',      scope: 'any', expect: 'deny'  },
  { role: 'student', action: 'view_any_audit_log',      scope: 'any', expect: 'deny'  },

  // ... ครบทุก row ใน Security.md authorization matrix
];

describe.each(cases)('permission: $role / $action / $scope → $expect', testCase => {
  it('enforces matrix', async () => {
    await runPermissionTest(testCase);
  });
});
```

**CI requirement:** ทุก row ใน Security.md § Authorization Matrix ต้องมี case ตรงกัน

---

## 5. E2E Scenarios (Playwright)

### Critical Paths (must pass before launch)

1. **Admin imports teachers via CSV**
   - Login as admin → Upload CSV → preview → confirm → audit log entry visible

2. **Teacher creates course → student joins**
   - Login as teacher → create CourseOffering → copy Class Code
   - Login as new student → signup → enter code → see course in dashboard

3. **Attendance flow**
   - Teacher: open course → record attendance for 5 students
   - Student: see own attendance % in dashboard

4. **Scoring + Publish**
   - Teacher: create 3 Score Items (weights 30/30/40) → enter scores
   - Try to publish without all weights summing 100 → blocked (in this case ok, sum = 100)
   - Publish → student sees scores + grade + weighted total

5. **Score edit after publish (with audit)**
   - Teacher edits a published score → reason modal blocks empty
   - Enter reason → save → audit log entry visible in admin view

6. **Assignment full flow**
   - Teacher: create Assignment (isScored=true, file allowed, due date)
   - Student: see in feed → upload PDF → submit
   - Teacher: open submission → Return with comment
   - Student: get notification → resubmit
   - Teacher: grade 8/10 → publish → student sees score

7. **Privacy: student A vs student B**
   - 2 students in same course, both submit
   - Student A logs in → tries to access `/student/courses/{id}/submissions/{B's id}` → 403
   - Student A tries to download Student B's file via signed URL pattern → 403

8. **Class-wide vs private comments**
   - Teacher posts Assignment
   - Student A asks class-wide question → Student B sees it
   - Teacher replies privately on Student A's submission → Student B does NOT see

9. **Admin audit + moderate**
   - Student posts inappropriate class-wide comment
   - Teacher hides comment → student no longer sees, but admin sees in moderation page
   - Audit log has `COMMENT_MODERATED`

10. **Notifications**
    - Teacher publishes Score Item
    - Student bell badge increments → click → see notification → mark read

11. **Feed (Course)**
    - Teacher creates Announcement + Assignment + Material in sequence
    - Student opens course feed → sees newest first, filter chips work

12. **Feed (User dashboard timeline)**
    - Student enrolled in 3 courses, each has new activity
    - Dashboard shows merged timeline, "upcoming deadlines" section

13. **Self-register spam protection**
    - Sign up 5 times from same IP in 1 hour → 6th rejected

14. **PDPA — data export**
    - Student requests `/profile/export` → JSON downloads with all own data + submission files

15. **PDPA — anonymize**
    - Admin anonymizes a student → name = "Anonymous-xxx", scores remain, submission files deleted

---

## 6. Security Tests (additional layer)

### Static
- ESLint security plugin
- `pnpm audit` ใน CI
- gitleaks pre-commit

### Dynamic
- OWASP ZAP baseline scan (before launch + monthly)
- Custom fuzzing:
  - File upload: malicious filenames (path traversal, null bytes, very long)
  - JSON body: oversized, deeply nested, prototype pollution attempts
  - URL injection in link attachments (`javascript:`, `data:`)

### Manual penetration tests (optional, recommended)
- IDOR enumeration on all `/:id` routes
- Race conditions: concurrent submit + grade
- CSRF: verify cookie + token required

---

## 7. CI Pipeline

```yaml
# .github/workflows/ci.yml (sketch)
jobs:
  lint-typecheck:
    - pnpm install
    - pnpm lint
    - pnpm typecheck

  unit:
    - pnpm test:unit
    - upload coverage

  integration:
    services: { postgres, minio }
    - pnpm test:integration

  permissions:                # ⭐ separate job, separate gate
    - pnpm test:permissions

  e2e:
    - pnpm exec playwright install --with-deps
    - pnpm build
    - pnpm test:e2e

  security:
    - gitleaks
    - pnpm audit --prod
```

**Branch protection:** all jobs must pass before merge to `main`

---

## 8. Manual QA

### Seed Script

```bash
pnpm seed:dev
```

สร้าง:
- 1 Admin
- 5 Teachers (สอนวิชาต่างกัน)
- 30 Students (ม.4/1, ม.4/2)
- 10 CourseOfferings (ครู × ห้อง × วิชา)
- 3 Assignments per course (1 scored + dueAt, 1 scored + no dueAt, 1 ungraded)
- Sample submissions + scores + attendance

### Manual QA Checklist (per release)

- [ ] Signup → Join → see course
- [ ] Login each role → correct dashboard
- [ ] Mobile view: student dashboard, feed, submission form
- [ ] 3D landing loads + responds to interaction
- [ ] Feed cards: layout looks "modern + ทางการ"
- [ ] Empty states show + look intentional
- [ ] Error states (404, 500) styled
- [ ] Keyboard navigation in score grid
- [ ] Accessibility: ⌨️ tab order, screen reader names
- [ ] Lighthouse Performance ≥ 80
- [ ] No console errors / warnings

### User Testing (recommended before launch)

- 2-3 ครูจริง ทดลองสร้าง CourseOffering + ใส่คะแนน + ตรวจการบ้าน 1 cycle
- 5-10 นักเรียนจริง ทดลอง signup + join + submit + ดูคะแนน
- รวบรวม feedback → adjust UI/flow ก่อน launch จริง

---

## 9. Coverage Targets (loose)

- ❌ ไม่บังคับ % coverage รวม (lead to fake tests)
- ✅ บังคับ:
  - `lib/scoring/*` — 100% line + branch
  - `lib/auth/permissions.ts` — 100% line + branch
  - `lib/storage/signed-url.ts` + `mime-check.ts` — 100%
  - All Zod schemas — at least 1 happy + 1 invalid test per field
- ✅ Permission matrix: ทุก row ใน Security.md ต้องมี test case ตรงกัน

---

## 10. Test Smell ที่ห้ามมี

- ❌ Test ที่ mock ทั้ง permission check (= test ปลอม)
- ❌ Test ที่เปลี่ยน database schema เพื่อให้ผ่าน
- ❌ Test ที่ใช้ `setTimeout` (flaky) — ใช้ Playwright auto-wait
- ❌ Test ที่ commit เป็น `skip` หรือ `todo` โดยไม่มี link issue
- ❌ Snapshot test ของ HTML ทั้งหน้า (เปราะ) — snapshot เฉพาะ data structure
- ❌ Test ที่ depend on order ของ test ก่อนหน้า

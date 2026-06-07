# ADR-0026 — Admin User Drill-Down + Password Reset (No Plaintext, Bcrypt-Only)

## Status

Accepted — 2026-06-05 (Phase 10B) — Extends [CLAUDE.md § 1 "Admin ไม่ใช่ผู้ใส่ข้อมูล"](../../CLAUDE.md). Does not supersede prior ADRs.

## Context

Phase 10 grill Q1 surfaced a fundamental misalignment between the product owner's intuition ("Admin should see everything, including passwords") and CLAUDE.md's hard rules ("เก็บ password เป็น plain text — ❌", "Log password / token / cookie — ❌"). Bcrypt hashes are one-way; there is no value to "view". The actual operational need behind the request — Admin recovering access for a teacher who forgot their password — is well-served by a generated-temporary-password flow, which several systems use (AWS IAM, Vercel, NextAuth itself for the existing teacher CSV import path).

This ADR records the user-visible surface and the boundaries that keep it safe.

## Decision

### 1. Drill-down read surface — `/admin/users/[id]`

A new Server Component page at `/admin/users/[id]` showing the **full** non-secret profile of any User row:

- Identity: email / studentId, firstName, lastName, role, anonymizedAt
- Auth meta: lastLoginAt, mustResetPwd, failedLoginCount, lockedUntil
- Relationships:
  - Teacher: list of `is_homeroom_of` (if any) + active CourseOfferings this term + total enrollments under those
  - Student: classroom + active enrollments this term (course + teacher per row)
- Audit trail: last 50 AuditLog rows where `actorId = userId` OR `targetId = userId`

**Not shown:** `passwordHash` (the bcrypt hash itself). It is in the DB but never reaches the wire. This is the entire "what's the difference between view-everything and view-plaintext-password" answer — Admin sees every meaningful column; the secret material is `passwordHash` which would be useless even if leaked.

Authorization: ADMIN role only; ADMIN cannot mutate score / attendance / submission via this page (only the reset-password action below).

### 2. Reset-password action — generate temp + reveal once + audit

A Server Action `resetUserPasswordAction(userId)` that:

1. Generates a cryptographically-strong temporary password (16 chars: 4 words from a Thai-friendly wordlist + 4 digits, or `crypto.randomBytes(12).toString('base64url')`).
2. Hashes it via bcrypt and writes to `User.passwordHash`.
3. Sets `User.mustResetPwd = true` so the user is forced to pick a new password on next login (the same machinery already in place for the CSV-import teacher flow).
4. Sets `User.failedLoginCount = 0` and `User.lockedUntil = null` (the reset undoes the lockout, which is operationally what the Admin is trying to achieve).
5. Emits `PASSWORD_RESET_BY_ADMIN` audit event (Important tier) with:
   - `targetType = "User"`, `targetId = userId`
   - `targetLabel = "<firstName> <lastName> (<email or studentId>)"` (ADR-0027 snapshot)
   - `before = { mustResetPwd: prev.mustResetPwd, lockedUntil: prev.lockedUntil }`
   - `after = { mustResetPwd: true, lockedUntil: null }`
   - **`reason` is NOT required** for password reset — the action itself is the reason; forcing the Admin to explain "why" every time creates a friction tax on a routine recovery operation. If a hostile Admin abuses this, the audit row is the trail.
   - **The temporary password itself is NEVER stored in the audit payload.** This is the CLAUDE.md hard rule "Log password / token / cookie / signed URL → ❌" applied as-is.
6. Returns the temp password to the calling Server Action result so the caller (the drill-down page) can render it once in a `<output>` block + copy button. The Admin is responsible for getting it to the user via an out-of-band channel (LINE, Slack, SMS, written note).
7. The temp password is gone the moment the page is closed or refreshed. There is no "show me the temp password I generated yesterday" endpoint. This is by design: the only durable record of any password is the bcrypt hash.

### 3. UX — single dialog, one shot, no second-screen confirmation

The drill-down page has a single button "รีเซ็ตรหัสผ่าน" that opens a Pattern-7 confirm dialog. On confirm, the Server Action returns the temp password, and the dialog state flips to a reveal pane:

```
┌───────────────────────────────────────┐
│  รหัสผ่านชั่วคราว                       │
│  ┌──────────────────────────────┐ 📋  │
│  │ tx9-Bk2-PqZ-7Lm3              │     │
│  └──────────────────────────────┘     │
│  ⚠ เก็บไว้เลย — หน้านี้รีเฟรชแล้วจะหาย   │
│  ผู้ใช้ต้องเปลี่ยนรหัสผ่านใหม่ทันที       │
│                                       │
│  [ ปิด ]                              │
└───────────────────────────────────────┘
```

No additional confirmation. No email of the temp password (out-of-scope: no transactional email infrastructure in Studennnn).

### 4. Boundaries that stay hard

- ADMIN cannot edit the target User's `firstName`, `lastName`, `email`, `role`, `studentId`. Those are operations for the original sign-up path / a future CSV-import update path. This ADR is narrowly about password recovery.
- ADMIN cannot delete a User. Anonymization is a separate, audited flow (`USER_ANONYMIZED` event already in the enum).
- ADMIN cannot impersonate. There is no "log in as this user" button.
- ADMIN cannot view the temp password of *another Admin's* reset action. The temp password only exists in the result of the calling Server Action; once revealed, it's not stored.

## Consequences

### Positive

- **The operational need is met.** A teacher locks themselves out → Admin opens `/admin/users/[teacher-id]` → clicks reset → reads the temp password to the teacher in person → teacher logs in → picks a new password. Same flow that ships today for new-teacher onboarding via CSV import; reused intentionally.
- **The CLAUDE.md hard rule is not violated.** No plaintext password is stored in the DB, the audit log, the session, or any log file. The temp password exists in a single in-memory Server Action return value for the lifetime of one page render.
- **The audit trail captures the action without storing the secret.** A future investigation "who reset what when" reads cleanly from `PASSWORD_RESET_BY_ADMIN` rows; the secret material is intentionally absent.
- **`mustResetPwd = true` + force-change-on-next-login means the temp password's window of exposure is brief.** Even if the temp password is overheard at the teachers' room, the very next login mints a new password the Admin never saw.
- **Lockout is implicitly undone.** A teacher who is locked out from `failedLoginCount` overrun no longer needs a separate "unlock user" path; reset-password handles it because the operational intent is the same.

### Negative

- **No "I forgot to write down the temp password" recovery.** If the Admin closes the reveal pane without copying, the only path is to reset again — generating a fresh temp password and a second audit row. Acceptable; the previous attempt's audit row stays as evidence.
- **The wordlist / random-bytes generator is a tiny new piece of code we have to own.** Mitigation: it lives in `lib/auth/temp-password.ts` as a 10-line pure helper, exhaustively unit-tested.
- **No transactional email.** The Admin has to relay the temp password manually. Not a regression — the existing CSV-import flow has the same constraint and operationally it has not been a problem (Thai schools' Admin and teachers share an office; out-of-band relay is the norm).

### Rejected Alternatives

- **Store plaintext password.** Violates CLAUDE.md hard rule. Non-starter.
- **Email the temp password to the user.** Requires transactional email infrastructure (Resend / SendGrid / SES) the project does not have. Phase-2-or-later concern.
- **Let Admin set a chosen password directly.** Creates a vector where an Admin gets to know any user's password permanently. Worse posture than the temp-password-with-must-reset flow.
- **Show the temp password persistently on the user detail page.** Means the secret material lives on disk somewhere (Next.js page cache, browser memory, etc.) for longer than it needs to. Reveal-once is the minimum-exposure design.

## References

- CLAUDE.md § 1 "Admin ไม่ใช่ผู้ใส่ข้อมูล" + § Hard Rules password/log items
- [ADR-0027](./0027-audit-log-rendering-thai-sentences-and-target-label-snapshot.md) — `targetLabel` snapshot is captured by this ADR's reset action so the audit viewer renders cleanly
- Phase 10 grill Q1 (this ADR's origin)
- HANDOFF.md § "Phase 1-3 hotfix history" — temp-password + mustResetPwd machinery already shipped for CSV-import path

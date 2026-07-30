# Post-Reset Restart Checklist

**Status:** Open
**Updated:** 2026-07-31
**Scope:** bringing the emptied Production instance back into service after the
2026-07-29 D0/D1 cutover and the separately authorized full application-data
reset

## Starting state

Production and the isolated Neon QA branch each contain exactly one `User` row:
an active `ADMIN` whose sign-in identifier is a username, with `email` and
`emailVerifiedAt` null and no `AuthIdentity`. Every other application table is
empty. The pre-reset aggregate inventories under
`.local-storage/database-reset-evidence/` are row counts only and cannot
restore anything.

All ten Prisma migrations are applied on both databases and `main` carries the
matching application code, so nothing in this checklist requires a migration.

Order matters: step 1 is a prerequisite for step 2, and step 2 is a
prerequisite for step 3.

## 1. Configure transactional email before touching the owner account

Nothing in the recovery path works without a real email provider.
`resolveEmailSender` is fail-closed: unless **both** `RESEND_API_KEY` and a
verified `RESEND_FROM` are present it returns the log-only sender, which
transmits nothing. In Production that means the verification link is never
sent and never logged, so the flow appears to succeed and silently strands the
account.

- [ ] Verify the sending domain in Resend (SPF, DKIM, DMARC).
- [ ] Set `RESEND_API_KEY` and `RESEND_FROM` in the Vercel Production
      environment and redeploy so the runtime picks them up.
- [ ] Confirm delivery with a throwaway address before using the owner
      account. A rejected or quarantined first send is much cheaper to discover
      here than mid-recovery.

## 2. Give the sole Admin a recoverable way back in

The owner account's password is currently the only way into Production. It
exists in ignored local secret storage and as a bcrypt hash in the database. If
it is lost, the instance is unrecoverable — there is no second Admin, no email
recovery target, and no linked Google identity.

Profile now offers first-time email setup on a username-only account, so this
is self-service:

- [ ] Sign in as the Admin, then open Profile **within 20 minutes** of signing
      in. Both actions below require the pragmatic re-authentication window.
- [ ] Under **อีเมล**, submit the address to attach. The verification link goes
      to that address, is single-use, and expires in 15 minutes. Confirming it
      sets the email, marks it verified, and signs every other device out.
- [ ] The sign-in identifier is deliberately unchanged: it only tracks the email
      for accounts whose identifier already was the email. The owner keeps
      signing in with the username and gains email recovery.
- [ ] Under **การเข้าสู่ระบบด้วย Google**, link a Google account whose address
      equals the account email. The service refuses any other address, so this
      section stays explanatory until step 2 completes.
- [ ] Consider creating a second Admin once Teacher onboarding works, so a
      single lost credential is no longer a total loss.

## 3. Confirm the environment matches the custom domain

The primary origin moved to `https://beagleclassroom.com`. Anything deriving an
absolute URL from `AUTH_URL` — emailed verification and recovery links, course
invite links — points at whatever this value says, so a stale value produces
links that work in the browser bar but fail on arrival.

- [ ] `AUTH_URL` is the custom domain, not the `.vercel.app` host.
- [ ] `NEXT_PUBLIC_APP_URL` agrees with it.
- [ ] Google Cloud Console has
      `https://beagleclassroom.com/api/auth/callback/google` in the authorized
      redirect URIs, alongside the existing hosts.
- [ ] The identity flags are on: `IDENTITY_FOUNDATION_ENABLED`,
      `IDENTITY_FOUNDATION_MUTATIONS_ENABLED`,
      `NEXT_PUBLIC_GOOGLE_SIGNIN_ENABLED`.
- [ ] `IDENTITY_TERMS_VERSION` and `IDENTITY_PRIVACY_VERSION` are non-empty;
      identity mutations fail closed when either is blank.

## 4. Manual acceptance that automation cannot cover

The D1 record states these explicitly as separate manual checks. Everything
else in that record is automated and already passing.

- [ ] Interactive Google consent against Production: choose an account, land
      back on the callback, and confirm the session is the expected user.
- [ ] Real Resend delivery for password recovery and verified-email change:
      the message arrives, the link resolves on the custom domain, and reusing
      it is rejected.

## 5. Repopulate the instance

The empty database means the first real run of each onboarding path is also its
Production acceptance. Work outward from the Admin:

- [ ] Issue a Teacher Invite from `/admin/teachers/invites` and accept it end to
      end. Admin no longer creates Teacher accounts or passwords; the invite is
      email-bound and single-use.
- [ ] Have the Teacher create a CourseOffering using the teacher-owned free-text
      labels. There is no Academic Year, Term, Class, or Homeroom to configure
      any more.
- [ ] Register a Student both ways — Google and email/password — and join the
      course through the class code or QR.
- [ ] Exercise the teaching loop once: post to Feed, publish an Assignment,
      submit, review, publish a score, take attendance, upload a private file.

## 6. Retire the Quiz pilot allowlist

The owner accepted the pilot on the restored course, so ADR-0045 removed
per-course gating: `QUIZ_ENABLED` and `QUIZ_MUTATIONS_ENABLED` now cover every
course alike. Before that change the allowlist named courses deleted in the
reset, which made Quiz unreachable in Production while the configuration looked
set — a new course would have needed its id added and a redeploy.

- [ ] Delete `QUIZ_PILOT_COURSE_IDS` from the Vercel Production environment and
      from `.env.local`. A leftover value is ignored, so this is tidiness rather
      than a fix.
- [ ] Confirm `QUIZ_ENABLED=1` and `QUIZ_MUTATIONS_ENABLED=1` in Production, and
      redeploy so the change takes effect.
- [ ] Check one course that was never on the old allowlist: its Quiz tab renders
      and `/teacher/courses/<id>/quizzes` no longer returns 404.
- [ ] Note that `.env.local` points at the Production database, so `pnpm dev`
      on port 3000 now exercises Quiz against real courses. Prefer
      `pnpm dev:qa` on port 3100, which swaps in the isolated QA branch.

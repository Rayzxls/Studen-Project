# Identity V2 Foundation Rollout

**Status:** Stage 2A accepted; Stage 2B Teacher Invite issue and Google-first
Teacher acceptance transaction slices accepted on isolated Neon QA on
2026-07-24  
**Production:** unchanged  
**Runtime:** disabled by default

## Delivered

- Added compatibility fields to `User` for unique verified email, separate real
  first/last name, session versioning, deletion scheduling, and anonymization.
- Added `AuthIdentity`, `TeacherInvite`, `ConsentAcceptance`, `IdentityToken`,
  and `RealNameHistory` persistence.
- Extended `UserSession` with re-authentication and revocation metadata.
- Added `DELETION_PENDING` without removing the legacy account states.
- Added pure policy helpers for email and real-name validation, Teacher Invite
  expiry, required consent versions, stable Default Avatar variants, session
  expiry, deletion recovery, and name-change continuity.
- Added fail-closed flags:
  - `IDENTITY_FOUNDATION_ENABLED`
  - `IDENTITY_FOUNDATION_MUTATIONS_ENABLED`
- Added the first Stage 2B application-service slice for issuing, replacing,
  and revoking Teacher Invites:
  - only an active Admin can mutate Invites;
  - email matching is normalized and role collisions fail closed;
  - raw Invite tokens are returned once and only SHA-256 hashes are persisted;
  - every new Invite atomically revokes all prior pending Invites for that email;
  - explicit revocation requires an Admin reason;
  - issue, replacement, and revocation are recorded as Important Audit events.
- Added Google-first Teacher Invite acceptance as one serializable transaction:
  - the raw Invite token is hashed before lookup and never persisted or audited;
  - Google email must be verified and exactly match the normalized Invite email;
  - existing User/Role and Google-provider collisions fail closed;
  - User, Teacher profile, Google `AuthIdentity`, two exact-version consent
    records, Invite acceptance, and three Audit events commit or roll back
    together;
  - Invite expiry, prior acceptance, revocation, and concurrent acceptance all
    fail closed;
  - the legacy non-null password column receives a precomputed bcrypt sentinel
    whose random plaintext was discarded. It is not a fallback credential and
    avoids per-request bcrypt work before the Invite is validated.

Mutations require both flags and configured Terms/Privacy versions. Flags
default to `0`; consent versions default to empty and therefore fail closed.

## Database Evidence

Migration:

`20260724010000_add_identity_v2_foundation`

The migration was deployed only to the isolated Neon QA branch. The guarded
post-migration verifier reported:

- 12 existing Users.
- 0 Users implicitly migrated into Identity V2.
- 0 non-default session-version values.
- 0 rows in every new Identity V2 table.
- Existing account states remained available and `DELETION_PENDING` was added.
- The Teacher Invite integration test used a disposable Admin and email on the
  isolated QA branch, proved replacement/token-hash/revoke/audit behavior in
  real serializable transactions, and removed all test rows afterward.
- The Teacher onboarding integration test issued a disposable Invite through
  the real Invite service, accepted it through the real Prisma onboarding
  adapter, and proved the User, Teacher, Google identity, exact two consent
  records, accepted Invite, and three Audit events committed atomically. A
  second acceptance attempt rolled back, and all disposable rows were removed.

This proves the migration is additive and the Teacher acceptance transaction
works on isolated QA. It does not prove Google token validation, web routes,
UI, email delivery, Student onboarding, existing-account linking, recovery, or
deletion workflows.

## Verification

- Prisma format, validate, and client generation passed.
- Focused Identity/account/release-gate tests passed.
- Full unit suite passed after the Teacher acceptance slice: 665 tests across
  68 files.
- The focused Invite issue and Teacher acceptance unit suites passed.
- The isolated-Neon Teacher Invite issue and acceptance integration suites
  passed.
- TypeScript passed.
- Targeted ESLint passed with zero errors.
- The dependency release gate passed with no baseline increase:
  637 blockers, 240 review findings, 877 total findings.

## Boundaries

- Production schema, data, secrets, and feature flags were not changed.
- Google OAuth is not wired into NextAuth yet.
- The acceptance service accepts only a trusted Google assertion. A future
  OAuth adapter must validate issuer, audience, signature, expiry, nonce, and
  verified email before calling it; raw browser claims are never trusted.
- Teacher Invite routes, OAuth adapter, email delivery, and Admin/onboarding UI
  are not enabled yet.
- No legacy Student Number, Credentials, Academic Year, Term, Class, or
  Homeroom dependency has been removed yet.
- No Production or shared development data reset is authorized by this stage.

## Next Slice: Stage 2B

1. Add Google-first Student onboarding and existing-account provider linking,
   followed by session revocation, verified-email change, recovery, and
   Deletion Pending services. Teacher Invite issue/replace/revoke/accept is
   complete at the service and Prisma transaction layer.
2. Prove one provider identity maps to one User, one User has one Role, and
   account/session mutations are atomic. Invite email matching, replacement,
   expiry, revocation, and acceptance races are already covered.
3. Keep all route and UI entry points disabled until isolated-QA integration
   tests pass.
4. Do not switch the default login or remove legacy fields in Stage 2B.

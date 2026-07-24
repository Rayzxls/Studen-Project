# Identity V2 Foundation Rollout

**Status:** Stage 2A accepted; Stage 2B Teacher Invite issue, Google-first
Teacher acceptance, Google-first Student onboarding, returning-user sign-in,
authenticated-Profile provider linking, optional fallback-password setup, and
the Google ID-token verifier accepted on isolated Neon QA on 2026-07-24  
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
- Added Google-first Student self-registration as one serializable transaction:
  - no Invite is required, matching the ADR-0041 Student onboarding path;
  - Google email must be verified, and the Student states a real first/last
    name explicitly rather than inheriting the Google display name;
  - an email that already belongs to any account fails closed, so an email
    match never auto-links and a different Role is never converted;
  - an already-linked Google identity fails closed and is left to the future
    sign-in and provider-linking slices;
  - User, Student profile, Google `AuthIdentity`, two exact-version consent
    records, and three Audit events commit or roll back together;
  - the legacy required unique `Student` identifier column receives an opaque
    `identity-v2-unassigned:` placeholder. It is never displayed, never typed
    by a person, and never used for authentication or lookup; the dependency
    gate records it as a reviewed compatibility bridge.
- Extracted the shared consent-version check and the disabled compatibility
  password hash into the identity foundation so both onboarding paths use one
  implementation.
- Added Google sign-in resolution for a returning User:
  - the Google subject, not the address, is the stable link, so a changed
    Google email is recorded on the identity but never overwrites the verified
    account email;
  - an unknown Google subject is reported rather than silently creating or
    linking an account, leaving the Role gate to the onboarding paths;
  - suspended, deletion-pending, terminated, and anonymized accounts fail
    closed through the existing authentication availability predicate and
    write no sign-in Audit row;
  - stale consent authenticates but returns `requiresConsentRefresh` instead of
    locking a real User out of their own academic record;
  - last-use stamping and the `LOGIN_SUCCESS` Audit row commit together.
- Added Google linking from an already-authenticated Profile:
  - ADR-0041 forbids linking by email match alone, so ownership comes from the
    authenticated Profile plus a re-authentication no older than twenty
    minutes;
  - the verified Google address must equal the account email, keeping one
    authoritative address per account and pushing a different address through
    the separate email-change flow;
  - a Google subject already linked to this or another account fails closed,
    and one User keeps at most one Google identity in this release;
  - unavailable accounts fail closed and nothing is linked;
  - the link and its new Critical `AUTH_PROVIDER_LINKED` Audit row commit
    together.
  - Linking by fallback password is deliberately not implemented: optional
    fallback-password setup does not exist yet, so there is nothing to verify
    against.
- Added optional fallback-password setup on the caller's own account:
  - the same twenty-minute re-authentication rule applies, and the password is
    validated and rejected for length or commonness before any hashing or
    database work;
  - a Google-first account carries the disabled compatibility hash, so the
    service reports whether a real credential was created or replaced;
  - the password, its hash, and its length are never written to the Audit row;
  - existing sessions are intentionally untouched, because session issue and
    revocation belong to their own slice and splitting that rule across two
    services would make session behaviour unpredictable.
- Added the Google ID-token verifier that produces the trusted assertion every
  identity service consumes:
  - signature, issuer, audience, and expiry are checked through `jose` against
    Google's published key set, with both accepted issuer spellings;
  - the nonce is required, not optional, so a token captured elsewhere cannot
    be replayed into this application;
  - an unverified or missing email is refused before any account is touched,
    and the address is normalized once at the boundary;
  - the underlying verification failure is never surfaced, so a caller cannot
    learn which part of a forged token to change next;
  - `GOOGLE_CLIENT_ID` is the required audience and defaults to empty, so the
    verifier refuses to build and nothing can reach a service.
- Wired a flag-gated Google provider into NextAuth beside the live Credentials
  provider:
  - `googleProvidersIfEnabled` is appended, never inserted, and fails closed on
    the identity mutation flag or a missing client id/secret, so with the flags
    off the deployed provider list is exactly the Credentials entry it is today;
  - NextAuth runs the OIDC checks — pkce, state, and the nonce it generates —
    and the `profile` step routes the verified identity through the existing
    Prisma sign-in resolver, so last use and the `LOGIN_SUCCESS` Audit row are
    written by the same audited path;
  - the requested scope is `openid email` only;
  - an account that owes fresh consent is refused at the provider because no
    consent-refresh surface exists yet; refusing is reversible and keeps the
    flag off until that surface ships.
- Added a reusable, flag-gated Google sign-in button on the login page:
  - rendering is gated by `NEXT_PUBLIC_GOOGLE_SIGNIN_ENABLED`, defaulting off,
    so the deployed login page is visually unchanged;
  - the flag is presentation only and defence-in-depth: the server provider
    gate is the real control, so forcing the flag on can only show a button
    that fails, never a working sign-in past the server gate;
  - the button reuses the existing `btn-secondary` design-system control and
    starts `signIn("google")`, disabling itself once the redirect begins.

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
- The Student onboarding integration test registered a disposable Student
  through the real Prisma adapter and proved the User, Student profile with a
  synthetic legacy identifier, Google identity, exact two consent records, and
  three Audit events committed atomically. A second Google account claiming the
  same verified email was rejected and left exactly one User; all disposable
  rows were removed.
- The Google sign-in integration test registered a disposable Student, resolved
  a later sign-in through the real adapter to the same User, and asserted the
  stamped last-use time, the recorded provider email, and exactly one
  `LOGIN_SUCCESS` Audit row. An unknown Google subject created no identity or
  User, and a suspended account failed closed with no sign-in Audit row.
- The provider-linking integration test linked Google to a disposable
  password-era Teacher through the real adapter, asserted exactly one identity
  and one `AUTH_PROVIDER_LINKED` Audit row, and proved that a stale
  re-authentication and a second Google subject both fail closed while leaving
  the identity count unchanged.
- The fallback-password integration test proved with real bcrypt that the
  disabled compatibility hash verifies against no chosen password, that setting
  a fallback password replaces it with a credential the same password verifies
  against, that a wrong password still fails, that the Audit row contains no
  trace of the password, and that a stale re-authentication leaves the original
  hash in place.

This proves the migration is additive and that the Teacher acceptance, Student
self-registration, and returning-user sign-in transactions work on isolated QA.
It does not prove Google token validation, web routes, UI, email delivery,
existing-account linking, session issue, recovery, or deletion workflows.

## Verification

- Prisma format, validate, and client generation passed.
- Focused Identity/account/release-gate tests passed.
- Full unit suite passed after the login-button slice: 715 tests across 75
  files. The Next.js Production build passed after the auth wiring and the
  login-page change.
- The focused Invite issue, Teacher acceptance, Student onboarding, Google
  sign-in, provider-linking, and fallback-password unit suites passed.
- The isolated-Neon Teacher Invite issue, Teacher acceptance, Student
  onboarding, Google sign-in, provider-linking, and fallback-password
  integration suites passed.
- The full isolated-Neon Integration suite passed 181 tests across 23 files
  after the Student onboarding slice, and passed again unchanged on a second
  run.
- TypeScript passed.
- Targeted ESLint passed with zero errors.
- The dependency release gate passed with no baseline increase:
  637 blockers, 240 review findings, 877 total findings.

## Boundaries

- Production schema, data, secrets, and feature flags were not changed.
- The Google provider is registered only when both identity flags and the
  OAuth client are configured; Production has the flags off, so the Credentials
  login path is unchanged. The login button is behind its own default-off
  public flag, so the deployed login page is visually unchanged. No new page or
  route is added yet.
- New-user onboarding is partially built. The `/onboarding` page, its form, the
  completion server action, the signed pending-handoff token, and the
  orchestrator all exist and are tested; the page renders the collected form
  from a valid pending token and an empty "start again" state otherwise, gated
  by the identity mutation flag. What is not wired is the OAuth-side glue that
  mints the pending cookie for a brand-new Google user and the post-onboarding
  session establishment. Both require a live Google OAuth credential and a
  browser walkthrough, so the sign-in button flag stays off until that is done.
- Google is still not wired into NextAuth. The ID-token verifier exists and is
  tested, but no route, callback, or provider calls it yet, and the live
  Credentials login path is unchanged.
- Every identity service accepts only a verified Google assertion. The verifier
  is the only supported way to produce one; raw browser claims are never
  trusted.
- Teacher Invite routes, OAuth adapter, email delivery, and Admin/onboarding UI
  are not enabled yet.
- No legacy Student Number, Credentials, Academic Year, Term, Class, or
  Homeroom dependency has been removed yet.
- No Production or shared development data reset is authorized by this stage.

## Next Slice: Stage 2B

1. Wire the ID-token verifier into a real OAuth callback that generates and
   stores the nonce, then route its verified assertion to sign-in, onboarding,
   or linking. After that: the password-guarded linking path, session
   issue/revocation, verified-email change, recovery, and Deletion Pending.
   Teacher Invite issue/replace/revoke/accept, Student self-registration,
   returning-user sign-in resolution, authenticated-Profile provider linking,
   optional fallback-password setup, and ID-token verification are complete at
   the service layer.
2. Prove one provider identity maps to one User, one User has one Role, and
   account/session mutations are atomic. Invite email matching, replacement,
   expiry, revocation, acceptance races, Student email/identity collisions, and
   sign-in availability/consent rules are already covered.
3. Keep all route and UI entry points disabled until isolated-QA integration
   tests pass.
4. Do not switch the default login or remove legacy fields in Stage 2B.

## Open Compatibility Debt

The `Student` row still requires a unique legacy identifier column that
ADR-0039 retires. Identity V2 accounts fill it with a synthetic placeholder.
Dropping the column belongs to the approved destructive migration, which is
gated by `qa:release:dependencies:strict` reaching zero blockers and by a
separate named approval. No Production or shared development reset is
authorized by this stage.

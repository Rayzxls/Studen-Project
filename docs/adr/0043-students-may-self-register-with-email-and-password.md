# Students may self-register with email and password

Beagle Classroom will offer students a second self-registration path — an email
address and a password they choose — alongside the Google-first sign-up of
ADR-0041, which this decision revises. Not every student has a Google account,
and the school wants a way in that does not depend on one. Teachers still require
an emailed Invite and Admins a secret-gated bootstrap; only the Student path
gains the additional option.

The account this creates is an ordinary identity-v2 Student: one verified-later
email as the canonical identifier, a real chosen password, a real first and last
name, and the two versioned consent acceptances — no Student Number in identity,
so ADR-0039 still holds. The email is stored but left unverified at sign-up
(`emailVerifiedAt` null). Ownership of the address is proven afterward rather
than up front: the owner links Google from Profile, where the Google email must
match, or completes a future verification step, which the ADR-0042 email port now
makes straightforward.

Deferring verification is a deliberate trade-off. Someone can register another
person's address, which blocks that person's later Google sign-up until an Admin
reconciles it, and password recovery and email change assume a controlled
address. These are accepted for a single-school deployment where the Admin can
resolve a collision by hand and where an immediate, dependency-free sign-up is
worth more than a verification round trip; the email port keeps a hardening step
available when the volume or the risk warrants it.

The path is additive and flag-gated: the email/password form appears only while
the identity mutation flag is on, with Google sign-up shown beside it, and a
duplicate email fails closed. Sign-up is rate-limited per address source. This
keeps one User to one Role and one email, does not reintroduce Student Number as
identity, and leaves the Google-first flow, Teacher Invite, and Admin bootstrap
unchanged.

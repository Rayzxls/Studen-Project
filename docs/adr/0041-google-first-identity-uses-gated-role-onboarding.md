# Google-first identity uses gated role onboarding

Beagle Classroom will use one unique verified email per User Account and Google as the primary authentication path, while preserving an optional email/password fallback on the same immutable internal User identity.

Google is an authentication provider, not an identity authority for the learning domain. Google display name and profile image may be arbitrary, so every new User explicitly enters a real first name and last name in Beagle Classroom, starts with a privacy-safe Default Avatar, and may upload an Avatar later. Login requests only the minimum identity and verified-email scopes; future integrations require separate feature-specific consent.

Role assignment is gated by the onboarding path:

- A Student may create an account after Google authentication and versioned Terms and Privacy acceptance, then joins a CourseOffering separately with its Class Code.
- A Teacher requires an email-bound, single-use Teacher Invite that expires after seven days.
- An Admin is provisioned only by a secret-gated Bootstrap/Deployment command and links Google from the pre-provisioned account.

An email match never auto-links an existing account. Linking requires the current fallback password or an already authenticated Profile. One User Account has one Role in this release; a Role collision fails closed instead of converting the account or creating a duplicate. Multi-role and global multi-tenant identity remain separate future architecture.

Fallback Password setup is optional and recovery uses a single-use verified-email link. Sessions last no more than 30 days and expire after seven inactive days; sensitive identity changes require re-authentication. Course peers and Teachers do not see a Student's email. Duplicate names are supported through stable Default Avatar variants and temporary audited name-change continuity rather than exposed identifiers.

This design adds onboarding and recovery work but removes Student Number from authentication, avoids privilege inference from a Google domain, minimizes OAuth scope, and keeps academic relationships stable when an email, name, Avatar, or authentication provider changes.

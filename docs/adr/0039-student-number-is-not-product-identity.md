# Student number is not product identity

Beagle Classroom will not use a Student Number as an authentication identifier, authorization input, required profile attribute, academic relationship key, or normal display field.

The prior model made Student Number both a human-facing school attribute and a login identifier. That coupling simplified early Credentials login but made Google-first onboarding harder, exposed institutional metadata throughout teaching surfaces, and confused the human-entered number with internal foreign keys that identify a User.

Authentication will identify a User Account through one unique verified email, with Google and optional fallback credentials resolving to the same immutable internal User identity. Enrollment, scores, attendance, submissions, comments, quiz attempts, notifications, and audit history reference that internal identity rather than email. Duplicate real names are allowed and must never be resolved by guessing from a name.

The current dataset is disposable development data, so the product will not build a legacy Student Number linking workflow. After replacement authentication and the new account-creation path are verified against an isolated database, explicitly approved development and QA datasets may be reset and reseeded without Student Number. A shared or Production database is never reset implicitly and requires a separate named approval.

The code transition remains ordered even though data continuity is not required: establish replacement authentication, remove product dependencies, verify the destructive migration and seed path in isolation, and only then reset an approved environment.

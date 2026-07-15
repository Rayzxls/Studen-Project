# Moderation and content retention matrix

Decision status: approved on 2026-07-14. The first operational Moderation Center slice was implemented and verified on an isolated Neon QA branch on 2026-07-15. Its additive production migration and feature enablement remain unapproved.

| Entity | Normal owner action | Moderation action | History and restore | Score/attendance effect |
|---|---|---|---|---|
| Comment | Author soft-deletes; self-restore within 30 minutes | Teacher for authorized class-wide scope; Admin for all authorized scopes, with reason | Placeholder preserves reply tree; moderated content restored only by equal/higher authority | None |
| Announcement | Unpublished empty draft may hard-delete; published content archives/hides | Admin may hide for policy/safety, never edit as Teacher | Comments, files, and case evidence remain; owner may restore unless moderation lock applies | None |
| Material | Unpublished empty draft may hard-delete; published content archives/hides | Admin may hide for policy/safety, never edit as Teacher | Comments, files, and case evidence remain; owner may restore unless moderation lock applies | None |
| Assignment | Empty never-published draft may hard-delete; otherwise archive | Admin may hide content for safety but cannot grade or change workflow | Submission versions, comments, files, grading history, and notifications remain; Teacher may restore | Linked Score Items and entries remain unchanged |
| Submission attachment | Student may remove before submission; after submission creates a new version or cancels through the workflow | Teacher requests quarantine; Admin confirms quarantine/restore | File relation and version metadata remain; quarantined file renders a placeholder | None |
| Profile image | User replaces/removes; old object eligible for purge after 24 hours | Admin resets to default with reason; evidence quarantined 30 days | User re-uploads rather than restoring old image; audit stores no public/signed URL | None |
| CourseOffering | Empty never-used course may hard-delete; otherwise archive | Admin observes only; no teaching mutation | Class Code disabled; history read-only; owner may restore with reason/audit | Existing records remain unchanged |
| Future Lesson/Quiz | Inherit archive-first policy when implemented | Must be added to this matrix before release | No cascade deletion of learning evidence | Quiz must preserve Score Item contract |

## Moderation Case

Statuses: `OPEN -> IN_REVIEW -> RESOLVED | DISMISSED`, with `RESOLVED -> APPEALED -> IN_REVIEW` for one appeal submitted within seven days.

The Admin queue exposes Active, History, and All views. Users may report only entities they can already access. Reports are authenticated, deduplicated per reporter/entity, and aggregated by entity. Report count affects priority only, never the decision automatically.

Temporary hide during review requires reason and audit. Dismissal restores a temporary hide. Resolution notifies the content owner with a safe user-facing explanation and tells reporters only whether action was taken or no violation was found. Reporter identity is visible to Admin but never disclosed to the reported user.

The QA implementation supports Announcement, Material, Assignment, Comment, File Attachment, and Profile Image targets. Every case stores an immutable target snapshot, an event timeline, reports, restriction state, and one owner appeal. Restricted posts/comments disappear from normal Feed/detail surfaces; restricted files fail closed before signing; restricted profile images fall back to the default avatar. Admin moderation never changes scores, attendance, submissions, or teaching workflow.

Existing Teacher comment moderation remains the fast classroom-level tool. The central Moderation Center is an Admin-only policy and safety workflow; it does not turn Admin into a Teacher and does not absorb Account Lifecycle requests in this first slice.

## Retention safety

Scores, attendance, submission text, and version metadata are not automatically deleted. Binary submission files are eligible for policy-controlled purge only after at least two academic years from CourseOffering archive. Automatic purge is out of scope until an isolated QA database, tested backup/restore, dry-run preview, and explicit production approval exist.

# Functional Completeness Audit

**Audit date:** 2026-07-14  
**Scope:** Release A3 static code audit  
**Method:** read-only inspection of routes, domain mutations, schema, permission
guards, and existing tests. No production data was changed and no mutating
suite was run against the shared Neon database.

This document classifies every area that was previously described as
"partially complete". A capability is not called shipped merely because a
model or button exists.

## Status vocabulary

- **Shipped** - implemented in the current product and backed by direct code
  evidence. Manual acceptance may still be listed under A2.
- **Intentionally Limited** - the smaller behavior is the current product
  decision, not an accidental omission.
- **Deferred** - not part of the current release; a target phase is named.
- **Removed from Proposal** - should not be presented as planned scope.

## 1. Dashboard and analytics

| Capability | Status | Evidence and decision |
| --- | --- | --- |
| Student operating dashboard | **Shipped** | `app/dashboard/page.tsx` and `lib/dashboard/action-center.ts` provide returned work, due work, recent scores, today's timetable, and course shortcuts scoped to the Student's own active enrollments. |
| Teacher operating dashboard | **Shipped** | The same dashboard provides per-course review backlog, draft score items, class health, current-term courses, and today's timetable scoped to the owning Teacher. |
| Admin operating dashboard | **Shipped** | `app/admin/dashboard/page.tsx` exposes user/class counts, Critical audit count, setup/import/account actions, Audit Log, and Activity Review without teaching mutations. |
| Teacher course-level trends | **Deferred - post-Core analytics release** | Add only after defining time window, owner, privacy level, and the action a trend should trigger. Current backlog/attendance/course health already answers the daily operational questions. |
| School-wide usage analytics | **Deferred - post-Core analytics release** | Single-tenant Admin does not yet need engagement charts merely for appearance. Revisit after real usage data and an explicit decision question exist. |
| Dashboard report export | **Intentionally Limited** | Export stays in report workflows: Student browser Print/PDF, Teacher course score/attendance CSV, and Admin Audit CSV. Dashboard cards do not each gain an export button. |
| Admin headcount semantics | **Shipped** | A3.1 aligned `getAdminStats()` with the Admin list filters: soft-deleted Teacher accounts and soft-deleted/anonymized Student identities are excluded, with a unit regression contract. |

## 2. Admin user lifecycle

| Capability | Status | Evidence and decision |
| --- | --- | --- |
| Create/import Teacher accounts | **Shipped** | Single-create and CSV import flows exist under `/admin/teachers` and `/admin/import/teachers`. |
| Read Teacher/Student details | **Shipped** | Lists and `/admin/users/[id]` expose identity, current relationships, activity/audit context, and account state. |
| Reset password and avatar moderation | **Shipped** | Admin can issue a temporary password and reset an inappropriate profile image; both mutations are audited. |
| Disable/reactivate login | **Deferred - A4 Account Lifecycle** | `User.isActive` is enforced by authentication, but no complete Admin transition flow with reason, confirmation, audit, self-protection, and last-Admin protection exists. |
| Soft-delete/restore account | **Deferred - A4 Account Lifecycle** | `User.deletedAt` is enforced by authentication, but the product has no complete Admin transition and restore workflow. Historical teaching records must remain intact. |
| Student anonymization | **Deferred - A4 Account Lifecycle** | `Student.anonymized` exists and list queries exclude it, but there is no end-to-end request/approval/anonymize workflow. |
| Hard-delete a User and teaching history | **Removed from Proposal** | Account access and retained academic evidence are separate concerns. The product must not cascade-delete submissions, scores, attendance, or audit history when access is disabled. |
| Teacher performs global password resets | **Intentionally Limited** | Global account operations remain Admin-only. A future own-course Student reset requires a separate permission and abuse-risk decision. |

## 3. QR and invite acceptance

| Capability | Status | Evidence and decision |
| --- | --- | --- |
| Class code entry and invite link | **Shipped** | `/join`, `/api/join`, and `ClassCodeCard` support direct code entry and pre-filled invite URLs. |
| QR invitation | **Shipped** | The Teacher-only class-code card renders a QR containing the private invite URL. |
| Regenerate, enable/disable, and expire code | **Shipped** | Owner-only audited mutations exist in `lib/course/class-code.ts`, including idempotent activation and expiry changes. |
| Existing enrollment and removed Student rejoin | **Shipped** | Active duplicate enrollment is rejected; a removed enrollment is restored in place with audit history and notification unsuppression. |
| In-app camera scanner | **Removed from Proposal** | The QR is scanned by the phone camera or browser/OS scanner and opens the invite link. Maintaining a second camera permission surface adds little value. |
| Full browser/mobile acceptance | **Deferred - A2 manual acceptance** | The isolated QA branch, integration suite, critical Playwright suite, safe smoke, and restore rehearsal pass. Expired/disabled/regenerated links, mobile handoff, role visibility, all themes, and private-R2 behavior still require manual release sign-off. |

## 4. Moderation coverage

| Content type | Status | Current rule and remaining boundary |
| --- | --- | --- |
| Class-wide and private Comment | **Shipped** | Author self-delete is soft; owning Teacher and Admin moderation require a reason and audit. Admin private-comment moderation escalates audit tier. |
| Announcement | **Shipped** | Owning Teacher soft-deletes with a reason, notification suppression, and audit evidence. Admin remains a read-only Course observer. |
| Material | **Shipped** | Same owner-only soft-delete posture as Announcement, with reason and audit evidence. |
| Profile image | **Shipped** | Owner can replace/remove; Admin can reset only the image as an audited moderation exception. |
| Assignment | **Deferred - A4 Content Retention** | Current delete is a physical delete and can cascade Submission/Version history when not blocked by scoring rules. Replace this with an archive/retention decision before calling Assignment moderation complete. |
| Submission attachment/file | **Deferred - A4 Content Retention** | Schema supports soft-delete metadata, but there is no complete moderator hide/delete/restore UI and evidence flow for every owner type. |
| Restore/appeal workflow | **Deferred - post-Core moderation release** | Deleted comments/announcements/materials preserve evidence but there is no user-facing restore or appeal workflow. |
| Unified moderation queue | **Removed from current Proposal** | Permission, retention, reason, and audit rules are mandatory; a central queue is optional and should be added only when operating volume justifies it. |

## 5. Profile scope

| Capability | Status | Evidence and decision |
| --- | --- | --- |
| Minimal learning identity | **Shipped** | Own avatar, optional friendly display name, read-only real identity, password change, and System/Light/Dark/Cream theme are implemented and audited where applicable. |
| Real identity on shared learning surfaces | **Shipped** | `resolveDisplayName` is restricted to personal UI. Feed/comments/course/submission review use authoritative Teacher/Student names. |
| Avatar consistency | **Shipped** | Avatar is present in navigation, dashboard, course shell/cards, Feed, comments, review queue, Teacher submission detail, and Teacher member management. Dense score/attendance tables remain text-first by design; the Student peer list remains real-name-only under its narrow L1 projection. |
| Full personal-information profile | **Removed from Proposal** | Phone, address, birth date, bio, guardian, and social fields are intentionally absent. Adding them would expand PII and PDPA obligations without improving the Core classroom workflow. |
| Public/social profile | **Removed from Proposal** | No public wall, followers, learning activity profile, or public grades. Beagle Classroom is a learning workspace, not a social network. |

## Follow-up order

1. **Finish A2 manual acceptance:** automated QA isolation, integration/E2E,
   safe smoke, and restore rehearsal are green. Complete role workflows,
   mobile/theme, QR handoff, and private R2 acceptance before release sign-off.
2. **A3.1 correctness and UI consistency:** closed for Admin headcount semantics
   and identity-rich avatar surfaces. Keep dense operational tables text-first.
3. **A4 Account and Content Retention:** design account transitions and replace
   destructive Assignment deletion before exposing more lifecycle controls.
4. **Release B Lesson Workspace:** begin only after A2 is green and A3.1/A4
   decisions are recorded. Keep the existing Feed as the chronological view.

## Audit conclusion

The current Proposal may claim the operational dashboards, QR/invite core, and
minimal Profile as shipped. It must not claim advanced analytics, complete User
CRUD/lifecycle, full-content moderation, or a full personal-information profile.
Those boundaries are now explicit rather than "probably complete".

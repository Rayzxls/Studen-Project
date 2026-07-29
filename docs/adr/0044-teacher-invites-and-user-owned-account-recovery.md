# Teacher Invites and user-owned account recovery

Admin no longer creates Teacher Accounts, temporary passwords, or replacement
passwords for another User. The Teacher management entry point is
`/admin/teachers/invites`, where Admin may enter one email or upload a CSV with
an `email` column. Both modes issue the same email-bound, single-use Teacher
Invite and reveal the resulting invite link only in the issue response.

The invited Teacher signs in with the matching Google account and completes
their own onboarding. This keeps account ownership with the person who controls
the verified email and prevents Admin from learning or distributing login
secrets. Existing direct-create and CSV-import URLs redirect to the invite
surface so bookmarks do not reopen the retired behavior.

Password recovery belongs to the account owner through the verified-email
recovery flow. Admin may suspend or reactivate access and may moderate an
inappropriate Avatar, but cannot view, generate, or reset another User's
password. Reactivating a suspended account does not change its credentials.
Restoring a terminated account is outside the current Admin lifecycle surface
and fails closed instead of preparing a temporary password.

The legacy `mustResetPwd` database/session bridge remains temporarily for
accounts created before this decision. Removing that compatibility field
requires an isolated QA migration, a count of affected accounts, rollback
evidence, and a separate production rollout. Historical audit actions and
labels also remain readable even though no current UI emits them.

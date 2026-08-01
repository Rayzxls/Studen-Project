# Authenticated Manual Acceptance — 2026-08-01

## Scope

This record covers the isolated QA application at `http://localhost:3100` on
the code shipped by PR #40. It does not claim real-device or Production
acceptance.

The pass used the seeded Teacher, Student, and Admin accounts. An isolated-QA
fixture made the seeded Student trigger all three explainable early-warning
signals in the demo course:

- attendance `25%` across four marked sessions;
- two overdue assignments with no handed-in submission;
- score-window decline from `95%` to `45%`.

No Production database row, environment value, or external service was
modified. The temporary fixture scripts were removed after use.

## Results

| Surface | Result | Evidence |
| --- | --- | --- |
| Teacher dashboard ordering | Pass | The course center renders before the early-warning panel, so warnings do not push the course card below the primary workspace. |
| Teacher early warning | Pass | The Student renders as “ควรช่วยก่อน” with attendance, missing-work, and score-drop signals. The row links to the owned course overview. |
| Course overview | Pass | Attendance shows `25%`; four published score items and the related course navigation render. |
| Scheduled publishing center | Pass | The Schedule tab badge shows one queued item; the center reports one future announcement, one eventual recipient, and one active Web Push subscription. |
| Teacher feed status | Pass | The future announcement is visible to its Teacher with “ตั้งเวลา” and “นักเรียนยังไม่เห็น”; the feed banner links back to the schedule center. |
| Shared date/time field | Pass | The calendar rejects past navigation at the current month, quick-date actions work, 24-hour time selection completed as `2 สิงหาคม 2569 เวลา 07:30 น.`, and the popovers stayed within a `390 × 844` viewport without horizontal overflow. |
| Student visibility | Pass | The future announcement body and scheduled label are absent from the Student feed before `publishAt`; live assignments and published scores remain visible. |
| Student authorization | Pass | Direct navigation to the Teacher schedule route redirects the Student to `/dashboard`. |
| Admin role boundary | Pass | `/dashboard` resolves to `/admin/dashboard`; direct navigation to the Teacher schedule route returns to the Admin dashboard. |
| Theme control | Pass | System, dark, and cream controls accepted changes; the pass restored the seeded Teacher to system mode. |
| Browser diagnostics | Pass | No warning or error console entries were present at the end of the three-role pass. |

The initial navigation from `/student/courses/<id>` spent several seconds in a
Next.js development compilation state. Opening the concrete `/feed` route then
rendered normally and produced no browser warning or error. This was treated as
development compilation latency, not a release defect.

## Automated corroboration

- Unit: four files, 19 tests passed for early-warning evaluation/projection and
  scheduled publishing visibility/schedule projection.
- Isolated integration: two files, nine tests passed for Teacher ownership and
  future-feed visibility.
- TypeScript: `tsc --noEmit` passed.

## Still requires a real device or Production

- Create a new scheduled post in Production, let cron publish it, and confirm
  the schedule center moves it from queued to published with the expected
  in-app notification counts.
- Grant notification permission on a real phone and confirm Web Push delivery.
  The QA projection proved subscription accounting only; it did not send to a
  physical device.
- Upload and preview a private R2 attachment through a signed URL on a real
  phone. This pass did not exercise Production object storage.
- Exercise Google consent and the email-delivery checks already listed in the
  post-reset restart checklist.
- Send a controlled server-side error to the intended Sentry project and verify
  that request bodies, cookies, signed URLs, and user details are absent.

The migration baseline remains a separate high-risk recovery-hardening task and
was intentionally not combined with this acceptance pass.

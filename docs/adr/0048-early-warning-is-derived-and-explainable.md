# Early warning is derived and explainable

Beagle Classroom gives a Teacher an early warning when an active student in
one of their active CourseOfferings shows a concrete sign that timely help may
matter. The warning joins three records the Teacher already owns: attendance,
missing submissions, and published scores. It does not create a new academic
record and it is never visible to another student.

**A warning is a live, explainable projection, not a permanent label.** The
dashboard derives it from current rows on every read and names every signal
that caused it. There is no `atRisk` column, no background classifier, and no
opaque risk score. Correcting attendance, submitting work, or recovering on
later score items removes the relevant signal automatically.

The first release deliberately uses a small set of conservative rules:

- attendance below 80% after at least three marked sessions;
- at least two published assignments whose due time has passed without a real
  submission; and
- a drop of at least 10 percentage points between the latest two published
  score items and the preceding two, using the existing sum-of-points contract
  and treating a missing published entry as zero.

One signal means "watch". Two or three different signals mean "help soon".
The distinction is operational priority, not a diagnosis or a grade. The UI
uses words and icons as well as colour, so urgency remains readable without
colour perception.

All calculations stay inside the Teacher ownership boundary. A Teacher sees
only active Enrollments in active CourseOfferings they own. The same student
in another Teacher's course is a separate context and is not returned. Admin
observer access and cross-course school-wide intervention are separate product
decisions and are not introduced here.

Missing-work eligibility starts at the Enrollment's `enrolledAt` time so a
late joiner is not blamed for work that was already due. Scheduled assignments
count only after their publish time. A DRAFT or NOT_SUBMITTED state is still
missing; SUBMITTED, LATE_SUBMITTED, RETURNED, and GRADED prove that the student
did hand in the work at least once.

This read-only projection intentionally sends no notification and writes no
audit event. It tells the Teacher where to look while the source attendance,
assignment, submission, and score workflows remain the records of truth.

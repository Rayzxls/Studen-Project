# Scheduled publishing is time-based, not job-based

A teacher can give an Announcement, a Material or an Assignment a publish time,
write it the night before, and have it appear to students in the morning. Each
of the three carries a nullable `publishAt`; null means what it has always
meant, which is visible as soon as it exists, so every existing row and every
existing flow is unchanged.

**Visibility is decided by comparing `publishAt` with the current time, never by
a job having run.** An item is visible to a student when `publishAt` is null or
has passed. Nothing flips a status, so there is no window in which a row is due
but still hidden because a worker was late, retried, or never fired. A deploy at
07:59 cannot lose the 08:00 post. This is the whole reason for the decision: the
correctness of what a student can see must not depend on infrastructure being
healthy, only on the clock.

The teacher who wrote the item always sees it, marked as scheduled. Hiding a
teacher's own draft from them would make the feature feel broken, and the
audience being protected is the class, not the author.

**Notifications are the one part that cannot be lazy.** Nobody's phone buzzes
because a row became old enough; something has to run. A sweep looks for items
whose publish time has passed and which have not notified yet, marked by a
nullable `notifiedAt`, and fans out for them. If the sweep is late the
notification is late — the item was already visible on time, and a student who
opened the app saw it. The failure mode is a delayed nudge rather than hidden
coursework, which is the trade we want: the job carries timeliness, the data
carries correctness.

Because visibility is a query-time comparison it has to be applied everywhere a
student can reach content, not just in the feed. The rule lives in one place and
every read path uses it, in the same spirit as the course-scope resolver: one
function for reviewers to read instead of an audit trail through every
`findMany`. A scheduled Assignment stays out of Due Soon and out of the Lesson
workspace, not only out of the feed.

Scheduling does not change what publication means for scores. A scored
Assignment still creates its linked draft Score Item when the Assignment is
created, since a draft Score Item is invisible to students by ADR-0036 and
publishing it stays a separate, deliberate teacher action. Scheduling controls
when the brief appears, not when a mark does.

A publish time in the past is accepted and simply means visible now, which keeps
the edit path honest — a teacher who reschedules something that already went out
cannot un-send it, and pretending otherwise would be a lie about what students
have already seen.

## Amendment — moving a post before it goes live (2026-08-03)

The publishing schedule page lets a teacher move a post they scheduled, because
otherwise a wrong hour could only be fixed by deleting the post and writing it
again. Two things bound that.

**The window closes the moment the post is visible.** A post may be moved only
while `publishAt` is still in the future and `notifiedAt` is unstamped. Pulling
a live post back would be the unpublish ADR-0018 refuses, and it would be silent
as well: the sweep claims a row once, so the second arrival would never be
announced. The control is therefore absent on a live card rather than failing
when submitted, and the write repeats the window in its own filter, where the
check is atomic against a sweep running at the same moment.

**Publishing early notifies inline.** "Publish now" writes the current time and
then fans out immediately rather than leaving the row for the next sweep, which
on the current deployment may be a day away. That is an optimisation of
timeliness only, and it holds the rule above: if the fan-out fails the row stays
unclaimed and the sweep still gets it. A past time is refused by this surface
even though the schema accepts one, so that "publish now" — which notifies — is
never reached by accident through the date field.

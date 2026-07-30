# Quiz is gated by course-independent flags after pilot acceptance

Quiz no longer carries a per-course pilot allowlist. `QUIZ_ENABLED` and
`QUIZ_MUTATIONS_ENABLED` remain the fail-closed gates, and every CourseOffering
they cover is treated alike. This retires `QUIZ_PILOT_COURSE_IDS` and amends the
flag section of ADR-0038, which named it as the third gate and made a one-course
pilot a rollout precondition.

The allowlist existed to bound the blast radius of a feature that writes into
student grades. Quiz creates and publishes a linked Score Item under ADR-0036,
so an early defect could have moved real course grades; restricting it to one
named CourseOffering meant any such defect surfaced in a course that knew it was
a pilot. That precondition has now been met — the owner ran the pilot course
through the builder, attempt, and review surfaces and accepted the result — so
the allowlist protects nothing that is still in doubt while imposing a cost on
every course created from now on.

That cost is what forces the decision. The allowlist matched CourseOffering ids
exactly, so a course omitted from it had no Quiz surfaces at all: the tab did not
render and the routes returned 404, with nothing telling the teacher why.
Enabling Quiz for a new course therefore required an owner to copy its id into a
deployment environment variable and redeploy, which does not survive a school
where teachers create their own courses. Worse, the failure was silent in both
directions: an id naming a deleted course produced exactly the same 404 as a
deliberately-off feature, and that is what happened after the 2026-07-29 reset,
leaving Quiz unreachable in Production while the configuration looked set.

Removing the gate does not remove the ability to stop Quiz. `QUIZ_ENABLED=0`
still withdraws every read surface and `QUIZ_MUTATIONS_ENABLED=0` still leaves
existing quizzes readable while refusing writes, both without deleting evidence
or touching Feed, Lesson, Assignment, Score, Notification, Moderation, or file
behavior. What is lost is the ability to withdraw Quiz from one course while
leaving it for another, which was a rollout instrument rather than a teaching
rule: a teacher who does not want a quiz simply does not create one.

If per-course control is wanted again it should be course state in the database
that Admin or the owning Teacher can see and change, not an environment variable
that requires a deployment and is invisible to the people it affects.

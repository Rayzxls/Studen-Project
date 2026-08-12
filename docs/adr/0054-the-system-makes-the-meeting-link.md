# The system makes the meeting link

**Amends [ADR-0052](./0052-online-class-is-a-link-not-a-room.md) and
[ADR-0053](./0053-a-live-room-around-a-meeting-we-do-not-host.md) — 2026-08-12.**
Everything else in both stands: the link still lives on `CourseOffering` with a
per-period override, it is still visible only to active enrolments and the
owning teacher, and only a teacher still writes an `AttendanceRecord`.

**Nothing here is implemented.**

## The complaint that produced this

The owner opened a room and was told there was no link. The question that
followed is the right one: *the product built the room, so why is a teacher
still fetching a link from somewhere else?*

The honest answer was that ADR-0053 deferred the stage — the only part that
would make the media ours — because bandwidth is the one cost no library
removes. Everything around it we built. But the answer papers over a real gap:
a teacher pasting a URL is setup this product could do for them, and whether we
host the media has nothing to do with it.

There is also a smaller thing the interface never said: the link is set **once
per course**, not per class. A teacher who read "paste a link" as a per-lesson
chore was reading it the way the screen presented it.

## What this changes

**There is no "create a link" button.** The teacher presses the button they
already press — "เปิดห้องเรียนออนไลน์" — and if the course has no link yet, the
system creates a real Google Meet space, stores its join URL as the course's
standing link, and walks the teacher into it. First press of the term and every
press after it look identical. Google still carries the media, so this stays
free.

A separate "generate a link" step was the first draft of this decision and it
was wrong. It made a teacher learn that links are a thing the product has,
which is precisely the knowledge this ADR exists to remove. Setup a teacher can
notice is setup we failed to absorb.

**One space per course, not one per class.** A per-class space would be more
faithful to "this lesson's room", and it is the wrong choice here: ADR-0052
requires a student to know where to go *before* the class exists, and a link
minted at open time cannot be on the timetable that morning. One space per
course also keeps every part of the existing model — the standing link, the
slot override, the resolver — untouched. Pressed once a term.

Manual paste stays, below and quieter. A teacher with no Google account linked,
or who wants the room they already use, keeps the field they have now — and it
is also the escape hatch when generation fails, which is why the failure must
leave that field usable rather than leaving the course unopenable.

## Two things this overturns, on purpose

Neither is incidental, and both were deliberate decisions before today.

**The minimum-scope stance.** `lib/auth/google-provider.ts` requests
`openid email` under the comment *"Minimum scope: prove ownership of a verified
address and nothing else."* This adds a second scope.

The scope is `https://www.googleapis.com/auth/meetings.space.created`, and it
was chosen over the obvious alternative for exactly this reason. Creating a
Meet link through Google Calendar needs `calendar.events`, which is read and
write access to a teacher's entire calendar — every appointment, medical and
personal included — to obtain one URL. `meetings.space.created` grants creating
and managing spaces **this application created** and nothing else: it cannot
read a teacher's calendar, cannot see their other meetings, and cannot touch a
space it did not make. The endpoint is `POST https://meet.googleapis.com/v2/spaces`
and the response carries `meetingUri`, a normal `https://meet.google.com/…`
join link.

**Storing an OAuth token.** `AuthIdentity` records who a Google account belongs
to and deliberately keeps no tokens. Calling an API as the teacher later — not
during sign-in — requires a refresh token at rest.

That is a credential, and it inherits every rule already written for one: never
logged, never in an audit entry, never returned by an API, encrypted at rest
rather than stored raw. It is per-teacher and revocable, and unlinking Google
must delete it. This is the real price of the feature and it should be weighed
as such rather than discovered during implementation.

## The access type is a child-safety decision, not a default

A Meet space is created with an access type, and the choice is ours now rather
than the teacher's:

- **OPEN** — anyone holding the link walks straight in.
- **TRUSTED** — people in the host's organisation enter directly; everyone else
  knocks and the host admits them.
- **RESTRICTED** — only explicitly invited people.

Today's pasted links are already whatever the teacher's own Meet settings make
them, so OPEN is not a regression. But ADR-0052 called a leaked meeting link
"a stranger in a room with children", and once the system mints the space, the
system owns that sentence.

TRUSTED is the safer default and it is not free: students who sign in with
email and password are not in the teacher's Google organisation, so every one
of them would knock at the start of every class and the teacher would spend the
first minutes admitting them. **This is not decided here.** It is the one
question that should be answered before the space-creation call is written,
because it is a line of code and an entire lesson's worth of friction.

## What has to be true before it works

- The Google client needs the Meet API enabled and the new scope on its consent
  screen. An unverified app shows a warning screen and is capped at a small
  number of users; a school-wide rollout needs Google's verification. Fine at
  three users, not fine later, and it is the owner's task rather than an
  agent's.
- Whether `meetings.space.created` counts as a sensitive scope, and whether a
  personal `@gmail.com` teacher can create spaces at all or only a Workspace
  account, were **not** confirmed while writing this. The endpoint, the scope
  string and the `meetingUri` shape were checked against Google's reference;
  those two were not. Check them before building rather than after.
- A generated link has to be replaceable. A space can be abandoned, and the
  teacher needs the ordinary field to overwrite it.

## What this costs

- A second Google scope, and a refresh token at rest per teacher who opts in.
  Both were previously and deliberately absent.
- A dependency on an API that can fail. Creation must fail visibly and leave
  the manual field usable, never leave a course with a broken link.
- The system now chooses who can walk into a room full of children, which was
  previously the teacher's own Meet configuration.

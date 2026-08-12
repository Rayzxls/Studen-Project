# An online class is a link, not a room we built

Third and last of the Release F grill decisions from 2026-08-06, after
[ADR-0050](./0050-chat-lives-inside-the-classroom.md) and
[ADR-0051](./0051-rewards-are-a-ledger-with-two-economies.md).

**Implemented.** Shipped 2026-08-11 (PR #62); the room around it followed in
[ADR-0053](./0053-a-live-room-around-a-meeting-we-do-not-host.md). The domain language is in
[CONTEXT.md § Meeting](../../CONTEXT.md).

## Two different products share the word "meeting"

The backlog entry said "meeting room", which turned out to cover two things
that are not variations of each other.

A **Discord voice channel** is always there. Nobody opens it, nobody schedules
it, and you can see who is sitting in it before you decide to join. Students use
it to work alongside each other, talking occasionally. No third-party product
offers this shape — Meet and Zoom have no notion of a room that idles open — so
having it would mean building WebRTC signalling and paying for TURN servers
every month, forever.

A **scheduled class** has a host, a start, an end, and a link. Every large
provider does this well already.

The second one was chosen. The first is not rejected on principle; it is
rejected on arithmetic. Production currently has three users, and standing voice
rooms for classrooms that do not exist yet would be a monthly bill for silence.

## What this product actually adds

Almost nothing about video, and that is the point. Meet and Zoom are better at
carrying a class than anything built here would be for years.

What they cannot do is tell a student where today's period is happening. That
answer lives in the timetable, and the timetable lives here. So the feature is
the link being in the right place at the right time — not another video product.

## Where the link lives, and why not on the session

`TimetableSlot` already carries `location`, with `"อาคาร 3 ห้อง 305"` as its own
example. A meeting link answers the identical question for an online period, so
it belongs beside it rather than as a new concept.

A standing link sits on the CourseOffering, because a teacher's Meet room is the
same room all term, exactly as a physical classroom usually is. Requiring a link
per period would get the feature abandoned in week two. A `TimetableSlot` may
override it, which covers a course whose lecture and lab meet in different
places.

**It must not live on `Session`.** Session rows are materialised lazily on the
teacher's first action, so before a class is opened there is no row to hang a
link on — and "before the class" is precisely when a student needs to know where
to go.

The link is visible only to active enrolments and the owning teacher. A leaked
meeting link is not leaked metadata; it is a stranger in a room with children.

## Attendance stays the teacher's

While the product stores only a link, it cannot know who joined: the student
leaves for another site and nothing comes back. So today, joining has no effect
on attendance because it cannot.

The owner intends to connect a provider API later and use it for attendance.
When that happens, **the system proposes and the teacher confirms** — the
attendance page shows who joined and for how long, with a single control to
accept the lot. It never writes an `AttendanceRecord` on its own.

That boundary is not caution for its own sake. Three concrete things break
without it:

- **`EXCUSED` cannot be derived.** A student home with a doctor's note and a
  student who skipped look identical to any API: neither joined. A system that
  writes its own records marks the sick child absent every time, and the teacher
  then has to back-edit — which this system deliberately makes expensive, with a
  required reason and an audit entry, for changes that ought to be rare.
- **`markedById` would lie.** The column is documented as "teacher who last
  marked", and everything downstream assumes a person decided. An imported row
  would name a teacher who never looked, which is the wrong answer to give a
  parent asking why their child was marked absent.
- **A dropped connection becomes an absence** recorded by nobody, noticed by
  nobody.

Full automation remains possible, but it needs a provenance field distinguishing
a teacher's mark from an imported one, and a rule that an import never
overwrites a teacher's mark. Neither exists today, and adding them is a separate
decision — not something to discover halfway through building an integration.

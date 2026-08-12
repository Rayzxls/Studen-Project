# In-room chat is not the course channel

**Extends [ADR-0050](./0050-chat-lives-inside-the-classroom.md) and
[ADR-0053](./0053-a-live-room-around-a-meeting-we-do-not-host.md) — 2026-08-12.**
ADR-0050 is untouched: the course Channel and Direct Messages it designs are
still unbuilt and still described exactly as written.

## Two things called chat

The room the owner drew has a chat panel in it, and the obvious reading was
that it is the Channel ADR-0050 designed. It is not, and conflating them would
have built the wrong thing.

A **Channel** is a place. It is there before the lesson and after it, a student
can scroll back to last week, a teacher can post to it on a Sunday, and
ADR-0050 gives it moderation, reporting and an expiry policy because a durable
record of what children said to each other needs all three.

**In-room chat** is a side channel for a class that is happening right now. It
is where "ข้อ 3 ทำยังไงคะ" goes while the teacher is mid-sentence and unmuting
would interrupt. It exists for fifty minutes.

The owner chose the second, in the shape Zoom's in-meeting chat has: typed,
read, gone.

## Nothing is stored, anywhere

Messages ride the stage's own data channel between browsers. No table, no row,
no server-side copy, and nothing survives a page refresh — the client library
says so itself. When the room closes the conversation has already ceased to
exist.

That is the feature, not an implementation shortcut. A record that exists is a
record someone must eventually decide who may read, how long it lives, and what
happens to it when an account is anonymized. This has none of those questions
because it has nothing to answer them about.

## What it costs, stated plainly

**There is no evidence to report.** ADR-0050 was careful about this: nobody
reads a DM until it is reported, and then only the snapshot. A student who
writes something cruel in the in-room chat leaves nothing behind — no snapshot,
no timestamp, nothing a teacher can show a parent an hour later. The teacher's
only recourse is what they saw at the time.

The owner was told this before choosing and chose anyway. It is a real cost in
a product for children and it is written down here rather than discovered after
an incident.

Two things make it smaller than it sounds, and neither makes it go away:

- The room is small and named. Everyone in it is an identified member of one
  course with a teacher present, which is not the condition under which most
  online cruelty happens.
- It is live. A teacher reading the panel sees it as it is said, rather than
  finding it in a log a week later.

If that trade stops being acceptable, the fix is not to add storage to this
feature. It is to build ADR-0050's Channel, which was designed with the record
in it from the start, and let the in-room panel keep being the ephemeral thing
it is.

## Consequences

- Chat exists only while the stage does. Without a media server configured
  there is no data channel and no chat panel, which is consistent: both are the
  same connection.
- A student who joins late sees nothing that was said before they arrived. That
  matches every meeting product and needs no explanation in the interface.
- Refreshing the page empties the panel for that person alone. Worth saying in
  the interface, because it will surprise someone at least once.
- Nothing here touches `MeetingPresence`, `AttendanceRecord`, or any moderation
  surface. There is no new privacy boundary because there is no new data.

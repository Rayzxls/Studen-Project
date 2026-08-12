# A live room around a meeting we do not host

**Amends [ADR-0052](./0052-online-class-is-a-link-not-a-room.md) — 2026-08-12.**
That decision stands where it is not contradicted here: the link still lives on
`CourseOffering` and may still be overridden per `TimetableSlot`, it is still
visible only to active enrolments and the owning teacher, and attendance is
still the teacher's.

**Implemented, and partly overtaken — 2026-08-12 (PR #68).**

The room shipped as written. The stage did too, which this document says is
deferred. Read the passages below about deferring it, about Google carrying the
media, and about joining leaving for Meet as the reasoning of the day rather
than as the current state: the owner chose to build the stage on LiveKit's free
tier within hours of this being written, and a room with a stage needs no
outside meeting link at all.

What still stands unchanged: presence derived rather than stored, opening a
room being separate from opening a Session, and pressing Join never being
attendance. The one part genuinely unbuilt is handing the stage to a student —
the token permits only a teacher to publish a screen.

The chat this document leaves unspecified is settled in
[ADR-0055](./0055-in-room-chat-is-not-the-course-channel.md).

## What changed since ADR-0052

ADR-0052 framed the choice as two products — a Discord voice channel that idles
open, or a scheduled class — and chose the second, which reduced to storing a
URL. The owner has since asked for something that is neither: a room with a
lifecycle. A teacher opens it, students are told it is open, they join, the
teacher closes it.

That is not a rejection of ADR-0052's arithmetic. It is a different feature that
the earlier framing had no name for, because "a link" and "a room that is always
there" are the two ends of a range and this sits between them.

## The room is ours, the meeting is not

The decisive question turned out not to be "build or buy" but "which part".
Separating the pieces showed that almost nothing the owner described needs a
media server:

| Part | Needs a media server |
| --- | --- |
| Teacher opens and closes the room | no |
| Students are notified | no |
| Participant list | no |
| Active / idle / away status | no |
| Shared chat | no |
| Screen share on a stage | **yes** |

So the product builds the room and Google keeps carrying the meeting. Joining
still leaves for Meet, which means voice needs no decision here: Meet has it.

**The stage is deferred for money, not because it was forgotten.** Sending a
teacher's screen to thirty students means sending it thirty times, and bandwidth
is the one cost no library removes. The reason the current feature is free is
that Google absorbs that cost. When the stage is built it will use a managed SFU
rather than hand-written WebRTC signalling and TURN, and the surrounding room
will not need to change, because none of it depends on where the media goes.

## Status comes from our own heartbeat, not from the provider

The participant list cannot ask Meet who is present, and does not try. A student
who has the app open reports it; the room shows green. Switched to another tab,
the badge becomes a hollow circle. Nothing for fifteen minutes, a moon.

This is honest about what it measures. It is not "who is in the meeting", it is
"who still has the classroom open", which is the question a teacher actually
asks. The two diverge, and the interface must not imply otherwise.

The same honesty applies to joining: **the system records that a student pressed
Join, which is not the same as attending.** A student can press it and close the
tab immediately. This is a second reason, on top of the three in ADR-0052, why
none of this may write an `AttendanceRecord` on its own. That rule is unchanged
and this ADR does not relax it.

## Where "open" lives, and why it is not where the link lives

ADR-0052 forbade putting the link on `Session`, because Session rows are
materialised lazily on the teacher's first action and a student needs the link
*before* the class exists. That reasoning does not transfer to this state.
Opening the room **is** the teacher's first action, so there is no gap to fall
into.

So the two live apart, and deliberately: the link stays configuration on
`CourseOffering`, while "open right now, since when, closed when" is a property
of the class occurrence. Putting it on the course instead would work today and
lose every trace tomorrow — no record of which Tuesdays had an online class, and
no place for join data to attach if attendance is ever automated.

## The teacher closes the room

The room does not close itself. The owner chose this over expiry at the end of
the timetabled period, and the cost is that a forgotten room keeps inviting
students into an empty call.

The mitigation is not automation but visibility: while a room is open its
teacher sees a persistent indicator wherever they are in the app, with the close
control in it. Forgetting stays possible; not noticing does not.

## Immediate means three seconds

Students already in the app see the Join control appear without reloading.
Vercel's functions cannot hold a WebSocket, so this is short-interval polling
rather than a live channel, and "immediate" means within a few seconds.

Web Push covers the other case — a student who does not have the app open — and
already exists. It obeys ADR-0047 without amendment: *"a push payload names the
course and the kind of thing that happened, and stops there."* A room opening is
exactly that. And as ADR-0047 requires, the push is a courier, never the record:
the `Notification` row is written first and the push follows.

## Students present too, but the teacher hands over the stage

Presenting work is a reason to have a stage at all, so sharing is not a teacher
capability with students as an audience. It is one stage that one person holds
at a time.

Who holds it is the teacher's to decide. A student does not take the stage; the
student asks — the raise-hand control already in the room is that request — and
the teacher grants it. The teacher can reclaim it at any moment with one
control, and the grant lasts for that presentation rather than for the term.

This is a safeguarding rule before it is a classroom-management one. A shared
screen shows whatever is on it, including things the student did not mean to
show, to a room of children. Self-service sharing makes that a matter of luck.
A grant the teacher makes and can revoke in one press does not prevent it, but
it puts an adult on both ends of it.

**A student on a phone cannot share a screen.** Capturing a screen on a phone is
an operating-system privilege — ReplayKit on iOS, MediaProjection on Android —
granted to native applications and not exposed to the browser. Discord's mobile
apps have it because they are native apps; Discord opened in mobile Safari
cannot share a screen either, which is the proof that this follows the platform
rather than the vendor. Installing this product to a home screen does not change
it, because a PWA is still the browser engine. Having it would mean shipping two
native applications, which is a different product, not a feature.

So screen sharing is a laptop capability in a product whose student surfaces are
otherwise mobile-first, and presentations cannot be assigned as though every
student can give one.

**A phone can still share its camera.** `getUserMedia` works on iOS Safari; only
screen capture is withheld. A student presenting work that exists on paper or as
a physical object can point the phone at it, which for that kind of work is
better than a screen share rather than a lesser substitute. Putting a file on
the stage covers slides. Both are worth building before anyone considers a
native app, and neither is decided here.

Browser support moves. Re-check this before building the stage rather than
trusting this paragraph.

Until the stage exists, this requirement is already met: students can share their
screens in Meet if the teacher allows it there.

## Layout decisions worth keeping

Two are recorded because they were argued and would otherwise be re-argued.

**Participants and chat both sit in one rail on the right.** The instinct to
move chat right is correct — Zoom, Meet and Teams all put it there. Moving the
participant list left to compensate would be wrong: Discord also keeps its
member list on the right, and what lives on the left in every one of these
products is *navigation*. A room entered from inside a single course has nothing
to navigate, so a left content rail would be a shape none of them has. One rail
also leaves the stage wider, which is the point of a screen share, and collapses
to a single bottom sheet on a phone instead of two.

**Status badges sit on the avatar**, Discord-style, rather than as a separate
dot — the rail has no horizontal room to spare. The idle badge is a hollow
circle rather than a black dot, because a black dot disappears on the dark
theme. Its ring takes the surface colour from a theme token, and the badge
carries a text label as well as a colour, since green and grey differ only by
hue.

## What this costs

- A room can be left open after class. The owner accepted this in exchange for
  never having a room close underneath a lesson that ran long.
- Status is a proxy. "Has the app open" will sometimes disagree with "is
  listening", and the labels say the former.
- Join is a button press, not attendance, and the gap is invisible to the
  teacher unless the interface says so.
- The stage is a hole in the middle of the screen until someone decides to pay
  for bandwidth. The layout is designed so the hole is fillable, not so it is
  hidden.
- Sharing a screen is a laptop capability. A student with only a phone can join,
  watch, chat, be counted present and show their camera, but cannot share their
  screen, and nothing built here changes that without shipping native apps.

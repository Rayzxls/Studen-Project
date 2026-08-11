# Chat lives inside the classroom

Release F listed a Chat Room as a backlog candidate with no requirement written
anywhere — the words "Chat Room", "Reward" and "Meeting" appeared in one table
in the development plan and in no other file in the repository. This records
what was decided when that table was finally grilled, on 2026-08-06.

**Nothing here is implemented.** No schema, no route, no service. The domain
language is in [CONTEXT.md § Chat](../../CONTEXT.md); this is the reasoning
behind it.

## It is part of this product, not a product beside it

The alternative was a separate application sharing the account system — a real
Discord, with communities that outlive a course and reach across schools. That
was rejected for the same reason the plan already keeps subscription and
multi-tenant work in a separate track: a system where children meet strangers is
not a school system with a chat feature, it is a different product with
different obligations.

Inside the classroom, membership is already solved. A Channel's members are the
active `Enrollment` rows of its CourseOffering plus the owning teacher. There is
no invitation, no friend request, and no membership table to keep in sync with
the truth.

## A Channel is not a Comment thread, and does not replace one

Both let a class talk. They differ in what they are attached to.

A Comment hangs off one entity — an Assignment, a Material, an Announcement —
and its usefulness expires with that entity. A Channel hangs off nothing. It is
where the course talks whether or not anything was posted today.

Keeping both is deliberate. A question about one homework belongs under that
homework, where the next student with the same question will find it. Moving
that conversation into a channel would scatter it into a scroll.

## Direct Messages reach the whole school

Anyone may start a conversation with anyone. This was the owner's decision,
taken against a recommendation to bound DMs to people who share a course.

The recommendation argued that a course-shared boundary gives revocability for
free — removing a student from a course closes the channel — and lets the
school tell a parent that their child can be contacted only by people in their
classes. The owner chose reach.

Three things follow from that choice, and they are not optional extras:

**Discovery is a search, not a directory.** L1 visibility has always confined a
student to the member list of their own courses. Reaching the whole school
requires breaking that, so it is broken as narrowly as it can be: a query of at
least three characters returns names and avatars, and no screen anywhere lists
the school. Finding someone you already know the name of is a different act from
browsing a roster of children, and only the first one is available.

**Blocking works on everyone, including teachers.** If anyone can open a
conversation, the person receiving it must be able to close it without waiting
for an adult to rule on it. Exempting teachers would create exactly the shape
that school abuse cases take: an adult with an unblockable private channel to
any child, invisible until the child is brave enough to report it. A teacher who
loses DM access has not lost contact — announcements, the course feed,
notifications, and the private comment thread under a submission all still work.

**Therefore DM is never an official channel.** If the school starts issuing
instructions through DM, blocking acquires a cost for the student, and a
protection with a cost is one that gets used too late. This constraint is the
price of the previous paragraph, and it is binding on the product, not just on
the code.

## Nobody reads a DM until it is reported

There is no screen and no permission that lets an Admin or a Teacher open
someone else's conversation. Reading happens exactly one way: a participant
reports a message, which copies that message and its surrounding context into a
`ModerationCase` snapshot. The reviewer sees the snapshot, not the thread.

The rejected alternative — an Admin who can open any conversation — fails on the
day the Admin account is compromised. This deployment has a single Admin. The
blast radius of that account should not include every private conversation
between children in the school. The moderation machinery already works this way
for comments and files; DM reuses it rather than inventing a second, weaker
path.

## Messages are not academic evidence, so they expire

Account anonymization currently keeps what a person did — scores, submissions,
attendance, audit — under an anonymous identity, and erases who they were. Chat
does not fit that rule, because a score is a number the system computed and a
message is free text the person wrote, which may contain their own or someone
else's personal information.

So chat is treated as the transient thing it is: messages are deleted after
twelve months, and a user's messages are deleted when their account is
anonymized, leaving a placeholder so the other side of the conversation still
reads coherently. Nothing depends on a message existing — no calculation, no
report, no grade.

Evidence survives this. Anything reported was already copied into a
`ModerationCase` snapshot, which is a separate immutable record and is not
touched by expiry.

## New messages arrive by polling, until they should not

This product has never had a live-updating surface. The notification bell
receives its rows as props from a server component and does not change until the
page does. There is no WebSocket, no SSE, and no polling anywhere in the
codebase, and the deployment is on a plan whose functions are too short-lived to
hold a connection open — the publishing cron already runs from an external
scheduler for the same reason.

Chat is the first feature that needs updates to arrive on their own, and it will
get them the cheapest way that works: the client asks for new messages every few
seconds while its tab is focused. No vendor, no secret, no new failure mode, and
no student message passing through another company's infrastructure.

This is a starting point with a stated exit. Move to a managed WebSocket service
— not a hand-written one — when either of these is true: more than roughly a
hundred people are online at once, or the database shows connection pressure
traceable to polling. Before that, adding a realtime vendor buys nothing; the
production database currently holds three users.

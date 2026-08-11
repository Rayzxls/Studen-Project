# Push may carry a message, and only a message

**Amends [ADR-0047](./0047-push-payloads-carry-no-private-content.md) — 2026-08-06.**
That decision holds for everything it was written about. This one carves a
single hole in it, for the one kind of content ADR-0047 did not anticipate:
a message a person wrote to another person.

## What changes

A push for a **conversation message** — a Direct Message, or a message in a
course Channel — may name the sender and show the message body.

Nothing else changes. A score, a grade, a mark, a teacher's feedback, another
student's name outside a conversation they are part of, and any submission
content remain forbidden in a push exactly as before. The reasoning of ADR-0047
is not weakened by this: a banner reading "คณิตศาสตร์: คุณได้ 12/20" is still
the thing that undoes everything this system is careful about, and it is still
banned.

## Why the hole exists

ADR-0047 was written for notifications that announce that *something happened
in a course*. "มีงานใหม่ที่ต้องส่ง" tells you what to do without telling anyone
else anything. The tap costs nothing because the detail was never the point.

A message is different. "คุณมีข้อความใหม่" does not tell you whether to open it,
and a person who cannot tell an important message from an unimportant one
without opening every single one stops opening any of them. A chat nobody
checks is not a chat; it is a table with rows in it. The notification *is* the
feature, in a way it is not for a published score.

That is the trade this accepts: the content of conversations becomes visible on
a lock screen in exchange for the conversations being read at all.

## What it costs, recorded honestly

This is not free, and a future reader should not be told it was.

- **A lock screen is public.** Whoever is sitting next to the phone can read
  who is messaging a student and what they said. For a student being harassed,
  the harasser's name and words arrive on the screen whether or not the student
  opens the app — the notification becomes part of the harm rather than a
  warning about it.
- **Message bodies now leave our infrastructure.** Push payloads travel through
  FCM. Until this decision, no push carried content, so nothing of substance
  transited a third party. Children's conversations now do. The product's public
  privacy page claims PDPA readiness; that claim now has this inside it.

The alternatives were: say only "คุณมีข้อความใหม่" (ADR-0047 unchanged, and the
notification carries no signal), name the sender but not the body (half the
signal, most of the exposure), or send no push for messages at all (a chat
nobody checks). The owner chose content, knowing the above.

## What keeps it bounded

- **The exception is written narrowly on purpose.** It names conversation
  messages and nothing else, so nobody can later argue that "push may carry
  content" covers a score. If another kind of content wants into a push, it
  needs its own decision, not this one by analogy.
- **A person can switch previews off, per device.** The switch lives beside the
  existing notification toggle. Someone who does not want their conversations
  on a shared or visible screen turns it off and gets ADR-0047's behaviour
  back. This is the same escape hatch every mainstream messenger provides, and
  it is why this decision does not have to be right for everybody.
- **Blocking still works, and it works on teachers too** (see
  [ADR-0050](./0050-chat-lives-inside-the-classroom.md)). The remedy for an
  unwanted sender is to cut the channel, not to hide the banner.

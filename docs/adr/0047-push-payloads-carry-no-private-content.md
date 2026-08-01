# Push payloads carry no private content

Beagle Classroom sends Web Push so a student learns there is work without
having to open the app. Notifications that only exist inside the app are seen
by the students who were already looking, which is not the ones who needed
telling.

**A push payload names the course and the kind of thing that happened, and
stops there.** No score, no mark, no grade, no teacher comment, no other
student's name, no submission content. A push arrives on a lock screen: it is
readable by whoever is holding the phone, sitting next to it on a desk, or
looking over a shoulder on a bus. Everything this system is careful about — a
student sees their own marks and nobody else's — would be undone by a banner
that reads "คณิตศาสตร์: คุณได้ 12/20". So "มีคะแนนใหม่ในวิชาคณิตศาสตร์" is the
most a push may say, and the number lives behind the tap.

This costs nothing that matters. The purpose of the push is to bring the person
back to the app, and a title plus a course name does that. Anything richer is
detail they will see one tap later anyway, bought at the price of showing it to
the room.

The push is a courier, never the record. Every push corresponds to a
Notification row that was already written, and delivery failure changes
nothing: the row is still there, the badge still counts it, and the app still
shows it. A student whose phone refused the subscription, whose browser does
not support push, or who denied permission loses a nudge and no information.
That is what makes it safe to treat push as best-effort and to drop a
subscription the moment the push service says it is gone.

Permission is asked for at a moment the person can connect to a reason, not on
first load. A prompt that appears before anyone knows what the app is gets
denied, and a denied permission is expensive to recover — the browser stops
asking and the person has to find it in settings.

Subscriptions belong to a person, not a device, and several devices per person
are normal. They are deleted when the account is deleted, along with everything
else, and pruned whenever the push service reports one gone, so the table
cannot fill with endpoints for phones that were reset years ago.

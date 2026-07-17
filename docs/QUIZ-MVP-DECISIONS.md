# Quiz MVP Decisions

**Status:** Approved prototype contract, 2026-07-17  
**UI term:** แบบทดสอบ  
**Code term:** Quiz

## Product boundary

- Every Quiz belongs to one Lesson and appears in Lesson, Feed, Work, and the dedicated Quiz tab.
- Quiz has two modes: Practice and Scored. Practice does not create a Score Item. Scored Quiz uses the existing sum-based Score Item and one-way publication contract.
- MVP question types are single choice, multiple choice, and true/false. Multiple choice is all-or-nothing.
- Question bank, cross-course copy, CSV/Excel import, short answer, essay grading, camera proctoring, browser lockdown, and AI grading are deferred.

## Lifecycle and scoring

- Lifecycle is Draft -> Open -> Closed. Scheduling is optional; a Quiz may remain open until the Teacher closes it.
- Once any Student starts, questions, correct answers, and points are immutable. Teacher may void a bad question with a required reason; all Attempt totals are recalculated and audited.
- Integer points per question sum to the Quiz full score. A Scored Quiz owns one linked Score Item with the same full score.
- Practice defaults to unlimited Attempts. Scored defaults to one and supports up to ten. Best Attempt supplies the draft Score Entry.
- Teacher may adjust a final score with a reason while preserving the original auto-grade and answer evidence.
- A Scored Quiz must be closed before Score Item publication. Missing Students are explicitly shown and confirmed because a missing published Score Entry counts as zero.
- Teacher may reopen a closed Quiz only before score publication, with a new close time, reason, and Student notification.

## Attempts and feedback

- Student answers one question per page with progress, question navigator, previous/next controls, timer, and a final unanswered-summary confirmation.
- Answers auto-save. Refresh resumes the same active Attempt. Only one active device owns writes; a Student may explicitly transfer the Attempt to another device.
- Optional per-Attempt time limit continues on the Server. The earliest of personal deadline and Quiz close wins; expiry auto-submits the latest server-confirmed answers.
- Offline behavior is recovery-oriented, not a full offline exam: pending local answers retry on reconnect, the UI exposes sync state, and final submission requires Server confirmation.
- Practice reveals score, correct answers, and explanations immediately. Scored Quiz hides results until Score Item publication and hides explanations until close; Teacher may keep explanations hidden permanently.
- Optional pass threshold is feedback only. It never locks the next Lesson. Required Quiz completion means at least one submitted Attempt; optional Quiz does not affect Lesson progress.

## Exceptions, files, and privacy

- Teacher may grant one Student an extended deadline or extra Attempts before score publication. Reason is required and audited; peers cannot see the exception.
- Quiz, question, option, and explanation surfaces support multiple private attachments. Quiz/question limits are ten files, option limit is five, and each file is at most 20 MB. Existing authenticated preview/private R2 delivery is reused.
- Attempt stores an immutable content/attachment snapshot reference so later edits cannot change what the Student saw.
- Student sees only their own Attempts and published result. Teacher sees course Attempts and item analysis. Admin is a read-only aggregate observer without Student answers or private files.
- Student can report a Quiz or question to Moderation Center. Evidence captures content at report time but excludes Student answers and score by default.

## Notifications and analytics

- Student shortcuts cover Quiz opened, due reminder, personal extension, score publication, and post-publication adjustment.
- Teacher shortcuts cover Quiz closed/ready, timeout auto-submit, and system grading exceptions. Routine submissions do not create notification spam.
- Teacher results include not-started/in-progress/submitted, average/high/low/pass rate, per-Student Attempt history, item analysis, distractor distribution, and CSV export.
- Every notification must resolve server-side from a recipient-owned Notification snapshot.

## Builder and limits

- Builder uses question navigation, focused editor, settings rail, draft auto-save, duplicate/reorder, validation, and Student preview. Preview never creates Attempts or Score Entries.
- One Quiz supports 1-100 questions, 2-10 options per objective question, 1-1,000 integer points per question, 200-character title, and 5,000-character prompt/explanation.
- Single choice has exactly one correct option. Multiple choice has at least two correct options.
- Optional stable shuffling covers question and option order; true/false order remains fixed. Each Attempt snapshot preserves its assigned order.
- Duplicate Quiz is limited to the same course and creates a new Draft without dates, Attempts, results, or linked Score Item.

## Delivery guardrails

- Additive schema only. Use fail-closed `QUIZ_ENABLED`, `QUIZ_MUTATIONS_ENABLED`, and `QUIZ_PILOT_COURSE_IDS`.
- Migration and mutating acceptance run on identity-checked Neon QA only. Production requires backup, migration verification, read-only smoke, one-course pilot, mutation smoke, rollback rehearsal, and explicit widening approval.
- Existing Feed, Assignment, Score, Lesson, Notification, Moderation, and private-file flows remain independently usable when Quiz flags are off.

## Prototype acceptance

Before schema implementation, validate three non-persistent surfaces: Teacher Quiz Builder, Student Quiz Attempt, and Teacher Results. The prototype must cover Light, Dark, Cream, desktop, and iPhone layouts. Its purpose is to settle information hierarchy and navigation, not to become production code.

Accepted for product review on 2026-07-17 at the development-only route `/teacher/courses/[id]/quiz-prototype`. All three surfaces and themes were visually checked at 1440x900 and 390x844. No persistence, schema, Production route, or feature flag was added.

# Lesson Workspace becomes the default course structure while Feed remains a timeline

Course content has grown beyond a single chronological stream, so the product will use a teacher-defined Lesson Workspace as the primary structure for Materials and Assignments while preserving Feed as a chronological projection of course activity. This replaces the default-landing part of ADR-0025, but does not remove Feed, existing content URLs, comments, submissions, scores, or notification history.

The transition must be additive and reversible: existing content is backfilled into a legacy Lesson Workspace, the new experience is released behind a feature flag, and the default course route changes only after parity and privacy checks pass. Announcements may remain course-wide as General Announcements, Student progress is private, and Admin continues to observe the same structure read-only.

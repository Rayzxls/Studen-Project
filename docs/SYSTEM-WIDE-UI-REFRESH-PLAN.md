# System-wide UI Refresh Plan

**Status:** Proposed for product review  
**Created:** 2026-07-19  
**Scope:** every current page surface, before another major Feature release  
**Reference:** Dashboard Variant B, ADR-0028 Calm Ledger v2, ADR-0029 task-modulated motion

## Product intent

The application currently has complete or usable workflows, but many pages feel visually unfinished on wide displays. The Dashboard uses a `1480px` operating layout with global navigation, a central workspace, and contextual information. Most other pages use `max-w-4xl`, `max-w-5xl`, or `max-w-6xl`, leaving large areas without useful context.

The goal is not to fill every gap with another Card. The goal is to make each page feel complete by giving every surface:

1. clear location and page context;
2. one obvious primary action;
3. the information needed to make the next decision;
4. an intentional desktop composition;
5. a focused and non-duplicated Mobile composition.

This is a presentation and information-architecture release. It must not change scoring, attendance, submission, Lesson, Quiz, Moderation, file-access, role, or audit contracts.

## Current inventory

There are **86 `page.tsx` routes** in the current tree:

| Area | Page count | Notes |
| --- | ---: | --- |
| Student | 21 | course discovery, timetable, results, and course workspaces |
| Teacher | 29 | includes Lesson/Quiz design-reference Prototype routes |
| Admin | 26 | existing Admin sidebar and read-only course observer |
| Shared, Auth, and Public | 10 | Dashboard, Profile, Moderation entry, auth, privacy, and landing |

There are **54 course-scoped pages** under Student, Teacher, and Admin. These must be migrated through a shared Course Workspace contract instead of being restyled independently.

## Design rules

### Full does not mean noisy

- Do not stretch reading content beyond a comfortable `65-75ch` line length.
- Do not add decorative Cards only to occupy width.
- Do not repeat a metric in the header, summary strip, main content, and right rail.
- One fact has one visual owner on a page. Other surfaces may link to it but must not restate it.
- Empty states must explain the next useful action, not simulate data.
- Page sections remain unframed unless they are repeated records, tools, or genuinely bounded panels.

### Data entry remains calm

ADR-0029 remains authoritative:

- T2 Interactive: Dashboard, course lists, Course Shell, Feed, and Lesson/Quiz arrival pages.
- T3 Responsive: content detail, member lists, and read-oriented progress pages.
- T4 Calm: grading, attendance, submission review, settings, account CRUD, Audit, imports, and moderation decisions.

T4 pages may use responsive layout, sticky context, clear status, and press feedback. They must not use tilt, parallax, ambient motion, or distracting entry choreography.

### Role and privacy boundaries

- Student sees only their own learning, score, attendance, submission, and enrolled-course data.
- Teacher context is limited to CourseOfferings they own.
- Admin keeps the existing global sidebar and remains a read-only observer of teaching data.
- Files remain private. The UI must never introduce a public object URL.
- A UI refresh must not create a hidden mutation or new role capability.

## Shared layout modes

### Mode O: Operating workspace

Use for top-level Student and Teacher pages.

Desktop composition:

```text
TopNav
Global rail (76 -> 220 hover) | Main workspace | Context rail (320-350)
```

- Maximum workspace width: `1480px`.
- Global rail owns application navigation only.
- Main workspace owns the page's primary task.
- Context rail owns today, next action, warnings, or shortcuts unique to that page.
- On Mobile, keep the existing Bottom Navigation and turn contextual content into a Bottom Sheet or inline section after the primary task.

Routes:

- `/dashboard`
- `/student/courses`, `/student/timetable`, `/student/terms`
- `/teacher/courses`, `/teacher/timetable`
- `/profile`, `/moderation`

### Mode C: Course workspace

Use for all active Student and Teacher CourseOffering pages.

Desktop composition:

```text
TopNav
Global rail | Course hero + local tabs + page content | Course context rail
```

- Keep the existing course hero and local tabs. They are local navigation and do not duplicate the global rail.
- Evolve `CourseShell` from `max-w-5xl` to the shared `1480px` workspace.
- The centre column keeps a readable content width; additional width belongs to the rails, not oversized content cards.
- Right-rail content changes by tab and role.
- On Mobile, tabs remain horizontally scrollable and the right rail becomes an inline context section or sheet.

Route families:

- Feed and Overview
- Lessons and Lesson detail
- Assignments and Assignment detail
- Announcements and Materials
- Quizzes, Quiz detail, Preview, Results, and Attempts
- Scores and Score Item detail
- Attendance and Session detail
- Members
- Settings

### Mode F: Focus workspace

Use when one uninterrupted task is more important than filling the viewport.

- Centred task column with stable progress/status header.
- Optional quiet right rail only when it directly prevents mistakes.
- No global decorative panels inside the task area.
- Mobile actions become sticky only when needed.

Routes:

- Teacher create-course form
- Teacher Quiz Builder and preview
- Student Quiz Attempt
- Student assignment submission
- Teacher grading/review queue
- Password reset and forced reset

### Mode A: Admin operations

Admin already has a global sidebar. Do not add the Student/Teacher rail again.

- Widen operational list and detail pages consistently inside the existing layout.
- Use dense filters, tables/cards, and a case/detail aside only where it improves comparison.
- Preserve T4 Calm behavior for Audit, imports, account lifecycle, Moderation decisions, and Admin Observer pages.
- Keep teaching actions hidden in observer routes.

### Mode P: Public and authentication

- Landing remains a T1 showcase and is not made to resemble Dashboard.
- Login, Signup, Join, and Reset remain focused forms with brand context, not three-column workspaces.
- Privacy remains a reading surface.
- These pages receive token, theme, responsive, and spacing consistency after authenticated surfaces are accepted.

## Context ownership by surface

| Surface | Main workspace owns | Context rail owns | Must not repeat |
| --- | --- | --- | --- |
| Courses | course cards and filtering | join/create action, next class, archived shortcut | course-card statistics |
| Timetable | weekly/daily schedule and slot editing | current/next class, unscheduled courses, conflicts | every visible slot |
| Feed | timeline and composer | current Lesson path, pinned action, course status | Feed posts |
| Lessons | Lesson path/cards | Teacher draft health or Student next checkpoint | Lesson card counts |
| Assignments | assignment queue/list | due/review summary and filters | assignment rows |
| Assignment detail | brief, comments, submission/review | submission status, version, action controls | brief text |
| Materials/Announcements | content list/detail | Lesson/category context and related links | content body |
| Quiz | Quiz list/detail/attempt/results | lifecycle, progress, time, or publication state | question content |
| Scores | score table and item editing | published total, draft health, export | Student rows |
| Attendance | session grid/history | current session, unmarked count, export | attendance rows |
| Members | member list | invite/code state and enrollment summary | member records |
| Settings | grouped settings forms | section index, save state, danger-zone guidance | form fields |
| Profile | identity and account controls | security state and theme preview | identity fields |
| Moderation | queue/case evidence and decisions | policy/state timeline | evidence content |
| Admin lists | filters and records | operational alerts when actionable | table totals already visible |

## Delivery waves

### UI0 - Baseline and route contract

1. Capture Desktop `1440x900` and `1920x1080`, Tablet `768px`, and iPhone `390x844` baselines for representative routes.
2. Create a route-to-mode manifest covering every real page.
3. Record each route's motion tier and role boundary.
4. Define a no-duplicate-content checklist.

Exit: every current page belongs to one layout mode and one motion tier.

### UI1 - Shared workspace foundation

Build reusable primitives without changing domain behavior:

- `WorkspaceFrame`
- `WorkspaceNavigationRail`
- `WorkspaceContextRail`
- `WorkspacePageHeader`
- `WorkspaceSummaryStrip`
- `WorkspaceEmptyState`
- `ResponsiveContextSheet`
- `FocusWorkspace`

The primitives must use Calm Ledger tokens and support Light, Dark, Cream, and System modes.

Exit: Story/prototype fixtures prove the primitives at Desktop and Mobile without a Production route cutover.

### UI2 - Timetable pilot

Apply Mode O to Teacher and Student Timetable first.

- Preserve the released schedule grid, overlap handling, Teacher CRUD, and Student read-only behavior.
- Add global navigation and unique contextual information.
- Verify sparse, normal, crowded, and overlapping schedules.

Exit: product owner approves the shared shell using real timetable data.

### UI3 - Top-level Student and Teacher pages

Migrate:

- Student and Teacher course lists
- Student results/terms
- Profile
- Moderation entry

Do not modify Dashboard except for shared primitive compatibility.

Exit: every top-level authenticated page uses the same global navigation and responsive context behavior.

### UI4 - CourseShell and arrival surfaces

Evolve `CourseShell`, then migrate T2 arrival pages:

- Feed
- Overview
- Lessons list
- Assignments list
- Materials list
- Announcements list
- Quiz list

Exit: Student and Teacher enter any course tab through one coherent desktop/mobile shell.

### UI5 - Course detail and work surfaces

Migrate T3 and T4 pages without adding decorative motion:

- Lesson, Assignment, Announcement, and Material detail
- Assignment submission and Teacher grading
- Quiz Builder, Attempt, Preview, and Results
- Scores and Score Item editing
- Attendance and Session editing
- Members and Settings

Exit: workflows keep keyboard efficiency, sticky actions, error states, and role permissions.

### UI6 - Admin operations

Standardise Admin Dashboard, Teachers, Students, Classes, Imports, Activity Review, Audit, Moderation, Setup, User detail, and course observer pages inside the existing Admin layout.

Exit: Admin has one dense operational language and no Teacher mutation appears.

### UI7 - Public/auth polish and cleanup

- Align Login, Signup, Join, Reset, Privacy, Not Found, and public theme behavior.
- Keep Landing's separate showcase composition.
- Remove obsolete Prototype routes and unused components only after real-route parity is accepted.
- Update screenshots, HANDOFF, DESIGN, and the route manifest.

Exit: no stale prototype is required to explain how the real product should look.

## Commit strategy

Each wave uses small, reversible commits:

1. shared primitive;
2. one role/page family migration;
3. Mobile/theme corrections;
4. tests and visual evidence;
5. documentation and cleanup.

Do not mix schema changes, domain Features, file-storage changes, or data migrations into UI commits.

## Acceptance gates

Every migrated family must pass:

1. Light, Dark, Cream, and System theme checks.
2. `390x844`, `768px`, `1440x900`, and `1920x1080` viewport checks.
3. No horizontal overflow or overlapping text/actions.
4. Keyboard navigation, visible focus, semantic headings, and accessible dialog/sheet behavior.
5. `prefers-reduced-motion` fallback.
6. Student, Teacher, and Admin authorization regression tests.
7. Admin observer remains read-only.
8. Private file routes remain authenticated and no public R2 URL appears.
9. Existing critical workflow E2E remains green.
10. Lint, TypeScript, unit tests, Production build, and safe smoke pass.

## First product checkpoint

The first implementation artifact will be the real Teacher/Student Timetable rendered through the proposed shared workspace. It must demonstrate:

- Dashboard-level visual completeness without copying Dashboard data;
- a useful left global rail;
- a page-specific right context rail;
- no duplicate timetable information;
- unchanged Teacher CRUD and Student read-only behavior;
- a clean Mobile fallback.

No other route family should be migrated until this checkpoint is visually approved.

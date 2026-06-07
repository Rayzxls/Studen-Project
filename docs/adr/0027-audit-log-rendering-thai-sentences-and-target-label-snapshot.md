# ADR-0027 — Audit Log Rendering: Thai Sentences + targetLabel Snapshot

## Status

Accepted — 2026-06-05 (Phase 10A) — Extends [ADR-0022](./0022-notification-fan-out-storage-model.md) § snapshot semantics. Does not supersede any prior ADR.

## Context

Phase 8 shipped the Admin-facing audit viewer with three behaviours that the Phase 10 grill identified as misaligned with the actual consumer (a school administrator with non-technical English):

1. **Enum-literal action column.** Rows render `SCORE_EDIT_AFTER_PUBLISH`, `COURSE_MEMBER_REMOVED`, `ATTENDANCE_BACK_EDIT` as-is. Developers read these fluently; school administrators do not.
2. **No human-readable target.** `targetType` + `targetId` is correct but unscannable — "ScoreItem abc123…" tells the admin nothing about WHICH score item or in WHICH course.
3. **JOIN-at-render-time would be wrong even if implemented.** ScoreItem `name` can change (class A edit is free per ADR-0018). CourseOffering can be renamed. Enrollment can be removed. By the time the admin reads the audit row a week later, the JOIN target may not exist, or may exist with different identifying text. The forensic record should reflect what the entity looked like **when the action happened**, not now.

Q9 of the Phase 10 grill committed to a verbose Thai sentence rendering + a denormalised snapshot column. This ADR records the why.

## Decision

### 1. Snapshot at fire time — `AuditLog.targetLabel String?`

A new column on the AuditLog row, captured by the **emitter** of the audit event (not by the renderer). The label is a short Thai noun phrase identifying the target as the user would speak about it. Examples:

- `SCORE_EDIT_AFTER_PUBLISH` on a ScoreItem → `targetLabel = "สอบกลางภาค (วิชาคณิตศาสตร์ ม.4 ครูสมชาย)"`
- `COURSE_MEMBER_REMOVED` on an Enrollment → `targetLabel = "นาย ก. นาวีลา · ม.4/2 → วิชาคณิตศาสตร์ ครูสมชาย"`
- `SUBMISSION_RETURNED` on a Submission → `targetLabel = "งาน 'การบ้านบทที่ 3' ของ นาย ก. นาวีลา"`
- `ANNOUNCEMENT_DELETED` on an Announcement → `targetLabel = "ประกาศ 'งดสอบวันศุกร์' (วิชาคณิตศาสตร์)"`
- `PASSWORD_RESET_BY_ADMIN` on a User → `targetLabel = "ครูสมชาย จันทร์โอชา (somchai@school.ac.th)"`

`targetLabel` is **optional in the schema** (`String?`). Legacy rows from before Phase 10A have `null`; the renderer treats `null` as `"—"`. New emissions are expected to populate it; the audit() helper accepts it via `AuditPayload.targetLabel?`.

Composition is the emitter's responsibility because only the emitter has the entity in hand at the right semantic moment. Capturing it later (in a background job, or in the renderer) re-introduces the JOIN-at-render problem this ADR is solving.

### 2. Rendering — verbose Thai sentence, one row → one sentence

Two pure helpers in `lib/audit/`:

- **`label.ts`** — `actionLabel(action: AuditEvent): string` — returns the short Thai noun phrase for the action enum. Used as a chip in the audit table's "เหตุการณ์" column. Example: `"SCORE_EDIT_AFTER_PUBLISH"` → `"แก้คะแนนหลังเผยแพร่"`. Used by both the table chip and the sentence renderer below.

- **`render.ts`** — `renderRow(row: AuditLog): string` — returns the verbose Thai sentence for the row. The shape is consistent: **[Actor] [action verb] [target] [reason clause] [timestamp]**.

```
"ครูสมชาย จันทร์โอชา ได้แก้ไขคะแนนของรายการ 'สอบกลางภาค (วิชาคณิตศาสตร์ ม.4 ครูสมชาย)'
 เนื่องจาก 'คำนวณผิด' เมื่อ 3 มิ.ย. 2569 เวลา 14:22"
```

Phase 10 Q9c locked the **verbose explanatory tone** (option B). The shorter "action-first chip" tone (option C) was rejected because verbose sentences read naturally as documentation entries; the audit log doubles as a written record for the school's records department.

The renderer reads the snapshot `targetLabel` directly. No JOINs at render. If `targetLabel` is `null`, the renderer falls back to `"—"` and lets the admin click through to the drill-down (`/admin/audit/[id]`) for raw `targetType` + `targetId` + JSON payload.

### 3. Where the rendering surfaces appear

- `/admin/audit` viewer (Phase 8 page) gains a new column **"เกิดอะไรขึ้น"** populated by `renderRow(row)`. The original "Action" column is kept (now using `actionLabel(action)` as a chip).
- `/admin/audit/[id]` drill-down (Phase 8 page) shows the rendered sentence at the top of the detail card, above the raw JSON.
- CSV export (Phase 8 route `/admin/audit/export`) gains a final column "เกิดอะไรขึ้น" with the Thai sentence. The raw `action` + `targetType` + `targetId` columns are preserved so a forensic consumer can still cross-reference by id.

### 4. Migration strategy for existing fire sites

Updating ~28 existing fire sites (CLASS_CODE_*, COURSE_MEMBER_*, SCORE_*, SESSION_CANCELLED, etc.) to capture `targetLabel` is mechanical but spans many files. The cutover is staged:

- **This ADR's commit** — schema column + ADR + label.ts + render.ts. Old fire sites continue to emit `null` for `targetLabel`. Renderer falls back to `"—"`.
- **Per-feature backfill** — as Phase 10B/C touches each fire site for unrelated reasons (e.g. Phase 10B Admin CRUD, Phase 10C Feed redesign), the relevant emitter gains a `targetLabel` line. No standalone backfill commit; the migration follows the natural editing path.
- **No historical backfill script.** Pre-cutover rows stay `null`. Backfilling from JOINs would lie about the snapshot semantics; renaming the audit log to preserve the old behaviour is worse than honest `"—"`.

## Consequences

### Positive

- **The audit page becomes readable by the actual user.** A school administrator skimming "Critical events from last week" sees full sentences in their own language, not technical enum literals.
- **The snapshot survives entity churn.** If a ScoreItem is renamed (class A free edit) or a Course is deleted, the audit row preserves the name as it was at the moment of the audited action. The forensic record stays honest.
- **No JOINs at render time.** The audit list page query is a single `findMany` against `AuditLog`; the renderer is pure. Page latency is unaffected by entity count or relationship depth.
- **Tone is consistent across surfaces.** The same `renderRow` powers the viewer column, the drill-down header, and the CSV export. Future surfaces (PDF export, weekly summary email) get the same sentence for free.
- **CLAUDE.md hard rules are unviolated.** `targetLabel` is a human-readable identifier, not a password / token / cookie / signed URL. It is never the secret material itself.

### Negative

- **Emitter cost.** Every fire site that wants useful rendering has to compose a label. That's a one-line `targetLabel: \`...\`` argument in the audit() call, but it's nonzero work × 28 sites. Mitigation: do it incrementally per feature commit, not as a standalone migration.
- **Label drift across emitters.** Two fire sites for the same `targetType` could compose different label shapes ("นาย ก. (ม.4/2)" vs "นาย ก. นาวีลา"). The renderer can't normalise after the fact because the source data is gone by then. Mitigation: a per-`targetType` label-composer helper landing in `lib/audit/labels-by-target-type.ts` once Phase 10B/C accumulates enough fire-site updates to extract a pattern.
- **Pre-cutover rows render as "—"** in the new column. That's the honest answer — we don't know what the target was called at the moment of the audit, and pretending to know is worse. Operationally fine because the drill-down page still has `targetType` + `targetId` + JSON.

### Rejected Alternatives

- **JOIN-at-render in the audit viewer.** Would surface the entity's *current* name, not its name at fire time. Worse than honest "—" for entities that have since been renamed or deleted.
- **Background job that fills `targetLabel` after the fact.** Same flaw — runs after the fire moment, sees the entity as it is at run time, not as it was at fire time.
- **Translate enum literals in the renderer only (no Thai sentence; no snapshot).** Solves the readability of the action but not the readability of the target. Half measure.
- **Action-first chip rendering (Q9c option C).** Scannable but less suitable for the written-record use case. Verbose sentences read more naturally as a permanent log entry. Reversible if Q9c is re-grilled — both renderers are pure functions on the same row shape.

## References

- [ADR-0022](./0022-notification-fan-out-storage-model.md) § snapshot semantics — same posture extended to audit
- Phase 8 audit viewer (`/admin/audit`, `/admin/audit/[id]`, `/admin/audit/export`) — surfaces this rendering touches
- Phase 10 grill Q9 (a/b/c/d locks)
- HANDOFF.md § Phase 8 — Q1 tier helper precedent for "no schema column for derived value" (this ADR makes the opposite call for label because label is not derivable post hoc)

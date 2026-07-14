# Beagle Classroom Data Safety Runbook

**Updated:** 2026-07-14  
**Scope:** isolated QA database provisioning, backup/restore rehearsal, and the gate for mutating tests.

## Current risk

Local development and production currently use the same Neon branch. Treat the
normal `DATABASE_URL` as production. Do not run `db:push`, migrations, seed,
bootstrap, reset, integration tests, E2E tests, or repair scripts against it.

The application already fails closed when `QA_DATABASE_URL` is missing or points
to the same Neon branch as `DATABASE_URL`. This runbook does not weaken that gate.

## Ownership and secrets

- Only the project owner creates, restores, or deletes Neon branches.
- Never paste a connection string into Git, screenshots, chat, tickets, or logs.
- Store `QA_DATABASE_URL` only in local/CI secret storage.
- A QA branch may contain copied production data. Restrict access, avoid public
  endpoints, and delete the branch when it is no longer needed.
- Keep Cloudflare R2 private. Database isolation does not make file objects public.

## Phase 1: create the isolated QA branch

1. In the Neon project, create a child branch from the current production branch.
2. Name it with an unambiguous environment label, for example
   `beagle-qa-YYYYMMDD`.
3. Give temporary branches an expiry date when the Neon plan supports it.
4. Create a compute endpoint for the QA branch and copy its pooled connection
   string into local secret storage as `QA_DATABASE_URL`.
5. Keep the existing production URL in `DATABASE_URL`.
6. Confirm the two host identities are different without printing either URL.

Local configuration shape:

```dotenv
DATABASE_URL="postgresql://...production-branch..."
QA_DATABASE_URL="postgresql://...qa-branch..."
```

Do not proceed if the runner reports `qa_database_matches_primary`.

## Phase 2: verify fail-closed behavior

Before using the QA branch, record these results:

```bash
# Safe and expected to pass without QA_DATABASE_URL
pnpm test -- tests/unit/database-safety.test.ts tests/unit/playwright-isolation.test.ts

# Expected to stop before tests when QA_DATABASE_URL is absent
pnpm test:integration

# Expected to stop before starting Next.js when QA_DATABASE_URL is absent
pnpm dev:qa
```

After configuring the separate branch, the two guarded commands may start. The
QA server must use port `3100`; Playwright must not reuse the normal port `3000`
server.

## Phase 3: backup and restore rehearsal

Run this drill on a disposable child of the QA branch, never on production.

1. Create `beagle-qa-restore-drill-YYYYMMDD` from the QA branch.
2. Record the branch name, project timezone, and restore point `T0`.
3. In Neon SQL Editor, while connected to the drill branch only, create a probe:

   ```sql
   CREATE TABLE _qa_restore_probe (
     id integer PRIMARY KEY,
     created_at timestamptz NOT NULL DEFAULT now()
   );
   INSERT INTO _qa_restore_probe (id) VALUES (1);
   SELECT count(*) FROM _qa_restore_probe;
   ```

4. Confirm the count is `1` and record timestamp `T1`.
5. In Neon's Branches view, reset the disposable drill branch from its QA parent
   at a point before the probe was created. Confirm both source and destination
   branch names before applying the reset. Do not reset the production branch.
6. After the branch reset completes, reconnect and verify that querying
   `_qa_restore_probe` returns `relation does not exist`.
7. Verify a known application table is readable and run `pnpm qa:safe` against a
   QA app server.
8. Delete or expire the drill branch after evidence is recorded.

If any step fails, stop. Do not compensate by restoring production or by pointing
local development at another unreviewed branch.

## Evidence record

Record the following without secrets or personal data:

| Field | Required evidence |
| --- | --- |
| QA branch | Name and creation date |
| Isolation | Guard unit tests pass; QA and primary identities differ |
| Fail-closed | Missing QA URL blocks integration runner and QA server |
| Restore drill | Drill branch, `T0`, `T1`, and probe absent after restore |
| Read smoke | `qa:safe` result and app commit SHA |
| Operator | Name and date |
| Cleanup | Drill branch deleted/expired |

### Rehearsal record: 2026-07-14

| Field | Result |
| --- | --- |
| QA branch | `beagle-qa-20260714`, isolated from production |
| Drill branch | `beagle-qa-restore-drill-20260714`, child of QA |
| T0 | `2026-07-14T13:41:34.363Z` |
| T1 | `2026-07-14T13:41:34.714Z`, probe count `1` |
| T2 | `2026-07-14T13:47:36.447Z` |
| Reset verification | Probe absent; application table readable |
| Safe smoke | `10/10` passed on QA |
| Integration tests | Passed on QA |
| E2E tests | `2/2` passed on QA |
| App commit at rehearsal | `09089d3f1387` |
| Cleanup | Completed: drill branch expired/deleted; local drill URL removed |

This rehearsal proves branch reset and application recovery on a disposable QA
child. It does not authorize or claim a production restore. Repeat the drill
after material changes to the database topology or recovery procedure.

## Gate for mutating QA

Mutating integration/E2E tests remain blocked until all conditions are true:

- `QA_DATABASE_URL` exists in secret storage and is not the production branch.
- Fail-closed tests pass.
- Backup/restore rehearsal passes on a disposable QA child branch.
- The operator confirms the active branch before every schema or data mutation.
- The test run has a cleanup plan and uses only test-owned records.

Passing this gate authorizes QA mutation only. It does not authorize a production
schema change, backfill, repair, or retention purge.

## References

- Neon branching: <https://neon.com/docs/guides/branching-intro>
- Neon Backup & Restore updates: <https://neon.com/docs/changelog/2025-10-31>

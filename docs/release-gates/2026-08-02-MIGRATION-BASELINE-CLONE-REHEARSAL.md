# Migration Baseline Deployment-Clone Rehearsal — 2026-08-02

## Outcome

The baseline transition and exact rollback passed against a dedicated Neon
child branch created from the current `production` branch with its schema and
data. The rehearsal clone was `baseline-rehearsal-2026-08-02`.

Production and QA were not modified. The runner rejected either database by
normalized identity before opening the rehearsal connection. No connection
string, password, row value, or application-table fingerprint is recorded in
this evidence.

## Read-only preflight

Command:

```powershell
npm run db:migration-baseline:clone:preflight
```

Verified inventory:

- 14 complete legacy `_prisma_migrations` rows matching the repository;
- 41 application tables in `public`;
- 92 total application rows across those tables;
- an empty Prisma datamodel diff;
- the `notification_post_once` partial unique index;
- representative Prisma queries; and
- expected divergence from the proposed baseline-only history before adoption.

## Guarded rehearsal

Command:

```powershell
npm run db:migration-baseline:clone:rehearse -- --confirm=REHEARSE_BASELINE_ON_DEPLOYMENT_CLONE
```

Forward proof:

1. acquired a dedicated transaction-scoped advisory lock;
2. copied all eight `_prisma_migrations` columns into a random backup schema;
3. verified that backup against `public` with `EXCEPT ALL` in both directions;
4. recorded the reviewed squashed baseline and observed the exact 15-row
   transition set;
5. deleted exactly 14 legacy rows, leaving only the baseline row;
6. proved baseline-only `migrate status` and `migrate deploy` were clean;
7. proved an empty schema diff, the partial index, and representative Prisma
   reads; and
8. matched every application-table fingerprint and public sequence value to
   the preflight snapshot.

Rollback proof, executed from `finally`:

1. replaced the temporary bookkeeping with the eight-column backup;
2. restored exactly 14 legacy rows;
3. compared the restored table with its backup byte-for-byte;
4. proved the active 14-migration history was clean again;
5. repeated schema, index, Prisma-query, application-data, and sequence checks;
   and
6. removed the verified backup schema and temporary migration workspace.

## Reusable safety boundary

The runner requires all of the following:

- `BASELINE_REHEARSAL_DATABASE_URL` is present;
- its normalized identity differs from both `DATABASE_URL` and
  `QA_DATABASE_URL`;
- a Neon target uses a direct endpoint without `-pooler`;
- the active schema is `public`;
- the baseline SQL matches its reviewed LF-normalized SHA-256;
- the deployed inventory is exactly 14 migrations and 41 application tables;
  and
- mutation receives the exact confirmation token
  `REHEARSE_BASELINE_ON_DEPLOYMENT_CLONE`.

If rollback cannot be verified, the random recovery schema is deliberately
preserved and its name is printed instead of being deleted.

## Decision boundary

This proof closes the deployment-clone rehearsal requirement only. It does not
move the candidate into `prisma/migrations` and does not authorize changes to
QA or Production.

QA adoption requires a current verified restorable backup, a schema-change
freeze, an explicit owner approval, and independent post-adoption verification.
Production requires the same controls plus a second explicit approval after QA
has succeeded. These approvals cannot be inferred from this rehearsal.

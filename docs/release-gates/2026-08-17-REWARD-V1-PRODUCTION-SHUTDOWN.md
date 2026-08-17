# Reward V1 Production shutdown — 2026-08-17

## Decision and scope

The owner approved temporarily disabling Reward V1 on Production after the
deployed manual Course points workflow was confirmed not to match the intended
product. This shutdown changes feature gates and deploys an existing built
artifact only. It does not mutate schema or data.

## Applied state

- `REWARD_ENABLED=0`
- `REWARD_MUTATIONS_ENABLED=0`
- Vercel deployment ID: `dpl_GgWwxXBz8SiZHQjD4VrQXkWco1Sd`
- Deployment URL: `https://studen-project-hgs46iwlq-rayzxls-projects.vercel.app`
- Production alias restored: `https://beagleclassroom.com`
- Deployment status: Ready

The redeploy used the already-built latest `main` Production artifact rather
than the local dirty worktree.

## Verification

- Public `/` returned HTTP 200.
- Public `/login` returned HTTP 200.
- An authenticated Student request to the old Course Reward route returned the
  application's real 404 page without console errors.
- The authenticated Student Course Feed still loaded, the Reward navigation
  item was absent, and the browser console remained clear.

No database migration, backfill, row update, or schema change occurred. The
legacy Reward ledger remains in place for later audit and explicit adoption or
retirement decisions.

## Next gate

[ADR-0056](../adr/0056-course-score-milestones-and-system-quest-wallet.md)
defines Reward V2. V2 uses separate Course Milestone and System Quest flags;
the old V1 flags must not be re-enabled as a shortcut.

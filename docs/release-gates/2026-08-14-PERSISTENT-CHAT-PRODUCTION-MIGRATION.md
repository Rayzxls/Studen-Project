# Persistent Chat Production Migration — 2026-08-14

## Scope and authorization

The owner explicitly authorized the Persistent Chat migration on Production.
This authorization covered the additive database migration only. It did not
authorize enabling `CHAT_ENABLED`, enabling `CHAT_MUTATIONS_ENABLED`, creating
the retention cron, or writing Chat data.

## Restore point

Immediately before the mutation, Neon created
`production-chat-backup-2026-08-14` from the current `production` branch with
data and schema. Neon confirmed the fork, the branch list confirmed
`production` as its parent, and it expires on 2026-08-21.

If post-migration verification had failed, the stop condition was to leave both
Chat flags off and recover from this Neon branch through a separately approved
Production restore. No manual table drops or ad-hoc rollback SQL are approved.

## Preflight

- Local Prisma files matched `origin/main`.
- `prisma migrate status` found five repository migrations and exactly one
  pending Production migration: `20260814000000_add_chat_foundation`.
- The same additive SQL had already passed isolated-QA migration, focused
  permission integration, browser E2E, mobile layouts, and all four themes.
- The guarded runner proved the configured QA and Production database
  identities differ before allowing deploy.

## Deployment

The guarded Production command applied only
`20260814000000_add_chat_foundation` and Prisma reported all migrations applied
successfully.

## Post-migration evidence

- `prisma migrate status` reports the Production schema up to date.
- `_prisma_migrations` records the Chat migration as finished and not rolled
  back.
- `ChatConversation`, `ChatConversationMember`, `ChatMessage`, and `ChatBlock`
  exist in `public`.
- `WebPushSubscription.messagePreviewEnabled` exists as non-null boolean with
  default `true`.
- Chat conversation and deletion-reason enums contain the reviewed values.
- All four new Chat tables contain zero rows.
- Both Chat feature flags remain off, so deployed application routes remain
  fail-closed and do not query or mutate the new tables.

## Next gate

Obtain a separate owner approval before changing either Chat flag in Vercel.
After redeploy, run authenticated Teacher/Student Course Channel and DM smoke
checks, notification/push privacy checks, and a flag-off rollback rehearsal.
Only then create the daily `chat-retention` cron job.

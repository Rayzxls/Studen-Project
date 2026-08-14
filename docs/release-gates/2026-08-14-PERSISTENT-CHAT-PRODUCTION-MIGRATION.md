# Persistent Chat Production Migration — 2026-08-14

## Scope and authorization

The owner explicitly authorized the Persistent Chat migration on Production.
That first authorization covered the additive database migration only. On
2026-08-14 the owner separately authorized enabling the Production Chat flags.
The retention cron remains outside this authorization.

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
- The flags were initially left off so deployed application routes remained
  fail-closed during migration verification.

## Feature-flag rollout

The first read-only rollout set only `CHAT_ENABLED=1`. An unauthenticated request
to `/chat` returned 500 because the UI route used the throwing `requireAuth`
guard. Production was immediately returned to `CHAT_ENABLED=0`, and
`CHAT_MUTATIONS_ENABLED` had not been created, so the failed attempt could not
write Chat data.

PR #79 replaced the throwing guard on all three general Chat UI routes with the
same login redirect used by the rest of the application and added an E2E
regression test. Local verification passed TypeScript, targeted ESLint, all
1,008 unit tests, and the three focused Chat E2E tests. PR CI, main CI, and the
Vercel Production deployment all passed.

The rollout was then repeated in two gates:

1. `CHAT_ENABLED=1` with mutations still disabled: `/` and `/login` returned
   200, all three unauthenticated Chat page shapes returned 307 to `/login`, and
   the deployment had no 500 logs.
2. `CHAT_MUTATIONS_ENABLED=1`: the final deployment reached Ready and was
   aliased to `beagleclassroom.com`; the same page checks passed,
   unauthenticated Chat write APIs returned 401, and the deployment had no 500
   logs.

Both Production Chat flags are now enabled.

## Next gate

The daily `chat-retention` cron job was created with the existing `CRON_SECRET`
contract and its manual test returned 200. The remaining gate is a short
authenticated Teacher/Student Production acceptance pass covering a Course
Channel, DM send/receive, block behavior, and notification/push privacy.

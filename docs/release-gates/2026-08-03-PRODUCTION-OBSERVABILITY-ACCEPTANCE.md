# Production Observability Acceptance — 2026-08-03

## Outcome

Production server-side Sentry delivery is accepted. PRs #50 and #51 added a
POST-only controlled probe, isolated its authority from scheduled publishing,
and merged through all required CI and Vercel gates.

The final Production redeployment reached `Ready`, restored the
`beagleclassroom.com` alias, and returned this Sentry event id after a successful
SDK flush:

```text
1d98b7ff244f4ed98867c03a99176562
```

## Security boundary

The probe requires a dedicated `SENTRY_PROBE_SECRET`. It does not reuse
`CRON_SECRET`, so observability testing and credential rotation cannot interrupt
scheduled publishing. The secret was generated from 256 random bits, stored as
a sensitive Production-only Vercel variable, held only in process memory during
the acceptance call, and never written to the repository or command output.

The existing Sentry `beforeSend` gate removes request bodies and cookies,
redacts authorization and credential-bearing headers, strips signed URL and
identity query credentials, and reduces users to an id. Unit coverage exercises
those rules together with missing configuration, wrong authorization,
successful capture/flush, and failed-flush behavior.

## Deployment evidence

- post-merge GitHub CI passed dependency, integration, unit, lint/typecheck, and
  build jobs;
- Vercel Production deployment `studen-project-giqqz954h` reached `Ready` and
  was aliased to `beagleclassroom.com`;
- the authorized probe returned `ok: true` and the event id above only after
  `Sentry.flush(2000)` succeeded;
- the deployed environment contains `SENTRY_DSN`, `SENTRY_ORG`,
  `SENTRY_PROJECT`, and `SENTRY_PROBE_SECRET`;
- all three VAPID variables and all four private R2 variables are present; and
- no temporary Production environment file remains in the workspace.

`SENTRY_AUTH_TOKEN` is not currently configured in Vercel. Runtime delivery does
not require it, but source-map upload does. Add a least-privilege token and
redeploy only if Production stack traces prove unreadable without uploaded
source maps.

## Remaining manual acceptance

A real phone is still required to prove scheduled publication through the
external cron, Web Push permission and delivery, and private R2 upload/preview
against Production. The in-app browser runtime was unavailable during this
acceptance run, so these device interactions were not inferred from environment
presence alone.

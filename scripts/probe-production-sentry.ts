const PRODUCTION_PROBE_URL =
  "https://beagleclassroom.com/api/cron/sentry-probe";

type ProbeResponse = {
  ok?: boolean;
  eventId?: string;
  error?: string;
};

async function main(): Promise<void> {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) throw new Error("cron_secret_required");

  const response = await fetch(PRODUCTION_PROBE_URL, {
    method: "POST",
    headers: { authorization: `Bearer ${secret}` },
  });
  const body = (await response.json().catch(() => ({}))) as ProbeResponse;

  if (!response.ok || body.ok !== true || !body.eventId) {
    throw new Error(
      `sentry_probe_failed_status_${response.status}_code_${body.error ?? "unknown"}`
    );
  }

  console.log(`Sentry Production probe accepted: eventId=${body.eventId}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "sentry_probe_failed");
  process.exitCode = 1;
});

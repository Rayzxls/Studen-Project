import type { EmailMessage, EmailSender } from "./types";
import { renderEmail } from "./render";

const RESEND_ENDPOINT = "https://api.resend.com/emails";

/**
 * The production adapter for ADR-0042. Sends the rendered message through
 * Resend's HTTP API with `fetch` — no SDK dependency, which suits the serverless
 * runtime. A non-2xx response throws a status-only error (never the recipient,
 * link, or token), so a caller can decide how to handle a delivery failure
 * without a sensitive value reaching a log. `fetchImpl` is injectable for tests.
 */
export function createResendEmailSender(config: {
  apiKey: string;
  from: string;
  fetchImpl?: typeof fetch;
}): EmailSender {
  const doFetch = config.fetchImpl ?? fetch;
  return {
    async send(message: EmailMessage): Promise<void> {
      const rendered = renderEmail(message.template);
      const response = await doFetch(RESEND_ENDPOINT, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: config.from,
          to: message.to,
          subject: rendered.subject,
          text: rendered.text,
        }),
      });
      if (!response.ok) {
        throw new Error(`resend_send_failed_${response.status}`);
      }
    },
  };
}

import type { EmailSender } from "./types";
import { createLogEmailSender } from "./log-sender";
import { createResendEmailSender } from "./resend-sender";

export type {
  EmailMessage,
  EmailSender,
  EmailTemplate,
  EmailTemplateKind,
  RenderedEmail,
} from "./types";
export { renderEmail } from "./render";
export { createLogEmailSender } from "./log-sender";
export { createResendEmailSender } from "./resend-sender";
export {
  createCapturedEmailSender,
  type CapturedEmailSender,
} from "./outbox-sender";

/**
 * Selects the active sender for the running environment (ADR-0042). Fail-closed:
 * Resend is used only when BOTH `RESEND_API_KEY` and a verified `RESEND_FROM`
 * sender are configured; with either absent every environment falls back to the
 * log-only sender, which transmits nothing. So an email-dependent feature stays
 * inert and Production is unchanged until a real provider is deliberately keyed.
 * The identity flag still gates each feature separately, so a key alone never
 * exposes a flow that is otherwise off.
 */
export function resolveEmailSender(
  env: Readonly<Record<string, string | undefined>> = process.env
): EmailSender {
  const apiKey = env.RESEND_API_KEY?.trim();
  const from = env.RESEND_FROM?.trim();
  if (apiKey && from) {
    return createResendEmailSender({ apiKey, from });
  }
  return createLogEmailSender(env);
}

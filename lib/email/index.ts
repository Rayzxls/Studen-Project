import type { EmailSender } from "./types";
import { createLogEmailSender } from "./log-sender";

export type {
  EmailMessage,
  EmailSender,
  EmailTemplate,
  EmailTemplateKind,
  RenderedEmail,
} from "./types";
export { renderEmail } from "./render";
export { createLogEmailSender } from "./log-sender";
export {
  createCapturedEmailSender,
  type CapturedEmailSender,
} from "./outbox-sender";

/**
 * Selects the active sender for the running environment (ADR-0042). Fail-closed:
 * until a keyed provider adapter is wired, every environment uses the log-only
 * sender, which transmits nothing — so an email-dependent feature is inert and
 * Production is unchanged until a real provider is deliberately configured.
 *
 * When the Resend adapter lands, this returns it only when `EMAIL_PROVIDER` is
 * `resend`, `RESEND_API_KEY` is set, and the identity mutation flag is on,
 * mirroring how the Google provider is gated; anything short of that stays on
 * the log-only sender.
 */
export function resolveEmailSender(
  env: Readonly<Record<string, string | undefined>> = process.env
): EmailSender {
  return createLogEmailSender(env);
}

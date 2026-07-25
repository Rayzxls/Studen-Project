import type { EmailMessage, EmailSender } from "./types";
import { renderEmail } from "./render";

/**
 * The default adapter until a real provider is configured: it transmits
 * nothing. In production it logs only that a send was suppressed — never the
 * recipient, link, or token — so no sensitive value reaches a log. Outside
 * production it prints the recipient and rendered body to the server console,
 * which is where a developer reads the one-time link while testing a flow
 * locally. Because it never sends, an email-dependent feature stays inert until
 * a keyed provider is wired in.
 */
export function createLogEmailSender(
  env: Readonly<Record<string, string | undefined>> = process.env
): EmailSender {
  const isProduction = env.NODE_ENV === "production";
  return {
    async send(message: EmailMessage): Promise<void> {
      if (isProduction) {
        console.info(
          `[email] suppressed ${message.template.kind}: no provider configured`
        );
        return;
      }
      const rendered = renderEmail(message.template);
      // Dev/QA only: the console is local and ephemeral, and the link must be
      // readable to complete a flow by hand.
      console.info(
        `[email:dev] to=${message.to} subject="${rendered.subject}"\n${rendered.text}`
      );
    },
  };
}

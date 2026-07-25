import type { EmailMessage, EmailSender } from "./types";

export type CapturedEmailSender = EmailSender & {
  /** Every message handed to `send`, in order. Test-only, in memory. */
  readonly outbox: ReadonlyArray<EmailMessage>;
  clear(): void;
};

/**
 * Test adapter: captures each message in memory instead of sending, so an
 * integration test can assert the recipient and template parameters — and pull
 * the one-time link straight out of a captured message to drive the rest of a
 * flow — with nothing transmitted and no provider key required.
 */
export function createCapturedEmailSender(): CapturedEmailSender {
  const outbox: EmailMessage[] = [];
  return {
    outbox,
    async send(message: EmailMessage): Promise<void> {
      outbox.push(message);
    },
    clear() {
      outbox.length = 0;
    },
  };
}

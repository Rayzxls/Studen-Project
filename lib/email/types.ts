/**
 * The transactional email port (ADR-0042). Feature code depends only on these
 * types, never on a provider SDK, so the provider is swappable behind one seam.
 * A message is a recipient plus a typed template — never raw HTML assembled at
 * the call site — so every send is auditable and rendering stays testable.
 */

export type EmailTemplate =
  | {
      kind: "password_recovery";
      recoveryUrl: string;
      expiresInMinutes: number;
    }
  | {
      kind: "email_change_verification";
      verifyUrl: string;
      expiresInMinutes: number;
    };

export type EmailTemplateKind = EmailTemplate["kind"];

export type EmailMessage = {
  to: string;
  template: EmailTemplate;
};

export type RenderedEmail = {
  subject: string;
  text: string;
};

export interface EmailSender {
  send(message: EmailMessage): Promise<void>;
}

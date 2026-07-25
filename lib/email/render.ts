import type { EmailTemplate, RenderedEmail } from "./types";

/**
 * Turns a typed template into a subject and plain-text body. Pure, so it can be
 * asserted directly and reused by every adapter. Copy is Thai and states the
 * single-use, time-limited nature of each link and that an unrequested message
 * can be ignored safely.
 */
export function renderEmail(template: EmailTemplate): RenderedEmail {
  switch (template.kind) {
    case "password_recovery":
      return {
        subject: "รีเซ็ตรหัสผ่าน — Beagle Classroom",
        text: [
          "มีคำขอรีเซ็ตรหัสผ่านสำหรับบัญชีของคุณ",
          "",
          `กดลิงก์ด้านล่างเพื่อตั้งรหัสผ่านใหม่ ลิงก์นี้ใช้ได้ครั้งเดียวและหมดอายุใน ${template.expiresInMinutes} นาที:`,
          template.recoveryUrl,
          "",
          "ถ้าคุณไม่ได้เป็นผู้ขอ ไม่ต้องทำอะไร บัญชีของคุณยังปลอดภัย",
        ].join("\n"),
      };
    case "email_change_verification":
      return {
        subject: "ยืนยันอีเมลใหม่ — Beagle Classroom",
        text: [
          "มีคำขอเปลี่ยนอีเมลของบัญชีมาเป็นอีเมลนี้",
          "",
          `กดลิงก์ด้านล่างเพื่อยืนยัน ลิงก์นี้ใช้ได้ครั้งเดียวและหมดอายุใน ${template.expiresInMinutes} นาที:`,
          template.verifyUrl,
          "",
          "ถ้าคุณไม่ได้เป็นผู้ขอ ไม่ต้องทำอะไร",
        ].join("\n"),
      };
  }
}

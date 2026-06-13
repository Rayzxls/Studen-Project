/**
 * PURE — Thai noun-phrase labels for audit action enum literals.
 *
 * Used by:
 *   - `/admin/audit` viewer "เหตุการณ์" column (as a chip)
 *   - `lib/audit/render.renderRow` (verb in the verbose sentence)
 *   - CSV export "เหตุการณ์" column
 *
 * Phase 10A · ADR-0027.
 *
 * Adding a new audit event:
 *   1. Extend `AuditEvent` union in `lib/audit/log.ts`
 *   2. Add a corresponding entry below — keep the tone as a short Thai
 *      noun phrase (≤ 6 words). Verbs in the sentence form happen in
 *      `render.ts`; the label here is the noun (subject of the audit).
 */

import type { AuditEvent } from "./log";

const ACTION_LABEL_TH: Record<AuditEvent, string> = {
  // Auth
  LOGIN_SUCCESS: "เข้าสู่ระบบ",
  LOGIN_FAILED: "เข้าสู่ระบบไม่สำเร็จ",
  USER_LOCKED: "ล็อกบัญชีอัตโนมัติ",
  LOGOUT: "ออกจากระบบ",
  PASSWORD_RESET_BY_OTHER: "รีเซ็ตรหัสผ่านโดยผู้อื่น",
  PASSWORD_CHANGED_SELF: "เปลี่ยนรหัสผ่านด้วยตัวเอง",
  // Identity
  STUDENT_SELF_REGISTERED: "นักเรียนสมัครเอง",
  USER_CREATED_BY_ADMIN: "Admin สร้างผู้ใช้",
  USER_ANONYMIZED: "ลบข้อมูลผู้ใช้แบบนิรนาม",
  ROLE_CHANGE: "เปลี่ยนบทบาทผู้ใช้",
  CONSENT_GRANTED: "ให้ความยินยอม",
  CONSENT_WITHDRAWN: "ถอนความยินยอม",
  // CSV Import
  CSV_IMPORT: "นำเข้า CSV",
  COURSE_OFFERING_CREATED: "ครูสร้างวิชาใหม่",
  // Class Code
  CLASS_CODE_REGENERATED: "สร้าง Class Code ใหม่",
  CLASS_CODE_DEACTIVATED: "ปิด Class Code",
  CLASS_CODE_REACTIVATED: "เปิด Class Code อีกครั้ง",
  CLASS_CODE_EXPIRY_SET: "ตั้งเวลาหมดอายุ Class Code",
  // Course Membership
  COURSE_MEMBER_JOINED: "นักเรียนเข้าห้อง",
  COURSE_MEMBER_LEFT: "นักเรียนออกจากวิชา",
  COURSE_MEMBER_REMOVED: "นำนักเรียนออกจากห้อง",
  COURSE_MEMBER_RESTORED_BY_REJOIN: "นักเรียนกลับเข้าห้องอัตโนมัติ",
  COURSE_OFFERING_ARCHIVED: "ครูยกเลิกวิชา",
  // Scoring
  SCORE_ITEM_PUBLISHED: "เผยแพร่รายการคะแนน",
  SCORE_EDIT_AFTER_PUBLISH: "แก้คะแนนหลังเผยแพร่",
  SCORE_DELETE_AFTER_PUBLISH: "ลบรายการคะแนนหลังเผยแพร่",
  // Attendance
  ATTENDANCE_BACK_EDIT: "แก้การเข้าเรียนย้อนหลัง",
  SESSION_CANCELLED: "ยกเลิกคาบเรียน",
  // Assignment + Submission
  ASSIGNMENT_UPDATED: "ยกเลิกการนับคะแนนของการบ้าน",
  SUBMISSION_RETURNED: "ส่งงานกลับให้นักเรียนแก้",
  SUBMISSION_WITHDRAWN: "นักเรียนยกเลิกการส่งงาน",
  // Profile (Phase 13)
  DISPLAY_NAME_CHANGED: "เปลี่ยนชื่อที่แสดง",
  PROFILE_IMAGE_CHANGED: "เปลี่ยนรูปโปรไฟล์",
  PROFILE_IMAGE_DELETED: "ลบรูปโปรไฟล์ของตัวเอง",
  PROFILE_IMAGE_RESET_BY_ADMIN: "Admin รีเซ็ตรูปโปรไฟล์",
  // Moderation
  COMMENT_MODERATED: "ลบข้อความโดยผู้ดูแล",
  // Material + Announcement
  MATERIAL_DELETED: "ลบเอกสาร",
  ANNOUNCEMENT_DELETED: "ลบประกาศ",
  // Files
  FILE_UPLOADED: "อัปโหลดไฟล์",
  FILE_REJECTED: "ไฟล์ถูกปฏิเสธ",
  FILE_DELETED: "ลบไฟล์",
  FILE_INFECTED_BLOCKED: "บล็อกไฟล์ที่ติดมัลแวร์",
  // Admin (Phase 7-8)
  ADMIN_VIEW_STUDENT_DATA: "Admin เปิดดูข้อมูลนักเรียน",
  ADMIN_AUDIT_EXPORTED: "Admin ส่งออก Audit Log",
  // Phase 10
  ACADEMIC_YEAR_CREATED: "เพิ่มปีการศึกษา",
  ACADEMIC_YEAR_UPDATED: "แก้ปีการศึกษา",
  ACADEMIC_YEAR_DELETED: "ลบปีการศึกษา",
  TERM_CREATED: "เพิ่มภาคเรียน",
  TERM_UPDATED: "แก้ภาคเรียน",
  TERM_DELETED: "ลบภาคเรียน",
  CLASS_CREATED: "เพิ่มห้องเรียน",
  CLASS_UPDATED: "แก้ห้องเรียน",
  CLASS_DELETED: "ลบห้องเรียน",
  HOMEROOM_ASSIGNED: "กำหนดครูประจำชั้น",
  TEACHER_CREATED_SINGLE: "เพิ่มครู (รายคน)",
  PASSWORD_RESET_BY_ADMIN: "Admin รีเซ็ตรหัสผ่าน",
  CLASS_ANALYTICS_EXPORTED: "ส่งออกรายงานห้องเรียน",
};

/**
 * Short Thai noun phrase for an audit action — chip / column header style.
 * Unknown action → the raw enum literal (defensive — newly-added events
 * that haven't been labelled yet still render rather than breaking the
 * page; the lint of the union catches them at typecheck time).
 */
export function actionLabel(action: AuditEvent): string {
  return ACTION_LABEL_TH[action] ?? action;
}

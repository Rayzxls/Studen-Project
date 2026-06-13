/**
 * Announcement validation (Zod) — Phase 7 · P7-3
 */

import { z } from "zod";
import { BODY_MAX, LINK_URL_MAX, MAX_LINK_URLS, TITLE_MAX } from "./constants";

const LinkUrlSchema = z
  .string()
  .trim()
  .min(1)
  .max(LINK_URL_MAX)
  .refine(
    (s) => {
      try {
        const u = new URL(s);
        return u.protocol === "http:" || u.protocol === "https:";
      } catch {
        return false;
      }
    },
    { message: "ลิงก์ไม่ถูกต้อง (ต้องขึ้นต้นด้วย http:// หรือ https://)" }
  );

export const CreateAnnouncementSchema = z
  .object({
    courseOfferingId: z.string().min(1),
    title: z.string().trim().max(TITLE_MAX).optional().nullable(),
    body: z.string().min(1).max(BODY_MAX),
    fileAttachmentIds: z.array(z.string().min(1)).default([]),
    linkUrls: z.array(LinkUrlSchema).max(MAX_LINK_URLS).default([]),
    id: z.string().min(1).max(64).optional(),
  })
  .transform((v) => ({
    ...v,
    title: v.title?.trim() ? v.title.trim() : null,
  }));
export type CreateAnnouncementInput = z.infer<typeof CreateAnnouncementSchema>;

export const UpdateAnnouncementSchema = z.object({
  title: z.string().trim().max(TITLE_MAX).optional().nullable(),
  body: z.string().min(1).max(BODY_MAX).optional(),
  fileAttachmentIds: z.array(z.string().min(1)).optional(),
  linkUrls: z.array(LinkUrlSchema).max(MAX_LINK_URLS).optional(),
});
export type UpdateAnnouncementInput = z.infer<typeof UpdateAnnouncementSchema>;

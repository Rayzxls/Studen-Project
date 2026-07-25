import Link from "next/link";
import { notFound } from "next/navigation";

import { identityFoundationMutationsEnabled } from "@/lib/identity/feature-flags";
import { findTeacherInviteByToken } from "@/lib/identity/teacher-invite-read";
import { startTeacherInviteAction } from "./actions";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ token: string }>;
};

export default async function TeacherInvitePage({ params }: PageProps) {
  // Fail closed like every other flagged surface: the route does not exist
  // until the identity feature is enabled.
  if (!identityFoundationMutationsEnabled()) {
    notFound();
  }

  const { token } = await params;
  const invite = await findTeacherInviteByToken(token);

  if (!invite || invite.status !== "PENDING") {
    const message =
      invite?.status === "ACCEPTED"
        ? "คำเชิญนี้ถูกใช้ไปแล้ว"
        : invite?.status === "REVOKED"
          ? "คำเชิญนี้ถูกยกเลิกแล้ว"
          : invite?.status === "EXPIRED"
            ? "คำเชิญนี้หมดอายุแล้ว"
            : "ลิงก์คำเชิญไม่ถูกต้อง";

    return (
      <div className="animate-fade-in rounded-2xl bg-white p-8 shadow-card">
        <h1 className="text-2xl font-medium text-black">รับคำเชิญไม่ได้</h1>
        <p className="mt-2 text-sm text-black/60">
          {message} — กรุณาติดต่อผู้ดูแลระบบเพื่อขอคำเชิญใหม่
        </p>
        <Link
          href="/login"
          className="btn-secondary mt-5 inline-flex justify-center"
        >
          ไปหน้าเข้าสู่ระบบ
        </Link>
      </div>
    );
  }

  return (
    <div className="animate-fade-in rounded-2xl bg-white p-8 shadow-card">
      <div className="mb-6">
        <h1
          className="text-2xl font-medium text-black"
          style={{ letterSpacing: "-0.02em" }}
        >
          คำเชิญเป็นครู
        </h1>
        <p className="mt-1 text-sm text-black/60">
          คุณได้รับเชิญให้เป็นครูในระบบ — เข้าสู่ระบบด้วยบัญชี Google
          ของอีเมลที่ได้รับเชิญเพื่อรับบัญชี
        </p>
      </div>

      <div className="mb-4 rounded-xl bg-black/[0.03] px-3 py-2 text-sm">
        <span className="text-black/50">อีเมลที่ได้รับเชิญ</span>
        <div className="font-medium text-black">{invite.email}</div>
      </div>

      <form action={startTeacherInviteAction}>
        <input type="hidden" name="token" value={token} />
        <button
          type="submit"
          className="btn-secondary w-full justify-center gap-2"
        >
          <GoogleGlyph />
          ยอมรับคำเชิญด้วย Google
        </button>
      </form>

      <p className="mt-4 text-center text-xs text-black/40">
        ต้องใช้บัญชี Google ของ {invite.email} เท่านั้น
      </p>
    </div>
  );
}

function GoogleGlyph() {
  return (
    <svg
      aria-hidden
      width="18"
      height="18"
      viewBox="0 0 18 18"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18Z"
      />
      <path
        fill="#FBBC05"
        d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33Z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.46 3.44 1.35l2.58-2.58C13.47.9 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58Z"
      />
    </svg>
  );
}

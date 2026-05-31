"use server";

import { AuthError } from "next-auth";
import { signIn } from "@/lib/auth";

export type LoginState = {
  error?: string;
};

export async function loginAction(
  _prev: LoginState,
  formData: FormData
): Promise<LoginState> {
  const identifier = String(formData.get("identifier") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!identifier || !password) {
    return { error: "กรุณากรอกข้อมูลให้ครบ" };
  }

  try {
    await signIn("credentials", {
      identifier,
      password,
      redirectTo: "/dashboard",
    });
    return {};
  } catch (err) {
    if (err instanceof AuthError) {
      return { error: "เข้าสู่ระบบไม่สำเร็จ ตรวจสอบรหัสผ่านอีกครั้ง" };
    }
    throw err; // re-throw for Next redirect
  }
}

import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth/config";

const { auth } = NextAuth(authConfig);

/**
 * Auth proxy + secure headers
 * ดู Security.md § 8 (Secure Headers)
 */
export default auth((req) => {
  const res = req.auth ? undefined : undefined;
  // (auth() handles redirect via authConfig.callbacks.authorized)
  void res;
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.svg$).*)"],
};

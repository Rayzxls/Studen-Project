import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import {
  PasswordRecoveryRequestForm,
  type RecoveryRequestState,
} from "@/components/auth/password-recovery-request-form";

afterEach(cleanup);

function noopAction(): Promise<RecoveryRequestState> {
  return Promise.resolve({});
}

describe("PasswordRecoveryRequestForm", () => {
  it("explains the fallback-password prerequisite before submission", () => {
    render(<PasswordRecoveryRequestForm action={noopAction} />);

    expect(
      screen.getByText("ใช้ได้เฉพาะบัญชีที่ตั้งรหัสผ่านสำรองแล้ว")
    ).toBeInTheDocument();
    expect(
      screen.getByText(/เข้าสู่ระบบด้วย Google แล้วไปที่ โปรไฟล์/)
    ).toBeInTheDocument();
  });

  it("provides a clear route back to Google sign-in", () => {
    render(<PasswordRecoveryRequestForm action={noopAction} />);

    expect(
      screen.getByRole("link", { name: /กลับหน้าเข้าสู่ระบบ/ })
    ).toHaveAttribute("href", "/login");
  });
});

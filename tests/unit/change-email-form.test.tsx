import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ProfileFormState } from "@/app/profile/actions";

// The form binds the Server Action directly, so the action module (which pulls
// in session/database/server-only code) is replaced with an inert stub.
vi.mock("@/app/profile/actions", () => ({
  requestEmailChangeAction: (): Promise<ProfileFormState> =>
    Promise.resolve({}),
}));

const { ChangeEmailForm } =
  await import("@/components/profile/change-email-form");

afterEach(cleanup);

describe("ChangeEmailForm", () => {
  it("shows the current address when the account already has one", () => {
    render(<ChangeEmailForm currentEmail="owner@studennnn.local" />);

    expect(screen.getByText("owner@studennnn.local")).toBeInTheDocument();
    expect(screen.getByLabelText("อีเมลใหม่")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "ส่งลิงก์ยืนยันอีเมลใหม่" })
    ).toBeInTheDocument();
  });

  it("sets the first email on a username-only account without claiming one exists", () => {
    render(<ChangeEmailForm currentEmail={null} />);

    expect(screen.queryByText(/อีเมลปัจจุบัน/)).not.toBeInTheDocument();
    expect(screen.getByLabelText("อีเมล")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "ส่งลิงก์ยืนยันอีเมล" })
    ).toBeInTheDocument();
  });
});

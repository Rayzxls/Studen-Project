import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const signIn = vi.fn();
vi.mock("next-auth/react", () => ({
  signIn: (...args: unknown[]) => signIn(...args),
}));

import {
  GoogleSignInButton,
  googleSignInEnabled,
} from "@/components/auth/google-sign-in-button";

afterEach(() => {
  cleanup();
  signIn.mockReset();
});

describe("googleSignInEnabled", () => {
  it("is off unless the public flag is exactly '1'", () => {
    expect(googleSignInEnabled({})).toBe(false);
    expect(
      googleSignInEnabled({ NEXT_PUBLIC_GOOGLE_SIGNIN_ENABLED: "0" })
    ).toBe(false);
    expect(
      googleSignInEnabled({ NEXT_PUBLIC_GOOGLE_SIGNIN_ENABLED: "true" })
    ).toBe(false);
    expect(
      googleSignInEnabled({ NEXT_PUBLIC_GOOGLE_SIGNIN_ENABLED: "1" })
    ).toBe(true);
  });
});

describe("GoogleSignInButton", () => {
  it("starts the Google flow with the given callback url", () => {
    render(<GoogleSignInButton callbackUrl="/student" />);

    fireEvent.click(screen.getByRole("button", { name: /Google/ }));

    expect(signIn).toHaveBeenCalledWith("google", { callbackUrl: "/student" });
  });

  it("disables itself once the redirect has started", () => {
    render(<GoogleSignInButton />);
    const button = screen.getByRole("button", { name: /Google/ });

    fireEvent.click(button);

    expect(button).toBeDisabled();
    // A second click cannot fire another redirect.
    fireEvent.click(button);
    expect(signIn).toHaveBeenCalledTimes(1);
  });

  it("defaults the callback url to the site root", () => {
    render(<GoogleSignInButton />);

    fireEvent.click(screen.getByRole("button", { name: /Google/ }));

    expect(signIn).toHaveBeenCalledWith("google", { callbackUrl: "/" });
  });
});

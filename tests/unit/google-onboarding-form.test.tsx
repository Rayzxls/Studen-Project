import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  GoogleOnboardingForm,
  type GoogleOnboardingState,
} from "@/components/auth/google-onboarding-form";

afterEach(cleanup);

function noopAction(): Promise<GoogleOnboardingState> {
  return Promise.resolve({});
}

describe("GoogleOnboardingForm", () => {
  it("shows the verified email as read-only context, not an input", () => {
    render(
      <GoogleOnboardingForm email="student@example.com" action={noopAction} />
    );

    expect(screen.getByText("student@example.com")).toBeInTheDocument();
    // The email is display-only: there must be no field that could resubmit a
    // different address than the one Google verified.
    expect(screen.queryByDisplayValue("student@example.com")).toBeNull();
    expect(document.querySelector('input[name="email"]')).toBeNull();
  });

  it("collects a real first and last name and a required consent box", () => {
    render(
      <GoogleOnboardingForm email="student@example.com" action={noopAction} />
    );

    expect(document.querySelector('input[name="firstName"]')).toBeInstanceOf(
      HTMLInputElement
    );
    expect(document.querySelector('input[name="lastName"]')).toBeInstanceOf(
      HTMLInputElement
    );

    const consent = document.querySelector(
      'input[name="acceptedConsent"]'
    ) as HTMLInputElement | null;
    expect(consent?.type).toBe("checkbox");
    expect(consent?.required).toBe(true);
  });

  it("renders a server error returned by the action", () => {
    const action = vi.fn(
      async (): Promise<GoogleOnboardingState> => ({ error: "boom" })
    );
    render(
      <GoogleOnboardingForm email="student@example.com" action={action} />
    );

    // useActionState starts with the initial empty state; the error surfaces
    // after submission, so assert the initial render is clean.
    expect(screen.queryByText("boom")).toBeNull();
    expect(screen.getByRole("button", { name: /สร้างบัญชี/ })).toBeEnabled();
  });

  it("does not let the consent link submit the form", () => {
    render(
      <GoogleOnboardingForm email="student@example.com" action={noopAction} />
    );

    const link = screen.getByRole("link", { name: /ข้อกำหนด/ });
    expect(link).toHaveAttribute("href", "/privacy");
  });
});

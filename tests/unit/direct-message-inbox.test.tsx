import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

import { DirectMessageInbox } from "@/components/chat/direct-message-inbox";

const BOB = {
  userId: "student-2",
  role: "STUDENT" as const,
  firstName: "Bob",
  lastName: "Tester",
  profileImageId: null,
};

beforeEach(() => {
  push.mockReset();
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => vi.unstubAllGlobals());

describe("DirectMessageInbox", () => {
  it("does not expose a directory before a deliberate 3-character search", () => {
    render(<DirectMessageInbox conversations={[]} />);
    expect(screen.queryByText("Bob Tester")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "ค้นหา" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText("ค้นหาชื่อ"), {
      target: { value: "Bo" },
    });
    expect(screen.getByRole("button", { name: "ค้นหา" })).toBeDisabled();
  });

  it("searches by name and opens the selected two-person thread", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ people: [BOB] }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ conversationId: "dm-1" }),
      } as Response);
    render(<DirectMessageInbox conversations={[]} />);

    fireEvent.change(screen.getByLabelText("ค้นหาชื่อ"), {
      target: { value: "Bob" },
    });
    fireEvent.click(screen.getByRole("button", { name: "ค้นหา" }));
    fireEvent.click(await screen.findByText("Bob Tester"));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/chat/dm-1"));
    expect(fetchMock).toHaveBeenNthCalledWith(1, "/api/chat/people?q=Bob", {
      cache: "no-store",
    });
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/chat/conversations",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ otherUserId: "student-2" }),
      })
    );
  });
});

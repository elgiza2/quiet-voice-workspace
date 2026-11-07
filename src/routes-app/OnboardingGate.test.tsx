import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";

const mocks = vi.hoisted(() => ({ getUser: vi.fn(), profile: vi.fn() }));
vi.mock("@/lib/authStore", () => ({ getAuthState: () => ({ userId: null }) }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {
  auth: { getSession: mocks.getUser },
  from: () => ({ select: () => ({ eq: () => ({ maybeSingle: mocks.profile }) }) }),
} }));
import { OnboardingGate } from "./OnboardingGate";

describe("account loading recovery", () => {
  afterEach(() => { cleanup(); vi.resetAllMocks(); });
  it("does not navigate to setup on a profile-read failure and can retry", async () => {
    mocks.getUser.mockResolvedValue({ data: { session: { user: { id: "test-user" } } }, error: null });
    mocks.profile.mockResolvedValueOnce({ data: null, error: new Error("Unavailable") })
      .mockResolvedValueOnce({ data: { onboarding_completed: true }, error: null });
    render(<MemoryRouter initialEntries={["/"]}><OnboardingGate><div>Workspace loaded</div></OnboardingGate></MemoryRouter>);
    await screen.findByRole("alert");
    expect(screen.queryByText("Workspace loaded")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    await screen.findByText("Workspace loaded");
    expect(mocks.profile).toHaveBeenCalledTimes(2);
  });
  it("handles an auth rejection without leaving a blank view", async () => {
    mocks.getUser.mockRejectedValue(new Error("Network unavailable"));
    render(<MemoryRouter><OnboardingGate><div>Workspace loaded</div></OnboardingGate></MemoryRouter>);
    await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());
    expect(mocks.profile).not.toHaveBeenCalled();
  });
});
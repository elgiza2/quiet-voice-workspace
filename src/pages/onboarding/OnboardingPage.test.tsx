import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ getUser: vi.fn(), profile: vi.fn(), rpc: vi.fn(), nav: vi.fn() }));
vi.mock("react-router-dom", () => ({ useNavigate: () => mocks.nav }));
vi.mock("@/lib/theme", () => ({ forceDarkTheme: () => {} }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {
  auth: { getUser: mocks.getUser }, rpc: mocks.rpc,
  from: () => ({ select: () => ({ eq: () => ({ maybeSingle: mocks.profile }) }) }),
} }));
vi.mock("@/pages/agent/hub/HubPanels", () => ({ AgentForm: ({ onSubmit }: { onSubmit: (v: object) => void }) =>
  <button onClick={() => onSubmit({ name: "Sam", description: "", prompt: "Help", look: {} })}>Create</button>,
}));
import OnboardingPage from "./OnboardingPage";
afterEach(() => { cleanup(); vi.clearAllMocks(); });
describe("first-run recovery", () => {
  it("does not redirect to setup or auth on an account network failure", async () => {
    mocks.getUser.mockRejectedValueOnce(new Error("Network failed"));
    render(<OnboardingPage />);
    await screen.findByRole("alert");
    expect(mocks.nav).not.toHaveBeenCalled();
    mocks.getUser.mockResolvedValue({ data: { user: { id: "user" } }, error: null });
    mocks.profile.mockResolvedValue({ data: { display_name: "Test", onboarding_completed: false }, error: null });
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await screen.findByPlaceholderText("Your name");
    expect(mocks.getUser).toHaveBeenCalledTimes(2);
  });
  it("saves setup through one atomic operation and allows retry after failure", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: "user" } }, error: null });
    mocks.profile.mockResolvedValue({ data: { display_name: "Test", onboarding_completed: false }, error: null });
    mocks.rpc.mockResolvedValueOnce({ data: null, error: { message: "Failed" } }).mockResolvedValueOnce({ data: "same-bot", error: null });
    render(<OnboardingPage />);
    await screen.findByPlaceholderText("Your name");
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    fireEvent.click(screen.getByRole("button", { name: "Developer" }));
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    fireEvent.click(screen.getByRole("button", { name: "Create" }));
    await waitFor(() => expect(mocks.rpc).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(mocks.nav).not.toHaveBeenCalled());
    fireEvent.click(screen.getByRole("button", { name: "Create" }));
    await waitFor(() => expect(mocks.nav).toHaveBeenCalledWith("/", { replace: true }));
    expect(mocks.rpc.mock.calls[0][0]).toBe("complete_onboarding");
    expect(mocks.rpc.mock.calls[1][0]).toBe("complete_onboarding");
  });
});
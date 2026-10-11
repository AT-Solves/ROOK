import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import SetupPage from "@/app/setup/page";
import type { Me } from "@/lib/types";

const replace = vi.fn();
const router = { replace, push: vi.fn() }; // stable, like Next's router
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/lib/session", () => ({ getToken: () => "token" }));

const api = vi.hoisted(() => ({ me: vi.fn(), completeOrgSetup: vi.fn(), connectDelegated: vi.fn() }));
vi.mock("@/lib/api", async (orig) => ({ ...(await orig<typeof import("@/lib/api")>()), api }));

function me(org: Partial<Me["org"]> = {}, role: "admin" | "member" = "admin"): Me {
  return {
    user: { id: 1, email: "ana@fabrikam.example", name: "Ana Silva", title: "", role, org_id: 7, timezone: "UTC" },
    org: { id: 7, name: "Fabrikam", status: "setup", is_demo: false, identity_provider: "microsoft", is_owner: true, setup_required: true, ...org },
    llm: "rules",
  };
}

describe("organization setup (ADR-0011)", () => {
  beforeEach(() => {
    replace.mockReset();
    Object.values(api).forEach((f) => f.mockReset());
  });

  it("the first administrator confirms the organization, then is offered Microsoft 365", async () => {
    api.me.mockResolvedValue(me());
    api.completeOrgSetup.mockResolvedValue({ ...me().org, name: "Fabrikam Ltd", status: "active", setup_required: false });
    render(<SetupPage />);
    const input = await screen.findByLabelText("Organization name");
    expect(input).toHaveValue("Fabrikam");
    expect(screen.getByText(/you are its owner and administrator/)).toBeInTheDocument();
    fireEvent.change(input, { target: { value: "Fabrikam Ltd" } });
    fireEvent.click(screen.getByRole("button", { name: "Confirm organization" }));
    await waitFor(() => expect(api.completeOrgSetup).toHaveBeenCalledWith("Fabrikam Ltd"));
    expect(await screen.findByRole("heading", { name: /Fabrikam Ltd is ready/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Connect Microsoft 365" })).toBeEnabled();
  });

  it("members and existing organizations go straight to the workspace", async () => {
    api.me.mockResolvedValue(me({ status: "active", setup_required: false }, "member"));
    render(<SetupPage />);
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/"));
    expect(screen.queryByLabelText("Organization name")).toBeNull();
  });

  it("shows why saving failed", async () => {
    const { ApiError } = await import("@/lib/api");
    api.me.mockResolvedValue(me());
    api.completeOrgSetup.mockRejectedValue(new ApiError("invalid", "Enter your organization's name.", 422));
    render(<SetupPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Confirm organization" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Enter your organization's name.");
  });
});

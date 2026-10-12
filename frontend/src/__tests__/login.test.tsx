import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import LoginPage from "@/app/login/page";

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn(), push: vi.fn() }) }));
vi.mock("@/lib/location", () => ({ useSearchParam: () => null }));

const api = vi.hoisted(() => ({ providers: vi.fn(), devLogin: vi.fn() }));
vi.mock("@/lib/api", async (orig) => ({ ...(await orig<typeof import("@/lib/api")>()), api }));

function providers(personal_accounts: boolean) {
  return {
    providers: [{ id: "microsoft", name: "Microsoft", configured: true, login_url: "/api/auth/microsoft/login", personal_accounts }],
    dev_login: false,
  };
}

describe("sign-in copy (ADR-0012)", () => {
  beforeEach(() => api.providers.mockReset());

  it("keeps the work or school wording when personal accounts are off", async () => {
    api.providers.mockResolvedValue(providers(false));
    render(<LoginPage />);
    expect(await screen.findByRole("heading", { name: "Use your Microsoft work or school account." })).toBeInTheDocument();
    expect(screen.queryByText(/personal/)).toBeNull();
  });

  it("names personal accounts only when the server accepts them", async () => {
    api.providers.mockResolvedValue(providers(true));
    render(<LoginPage />);
    expect(await screen.findByRole("heading", { name: "Use your Microsoft account (work, school or personal)." })).toBeInTheDocument();
    expect(screen.getByText(/a personal account gets its own private workspace/)).toBeInTheDocument();
  });
});

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
    const only = screen.getByRole("link", { name: "Continue with Microsoft" });
    expect(only.getAttribute("href")).not.toContain("account=");
    expect(screen.getAllByRole("link", { name: /Continue with/ })).toHaveLength(1);
  });

  it("names personal accounts only when the server accepts them", async () => {
    api.providers.mockResolvedValue(providers(true));
    render(<LoginPage />);
    expect(await screen.findByRole("heading", { name: "Use your Microsoft account (work, school or personal)." })).toBeInTheDocument();
    expect(screen.getByText(/a personal account gets its own private workspace/)).toBeInTheDocument();
  });

  it("offers an explicit choice of work or school and personal Microsoft account", async () => {
    api.providers.mockResolvedValue(providers(true));
    render(<LoginPage />);
    const work = await screen.findByRole("link", { name: "Continue with work or school account" });
    const personal = screen.getByRole("link", { name: "Continue with personal Microsoft account" });
    expect(work.getAttribute("href")).toContain("/api/auth/microsoft/login?account=work&return_to=");
    expect(personal.getAttribute("href")).toContain("/api/auth/microsoft/login?account=personal&return_to=");
    expect(screen.queryByRole("link", { name: "Continue with Microsoft" })).toBeNull();
  });
});

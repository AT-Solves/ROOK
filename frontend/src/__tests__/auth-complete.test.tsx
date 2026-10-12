import { render, waitFor } from "@testing-library/react";
import { StrictMode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import AuthComplete from "@/app/auth/complete/page";
import { getToken } from "@/lib/session";

const replace = vi.fn();
const router = { replace, push: vi.fn() };
vi.mock("next/navigation", () => ({ useRouter: () => router }));

const INCOMPLETE = "/login?error=The%20sign-in%20response%20was%20incomplete";

describe("Microsoft sign-in completion", () => {
  beforeEach(() => {
    replace.mockReset();
    window.sessionStorage.clear();
  });

  it("handles the sign-in once, even when development mode runs the effect twice", async () => {
    window.history.replaceState(null, "", "/auth/complete#token=session-token&return_to=%2Fsetup");
    render(
      <StrictMode>
        <AuthComplete />
      </StrictMode>,
    );
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/setup"));
    expect(replace).toHaveBeenCalledTimes(1);
    expect(replace).not.toHaveBeenCalledWith(INCOMPLETE);
    expect(getToken()).toBe("session-token");
    expect(window.location.hash).toBe(""); // the token is still removed from the address bar
  });

  it("still reports an incomplete response when no token arrived", async () => {
    window.history.replaceState(null, "", "/auth/complete");
    render(<AuthComplete />);
    await waitFor(() => expect(replace).toHaveBeenCalledWith(INCOMPLETE));
    expect(getToken()).toBeNull();
  });
});

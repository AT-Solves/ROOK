import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { StrictMode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ContextPage from "@/app/(workspace)/context/page";
import MeetingsPage from "@/app/(workspace)/meetings/page";
import type { ContextOverview, ContextSource } from "@/lib/types";

const router = { replace: vi.fn(), push: vi.fn() };
vi.mock("next/navigation", () => ({ useRouter: () => router, usePathname: () => "/context" }));

const api = vi.hoisted(() => ({ context: vi.fn(), syncSource: vi.fn(), meetings: vi.fn(), disconnectSource: vi.fn(), connectDelegated: vi.fn() }));
vi.mock("@/lib/api", async (orig) => ({ ...(await orig<typeof import("@/lib/api")>()), api }));

const NONE = { meetings: 0, conversations: 0, transcripts: 0, work_items: 0, documents: 0 };

function m365(state: ContextSource["state"], lastSync: string | null): ContextSource {
  return {
    kind: "microsoft365", name: "Microsoft 365", suite: "", category: "communication", implemented: true, synthetic: false, delegated: true,
    connectable: state !== "connected", setup_required: false, sending: "off", state, requested_permissions: [],
    data_types: [{ key: "calendar", type: "meetings", label: "Calendar" }],
    connection: state !== "connected" ? null : {
      id: 7, status: "connected", account: "pat@outlook.example", last_attempted_sync: lastSync, last_successful_sync: lastSync,
      last_sync: lastSync ? { at: lastSync, ok: true, error: "", warnings: [], counts: {} } : null, granted_permissions: [],
      access: [{ key: "calendar", label: "Calendar", context: "meetings", status: lastSync ? "available" : "granted", status_label: "Available", reason: "", ok: true }],
      visible_items: NONE, actions: ["sync", "reconnect", "disconnect"],
    },
  };
}

function overview(source: ContextSource): ContextOverview {
  return {
    tagline: "", context_types: { meetings: "Meetings", conversations: "Conversations", transcripts: "Meeting transcripts", work_items: "Work items", documents: "Documents" },
    sources: [source], available_later: [],
    health: { state: "limited", label: "Limited context", claim_type: "INFERENCE", synthetic: false, summary: "", coverage: NONE, reasons: [] },
  };
}

const REPORT = { signals_new: 3, meetings_upserted: 2 };

function at(path: string) {
  window.history.replaceState(null, "", path);
}

describe("first Microsoft 365 sync after connecting", () => {
  beforeEach(() => {
    Object.values(api).forEach((f) => f.mockReset());
    api.context.mockResolvedValue(overview(m365("connected", null)));
    api.syncSource.mockResolvedValue(REPORT);
  });

  it("runs the existing sync exactly once for the connection event, then shows the result and refreshes", async () => {
    let finish: (r: typeof REPORT) => void = () => {};
    api.syncSource.mockReturnValueOnce(new Promise((resolve) => (finish = resolve)));
    at("/context?connected=microsoft365&id=7");
    render(<ContextPage />);
    expect(await screen.findByText("Microsoft 365 connected. ROOK is syncing your calendar and mail…")).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "Microsoft 365" })).toBeInTheDocument(); // the page is not blocked
    finish(REPORT);
    expect(await screen.findByText("Microsoft 365 connected and synchronized: 3 new items, 2 meetings.")).toBeInTheDocument();
    expect(api.syncSource).toHaveBeenCalledTimes(1);
    expect(api.syncSource).toHaveBeenCalledWith(7);
    await waitFor(() => expect(api.context).toHaveBeenCalledTimes(2)); // context reloaded after the sync
    expect(window.location.search).toBe(""); // the connection event is consumed
  });

  it("sends one sync request even when development mode runs the effect twice", async () => {
    at("/context?connected=microsoft365&id=7");
    render(
      <StrictMode>
        <ContextPage />
      </StrictMode>,
    );
    await screen.findByText(/connected and synchronized/);
    expect(api.syncSource).toHaveBeenCalledTimes(1);
  });

  it("does not sync on a normal visit or after a refresh of the connection page", async () => {
    at("/context");
    const { unmount } = render(<ContextPage />);
    await waitFor(() => expect(api.context).toHaveBeenCalled());
    unmount();
    expect(api.syncSource).not.toHaveBeenCalled();

    at("/context?connected=microsoft365&id=7");
    const first = render(<ContextPage />);
    await screen.findByText(/connected and synchronized/);
    first.unmount();
    render(<ContextPage />); // a refresh: the address no longer carries the event
    await waitFor(() => expect(api.context).toHaveBeenCalledTimes(4));
    expect(api.syncSource).toHaveBeenCalledTimes(1);
  });

  it("shows a failed first sync once, never retries, and keeps Sync now available", async () => {
    const { ApiError } = await import("@/lib/api");
    api.syncSource.mockRejectedValueOnce(new ApiError("conflict", "Microsoft 365 rejected the stored credentials; reconnect Microsoft 365.", 409, true));
    at("/context?connected=microsoft365&id=7");
    render(<ContextPage />);
    expect(await screen.findByRole("alert")).toHaveTextContent("first sync didn't complete: Microsoft 365 rejected the stored credentials");
    await new Promise((r) => setTimeout(r, 50));
    expect(api.syncSource).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Sync now" })).toBeEnabled();
  });

  it("keeps the manual Sync now action working", async () => {
    at("/context");
    render(<ContextPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Sync now" }));
    expect(await screen.findByText("Synchronized: 3 new items, 2 meetings.")).toBeInTheDocument();
    expect(api.syncSource).toHaveBeenCalledTimes(1);
    expect(api.syncSource).toHaveBeenCalledWith(7);
  });
});

describe("Meetings empty state", () => {
  beforeEach(() => {
    Object.values(api).forEach((f) => f.mockReset());
    api.meetings.mockResolvedValue([]);
  });

  it("asks to connect a calendar in Context when Microsoft 365 is not connected", async () => {
    api.context.mockResolvedValue(overview(m365("available", null)));
    render(<MeetingsPage />);
    expect(await screen.findByText("Connect your calendar in Context and ROOK will prepare you for upcoming meetings.")).toBeInTheDocument();
    expect(screen.queryByText(/Sources/)).toBeNull();
  });

  it("says the calendar is connected but not synchronized yet", async () => {
    api.context.mockResolvedValue(overview(m365("connected", null)));
    render(<MeetingsPage />);
    expect(await screen.findByText("Your Microsoft 365 calendar is connected but hasn't been synchronized yet.")).toBeInTheDocument();
    expect(screen.getByText("ROOK will prepare your meetings after the first sync.")).toBeInTheDocument();
    expect(screen.queryByText(/Connect your calendar/)).toBeNull();
  });

  it("says no meetings were found in the calendar period after a successful sync", async () => {
    api.context.mockResolvedValue(overview(m365("connected", "2026-10-13T08:00:00Z")));
    render(<MeetingsPage />);
    expect(await screen.findByText("No meetings found for the available calendar period.")).toBeInTheDocument();
    expect(screen.queryByText(/Connect your calendar/)).toBeNull();
  });
});

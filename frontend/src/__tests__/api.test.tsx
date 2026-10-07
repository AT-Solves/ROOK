import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { FollowupDraft } from "@/components/followup";
import { ApiError, api } from "@/lib/api";
import { getToken, safeReturnTo, setToken } from "@/lib/session";
import type { ActionProposal } from "@/lib/types";

import { ev } from "./fixtures";

function mockFetch(status: number, body: unknown) {
  return vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }));
}

describe("API boundary", () => {
  it("sends the session token as a bearer header", async () => {
    setToken("tok");
    const f = mockFetch(200, { ok: true });
    await api.risks();
    const headers = (f.mock.calls[0][1] as RequestInit).headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer tok");
    expect(String(f.mock.calls[0][0])).toMatch(/\/api\/risks$/);
  });

  it("401 clears the session and reports unauthenticated", async () => {
    setToken("expired");
    mockFetch(401, { detail: "Not authenticated" });
    await expect(api.brief()).rejects.toMatchObject({ kind: "unauthenticated" });
    expect(getToken()).toBeNull();
  });

  it("parses structured 409 details (what failed / action required / partial data)", async () => {
    mockFetch(409, { detail: { message: "Reconnect Microsoft 365.", action_required: true, partial_data: "Previously synced information remains available." } });
    const err = (await api.syncSource(1).catch((e) => e)) as ApiError;
    expect(err).toBeInstanceOf(ApiError);
    expect(err.kind).toBe("conflict");
    expect(err.actionRequired).toBe(true);
    expect(err.partialData).toMatch(/remains available/);
  });

  it("maps 403 to forbidden and network failures to a calm message", async () => {
    mockFetch(403, { detail: "You do not have access to this source in the originating system" });
    await expect(api.signal(9)).rejects.toMatchObject({ kind: "forbidden" });
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("offline"));
    await expect(api.brief()).rejects.toMatchObject({ kind: "network" });
  });

  it("blocks open redirects after sign-in", () => {
    expect(safeReturnTo("https://evil.example")).toBe("/");
    expect(safeReturnTo("//evil.example")).toBe("/");
    expect(safeReturnTo("/meetings/3")).toBe("/meetings/3");
  });
});

const draft: ActionProposal = {
  id: 11, kind: "send_email", title: "Follow up with Marcus Chen", status: "draft", result: "", related_type: "commitment",
  related_id: 3, created_at: "2026-10-07T10:00:00Z",
  payload: { to: ["marcus@acme.example"], subject: "Follow-up: performance testing", body: "Hi Marcus,", tone: "executive", engine: "template",
    context: { why: "A dependency slipped.", claim_type: "RECOMMENDATION", evidence: [ev(7)] } },
};

describe("human-controlled follow-up (C-001, ADR-0005)", () => {
  it("states that nothing is sent until approval, and shows why", () => {
    render(<FollowupDraft initial={draft} />);
    expect(screen.getByText(/Nothing is sent until you approve/)).toBeInTheDocument();
    expect(screen.getByText("A dependency slipped.")).toBeInTheDocument();
    expect(screen.getByLabelText("Message")).toHaveValue("Hi Marcus,");
  });

  it("sends only after an explicit approval click, saving edits first", async () => {
    const f = vi.spyOn(globalThis, "fetch").mockImplementation(async (url, init) => {
      const u = String(url);
      const body = u.endsWith("/approve") ? { ...draft, status: "executed", result: "Delivered to demo outbox" } : { ...draft, payload: { ...draft.payload, body: "Hi Marcus, edited" } };
      expect(init?.method).not.toBe("GET");
      return new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });
    });
    render(<FollowupDraft initial={draft} />);
    expect(f).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("Message"), { target: { value: "Hi Marcus, edited" } });
    fireEvent.click(screen.getByRole("button", { name: "Approve and send" }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Sent."));
    expect(f.mock.calls.map((c) => String(c[0]).replace(/.*\/api/, ""))).toEqual(["/actions/11", "/actions/11/approve"]);
  });
});

import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ContextOverviewView } from "@/components/context";
import type { ContextOverview, ContextSource } from "@/lib/types";

const TYPES = { meetings: "Meetings", conversations: "Conversations", transcripts: "Meeting transcripts", work_items: "Work items", documents: "Documents" } as const;
const NONE = { meetings: 0, conversations: 0, transcripts: 0, work_items: 0, documents: 0 };

function m365(overrides: Partial<NonNullable<ContextSource["connection"]>> = {}): ContextSource {
  return {
    kind: "microsoft365", name: "Microsoft 365", suite: "", category: "communication", implemented: true, synthetic: false, delegated: true,
    connectable: false, setup_required: false, sending: "off", state: "connected",
    data_types: [{ key: "mail", type: "conversations", label: "Outlook mail" }, { key: "calendar", type: "meetings", label: "Calendar" }, { key: "teams_transcripts", type: "transcripts", label: "Teams meeting transcripts" }],
    requested_permissions: [],
    connection: {
      id: 7, status: "connected", account: "yamini@contoso.example",
      last_attempted_sync: "2026-10-10T09:00:00Z", last_successful_sync: "2026-10-10T09:00:00Z",
      last_sync: { at: "2026-10-10T09:00:00Z", ok: true, error: "", warnings: ["Transcript unavailable for 'Leadership' (403); continuing without it."], counts: { signals_new: 3, meetings: 2 } },
      granted_permissions: [{ scope: "Mail.Read", label: "Read your mail" }, { scope: "Calendars.Read", label: "Read your calendar" }],
      access: [
        { key: "mail", label: "Outlook mail", context: "conversations", status: "available", status_label: "Available", reason: "Permission granted and read at the last sync.", ok: true },
        { key: "calendar", label: "Calendar", context: "meetings", status: "available", status_label: "Available", reason: "Permission granted and read at the last sync.", ok: true },
        { key: "teams_transcripts", label: "Teams meeting transcripts", context: "transcripts", status: "admin_required", status_label: "Administrator permission required", reason: "Microsoft 365 refused access to meeting transcripts (HTTP 403).", ok: false },
      ],
      visible_items: { ...NONE, conversations: 3, meetings: 2 },
      actions: ["sync", "reconnect", "disconnect"],
      ...overrides,
    },
  };
}

function ctx(sources: ContextSource[], health: Partial<ContextOverview["health"]> = {}): ContextOverview {
  return {
    tagline: "ROOK continuously builds context from the systems your organization already uses.",
    context_types: TYPES,
    sources,
    available_later: [
      { name: "Atlassian", products: ["Confluence", "Jira"], data_types: ["Pages", "Issues"] },
      { name: "Slack", products: ["Slack"], data_types: ["Messages", "Channels", "Threads"] },
    ],
    health: {
      state: "partial", label: "Partial context", claim_type: "INFERENCE", synthetic: false,
      summary: "ROOK can access your meetings and conversations, but not Teams meeting transcripts.",
      coverage: { ...NONE, meetings: 2, conversations: 3 },
      reasons: [
        { text: "Meetings: 2 you can access.", claim_type: "FACT", kind: "access" },
        { text: "Microsoft 365 · Teams meeting transcripts: administrator permission required.", claim_type: "FACT", kind: "limitation" },
      ],
      ...health,
    },
  };
}

describe("Context Control Center (M3.5 P0-2/P0-3)", () => {
  it("shows a connected source with account, access per kind of data, sync state and permissions", () => {
    render(<ContextOverviewView ctx={ctx([m365()])} onChange={() => {}} />);
    const card = screen.getByRole("article", { name: "Microsoft 365" });
    expect(card).toHaveTextContent("Connected");
    expect(card).toHaveTextContent("Account: yamini@contoso.example");
    expect(card).toHaveTextContent("Outlook mail — Available");
    expect(card).toHaveTextContent("Teams meeting transcripts — Administrator permission required");
    expect(card).toHaveTextContent("HTTP 403");
    expect(card).toHaveTextContent("Succeeded");
    expect(card).toHaveTextContent("3 new items · 2 meetings");
    expect(within(card).getByRole("list", { name: "Sync warnings" })).toHaveTextContent("Transcript unavailable");
    expect(card).toHaveTextContent("Read your mail");
    for (const name of ["Sync now", "Reconnect", "Disconnect"]) expect(within(card).getByRole("button", { name })).toBeEnabled();
  });

  it("offers only the actions the API allows", () => {
    render(<ContextOverviewView ctx={ctx([m365({ actions: ["sync"] })])} onChange={() => {}} />);
    const card = screen.getByRole("article", { name: "Microsoft 365" });
    expect(within(card).getByRole("button", { name: "Sync now" })).toBeInTheDocument();
    expect(within(card).queryByRole("button", { name: "Disconnect" })).toBeNull();
    expect(within(card).queryByRole("button", { name: "Reconnect" })).toBeNull();
  });

  it("explains a failed sync", () => {
    render(<ContextOverviewView ctx={ctx([m365({ last_sync: { at: "2026-10-10T09:00:00Z", ok: false, error: "Microsoft 365 access was revoked.", warnings: [], counts: {} }, status: "needs_reauth" })])} onChange={() => {}} />);
    const card = screen.getByRole("article", { name: "Microsoft 365" });
    expect(card).toHaveTextContent("Needs reconnecting");
    expect(card).toHaveTextContent("Failed");
    expect(card).toHaveTextContent("Microsoft 365 access was revoked.");
  });

  it("states health with its reason, split into access and limitations", () => {
    render(<ContextOverviewView ctx={ctx([m365()])} onChange={() => {}} />);
    const health = screen.getByRole("region", { name: "Context health" });
    expect(health).toHaveTextContent("Partial context");
    expect(health).toHaveTextContent("but not Teams meeting transcripts");
    expect(health.querySelector('[data-claim-type="INFERENCE"]')).not.toBeNull();
    expect(within(health).getByRole("heading", { name: /Limitations/ }).parentElement).toHaveTextContent("administrator permission required");
  });

  it("lists sources that are not built yet without any action", () => {
    render(<ContextOverviewView ctx={ctx([m365()])} onChange={() => {}} />);
    const later = screen.getByRole("region", { name: /Available later/ });
    expect(later).toHaveTextContent("Atlassian");
    expect(later).toHaveTextContent("Confluence · Jira");
    expect(later).toHaveTextContent("Messages · Channels · Threads");
    expect(within(later).queryByRole("button")).toBeNull();
  });

  it("has a clear empty state when nothing is connected", () => {
    const setup: ContextSource = { ...m365(), state: "available", connection: null, setup_required: true, connectable: false };
    render(<ContextOverviewView ctx={ctx([setup], { state: "not_connected", label: "Not connected", summary: "No organizational source is connected yet, so ROOK cannot build context.", reasons: [{ text: "No source is connected.", claim_type: "FACT", kind: "limitation" }] })} onChange={() => {}} />);
    expect(screen.getByRole("region", { name: /^Connected/ })).toHaveTextContent("No organizational source is connected yet.");
    const available = screen.getByRole("region", { name: /^Available(?! later)/ });
    expect(available).toHaveTextContent("Administrator setup required");
    expect(within(available).queryByRole("button", { name: "Connect" })).toBeNull();
    expect(screen.getByRole("region", { name: "Context health" })).toHaveTextContent("Not connected");
  });
});

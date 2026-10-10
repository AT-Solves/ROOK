import type { Page } from "@playwright/test";

/** The connected Microsoft 365 state as GET /api/context reports it (shape covered by backend/tests/test_context.py). */
export async function withMicrosoft365(page: Page) {
  await page.route("**/api/context", async (route) => {
    const real = await (await route.fetch()).json();
    const ms = real.sources.find((s: { kind: string }) => s.kind === "microsoft365");
    ms.state = "connected";
    ms.connection = {
      id: 999, status: "connected", account: "yamini@contoso.example",
      last_attempted_sync: "2026-10-10T09:00:00Z", last_successful_sync: "2026-10-10T09:00:00Z",
      last_sync: { at: "2026-10-10T09:00:00Z", ok: true, error: "", warnings: ["Transcript unavailable for 'Product Leadership Meeting' (403); continuing without it."], counts: { signals_new: 3, meetings: 2 }, gaps: {} },
      granted_permissions: [{ scope: "Calendars.Read", label: "Read your calendar" }, { scope: "Mail.Read", label: "Read your mail" }],
      access: [
        { key: "mail", label: "Outlook mail", context: "conversations", status: "available", status_label: "Available", reason: "Permission granted and read at the last sync.", ok: true },
        { key: "calendar", label: "Calendar", context: "meetings", status: "available", status_label: "Available", reason: "Permission granted and read at the last sync.", ok: true },
        { key: "teams_transcripts", label: "Teams meeting transcripts", context: "transcripts", status: "admin_required", status_label: "Administrator permission required", reason: "Microsoft 365 refused access to meeting transcripts (HTTP 403). An administrator must grant transcript access for your organization.", ok: false },
      ],
      visible_items: { meetings: 2, conversations: 3, transcripts: 0, work_items: 0, documents: 0 },
      actions: ["sync", "reconnect", "disconnect"],
    };
    // health as the backend derives it when a source has a permission gap (test_access_is_shown_per_kind_of_data_with_the_reason)
    real.health = {
      ...real.health, state: "partial", label: "Partial context",
      summary: "ROOK can access your meetings and conversations, but not Teams meeting transcripts or documents.",
      reasons: [...real.health.reasons,
        { text: "Microsoft 365 · Teams meeting transcripts: administrator permission required.", claim_type: "FACT", kind: "limitation" },
        { text: "Microsoft 365: Transcript unavailable for 'Product Leadership Meeting' (403); continuing without it.", claim_type: "FACT", kind: "limitation" }],
    };
    await route.fulfill({ json: real });
  });
}

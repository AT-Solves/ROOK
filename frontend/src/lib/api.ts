/**
 * The single boundary between the UI and the ROOK backend. Components call these functions; they do not
 * construct URLs, interpret HTTP status codes, or hold business logic.
 */

import { clearToken, getToken } from "./session";
import type {
  ActionProposal,
  AskAnswer,
  Brief,
  Commitment,
  ContextOverview,
  Decision,
  Me,
  Meeting,
  MeetingIntel,
  MeetingPrep,
  Providers,
  Risk,
  SignalDetail,
  SourceCatalogItem,
  SyncReport,
} from "./types";

export const API_BASE = (process.env.NEXT_PUBLIC_ROOK_API_URL ?? "http://localhost:8000").replace(/\/$/, "");

export type ApiErrorKind = "unauthenticated" | "forbidden" | "not_found" | "conflict" | "invalid" | "server" | "network";

/** Errors carry what UX §14 requires: what failed, whether the user must act, and whether partial data remains. */
export class ApiError extends Error {
  constructor(
    public kind: ApiErrorKind,
    message: string,
    public status: number = 0,
    public actionRequired: boolean = false,
    public partialData: string = "",
  ) {
    super(message);
  }
}

function kindFor(status: number): ApiErrorKind {
  if (status === 401) return "unauthenticated";
  if (status === 403) return "forbidden";
  if (status === 404) return "not_found";
  if (status === 409) return "conflict";
  if (status === 422 || status === 400) return "invalid";
  return "server";
}

export async function request<T>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json" };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  let body = init.body;
  if (init.json !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(init.json);
  }
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/api${path}`, { ...init, headers: { ...headers, ...(init.headers as object) }, body });
  } catch {
    throw new ApiError("network", "ROOK could not reach its server. Check your connection and try again.");
  }
  if (res.ok) return (res.status === 204 ? undefined : await res.json()) as T;

  let detail: unknown = undefined;
  try {
    detail = (await res.json())?.detail;
  } catch {
    /* non-JSON error body */
  }
  if (res.status === 401) clearToken();
  if (detail && typeof detail === "object" && "message" in detail) {
    const d = detail as { message: string; action_required?: boolean; partial_data?: string };
    throw new ApiError(kindFor(res.status), d.message, res.status, !!d.action_required, d.partial_data ?? "");
  }
  const fallback: Record<ApiErrorKind, string> = {
    unauthenticated: "Your session has ended. Please sign in again.",
    forbidden: "You don't have access to this in the source system.",
    not_found: "This item doesn't exist or isn't visible to you.",
    conflict: "This action can't be completed in the current state.",
    invalid: "ROOK couldn't accept that input.",
    server: "ROOK hit an unexpected error. Your data is safe; please try again.",
    network: "",
  };
  const kind = kindFor(res.status);
  throw new ApiError(kind, typeof detail === "string" ? detail : fallback[kind], res.status, kind === "unauthenticated");
}

// ---------------------------------------------------------------- auth / profile
export const api = {
  providers: () => request<Providers>("/auth/providers"),
  devLogin: (email: string) => request<{ token: string }>("/auth/login", { method: "POST", json: { email } }),
  me: () => request<Me>("/me"),
  setTimezone: (timezone: string) => request<Me["user"]>("/me", { method: "PATCH", json: { timezone } }),

  // ---------------------------------------------------------------- brief / ask
  brief: () => request<Brief>("/brief"),
  ask: (question: string) => request<AskAnswer>("/ask", { method: "POST", json: { question } }),

  // ---------------------------------------------------------------- meetings
  meetings: () => request<Meeting[]>("/meetings"),
  meetingPrep: (id: number) => request<MeetingPrep>(`/meetings/${id}/prep`),
  meetingIntel: (id: number) => request<MeetingIntel>(`/meetings/${id}/intelligence`),
  uploadTranscript: (id: number, text: string) =>
    request<MeetingIntel>(`/meetings/${id}/transcript`, { method: "POST", json: { text } }),

  // ---------------------------------------------------------------- registers
  decisions: (status?: "pending" | "made") => request<Decision[]>(`/decisions${status ? `?status=${status}` : ""}`),
  decision: (id: number) => request<Decision>(`/decisions/${id}`),
  commitments: (scope: "all" | "mine" | "waiting" | "proposed" = "all") => request<Commitment[]>(`/commitments?scope=${scope}`),
  commitment: (id: number) => request<Commitment>(`/commitments/${id}`),
  acceptCommitment: (id: number, ownerName?: string) =>
    request<Commitment>(`/commitments/${id}/accept`, { method: "POST", json: { owner_name: ownerName ?? null } }),
  dismissCommitment: (id: number) => request<Commitment>(`/commitments/${id}/dismiss`, { method: "POST" }),
  completeCommitment: (id: number) => request<Commitment>(`/commitments/${id}/complete`, { method: "POST" }),
  risks: () => request<Risk[]>("/risks"),
  risk: (id: number) => request<Risk>(`/risks/${id}`),
  acknowledgeRisk: (id: number) => request<Risk>(`/risks/${id}/acknowledge`, { method: "POST" }),

  // ---------------------------------------------------------------- follow-ups (human-controlled, ADR-0005)
  draftFollowup: (commitmentId: number, opts: { tone?: string; riskId?: number } = {}) =>
    request<ActionProposal>(`/commitments/${commitmentId}/followup`, {
      method: "POST",
      json: { tone: opts.tone ?? "executive", risk_id: opts.riskId ?? null },
    }),
  editAction: (id: number, patch: { subject?: string; body?: string }) =>
    request<ActionProposal>(`/actions/${id}`, { method: "PATCH", json: patch }),
  approveAction: (id: number) => request<ActionProposal>(`/actions/${id}/approve`, { method: "POST" }),
  rejectAction: (id: number) => request<ActionProposal>(`/actions/${id}/reject`, { method: "POST" }),

  // ---------------------------------------------------------------- sources / evidence
  sources: () => request<SourceCatalogItem[]>("/sources"),
  context: () => request<ContextOverview>("/context"),
  disconnectSource: (id: number) => request<{ id: number; status: string }>(`/sources/${id}/disconnect`, { method: "POST" }),
  connectDelegated: (kind: string) => request<{ authorization_url: string }>(`/sources/${kind}/connect`, { method: "POST" }),
  syncSource: (id: number) => request<SyncReport>(`/sources/${id}/sync`, { method: "POST" }),
  signal: (id: number) => request<SignalDetail>(`/signals/${id}`),
};

export type Api = typeof api;

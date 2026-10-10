/**
 * Types mirroring the ROOK API contract (backend/rook/services/views.py, ask.py, briefing.py, meetings.py).
 * The UI renders these structures; it never derives business facts of its own.
 */

export type ClaimType = "FACT" | "INFERENCE" | "RECOMMENDATION" | "UNKNOWN";
export type Confidence = "high" | "medium" | "low";
export type Level = "high" | "medium" | "low";

export interface EvidenceRef {
  signal_id: number;
  kind: string;
  channel: string;
  title: string;
  author: string;
  occurred_at: string | null;
  quote: string;
  note: string;
  url: string;
  authority: number;
  summary?: string;
  derived?: string[];
}

export type ActionRef =
  | { type: "draft_followup"; commitment_id: number; risk_id?: number }
  | { type: "prepare_meeting"; meeting_id: number }
  | { type: "decide"; decision_id: number }
  | { type: "review_decision"; decision_id: number }
  | { type: "assign_owner"; signal_id: number }
  | { type: "schedule_decision" };

export interface RecommendedAction {
  text: string;
  claim_type: "RECOMMENDATION";
  action: ActionRef | Record<string, never>;
}

export interface Claim {
  text: string;
  claim_type: ClaimType;
  confidence: Confidence;
  evidence: EvidenceRef[];
  basis: string;
  detail: string;
  meta: string;
  action?: ActionRef;
}

export interface Decision {
  id: number;
  code: string;
  statement: string;
  owner: string;
  rationale: string;
  status: "made" | "pending" | "superseded";
  confidence: Confidence;
  decided_at: string;
  project_id: number | null;
  project: string | null;
  meeting_id: number | null;
  participants: string[];
  context: string;
  needs_me: boolean;
  claim_type: ClaimType;
  basis: string;
  related_commitments: { id: number; owner: string; description: string; status: string }[];
  evidence: EvidenceRef[];
  related_risks?: Risk[];
}

export interface Commitment {
  id: number;
  owner: string;
  owner_email: string;
  description: string;
  due_date: string | null;
  kind: "explicit" | "inferred";
  status: "open" | "overdue" | "done" | "proposed" | "dropped";
  confidence: Confidence;
  project_id: number | null;
  project: string | null;
  mine: boolean;
  claim_type: ClaimType;
  basis: string;
  status_claim_type: ClaimType;
  status_basis: string;
  related_decision: { id: number; code: string; statement: string; basis: string; claim_type: ClaimType } | null;
  evidence: EvidenceRef[];
  related_risks?: Risk[];
  followups?: ActionProposal[];
}

export interface Risk {
  id: number;
  title: string;
  explanation: string;
  level: Level;
  confidence: Confidence;
  status: "open" | "acknowledged" | "resolved";
  rule: string;
  project_id: number | null;
  project: string | null;
  detected_at: string;
  claim_type: ClaimType;
  basis: string;
  recommended_action: RecommendedAction | null;
  related: { commitments?: number[]; decisions?: number[] };
  evidence: EvidenceRef[];
  related_commitments?: Commitment[];
  related_decisions?: Decision[];
}

export interface Meeting {
  id: number;
  title: string;
  purpose: string;
  starts_at: string;
  ends_at: string;
  attendees: string[];
  organizer: string;
  project_id: number | null;
  project: string | null;
  past?: boolean;
  prep_reasons?: string[];
  prep_required?: boolean;
  has_transcript?: boolean;
}

export interface AttentionItem {
  type: "risk" | "decision" | "commitment";
  label: string;
  title: string;
  level: Level;
  confidence: Confidence;
  id: number;
  why: string;
  claim_type: ClaimType;
  evidence: EvidenceRef[];
  recommended_action: RecommendedAction | null;
}

export interface ChangeItem extends EvidenceRef {
  claim_type: ClaimType;
  derived: string[];
  summary: string;
}

export interface PersonAttention {
  name: string;
  email: string;
  title: string;
  last_interaction: string | null;
  days_since: number | null;
  reasons: string[];
}

export interface Brief {
  greeting: string;
  date: string;
  timezone: string;
  generated_at: string;
  headline: string[];
  counts: Record<string, number>;
  attention: AttentionItem[];
  today: Meeting[];
  decisions_pending: Decision[];
  my_commitments: Commitment[];
  waiting_for: Commitment[];
  proposed: Commitment[];
  risks: Risk[];
  changes: ChangeItem[];
  people: PersonAttention[];
}

export interface AskAnswer {
  question: string;
  intent: string;
  engine: string;
  answer: string;
  /** Single-type answers only. Null for a composite answer: mixed claims are never collapsed into one label (C-008). */
  claim_type: ClaimType | null;
  confidence: Confidence | null;
  /** Composite answers: the direct answer as individually typed units, FACT → INFERENCE → RECOMMENDATION → UNKNOWN. */
  composite: boolean;
  units: Claim[];
  unknowns: Claim[];
  what_changed: Claim[];
  why_it_matters: Claim[];
  key_points: Claim[];
  recommended_actions: Claim[];
  sections: { title: string; items: Claim[] }[];
  sources: EvidenceRef[];
  meeting_id?: number;
  project_id?: number;
}

export interface MeetingPrep {
  meeting: Meeting;
  participants: { email: string; name: string; title: string }[];
  prep_reasons: string[];
  previous_meetings: Meeting[];
  decisions: Decision[];
  open_commitments: Commitment[];
  risks: Risk[];
  related_signals: EvidenceRef[];
  suggested_questions: Claim[];
}

export interface MeetingIntel {
  meeting: Meeting;
  has_transcript: boolean;
  decisions: Decision[];
  commitments: Commitment[];
  open_questions: Claim[];
  inform: { email: string; name: string; title: string }[];
  deadlines: string[];
}

export interface ActionProposal {
  id: number;
  kind: string;
  title: string;
  status: "draft" | "approved" | "rejected" | "executed" | "blocked";
  result: string;
  related_type: string;
  related_id: number | null;
  created_at: string;
  payload: {
    to: string[];
    subject: string;
    body: string;
    tone: string;
    engine: string;
    context?: {
      why: string;
      claim_type: ClaimType;
      evidence: EvidenceRef[];
      risk?: { id: number; title: string; level: Level };
      commitment?: { id: number; owner: string; description: string; due_date: string | null; status: string };
    };
  };
}

export interface SourceCatalogItem {
  kind: string;
  name: string;
  category: string;
  phase: number;
  delegated: boolean;
  credentials_present: boolean;
  required_env: string[];
  scopes: string[];
  sending_enabled: boolean;
  connection: { id: number; status: string; last_synced_at: string | null } | null;
}

/* ---------------------------------------------------------------- Context Control Center (GET /api/context) */

export type ContextType = "meetings" | "conversations" | "transcripts" | "work_items" | "documents";
export interface Permission {
  scope: string;
  label: string;
}
export interface LastSync {
  at: string;
  ok: boolean;
  error: string;
  warnings: string[];
  counts: { signals_new?: number; meetings?: number };
}
export interface ContextSource {
  kind: string;
  name: string;
  category: string;
  implemented: boolean;
  synthetic: boolean;
  delegated: boolean;
  connectable: boolean;
  setup_required: boolean;
  data_types: { type: ContextType; label: string }[];
  requested_permissions: Permission[];
  sending: string;
  state: "connected" | "available" | "later";
  connection: {
    id: number;
    status: "connected" | "needs_reauth" | "needs_configuration" | "disconnected" | string;
    account: string;
    last_successful_sync: string | null;
    last_sync: LastSync | null;
    granted_permissions: Permission[];
    visible_items: Record<ContextType, number>;
  } | null;
}
export interface ContextHealth {
  state: "strong" | "partial" | "limited" | "not_connected";
  label: string;
  claim_type: ClaimType;
  summary: string;
  reasons: { text: string; claim_type: ClaimType }[];
  coverage: Record<ContextType, number>;
  synthetic: boolean;
}
export interface ContextOverview {
  health: ContextHealth;
  sources: ContextSource[];
  context_types: Record<ContextType, string>;
}

export interface SyncReport {
  signals_new: number;
  meetings_upserted: number;
  decisions_new: number;
  commitments_new: number;
  commitments_completed: number;
  evidence_linked: number;
  risks_open: number;
  engine: string;
  warnings: string[];
}

export interface SignalDetail extends EvidenceRef {
  body: string;
  participants: string[];
  visibility: "org" | "restricted";
}

export interface Me {
  user: { id: number; email: string; name: string; title: string; role: "admin" | "member"; org_id: number; timezone: string };
  org: { id: number; name: string };
  llm: string;
}

export interface Providers {
  providers: { id: string; name: string; configured: boolean; login_url: string }[];
  dev_login: boolean;
}

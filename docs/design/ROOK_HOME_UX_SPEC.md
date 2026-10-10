# ROOK Home — Executive Command Center (UX spec)

Status: **proposed — awaiting product-owner approval before implementation** (2026-10-10).
Scope: frontend information architecture and presentation of Home only. No backend, API, data, auth, permission, trust,
evidence, audit or follow-up-approval change. Related: `03_UX_UI_SPEC §4` (see C-010), `DESIGN_SYSTEM.md`, ADR-0008.

**Principle.** Metrics are navigation; situations are intelligence. Home answers *What should I know right now? What needs
my judgment? What should I do next? What should I watch?* — not *What records exist?*

---

## 1. Information architecture

| # | Region | Answers | Replaces (today's Home) |
|---|---|---|---|
| 1 | **Executive header** | Who / when / how much needs me | Brief hero |
| 2 | **Executive pulse** | Orientation (counts as filters/links) | 5 large metric cards |
| 3 | **One thing needs your judgment** | What matters most, why, what to do | First "Needs your attention" card |
| 4 | **Your next moves** | What should I do next (ranked) | Recommendations scattered across Attention, Waiting for, Decisions |
| 5 | **Today's moves** | Which meetings need preparation and what ROOK prepared | "Today" list |
| 6 | **Watch** | What ROOK is monitoring, per situation | "At risk" + "Waiting on others" + "Your commitments" registers |
| 7 | **Recent changes** | What changed (compact, linked to source) | "Recent changes" cards |

Registers are not shown on Home any more; every record stays one click away in its module (Decisions, Commitments, Risks).

## 2. Wireframes

### Desktop (≥1280px; first viewport at 1440×900 shows regions 1–3 and the top of 4 and 5)

```
┌ sidebar ┐┌──────────────────────────────────────────────────────────────────────────────┐
│ ROOK    ││ ░▓░▓ ROOK / EXECUTIVE BRIEF ░▓░▓░▓░▓░▓░▓░▓░▓░▓░▓░▓░▓░▓░▓░▓     [↻ Refresh]     │
│         ││ Good morning, Yamini                                       Prepared 09:18   │
│ Home    ││ Here's what needs your judgment today.  ·  Saturday, October 10              │
│ Ask     │├──────────────────────────────────────────────────────────────────────────────┤
│ …       ││ 6 ATTENTION │ 3 MEETINGS │ 1 DECISION │ 2 WAITING │ 4 WATCH      (pulse row) │
│         │├──────────────────────────────────────────────────────────────────────────────┤
│         ││ ONE THING NEEDS YOUR JUDGMENT                                                 │
│         ││ ┃ [INFERENCE] Project Phoenix · Risk detected                                 │
│         ││ ┃ Project Phoenix at risk: dependency delayed          ■ High risk · High conf.│
│         ││ ┃ The API release is reported delayed; this may put D-1001 at risk.           │
│         ││ ┃ Decision → D-1001 · Commitment → Marcus Chen, perf. testing (Oct 11)        │
│         ││ ┃ Dependency signal → Slack #platform, Jira · Pending → D-1002 pricing        │
│         ││ ┃ ▸ Evidence · 5 sources      ▸ View situation                                │
│         ││ ┃ [RECOMMENDATION] Ask Marcus for a recovery plan…   [Draft follow-up]        │
│         │├─────────────────────────────────────────┬────────────────────────────────────┤
│         ││ YOUR NEXT MOVES                         │ TODAY'S MOVES                       │
│         ││ 01 Ask Marcus for a recovery plan  [Draft]│ 13:30 Phoenix Product Review [Prep]│
│         ││ 02 Decide Phoenix pricing tiers  [Review] │   4 people · 2 decisions · 1 risk  │
│         ││ 03 Time-box Payments decision  [Prepare]  │   ROOK prepared 4 questions        │
│ profile ││ …                                        │ WATCH                               │
│         ││                                          │ ● Phoenix  Needs intervention       │
│         ││ RECENT CHANGES (compact, linked)         │ ● Q4 forecast  Monitor              │
└─────────┘└─────────────────────────────────────────┴────────────────────────────────────┘
```

### Tablet (768–1279px)
Header → pulse (wraps to one compact row) → judgment card → Next moves → Today's moves → Watch → Recent changes (single column).

### Mobile (<768px)
Top bar → header (compact, board visible) → pulse as a 3+2 compact grid → judgment card → Next moves → Today's moves → Watch → Recent changes.

## 3. Component hierarchy

```
HomePage (app/(workspace)/page.tsx — data loading + composition only)
├─ RookExecutiveHeader        greeting, "Here's what needs your judgment today.", date, refresh  [RookChessPattern dark]
├─ RookExecutivePulse         5 compact indicators (links/filters)
├─ RookJudgmentCard           wraps RookSituationCard (primary emphasis) + recommendation + actions
│   └─ RookSituationCard      headline · one-line why · relationship rows · evidence · expandable full context
├─ RookNextMoves → RookNextMove   numbered moves with claim type, reason, source situation, action
├─ RookTodaysMoves → RookMeetingPreparation   upcoming meetings + what ROOK prepared
├─ RookWatch                  one row per situation with a text status
└─ RookRecentChanges          compact time-ordered list linked to source
```
View-model logic lives in `frontend/src/lib/situations.ts` (pure functions, unit-tested), not in components.

## 4. Data mapping (existing APIs only)

| UI element | Source (existing endpoint → field) | Notes |
|---|---|---|
| Greeting, date, timezone | `GET /api/brief` → `greeting`, `date`, `timezone` | Time-aware greeting and local date already computed in the user's time zone. |
| "Prepared HH:MM" | `brief.generated_at` | Rendered in the browser's local time. |
| Pulse: Attention | `brief.counts.attention` | → scrolls to *Your next moves*. |
| Pulse: Meetings | `brief.counts.meetings_today` | → scrolls to *Today's moves*. |
| Pulse: Decisions | `brief.counts.decisions_pending` | → `/decisions?tab=pending`. |
| Pulse: Waiting | `brief.counts.waiting_for` | → `/commitments?tab=waiting`. |
| Pulse: Watch | `brief.counts.risks` (open risks ROOK is monitoring) | → scrolls to *Watch*. |
| **Situation** grouping | `brief.risks[]`, `decisions_pending[]`, `waiting_for[]`, `my_commitments[]` grouped by `project_id`; `attention[]` items resolved to those records by `type`+`id` | Records without a project become their own situation. |
| Situation relationships | `risk.related.decisions/commitments` ids; full records from `GET /api/risks/{id}` → `related_decisions`, `related_commitments` (permission-filtered) | Fetched for the primary situation only, after first paint. |
| FACT line (what changed) | `brief.changes[]` whose `signal_id` is in the situation's risk `evidence[].signal_id` → `summary` (`claim_type: FACT`) | Facts come from the source; never paraphrased into an inference. |
| INFERENCE line (why it matters) | `risk.title` / `risk.explanation` (`claim_type: INFERENCE`), clamped to one line; full text under "View situation" | |
| Dependency signal | risk `evidence[]` with `note: "delay signal"` → channel + title | Shown as "Dependency signal", not as a named entity ROOK did not extract. |
| RECOMMENDATION | `attention[].recommended_action` / `risk.recommended_action` (`claim_type: RECOMMENDATION`, `action`) | Action uses existing `ActionControl` (draft → explicit approval). |
| UNKNOWN | **Not in `/api/brief`.** Exists only in `POST /api/ask` (composite answer units). | See decision D-1. The frontend never writes its own UNKNOWN text. |
| Evidence | `evidence[]` on the risk/decision/commitment → existing `EvidenceList` (`Evidence · N sources`, links to `/evidence/{id}`) | |
| Next moves | `attention[]` in ROOK's order, one move per item with a `recommended_action`; plus pending decisions without one | Each move: rank, text, claim type, reason (`attention.label`), situation name, action. |
| Today's moves | `brief.today[]` where `!past`; per meeting `GET /api/meetings/{id}/prep` → `participants`, `decisions`, `risks`, `open_commitments`, `suggested_questions` | Prep loads progressively after first paint (2 calls today, ~17 ms each). Earlier meetings collapse into "Earlier today". |
| Watch | one row per situation with an open risk, an overdue commitment or a commitment others owe the user | Status text from existing fields (see §6). |
| Recent changes | `brief.changes[]` → time, `summary`, `channel`; link `/evidence/{signal_id}` | One line each; derived items listed in small text. |

**No new endpoints.** Extra reads are `GET /api/risks/{id}` (primary situation) and `GET /api/meetings/{id}/prep` (upcoming meetings). Neither writes audit records.

## 5. Situation view model (presentation layer only)

```ts
type Situation = {
  key: string;                    // "project:<id>" or "<type>:<id>" when no project
  title: string;                  // project name, else the lead record's title
  lead: AttentionItem | null;     // highest-ranked attention item in this situation
  risks: Risk[]; decisions: Decision[]; commitments: Commitment[];   // records from the brief, de-duplicated by id
  changes: ChangeItem[];          // facts linked through evidence signal ids
  recommendation: RecommendedAction | null;
  level: Level; confidence: Confidence;
  score: number;                  // ranking (see below)
};
```

**Ranking (primary judgment).** A documented, deterministic heuristic over existing fields:
`score = severity (high 3 / medium 2 / low 1) × 2 + connected records (decisions + commitments + risks, capped at 4)`
`+ 1 if it has an actionable recommendation + 1 if a decision in it is pending + 1 if confidence is high`.
Ties keep the backend's attention order. On today's demo data this selects **Project Phoenix** (high-severity
dependency risk, decision D-1001, pending decision D-1002, Marcus Chen's commitment, actionable recommendation).
Nothing is hard-coded to Phoenix.

**Duplicate rule.** A record appears in exactly one situation. The judgment card shows the top situation; Next moves,
Watch and Today's moves reference situations by name in one line each, never as a second large card.

## 6. Interaction model and status vocabulary

| Element | Interaction |
|---|---|
| Situation card | "View situation" expands in place (full explanation, all linked records with links to their detail pages, evidence). |
| Evidence | Existing disclosure → `/evidence/{id}`. |
| Recommendation | Existing `ActionControl`: **Draft follow-up** opens the draft; nothing is sent without "Approve and send". |
| Next move | Its action (Draft / Review decision / Open meeting preparation); the title links to the record. |
| Meeting | **Prepare** → `/meetings/{id}` (existing preparation page). |
| Watch row | → the lead record's detail page (risk, else commitment). |
| Pulse item | Scroll to the region on Home, or navigate to the filtered module (table above). |

Watch status (text, never colour alone):

| Condition (existing data) | Status text | Tone |
|---|---|---|
| open high-severity risk with a recommendation | Needs intervention | risk |
| open medium/low risk, or an overdue commitment | Monitor | warn |
| commitment others owe you, open and not overdue | Awaiting response | neutral |

ROOK does not show "On track": the API has no positive-signal field to support that claim.

## 7. Trust model on Home

Every line carries its own label: FACT (source change), INFERENCE (risk/derived), RECOMMENDATION (next step),
UNKNOWN (only from the API — see D-1). Mixed claims are never merged under one label. Evidence counts stay visible.

## 8. Loading, empty and error states

- First paint: header + pulse + judgment card from `/api/brief` (one request). Risk detail and meeting prep load
  afterwards, each region with its own quiet loading line; a failure in one region does not blank the page.
- No critical situation: "ROOK sees no immediate situation requiring your judgment." followed by Today's moves, Watch and
  upcoming meetings.
- Permission: everything comes from permission-filtered responses; a related record the user cannot open is simply
  absent (the existing APIs drop it), and the relationship row is omitted rather than shown empty.

## 9. Accessibility

Landmarks and one `h1`; each region is a `section` with an `h2` (region names used by E2E). Pulse items are links with
full accessible names ("6 items need your attention"). Status and claim type are text. Keyboard order follows reading
order; focus rings visible on dark (gold) and light (deep gold). Chessboard header keeps text ≥ 7:1.

## 10. Acceptance criteria

1. At 1440×900 the first viewport shows the header, pulse, the full judgment card and the start of Next moves / Today's moves.
2. The top situation shows: claim label, headline, severity + confidence, one-line why, ≥1 relationship row,
   evidence count, recommendation with an action — and no paragraph longer than two lines.
3. No record appears in more than one situation; Phoenix appears once as a card.
4. Each Next move shows rank, claim type, reason, situation and an action; drafting still requires explicit approval.
5. Each upcoming meeting shows time, participants, linked decisions/risks counts and what ROOK prepared, with Prepare.
6. Watch shows one text-status row per situation; no red backgrounds.
7. Pulse items navigate or scroll; nothing is discoverable only through them.
8. Empty state as §8. Existing workflows (follow-up approval, evidence, meeting prep) unchanged.
9. WCAG 2.2 AA (axe: no serious/critical); all existing tests green; new unit tests for `situations.ts`
   (grouping, ranking, duplicate suppression, watch status, next moves) and E2E for the new regions.

## 11. Decisions needed from the product owner

- **D-1 — UNKNOWN on Home.** The only UNKNOWN claims live in Ask ROOK, and every Ask call writes an `ask` audit record.
  Calling it automatically on Home would record questions the user never asked.
  *Recommendation:* on the judgment card, a **"Full briefing"** control runs the existing Ask
  ("What changed and what should I do?") only when the user clicks it, and shows its FACT → INFERENCE → RECOMMENDATION →
  UNKNOWN units inline. Alternative: a narrow backend addition of unknowns to `/api/brief` (a backend change, deferred).
- **D-2 — "View situation".** There is no situation route. *Recommendation:* expand in place, with links to existing detail
  pages; no new route.
- **D-3 — Ask bar on Home.** It is not in the new IA. *Recommendation:* keep a slim Ask bar at the end of Home ("Ask ROOK
  anything else"); Ask ROOK remains in the navigation.
- **D-4 — Example values.** The brief's examples (October 18, CFO forecast variance, Engineering Review) differ from today's
  demo data (launch October 21, meetings: Phoenix Product Review, Payments Migration steering). Home will show only real data.
- **C-010** — this IA supersedes the section list in `03_UX_UI_SPEC §4`; all of its content is kept but regrouped. Logged in
  `docs/CONFLICTS.md`; `docs/product/` is not edited.

---
name: rook-ux
description: ROOK enterprise UX/UI skill. Use when designing or building any ROOK screen or component (Home, Ask ROOK, Meetings, Decisions, Commitments, Risks, Sources, Settings), writing UI copy, presenting evidence/confidence, designing empty/loading/error states, navigation, responsiveness, or accessibility.
---

# ROOK Enterprise UX/UI

## Purpose
Make ROOK feel like a calm, highly capable Chief of Staff and an executive command centre, not a
chatbot (03_UX_UI_SPEC §1, §16).

## When to use
Any frontend work, UI copy, or API shape decision driven by a screen.

## Rules
- **Interaction order**: insight first, evidence second, action third, raw source last (UX §17).
  Use progressive disclosure: insight → evidence → context → source → full conversation.
- **Information hierarchy**: attention, then decisions, risks, commitments, meetings, changes,
  evidence, and raw sources (UX §2).
- **Navigation (MVP)**: Home, Ask ROOK, Meetings, Decisions, Commitments, Risks and Sources
  (`frontend/src/components/shell.tsx`). Settings is pending C-007. Hide Projects, People and
  Briefings until their P1 features are implemented (UX §3: "hide future modules").
- **Implementation**: screens live in `frontend/src/app/(workspace)/`; the only API boundary is
  `frontend/src/lib/api.ts`. Trust UI is in `components/trust.tsx` (claim badges are always text),
  `evidence.tsx` (collapsed evidence), `states.tsx` (loading, empty, error, permission-denied), and
  `followup.tsx` (draft → explicit approval). See ADR-0007.
- **Home** sections per UX §4 and MVP P0: Needs Attention, Today, Decisions, Commitments,
  Waiting For, At Risk, Recent Changes. The header shows greeting, date and refresh state.
- **Ask ROOK answers** are structured: direct answer, key points, recommended action, evidence,
  sources, and confidence when useful. No walls of text.
- **Detail pages** (decision, commitment, risk, meeting) contain exactly the fields listed in UX
  §6–9. Risk shows "why ROOK detected it" and has no numeric AI score.
- **Source UX**: type, author, timestamp, permitted excerpt, and "open original" (UX §11).
  Restricted sources are never previewed.
- **States**: every screen has a meaningful empty state, progressive loading states (Connecting
  → Syncing → Analyzing → Preparing → Ready), and errors that say what failed, what the user can
  do, and whether partial results are shown (UX §12–14).
- **Visual**: calm neutral base, strong typography, restrained status colour, dense but
  uncluttered. Desktop first, and responsive for tablet and phone briefing (UX §16, §18).
- **Epistemic clarity**: visibly distinguish fact, inference, recommendation and unknown.
  Inferred items read as suggestions that need confirmation.

## Constraints
- No gamification, celebratory animation, red-alert urgency styling, or chat-only flows (Principle 8).
- No people leaderboards or scores (Vision §6).
- Stack: Next.js + TypeScript + Tailwind (README §35). Read `frontend/AGENTS.md` and the bundled
  Next docs before using framework APIs, because the installed version has breaking changes.

## Accessibility (WCAG 2.2 AA, UX §15)
Semantic landmarks and headings; every control keyboard reachable with a visible focus ring;
labels on all inputs and icon buttons; contrast ≥ 4.5:1; `prefers-reduced-motion` respected;
live regions for async Ask answers.

## Inputs
Stories (rook-product), API contracts (rook-api), the UX spec.

## Outputs
Screens and components, copy, a state matrix per screen, and Playwright checks.

## Quality standards
Axe (or equivalent) shows no serious or critical violations; keyboard-only walkthrough of the
MVP demo passes; each screen has empty, loading and error variants covered in tests.

## Artifact references
03_UX_UI_SPEC (all) · 00_VISION §12 · 01_PRD §8 · 02_MVP_SCOPE Executive Home, Ask ROOK ·
04_PRINCIPLES 3, 6, 8, 9.

## Relationships
Edge skill. Depends on rook-api and rook-product. Coordinates with rook-ai-eval on how
confidence and epistemic labels are displayed.

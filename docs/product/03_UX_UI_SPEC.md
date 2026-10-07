# ROOK — UX/UI Specification

## 1. UX Objective

ROOK should feel like a calm, highly capable executive Chief of Staff—not a generic AI chat application.

The interface should minimize cognitive load.

Primary question:

"What do I need to know or do?"

## 2. Information Hierarchy

1. Attention
2. Decisions
3. Risks
4. Commitments
5. Meetings
6. Changes
7. Evidence
8. Raw source material

## 3. Primary Navigation

- Home
- Ask ROOK
- Meetings
- Decisions
- Commitments
- Risks
- Projects
- People
- Briefings
- Sources
- Settings

For MVP, keep navigation lean and hide future modules until implemented.

## 4. Home

Header:
- Greeting
- Date
- Briefing refresh state

Main sections:
- Needs Your Attention
- Today
- Decisions
- Commitments
- Waiting For
- At Risk
- Recent Changes

Cards should show concise information with status, owner, urgency/importance, and source.

## 5. Ask ROOK

Chat-like interaction, but answers should be structured.

Answer structure:
- Direct answer
- Key points
- Recommended action
- Evidence
- Sources
- Confidence when useful

Avoid walls of text.

## 6. Meeting Detail

Sections:
- Meeting purpose
- Participants
- Previous context
- Open actions
- Related decisions
- Related risks
- Suggested questions
- Meeting outcome
- Extracted decisions
- Extracted commitments
- Sources

## 7. Decision Detail

Show:
- Decision
- Status
- Date
- Decision owner
- Context
- Why
- Participants
- Related actions
- Related risks
- Evidence

## 8. Commitment Detail

Show:
- Commitment
- Owner
- Due date
- Status
- Source
- Confidence
- Related decision/project
- Follow-up options

## 9. Risk Detail

Show:
- Risk statement
- Severity
- Why ROOK detected it
- Evidence
- Related commitments
- Related project
- Suggested next step
- Last updated

Do not show unexplained AI scores.

## 10. Timeline

Chronological events:
- Conversations
- Meetings
- Decisions
- Commitments
- Updates
- Risk changes

## 11. Source UX

Users should be able to inspect the original source for important claims.

Show:
- Source type
- Author
- Timestamp
- Relevant excerpt when permitted
- Open original

## 12. Empty States

Every screen must have a meaningful empty state.

Example:
"No decisions captured yet. ROOK will add decisions when they are detected from your connected sources."

## 13. Loading States

Never leave the user with a blank screen.

Use clear progressive states:
- Connecting
- Syncing
- Analyzing
- Preparing
- Ready

## 14. Error States

Errors should explain:
- What failed.
- Whether user action is required.
- Whether ROOK can continue with partial information.

## 15. Accessibility

Target WCAG 2.2 AA principles:
- Keyboard navigation.
- Semantic structure.
- Accessible labels.
- Sufficient contrast.
- Focus states.
- Screen-reader support.
- Reduced motion support.

## 16. Visual Direction

Recommended visual language:
- Clean enterprise interface.
- Calm neutral base.
- Strong typography.
- Minimal visual noise.
- Restrained use of status indicators.
- Clear hierarchy.
- High information density without clutter.

ROOK should look more like an executive command center than a consumer chatbot.

## 17. Interaction Principle

Insight first.

Evidence second.

Action third.

Raw information last.

## 18. Responsive Design

Desktop-first because executives often use ROOK in professional workflows, but support tablet and mobile layouts for briefing and quick decisions.

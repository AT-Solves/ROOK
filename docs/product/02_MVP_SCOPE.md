# ROOK — MVP Scope

## MVP Goal

Prove one complete ROOK loop:

Communication → Context → Decision → Commitment → Follow-up → Risk → Executive Brief.

The MVP must demonstrate that ROOK can turn fragmented leadership information into useful, evidence-backed action.

## P0 — Must Have

### Identity and Workspace
- Sign in.
- Organization/workspace.
- User profile.
- Basic roles.
- Secure session management.

### Connector Foundation
- Modular connector interface.
- At least one email source.
- At least one calendar source.
- Meeting/conversation ingestion path.
- Permission metadata.

### Executive Home
Display:
- Needs Attention
- Today's Meetings
- Pending Decisions
- Active Commitments
- Waiting For
- Risks
- Recent Changes

### Ask ROOK
Natural-language question interface.

Minimum supported questions:
- What needs my attention?
- What changed?
- What decisions are pending?
- What am I waiting for?
- What commitments are overdue?
- Prepare me for my next meeting.
- What is at risk?

### Meeting Intelligence
- Meeting context.
- Pre-meeting briefing.
- Post-meeting extraction.
- Decisions.
- Commitments.
- Risks.
- Open questions.

### Decision Register
- Decision.
- Date.
- Decision maker/participants when known.
- Context.
- Source.
- Status.
- Related actions.

### Commitment Register
- Commitment.
- Owner.
- Due date when available.
- Source.
- Confidence.
- Status.
- Related decision/project.

### Basic Risk Radar
- Risk.
- Severity.
- Evidence.
- Related project/commitment.
- Recommended next step.

### Evidence
Every significant insight must link to supporting source information.

### Audit
Track important user and system actions.

## P1 — Should Have

- Slack connector.
- Teams connector.
- Document connector.
- Timeline view.
- Stakeholder context.
- Draft follow-up messages.
- Configurable notification preferences.
- Weekly executive brief.

## P2 — Later

- Jira.
- Confluence.
- GitHub.
- SharePoint.
- OneDrive.
- Zoom / Google Meet.
- CRM integrations.
- Advanced organizational graph.
- Autonomous approved actions.
- Enterprise private deployment.
- Self-hosted model support.

## MVP Success Demonstration

A test user connects permitted sources.

ROOK ingests a set of realistic organizational communications.

ROOK generates a daily brief.

The user opens an upcoming meeting.

ROOK provides relevant prior context.

After the meeting, ROOK extracts a decision and explicit commitments.

ROOK tracks the commitments.

A dependency becomes delayed.

ROOK identifies the resulting risk and shows evidence.

The user asks, "What changed and what should I do?"

ROOK answers with a concise, evidence-backed recommendation.

## MVP Rule

Do not add features merely because they sound intelligent. Every feature must strengthen the core leadership loop.

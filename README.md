# ROOK

## Enterprise AI Chief of Staff

### Product Vision, Functional Specification, Architecture & Build Brief

---

# 1. PRODUCT OVERVIEW

ROOK is an enterprise-grade AI Chief of Staff designed to help executives, founders, business leaders, senior managers, and high-impact professionals manage the complexity of modern organizational communication and execution.

ROOK connects the fragmented communication and work systems that leaders use every day—email, meetings, messaging, calendars, documents, project-management systems, collaboration platforms, and business applications.

It transforms these scattered signals into:

* Context
* Decisions
* Commitments
* Actions
* Priorities
* Risks
* Dependencies
* Follow-ups
* Executive insights

ROOK is not primarily a chatbot.

ROOK is an **AI-powered leadership operating layer**.

Its purpose is to help leaders understand:

**What happened?
What changed?
What matters?
What was decided?
Who committed to what?
What is at risk?
What needs my attention?
What should happen next?**

---

# 2. CORE PRODUCT PROMISE

ROOK ensures that important organizational context does not disappear inside communication noise.

The fundamental workflow is:

**Communication → Context → Decision → Commitment → Action → Follow-up → Outcome**

ROOK continuously connects these stages.

For example:

A discussion happens in Teams.

A decision is made during a meeting.

Someone commits to an action.

The commitment appears later in an email.

A dependency is discussed in Slack.

A project update appears in Jira.

The deadline approaches.

ROOK connects these signals and tells the leader:

> "This commitment originated in Monday's leadership meeting, was confirmed in email on Tuesday, is dependent on the platform team's API release, and is currently at risk because the dependency has not been completed."

This continuity is the core value of ROOK.

---

# 3. TARGET USERS

## Primary Persona 1 — CEO / Founder

Needs:

* Strategic visibility
* Organizational awareness
* Decision tracking
* Follow-up
* Risk detection
* Stakeholder management
* Executive briefing

ROOK should answer:

"What do I need to know today?"

---

## Primary Persona 2 — COO

Needs:

* Operational visibility
* Cross-functional dependencies
* Execution tracking
* Accountability
* Risks
* Escalations
* Business rhythm

ROOK should answer:

"Where is execution deviating from plan?"

---

## Primary Persona 3 — Chief of Staff

Needs:

* Meeting preparation
* Executive briefing
* Action tracking
* Decision management
* Stakeholder coordination
* Follow-ups
* Information synthesis

ROOK should answer:

"What does the leader need before, during, and after every important interaction?"

---

## Primary Persona 4 — VP / Business Leader

Needs:

* Team performance
* Strategic priorities
* Cross-functional dependencies
* Decisions
* Escalations
* Communication

---

## Secondary Users

* Directors
* Program leaders
* Product leaders
* Engineering leaders
* Operations leaders
* Enterprise transformation leaders
* PMO
* Strategy teams

---

# 4. THE ROOK DIFFERENTIATOR

Existing AI products generally solve one problem.

Examples:

Meeting AI → summarizes meetings.

Email AI → summarizes emails.

Project AI → tracks projects.

Task manager → tracks tasks.

Chatbot → answers questions.

ROOK connects all of them.

The differentiator is:

## CROSS-CHANNEL CONTEXTUAL CONTINUITY

ROOK should understand that:

Meeting A → Email B → Slack message C → Jira ticket D → Project update E

may all represent different parts of the same organizational event.

ROOK should build a contextual relationship between them.

---

# 5. COMMUNICATION CHANNELS

ROOK should be channel-agnostic.

The initial architecture should support connectors for:

### Communication

* Microsoft Teams
* Outlook
* Gmail
* Slack
* Enterprise messaging
* Internal chat systems

### Meetings

* Microsoft Teams meetings
* Zoom
* Google Meet
* Calendar events
* Meeting transcripts

### Documents

* SharePoint
* OneDrive
* Google Drive
* Confluence
* Notion
* Enterprise document repositories

### Work Management

* Jira
* Azure DevOps
* GitHub
* GitLab
* Linear
* Asana
* Monday.com
* Microsoft Planner

### CRM / Business Systems

Architecture should allow future integrations with:

* Salesforce
* HubSpot
* ServiceNow
* SAP
* Other enterprise systems

Do not hard-code ROOK around Microsoft Teams.

Teams can be an important integration, but ROOK's identity must remain:

**AI Chief of Staff across the enterprise communication and execution ecosystem.**

---

# 6. CORE ROOK CAPABILITIES

## 6.1 Executive Briefing

Generate:

### Morning Brief

* Today's priorities
* Important meetings
* Decisions required
* Pending commitments
* Overdue actions
* Risks
* Important communication
* Significant changes
* Stakeholder issues

Example:

> Good morning.
>
> 3 items require your attention today:
>
> 1. Product launch dependency is at risk.
> 2. Finance approval is still pending.
> 3. The customer escalation from yesterday has not received an owner.
>
> You have 5 meetings today. Two require preparation.

---

# 7. DAILY EXECUTIVE BRIEF

ROOK should provide a personalized daily briefing.

Sections:

### TODAY

Calendar and important meetings.

### PRIORITIES

Top strategic priorities requiring attention.

### DECISIONS

Decisions waiting for the leader.

### COMMITMENTS

Commitments made by the leader or their organization.

### RISKS

Emerging risks.

### FOLLOW-UPS

Items requiring action.

### CHANGES

Important changes since the previous briefing.

### PEOPLE

Stakeholders requiring attention.

---

# 8. MEETING INTELLIGENCE

Before a meeting:

ROOK should provide:

* Meeting purpose
* Participants
* Relevant previous meetings
* Previous decisions
* Open actions
* Relevant emails
* Related documents
* Current project status
* Known risks
* Suggested questions

Example:

> Before your 10 AM Product Review:
>
> Previous decision: Launch moved to October 18.
>
> Open action: Engineering to complete performance testing.
>
> Current status: Testing is 2 days behind schedule.
>
> Suggested question:
> "What is the recovery plan to protect the October 18 launch?"

---

# 9. POST-MEETING INTELLIGENCE

After a meeting ROOK extracts:

### Decisions

What was decided?

### Action Items

Who needs to do what?

### Commitments

Who committed to what?

### Deadlines

When is it expected?

### Risks

What could prevent success?

### Dependencies

What needs to happen first?

### Open Questions

What remains unresolved?

### Stakeholders

Who needs to be informed?

---

# 10. DECISION REGISTER

ROOK should maintain an organizational decision memory.

Each decision should contain:

* Decision ID
* Decision
* Date
* Decision maker
* Participants
* Context
* Reason
* Alternatives considered
* Source
* Related documents
* Related projects
* Related actions
* Current status

Example:

**Decision D-1042**

Decision:
Launch product on October 18.

Decision owner:
VP Product

Reason:
Customer contractual commitment.

Source:
Product Leadership Meeting — October 4.

Related risk:
Performance testing delay.

This prevents organizations from repeatedly revisiting decisions.

---

# 11. COMMITMENT ENGINE

ROOK should detect commitments.

Examples:

"I'll send this by Friday."

"Engineering will complete this tomorrow."

"I'll speak with the customer."

"We'll review this next week."

ROOK converts these into structured commitments.

Fields:

* Person
* Commitment
* Date
* Source
* Confidence
* Status
* Dependency
* Related objective

The system should distinguish between:

### Explicit commitment

"I will complete this Friday."

and

### Inferred action

"Someone probably needs to investigate this."

The second must not automatically become an assigned task without appropriate confidence or approval.

---

# 12. FOLLOW-UP ENGINE

ROOK should automatically monitor commitments.

Example:

> Sarah committed to providing the financial forecast by Thursday.

Thursday:

> Financial forecast has not been detected.

ROOK can surface:

**Follow-up recommended**

and offer:

> Draft reminder

rather than automatically sending it.

The user remains in control.

---

# 13. RISK RADAR

ROOK should identify emerging organizational risks.

Signals may include:

* Repeated delays
* Missed commitments
* Unresolved blockers
* Conflicting statements
* Increasing escalations
* Dependency delays
* Resource constraints
* Repeated meeting discussions without resolution
* Project status deterioration
* Customer dissatisfaction

Example:

> Risk detected:
>
> The Payments migration has been discussed in 4 meetings over 3 weeks without closure.
>
> Current dependency remains unresolved.
>
> Risk level: Medium → High.

ROOK should explain **why** the risk was identified.

No unexplained AI scores.

---

# 14. EXECUTIVE ACTION CENTER

A central view showing:

### Needs Me

Items requiring the leader's action.

### Waiting For

Things waiting on others.

### At Risk

Potential problems.

### Decisions

Decisions required.

### Follow Up

Items requiring communication.

### Delegated

Actions assigned to others.

---

# 15. ROOK MEMORY

ROOK should have organizational memory.

Memory should not simply be a vector database.

It should contain structured entities such as:

* People
* Teams
* Projects
* Objectives
* Decisions
* Commitments
* Meetings
* Documents
* Risks
* Dependencies
* Customers
* Initiatives

Relationships should be maintained between them.

Example:

Person → owns → Commitment

Commitment → supports → Objective

Objective → belongs to → Initiative

Initiative → depends on → Project

Project → has risk → Risk

This creates a **Leadership Context Graph**.

---

# 16. ROOK CONTEXT GRAPH

The Context Graph is one of the most important technical differentiators.

Example:

Customer Escalation
↓
Account
↓
Project
↓
Engineering Team
↓
Open Jira Issues
↓
Previous Meetings
↓
Commitments
↓
Current Risks

ROOK should retrieve the relevant graph context before generating an answer.

This reduces shallow retrieval and improves contextual reasoning.

---

# 17. ASK ROOK

ROOK should have a natural-language interface.

Examples:

"What changed since yesterday?"

"What am I waiting for?"

"What decisions are pending?"

"Which commitments are overdue?"

"Why is the launch at risk?"

"What did we decide about pricing?"

"Who owns this issue?"

"What did the customer say?"

"Show me everything related to Project Phoenix."

"Prepare me for my 2 PM meeting."

"What should I personally focus on today?"

---

# 18. ROOK SHOULD SHOW EVIDENCE

Every important AI conclusion should have provenance.

For example:

> Launch is at risk.

Then:

**Why?**

* Engineering update — Oct 6
* Performance test delay — Oct 5
* Product meeting — Oct 4
* Jira issue PROJ-1842

The user should be able to open the original source.

Principle:

**AI insight without evidence should not be trusted in enterprise environments.**

---

# 19. HUMAN-IN-THE-LOOP

ROOK should distinguish between:

### Observe

ROOK can automatically analyze information.

### Recommend

ROOK suggests an action.

### Prepare

ROOK drafts an action.

### Execute

ROOK performs an action only when authorized.

Examples:

Draft email → safe.

Send email → requires permission/approval depending on policy.

Create task → configurable.

Delete data → highly restricted.

Change business system data → explicit authorization.

---

# 20. COMMUNICATION COPILOT

ROOK can help draft:

* Executive emails
* Follow-ups
* Meeting summaries
* Escalations
* Status updates
* Stakeholder messages
* Leadership communications
* Decision announcements

The tone should adapt to the user.

Possible modes:

* Executive
* Concise
* Diplomatic
* Direct
* Collaborative
* Formal

---

# 21. STAKEHOLDER INTELLIGENCE

ROOK should help leaders understand important relationships.

For each stakeholder:

* Role
* Organization
* Recent interactions
* Open commitments
* Pending requests
* Important topics
* Recent concerns
* Communication history

Example:

> You have not interacted with the CFO in 18 days. The Finance team currently has two open dependencies related to your initiative.

This should be presented as useful context—not surveillance.

---

# 22. PRIORITY ENGINE

ROOK should help distinguish:

### Urgent

Requires immediate attention.

### Important

Strategically significant.

### Waiting

Someone else needs to act.

### Informational

No action required.

### Delegatable

Someone else should own it.

The system should avoid creating artificial urgency.

---

# 23. EXECUTIVE DASHBOARD

Main dashboard:

## Good Morning, [Name]

### Attention Required

3 items

### Decisions

2 pending

### At Risk

3 initiatives

### Waiting For

5 commitments

### Today's Meetings

6

### Strategic Priorities

4

### Recent Changes

7

The interface should be calm, minimal, executive-oriented, and information-dense without being overwhelming.

---

# 24. NAVIGATION

Recommended initial navigation:

**Home**

Executive overview.

**Ask ROOK**

Natural-language intelligence interface.

**Meetings**

Upcoming and historical meetings.

**Decisions**

Decision register.

**Commitments**

Commitment tracking.

**Risks**

Risk radar.

**Projects**

Cross-project context.

**People**

Stakeholder intelligence.

**Briefings**

Daily/weekly executive briefings.

**Sources**

Connected communication and work systems.

**Settings**

Permissions, integrations, preferences, security.

Avoid creating dozens of menu items.

---

# 25. ADMIN CONSOLE

Enterprise administrators need:

### Organization

Company configuration.

### Users

Users and roles.

### Teams

Organizational structure.

### Integrations

Connected systems.

### Permissions

Data access.

### AI Policies

Allowed AI actions.

### Audit Logs

System activity.

### Data Governance

Retention and deletion.

### Usage

AI usage and system metrics.

---

# 26. SECURITY PRINCIPLES

ROOK must be designed enterprise-first.

Requirements:

* OAuth 2.0 / OIDC
* SSO
* RBAC
* Tenant isolation
* Encryption in transit
* Encryption at rest
* Audit logging
* Least-privilege access
* Connector-level permissions
* User-level permissions
* Data retention controls
* Data deletion
* Consent management
* Secure secrets management
* Prompt injection protection
* Tool-use authorization
* Sensitive data controls

ROOK must never bypass permissions.

If a user cannot access a document in the source system, ROOK must not reveal its contents.

---

# 27. MULTI-TENANCY

ROOK should support enterprise SaaS architecture.

Each organization must have isolated:

* Users
* Data
* Connectors
* AI context
* Policies
* Audit logs
* Configuration

No cross-tenant retrieval.

---

# 28. AI ARCHITECTURE

ROOK should use a modular AI architecture.

Do not tightly couple the product to one model provider.

Support model abstraction.

Possible providers:

* OpenAI
* Anthropic
* Google
* Groq
* Local/self-hosted models
* Enterprise models

The architecture should allow model routing.

For example:

Simple classification:

→ smaller/cheaper model.

Complex reasoning:

→ stronger model.

Sensitive enterprise workload:

→ approved enterprise/local model.

---

# 29. RAG ARCHITECTURE

ROOK should use hybrid retrieval.

Combine:

* Semantic search
* Keyword search
* Metadata filtering
* Entity retrieval
* Graph traversal
* Time-based retrieval
* Source authority
* Permission filtering

Do not rely exclusively on vector search.

---

# 30. KNOWLEDGE PIPELINE

Connector

↓

Ingestion

↓

Normalization

↓

Permission mapping

↓

Entity extraction

↓

Relationship extraction

↓

Chunking/indexing

↓

Embedding

↓

Knowledge Graph

↓

Hybrid Retrieval

↓

Context Assembly

↓

LLM Reasoning

↓

Evidence Validation

↓

Response / Recommendation

---

# 31. SOURCE AUTHORITY

Not every source should have equal authority.

Example:

Official project status > casual Slack message.

Approved decision record > speculative conversation.

ROOK should consider:

* Source type
* Author
* Timestamp
* Official status
* Confidence
* Recency

---

# 32. AI AGENT ARCHITECTURE

Use specialized agents/services rather than one giant agent.

Potential components:

### Context Agent

Builds relevant context.

### Meeting Agent

Processes meetings.

### Decision Agent

Detects decisions.

### Commitment Agent

Detects commitments.

### Risk Agent

Identifies risks.

### Briefing Agent

Creates executive briefings.

### Follow-up Agent

Identifies required follow-ups.

### Communication Agent

Drafts messages.

### Research Agent

Investigates organizational questions.

### Reflection / Validation Agent

Checks AI reasoning against available evidence.

---

# 33. AGENT SAFETY

Agents must operate under explicit permissions.

Every action should have:

* Actor
* Intent
* Tool
* Input
* Authorization
* Result
* Audit record

No hidden autonomous actions.

---

# 34. ROOK EVENT MODEL

The architecture should be event-driven.

Example events:

MEETING_COMPLETED

EMAIL_RECEIVED

MESSAGE_RECEIVED

DOCUMENT_UPDATED

TASK_CREATED

TASK_COMPLETED

DECISION_DETECTED

COMMITMENT_CREATED

COMMITMENT_OVERDUE

RISK_DETECTED

PROJECT_STATUS_CHANGED

These events can trigger appropriate processing.

---

# 35. RECOMMENDED TECHNICAL ARCHITECTURE

Build ROOK as a modern modular web application.

Suggested stack:

### Frontend

React / Next.js

TypeScript

Tailwind CSS

Accessible component system

### Backend

Python + FastAPI

or

TypeScript + Node.js

### Database

PostgreSQL

### Vector Search

pgvector initially.

Avoid unnecessary infrastructure in MVP.

### Graph

Start with PostgreSQL relational relationships.

Introduce a dedicated graph database only when justified by scale.

### Queue

Redis / Celery or equivalent.

### Object Storage

S3-compatible storage.

### Authentication

OIDC / OAuth2.

### Observability

OpenTelemetry.

### Deployment

Docker.

Kubernetes should be optional for enterprise deployment, not mandatory for MVP.

---

# 36. OPEN-SOURCE FIRST

The product should prefer open-source technologies where practical.

Recommended philosophy:

Open-source infrastructure first.

Commercial AI APIs should be abstracted behind interfaces.

ROOK should eventually support self-hosted AI models for organizations requiring:

* Data sovereignty
* Private deployment
* Cost control
* Regulatory compliance

Potential local model support:

Ollama

vLLM

other compatible inference servers.

---

# 37. INITIAL INTEGRATIONS

Do not attempt to build every integration in V1.

Recommended sequence:

### Phase 1

* Microsoft Outlook
* Microsoft Teams
* Microsoft Calendar
* Slack
* Google Gmail
* Google Calendar

### Phase 2

* Jira
* Confluence
* GitHub
* SharePoint
* OneDrive

### Phase 3

* Zoom
* Google Meet
* Asana
* Linear
* Salesforce
* ServiceNow

Architecture must allow connectors to be added independently.

---

# 38. MVP

The MVP should NOT attempt to build the entire Chief of Staff vision.

Build the smallest product that proves the core thesis:

> ROOK can connect communication signals and turn them into actionable executive intelligence.

### MVP capabilities

1. User authentication
2. Organization/workspace
3. Connector framework
4. Email integration
5. Calendar integration
6. Meeting ingestion
7. Conversation ingestion
8. AI summarization
9. Decision extraction
10. Commitment extraction
11. Action tracking
12. Daily executive brief
13. Ask ROOK
14. Evidence/source citations
15. Basic risk detection
16. Human approval for actions
17. Audit log

---

# 39. MVP USER JOURNEY

User signs in.

↓

Connects communication sources.

↓

ROOK synchronizes permitted information.

↓

ROOK builds initial context.

↓

User sees:

**Good Morning**

↓

ROOK identifies:

* Today's meetings
* Important messages
* Decisions
* Commitments
* Risks
* Follow-ups

↓

User asks:

"What needs my attention?"

↓

ROOK answers with evidence.

↓

User asks:

"Prepare me for my 2 PM meeting."

↓

ROOK generates a contextual briefing.

↓

After meeting:

ROOK extracts decisions and commitments.

↓

ROOK tracks them.

↓

Next day:

ROOK reports what changed.

This demonstrates the complete ROOK loop.

---

# 40. SUCCESS METRICS

Measure product value rather than AI activity.

### Primary metrics

Executive time saved.

Decision follow-through rate.

Commitment completion rate.

Missed commitment reduction.

Time required to prepare for meetings.

Time required to prepare executive updates.

Number of important issues surfaced before escalation.

User trust in ROOK insights.

---

# 41. NORTH STAR METRIC

A possible North Star metric:

## "Important organizational signals successfully converted into timely executive action."

This can combine:

* Detected decisions
* Detected commitments
* Resolved actions
* Prevented missed follow-ups
* Identified risks

Avoid using "number of AI messages" as the primary success metric.

---

# 42. TRUST MODEL

ROOK should communicate confidence.

For example:

**High confidence**

Explicitly stated in an official source.

**Medium confidence**

Supported by multiple signals.

**Low confidence**

Inferred from indirect evidence.

Example:

> Possible risk detected — Medium confidence.

This prevents ROOK from presenting speculation as fact.

---

# 43. EXPLAINABILITY

Every important insight should answer:

### What?

What did ROOK identify?

### Why?

Why does ROOK believe it?

### Source?

Where did the information come from?

### When?

When did it happen?

### What next?

What action is recommended?

This should be part of the UX.

---

# 44. PRIVACY

ROOK should not become an employee-surveillance product.

The product should emphasize:

* User-controlled access
* Explicit organizational policies
* Data minimization
* Purpose limitation
* Transparent AI behavior
* Auditability
* Appropriate aggregation
* No hidden employee scoring

ROOK's purpose is leadership effectiveness and organizational execution—not employee surveillance.

---

# 45. PRODUCT PERSONALITY

ROOK should feel:

* Intelligent
* Calm
* Precise
* Executive
* Trustworthy
* Proactive
* Discreet
* Non-intrusive

It should not feel:

* Playful
* Noisy
* Overly conversational
* Gamified
* Like a generic AI chatbot

ROOK should communicate like an excellent human Chief of Staff.

---

# 46. UX PRINCIPLE

The interface should answer:

**"What do I need to know or do?"**

before showing:

**"Here is everything we know."**

Progressive disclosure should be used.

Start with the insight.

Allow the user to expand into:

Evidence → Context → Source → Full conversation.

---

# 47. ROOK HOME SCREEN

Suggested structure:

---

GOOD MORNING, YAMINI

Tuesday, October 7

### NEEDS YOUR ATTENTION

3 items

[Decision required]

[Follow-up overdue]

[Risk detected]

### TODAY

6 meetings

2 require preparation

### YOUR COMMITMENTS

4 active

1 due today

### WAITING FOR

5 items

### AT RISK

2 initiatives

### RECENT CHANGES

7 meaningful changes

---

---

# 48. ASK ROOK UX

Chat should not be the only interface.

Users can ask:

"What happened with Project Phoenix?"

ROOK should respond with:

Summary

↓

Timeline

↓

Decisions

↓

Commitments

↓

Risks

↓

Sources

The user can then ask:

"What do I need to do?"

ROOK continues from the existing context.

---

# 49. TIMELINE VIEW

ROOK should provide a chronological view of important organizational events.

Example:

Oct 1
Customer raised concern.

Oct 2
Engineering investigated.

Oct 3
Leadership discussed issue.

Oct 4
Decision made.

Oct 5
Action assigned.

Oct 6
Dependency delayed.

Oct 7
ROOK detects risk.

This is extremely valuable for executive context.

---

# 50. ORGANIZATIONAL MEMORY

Users should be able to ask:

"What did we decide six months ago?"

"Why did we choose this vendor?"

"When did this issue first appear?"

"Who originally raised this concern?"

ROOK should reconstruct the answer using evidence.

---

# 51. ROOK SHOULD NOT HALLUCINATE

If evidence does not exist:

ROOK should say:

> "I couldn't find enough evidence to answer this confidently."

Never fabricate:

* Decisions
* Commitments
* People
* Dates
* Reasons
* Organizational facts

---

# 52. ENTERPRISE DEPLOYMENT MODELS

Support:

### SaaS

Multi-tenant cloud.

### Enterprise Private Cloud

Dedicated environment.

### Self-hosted

For highly regulated customers.

Architecture should avoid making any of these impossible.

---

# 53. ENTERPRISE ADMIN CONTROLS

Administrators should be able to configure:

* Allowed connectors
* AI providers
* Data retention
* User permissions
* Action permissions
* External communication rules
* Audit retention
* Model policies
* Sensitive data policies
* Connector synchronization frequency

---

# 54. BILLING MODEL

Potential SaaS pricing:

### Individual

For executives and professionals.

### Team

For leadership teams.

### Business

For organizations.

### Enterprise

Custom pricing.

Possible pricing metric:

Per active executive/user per month.

Enterprise pricing may additionally consider:

* Number of users
* Connectors
* Data volume
* Private deployment
* AI usage
* Compliance requirements

---

# 55. COMPETITIVE POSITIONING

ROOK should not compete directly as:

"another meeting assistant."

Instead position against the broader problem:

### Fragmented leadership context.

The category:

**AI Chief of Staff**

The product category expansion:

**AI Leadership Operating System**

Core differentiation:

**Cross-channel organizational context + decision intelligence + commitment intelligence + proactive follow-through.**

---

# 56. BRAND

Name:

**ROOK**

Possible interpretation:

A rook is a strategic chess piece.

The brand can represent:

* Strategic positioning
* Protection
* Structure
* Long-range awareness
* Supporting the king/leader
* Coordinated movement

ROOK should feel strategic rather than robotic.

---

# 57. TAGLINE OPTIONS

Primary:

**ROOK — Your AI Chief of Staff**

Alternative:

**From Conversation to Execution.**

**Know What Matters. Act on What Matters.**

**The Intelligence Layer for Leadership.**

**Your Organization's Context, Connected.**

**Never Lose the Thread.**

Recommended positioning:

> **ROOK — Your AI Chief of Staff**
>
> **Connect every conversation, decision, commitment, and action.**

---

# 58. DEVELOPMENT PRINCIPLES

Claude Cowork should follow these principles while building ROOK:

1. Build production-quality code, not a throwaway prototype.
2. Use modular architecture.
3. Keep integrations independently replaceable.
4. Separate AI logic from business logic.
5. Separate retrieval from generation.
6. Enforce permissions before retrieval.
7. Maintain source provenance.
8. Log important system actions.
9. Make AI decisions explainable.
10. Never perform sensitive actions without authorization.
11. Build accessibility into the UI.
12. Use responsive design.
13. Write automated tests.
14. Use typed interfaces.
15. Use environment variables for secrets.
16. Never hard-code API keys.
17. Provide clear error states.
18. Design for multi-tenancy from the beginning.
19. Keep the MVP small.
20. Do not build speculative features before validating the core workflow.

---

# 59. FIRST DEVELOPMENT MILESTONE

The first milestone should be:

## ROOK Executive Intelligence MVP

Build:

Authentication

*

Workspace

*

Dashboard

*

Ask ROOK

*

Calendar

*

Email

*

Meeting intelligence

*

Decision extraction

*

Commitment extraction

*

Daily briefing

*

Evidence/provenance

*

Basic risk detection

*

Audit logging

The first demo should allow a user to connect their communication sources and experience:

**Morning Brief → Meeting Preparation → Meeting Intelligence → Decision → Commitment → Follow-up → Risk Detection**

That single loop should demonstrate the core value of ROOK.

---

# 60. FINAL PRODUCT DEFINITION

ROOK is an AI Chief of Staff that sits above an organization's communication and execution systems.

It does not replace Teams, Slack, email, Jira, calendars, documents, or project-management platforms.

It connects them.

ROOK continuously converts organizational communication into structured understanding and then turns that understanding into executive action.

The ultimate objective is:

**A leader should never have to search across five systems to understand what happened, what matters, what was decided, who owns it, what is at risk, and what they need to do next.**

ROOK should bring that answer to them.

## ROOK

**See the context.
Know what matters.
Act at the right time.**

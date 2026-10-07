"""A realistic, self-consistent week of leadership communication for the demo tenant.

All timestamps are relative to *now* so the demo always looks current. The scenario is the one
described in the README: a launch decision, a commitment confirmed by email, a dependency slipping
in Slack, a Jira blocker, an overdue forecast, a payments topic discussed for weeks without closure,
and an unowned customer escalation.
"""

from __future__ import annotations

from datetime import datetime, time, timedelta

from .base import DirectoryPerson, DirectoryProject, NormalizedMeeting, NormalizedSignal, SyncBatch

DOMAIN = "acme.example"
LEADER_EMAIL = f"yamini@{DOMAIN}"


def _e(local: str) -> str:
    return f"{local}@{DOMAIN}"


def _fmt(d: datetime) -> str:
    return f"{d:%B} {d.day}"


def build(now: datetime) -> SyncBatch:
    today = datetime.combine(now.date(), time())

    def ago(days: int, hour: int = 9, minute: int = 0) -> datetime:
        return today - timedelta(days=days) + timedelta(hours=hour, minutes=minute)

    def ahead(days: int, hour: int = 9, minute: int = 0) -> datetime:
        return today + timedelta(days=days) + timedelta(hours=hour, minutes=minute)

    # Today's agenda is anchored to the next full hour so the demo always has meetings ahead.
    next_hour = now.replace(minute=0, second=0, microsecond=0) + timedelta(hours=1)

    def slot(hours: float, length_min: int = 60) -> tuple[datetime, datetime]:
        start = next_hour + timedelta(hours=hours)
        return start, start + timedelta(minutes=length_min)

    launch_date = today + timedelta(days=11)
    perf_due = today + timedelta(days=1)
    recon_due = today - timedelta(days=3)
    forecast_due_weekday = f"{today - timedelta(days=1):%A}"  # said 4 days ago -> due yesterday

    people = [
        DirectoryPerson("Yamini Devasena", LEADER_EMAIL, "Chief Executive Officer", "Executive"),
        DirectoryPerson("Priya Shah", _e("priya"), "VP Product", "Product"),
        DirectoryPerson("Marcus Chen", _e("marcus"), "VP Engineering", "Engineering"),
        DirectoryPerson("Sarah Okafor", _e("sarah"), "Finance Director", "Finance"),
        DirectoryPerson("David Kim", _e("david"), "Chief Financial Officer", "Finance"),
        DirectoryPerson("Elena Rossi", _e("elena"), "Head of Customer Success", "Customer Success"),
        DirectoryPerson("Tom Becker", _e("tom"), "Platform Team Lead", "Platform"),
        DirectoryPerson("Lena Park", _e("lena"), "Payments Lead", "Payments"),
    ]
    projects = [
        DirectoryProject(
            "Project Phoenix",
            ["phoenix"],
            "Priya Shah",
            "Next-generation analytics product launch, contractually committed to Northwind.",
        ),
        DirectoryProject(
            "Payments Migration",
            ["payments migration", "payments cutover", "ledger"],
            "Lena Park",
            "Move billing from the legacy processor to the new payments platform.",
        ),
        DirectoryProject(
            "Q4 Financial Plan",
            ["financial forecast", "q4 plan", "q4 budget"],
            "David Kim",
            "Q4 forecast and budget approval.",
        ),
        DirectoryProject(
            "Northwind Account",
            ["northwind"],
            "Elena Rossi",
            "Largest enterprise customer; anchor customer for Phoenix.",
        ),
    ]

    leadership = [LEADER_EMAIL, _e("priya"), _e("marcus"), _e("sarah"), _e("elena")]
    payments_team = [LEADER_EMAIL, _e("lena"), _e("tom"), _e("marcus")]

    meetings = [
        # past meetings (transcripts below)
        NormalizedMeeting("mtg-pay-1", "Payments Migration sync", ago(21, 15), ago(21, 16), payments_team, _e("lena")),
        NormalizedMeeting("mtg-pay-2", "Payments Migration sync", ago(14, 15), ago(14, 16), payments_team, _e("lena")),
        NormalizedMeeting("mtg-pay-3", "Payments Migration sync", ago(10, 15), ago(10, 16), payments_team, _e("lena")),
        NormalizedMeeting("mtg-pay-4", "Payments Migration sync", ago(6, 15), ago(6, 16), payments_team, _e("lena")),
        NormalizedMeeting(
            "mtg-lead-1", "Product Leadership Meeting", ago(4, 10), ago(4, 11), leadership, _e("priya"),
            "Weekly product leadership: Phoenix launch readiness and pricing.",
        ),
        # today and upcoming
        NormalizedMeeting("mtg-staff", "Executive staff stand-up", *slot(-2, 30), leadership, LEADER_EMAIL,
                          "Weekly staff alignment."),
        NormalizedMeeting(
            "mtg-review", "Phoenix Product Review", *slot(0), [LEADER_EMAIL, _e("priya"), _e("marcus"), _e("tom")],
            _e("priya"), "Review Phoenix launch readiness and performance test results.",
        ),
        NormalizedMeeting(
            "mtg-pay-steer", "Payments Migration steering", *slot(3), payments_team, _e("lena"),
            "Agree cutover approach for the payments migration.",
        ),
        NormalizedMeeting("mtg-cfo", "1:1 with David (CFO)", *slot(5.5, 30), [LEADER_EMAIL, _e("david")], LEADER_EMAIL),
        NormalizedMeeting(
            "mtg-nw-qbr", "Northwind quarterly business review", ahead(1, 11), ahead(1, 12),
            [LEADER_EMAIL, _e("elena"), _e("priya")], _e("elena"), "Quarterly review with Northwind leadership.",
        ),
    ]

    s: list[NormalizedSignal] = []
    add = s.append

    # --- Payments: discussed repeatedly, never closed --------------------------------------
    add(NormalizedSignal(
        "tr-pay-1", "meeting_transcript", "Google Meet", "Payments Migration sync — transcript",
        "Lena Park: The payments migration cutover approach is still open. We are weighing big-bang versus phased.\n"
        "Tom Becker: The ledger reconciliation dependency needs to be understood before we choose.\n"
        "Marcus Chen: Let's come back to this next time.",
        "Lena Park", _e("lena"), ago(21, 16), payments_team, authority=0.7, meeting_external_id="mtg-pay-1",
    ))
    add(NormalizedSignal(
        "tr-pay-2", "meeting_transcript", "Google Meet", "Payments Migration sync — transcript",
        "Lena Park: We discussed the payments migration cutover again without agreement.\n"
        "Tom Becker: Ledger reconciliation is still unresolved on our side.",
        "Lena Park", _e("lena"), ago(14, 16), payments_team, authority=0.7, meeting_external_id="mtg-pay-2",
    ))
    add(NormalizedSignal(
        "tr-pay-3", "meeting_transcript", "Google Meet", "Payments Migration sync — transcript",
        "Lena Park: Payments migration: still no agreement on cutover; reconciliation numbers do not match.\n"
        f"Lena Park: I'll send the ledger reconciliation report by {_fmt(recon_due)}.\n"
        "Marcus Chen: Someone probably needs to check the legacy processor contract end date.",
        "Lena Park", _e("lena"), ago(10, 16), payments_team, authority=0.7, meeting_external_id="mtg-pay-3",
    ))
    add(NormalizedSignal(
        "tr-pay-4", "meeting_transcript", "Google Meet", "Payments Migration sync — transcript",
        "Lena Park: The payments migration cutover is still unresolved. Phased looks safer but costs six weeks.\n"
        "Tom Becker: The ledger dependency remains blocked on the reconciliation report.",
        "Lena Park", _e("lena"), ago(6, 16), payments_team, authority=0.7, meeting_external_id="mtg-pay-4",
    ))
    add(NormalizedSignal(
        "sl-pay-done", "message", "Slack #payments", "Message in #payments",
        "I sent the ledger reconciliation report to the team, as promised. Numbers now match within 0.2%.",
        "Lena Park", _e("lena"), ago(2, 11), payments_team, authority=0.4,
    ))

    # --- Phoenix: the README's continuity example ----------------------------------------------
    add(NormalizedSignal(
        "tr-lead-1", "meeting_transcript", "Microsoft Teams", "Product Leadership Meeting — transcript",
        f"Priya Shah: We decided to launch Project Phoenix on {_fmt(launch_date)}. Reason: customer contractual commitment with Northwind.\n"
        f"Marcus Chen: Engineering will complete Phoenix performance testing by {_fmt(perf_due)}.\n"
        f"Sarah Okafor: I'll send the updated financial forecast by {forecast_due_weekday}.\n"
        f"Yamini Devasena: I'll speak with the Northwind executive sponsor about the launch plan by {_fmt(today + timedelta(days=2))}.\n"
        "Priya Shah: We need Yamini to approve the Phoenix enterprise pricing tiers before launch.\n"
        "Marcus Chen: Someone probably needs to investigate the Phoenix API rate limits.",
        "Priya Shah", _e("priya"), ago(4, 11), leadership, authority=0.8, meeting_external_id="mtg-lead-1",
    ))
    add(NormalizedSignal(
        "em-perf-confirm", "email", "Outlook", "Re: Phoenix performance testing",
        f"Confirming from the leadership meeting: Engineering will complete Phoenix performance testing by {_fmt(perf_due)}. "
        "Note that this depends on the platform team's API release.",
        "Marcus Chen", _e("marcus"), ago(3, 17), [LEADER_EMAIL, _e("marcus"), _e("priya")], authority=0.7,
    ))
    add(NormalizedSignal(
        "sl-api-delay", "message", "Slack #platform", "Message in #platform",
        "Heads up: the API release for Phoenix is delayed. It is slipping by about a week; we are blocked on the security review.",
        "Tom Becker", _e("tom"), ago(1, 15), [_e("tom"), _e("marcus"), LEADER_EMAIL], authority=0.4,
    ))
    add(NormalizedSignal(
        "jira-1842", "task_update", "Jira", "PROJ-1842 · Phoenix performance test environment",
        "Status changed In Progress → Blocked. Phoenix performance testing is 2 days behind schedule; "
        "load environment waiting on API release.",
        "Jira", "", ago(1, 18), [], authority=0.9, url="https://jira.acme.example/browse/PROJ-1842",
    ))
    add(NormalizedSignal(
        "em-pricing", "email", "Gmail", "Phoenix pricing — decision needed",
        "Yamini, a decision is needed on the Phoenix enterprise pricing tiers before Thursday so sales collateral can ship. "
        "Option A keeps three tiers; option B adds a usage-based tier.",
        "Priya Shah", _e("priya"), ago(0, 7, 40), [LEADER_EMAIL, _e("priya")], authority=0.6,
    ))

    # --- Northwind escalation with no owner ------------------------------------------------------
    add(NormalizedSignal(
        "em-nw-escalation", "email", "Gmail", "Customer escalation: Northwind data sync failures",
        "Northwind reports intermittent data sync failures in production since yesterday morning. This is a customer escalation "
        "and it has no owner yet. Their CTO asked for a call before the QBR.",
        "Elena Rossi", _e("elena"), ago(1, 9, 30), [LEADER_EMAIL, _e("elena"), _e("marcus")], authority=0.6,
    ))

    # --- Finance / CFO context -----------------------------------------------------------------
    add(NormalizedSignal(
        "em-cfo-q4", "email", "Outlook", "Q4 budget — two open dependencies",
        "Finance has two open dependencies on your initiatives for the Q4 budget: Phoenix launch costs and payments migration timing.",
        "David Kim", _e("david"), ago(18, 10), [LEADER_EMAIL, _e("david")], authority=0.6,
    ))
    add(NormalizedSignal(
        "em-comp", "email", "Outlook", "Confidential: executive compensation review",
        "Sarah, draft compensation adjustments for the executive team are attached for your review only.",
        # Restricted to its participants in the source system: even the CEO must not see it via ROOK.
        "David Kim", _e("david"), ago(2, 13), [_e("david"), _e("sarah")], visibility="restricted", authority=0.6,
    ))

    # Mirror source-system ACLs: mail and meeting transcripts are visible only to their participants;
    # public Slack channels and Jira are org-wide.
    for sig in s:
        if sig.kind in {"email", "meeting_transcript"}:
            sig.visibility = "restricted"
    return SyncBatch(signals=s, meetings=meetings, people=people, projects=projects)

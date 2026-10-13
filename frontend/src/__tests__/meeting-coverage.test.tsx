import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { MeetingDetail } from "@/app/(workspace)/meetings/[id]/meeting-detail";
import type { ContextCoverage, MeetingIntel, MeetingPrep } from "@/lib/types";

import demo from "./brief.fixture.json";

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn(), push: vi.fn() }) }));
const api = vi.hoisted(() => ({ meetingPrep: vi.fn(), meetingIntel: vi.fn() }));
vi.mock("@/lib/api", async (orig) => ({ ...(await orig<typeof import("@/lib/api")>()), api }));

const SOON = new Date(Date.now() + 86_400_000).toISOString();
const LATER = new Date(Date.now() + 90_000_000).toISOString();

function coverage(linked: boolean, over: Partial<ContextCoverage> = {}): ContextCoverage {
  const items = (n: number) => ({ evaluated: linked, count: n });
  return {
    state: linked ? "limited" : "insufficient",
    label: linked ? "Limited context" : "Insufficient context",
    summary: linked
      ? "This meeting is linked to Atlas, but ROOK has found nothing linked to it yet."
      : "ROOK has only the meeting details and participants: this meeting is not linked to a ROOK project and nothing else is linked to it yet.",
    project: { linked, name: linked ? "Atlas" : null },
    items: { decisions: items(0), risks: items(0), sources: items(0), commitments: { evaluated: true, count: 0 }, previous_meetings: { evaluated: true, count: 0 } },
    reasons: linked
      ? [
          { text: "Meeting details and 2 participants are available.", claim_type: "FACT", kind: "found" },
          { text: "Linked to the ROOK project Atlas.", claim_type: "FACT", kind: "found" },
          { text: "Checked Atlas: 0 decisions, 0 open risks and 0 recent related messages you can access.", claim_type: "FACT", kind: "found" },
        ]
      : [
          { text: "Meeting details and 2 participants are available.", claim_type: "FACT", kind: "found" },
          { text: "This meeting is not linked to a ROOK project.", claim_type: "FACT", kind: "found" },
          { text: "Project-level decisions, risks and related correspondence cannot be evaluated until the meeting is linked to a project.", claim_type: "UNKNOWN", kind: "unknown" },
          { text: "A ROOK administrator can define a project with the names this meeting uses as its aliases; the meeting is then linked at the next sync.", claim_type: "RECOMMENDATION", kind: "next" },
        ],
    ...over,
  };
}

function prep(c: ContextCoverage, over: Partial<MeetingPrep> = {}): MeetingPrep {
  return {
    meeting: { id: 5, title: "Release #12 - Preparations", starts_at: SOON, ends_at: LATER, purpose: "Agenda", attendees: ["a@x.example", "b@x.example"], organizer: "a@x.example", project: c.project.name ?? undefined } as MeetingPrep["meeting"],
    participants: [{ email: "a@x.example", name: "Ana", title: "" }, { email: "b@x.example", name: "Ben", title: "" }],
    prep_reasons: [], previous_meetings: [], decisions: [], open_commitments: [], risks: [], related_signals: [], suggested_questions: [],
    context_coverage: c,
    ...over,
  };
}

const INTEL = { meeting: {}, has_transcript: false, decisions: [], commitments: [], open_questions: [], inform: [], deadlines: [] } as unknown as MeetingIntel;

function region(name: RegExp) {
  return screen.getByRole("region", { name });
}

describe("Meeting Detail context coverage", () => {
  beforeEach(() => {
    api.meetingPrep.mockReset();
    api.meetingIntel.mockReset().mockResolvedValue(INTEL);
  });

  it("explains a meeting with no project as insufficient context, with FACT, UNKNOWN and RECOMMENDATION labels", async () => {
    api.meetingPrep.mockResolvedValue(prep(coverage(false)));
    render(<MeetingDetail id={5} />);
    const cov = await screen.findByRole("region", { name: /Context coverage/ });
    expect(within(cov).getByText("Insufficient context")).toBeInTheDocument();
    const items = within(cov).getByRole("list", { name: "What ROOK knows about this meeting" });
    const typeOf = (text: string) => within(items).getByText(text).closest("li")?.getAttribute("data-claim-type");
    expect(typeOf("This meeting is not linked to a ROOK project.")).toBe("FACT");
    expect(typeOf("Project-level decisions, risks and related correspondence cannot be evaluated until the meeting is linked to a project.")).toBe("UNKNOWN");
    expect(typeOf("A ROOK administrator can define a project with the names this meeting uses as its aliases; the meeting is then linked at the next sync.")).toBe("RECOMMENDATION");
  });

  it("does not claim there are no risks, decisions or sources when no project was evaluated", async () => {
    api.meetingPrep.mockResolvedValue(prep(coverage(false)));
    render(<MeetingDetail id={5} />);
    await screen.findByRole("region", { name: /Context coverage/ });
    expect(within(region(/Related risks/)).getByText("ROOK cannot evaluate project-level risks for this meeting yet because no project is linked.")).toBeInTheDocument();
    expect(within(region(/Related decisions/)).getByText("ROOK cannot evaluate project-level decisions for this meeting yet because no project is linked.")).toBeInTheDocument();
    expect(within(region(/^Sources/)).getByText("No related project correspondence is available because this meeting is not linked to a project.")).toBeInTheDocument();
    expect(within(region(/Suggested questions/)).getByText(/this meeting is not linked to a project yet/)).toBeInTheDocument();
    expect(screen.queryByText("No open risks are linked to this meeting.")).toBeNull();
    expect(screen.queryByText("No decisions are linked to this meeting.")).toBeNull();
  });

  it("states legitimate zeroes when the project was evaluated", async () => {
    api.meetingPrep.mockResolvedValue(prep(coverage(true)));
    render(<MeetingDetail id={5} />);
    expect(await screen.findByText("Limited context")).toBeInTheDocument();
    expect(within(region(/Related risks/)).getByText("No open risks are linked to this meeting.")).toBeInTheDocument();
    expect(within(region(/Related decisions/)).getByText("No decisions are linked to this meeting.")).toBeInTheDocument();
    expect(within(region(/^Sources/)).getByText("No related sources you can access.")).toBeInTheDocument();
    expect(screen.queryByText(/cannot evaluate/)).toBeNull();
    expect(screen.queryByText(/define a project/)).toBeNull();
  });

  it("keeps showing linked risks, decisions and suggested questions", async () => {
    const c = coverage(true, { state: "sufficient", label: "Sufficient context", summary: "ROOK prepared this meeting from what is linked to Atlas." });
    api.meetingPrep.mockResolvedValue(prep(c, {
      risks: [demo.risks[0]] as unknown as MeetingPrep["risks"],
      decisions: [demo.decisions_pending[0]] as unknown as MeetingPrep["decisions"],
      suggested_questions: [{ text: "What is the recovery plan?", claim_type: "RECOMMENDATION", confidence: "medium", evidence: [], basis: "Suggested from open risks.", detail: "", meta: "" }],
    }));
    render(<MeetingDetail id={5} />);
    expect(await screen.findByText("Sufficient context")).toBeInTheDocument();
    expect(within(region(/Related risks/)).getByText(demo.risks[0].title)).toBeInTheDocument();
    expect(within(region(/Related decisions/)).getByText(new RegExp(demo.decisions_pending[0].statement))).toBeInTheDocument();
    expect(within(region(/Suggested questions/)).getByText("What is the recovery plan?")).toBeInTheDocument();
  });
});

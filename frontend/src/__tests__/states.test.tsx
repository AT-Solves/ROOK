import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { EvidenceList } from "@/components/evidence";
import { Empty, ErrorState, Loading } from "@/components/states";
import { ApiError } from "@/lib/api";

import { ev } from "./fixtures";

describe("states (UX §12–14)", () => {
  it("loading uses a progressive stage and a live region", () => {
    render(<Loading stage="Syncing" />);
    expect(screen.getByRole("status")).toHaveTextContent("Syncing…");
  });

  it("empty states explain what will appear", () => {
    render(<Empty title="No decisions captured yet.">ROOK will add decisions when they are detected.</Empty>);
    expect(screen.getByText("No decisions captured yet.")).toBeInTheDocument();
  });

  it("errors explain what failed, whether action is needed, and partial data", () => {
    render(<ErrorState error={new ApiError("conflict", "Microsoft 365 needs reconnecting.", 409, true, "Previously synced information remains available.")} what="your sources" />);
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Couldn't load your sources");
    expect(alert).toHaveTextContent("Action needed from you");
    expect(alert).toHaveTextContent("Previously synced information remains available.");
  });

  it("forbidden shows a permission-denied state without content", () => {
    render(<ErrorState error={new ApiError("forbidden", "x", 403)} what="this source" />);
    expect(screen.getByRole("alert")).toHaveTextContent("You don't have access to this source.");
  });

  it("not found doesn't reveal whether a restricted item exists", () => {
    render(<ErrorState error={new ApiError("not_found", "x", 404)} what="this decision" />);
    expect(screen.getByRole("alert")).toHaveTextContent("This decision isn't available.");
  });
});

describe("evidence (UX §11, §17)", () => {
  it("is collapsed by default and links each source to the evidence view", () => {
    render(<EvidenceList evidence={[ev(4), ev(5, { note: "confirmed in another channel" })]} />);
    expect(screen.getByText("Evidence · 2 sources")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Source 4", hidden: true })).toHaveAttribute("href", "/evidence/4");
    expect(document.querySelector("details")).not.toHaveAttribute("open");
  });

  it("says when no accessible source supports a claim", () => {
    render(<EvidenceList evidence={[]} />);
    expect(screen.getByText("No source you can access supports this.")).toBeInTheDocument();
  });
});

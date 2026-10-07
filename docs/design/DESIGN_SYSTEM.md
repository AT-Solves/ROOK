# ROOK Design System — "Context for Higher Judgment"

Visual source of truth: the ROOK chess-themed design reference supplied by the product owner (2026-10-07).
The system is a **presentation layer only**: no API, data, trust, permission or workflow behaviour depends on it (ADR-0008).
Owner skill: `rook-ux`.

## Brand
| Element | Implementation |
|---|---|
| Name / positioning / tagline | ROOK · *Your AI Chief of Staff* · *Context for Higher Judgment* |
| Primary symbol | Geometric vector rook: crenellated crown, collar, tapered body, base ring, plinth (`components/brand.tsx::RookMark`). Never a Unicode chess glyph. |
| Primary logo (dark) | Gold-gradient rook + gold Cinzel "ROOK" wordmark (`<Logo surface="dark">`) |
| Primary logo (light) | Midnight rook + midnight wordmark (`<Logo surface="light">`) |
| App icon | Rounded tile, midnight + gold rook / white + midnight rook (`<AppIcon>`) |
| Monogram (compact) | Gold Cinzel "R" on midnight (`<Monogram>`) |
| Favicon | `frontend/src/app/icon.svg`: gold rook on a midnight tile (crisp at 16px) |
| Watermark | Hairline gold outline rook (`tone="outline"`) on midnight heroes |

Where the rook appears: sidebar logo, login identity panel, Home briefing hero (watermark), the **Ask ROOK** primary button, Ask answer header, and loading/empty states.

## Tokens (`frontend/src/app/globals.css`)
**Palette** (exactly the reference): Midnight `#0B1220` (primary) · Rook Gold `#D4AF7C` (accent) · Board Light `#F8F7F4` (surface) · Chess Gray `#475569` (secondary) · Slate `#1E293B` (supporting) · Success `#16A34A` · Warning `#F59E0B` · Risk `#DC2626`.

Accessibility-derived tokens:
- `--rook-gold-deep #8A6420`: the gold-family colour for text and the focus ring on light surfaces. Rook Gold itself is 2:1 on white, so it is used only for fills behind dark text, strokes, icons and accents.
- Semantic chip tints: each text colour meets WCAG AA on its tint.

| Group | Tokens |
|---|---|
| Surfaces | `--bg` Board Light · `--surface` white · `--surface-sunken` · `--line` · `--line-strong` |
| Text | `--ink` Midnight · `--ink-soft` Slate · `--muted` Chess Gray |
| Claim chips | `--fact-*` blue · `--inf-*` purple · `--rec-*` gold · `--unk-*` gray (dot, tint, ink) |
| Status chips | `--high-*` risk · `--med-*` warning · `--ok-*` success · `--up-*` upcoming · `--done-*` completed |
| Radius | `--radius-sm` 6 · `--radius-md` 10 (cards, buttons) · `--radius-lg` 14 (heroes, answers) |
| Shadow | `--shadow-card` (hairline) · `--shadow-raised` (hover, drafts) |
| Motion | `--ease`; `.lift` hover elevation; all motion disabled under `prefers-reduced-motion` |

**Typography** (`app/layout.tsx`, via `next/font`, self-hosted):
- **Cinzel**: the wordmark, Trajan-style capitals.
- **Cormorant Garamond**: editorial display headings (page titles, greeting, answer question).
- **Inter**: all UI and body text.

Hierarchy: page title (display 32px) → section title (12px uppercase tracked, gold rule) → card title (15px semibold) → supporting text (14px) → metadata (12px, icon + text) → evidence (quotes in display italic).

**Chessboard motifs** are brand texture, never a game board:
- `.board-light`: page headers, empty and loading states, login form side.
- `.board-dark`: sidebar.
- `.board-hero`: midnight gradient with a faint board, for the Home briefing hero and login identity panel.
- `.gold-rule`: section titles.

## Components
| Component | File | Notes |
|---|---|---|
| Icon family | `components/icons.tsx` | 34 icons on one 24px grid with 1.75 stroke. `accent` renders the gold highlight parts (feature-icon style). Decorative unless given a `label`. |
| Module tiles | `icons.tsx::MODULES`, `ModuleTile` | Home midnight/gold · Ask chess-gray · Meetings navy · Decisions gold · Commitments green · Risks red · Sources slate |
| Feature tile | `icons.tsx::FeatureTile` | White tile, midnight glyph, gold accents |
| Evidence type icons | `components/evidence.tsx::SourceIcon` | Meeting (video) · Teams (people) · Email · Chat · Document · Work item · External (globe). Generic glyphs, no third-party logos. |
| Buttons | `components/ui.tsx::Button`, `ButtonLink`, `BUTTON` | `primary` Midnight (Ask ROOK, with gold rook) · `secondary` Gold (navigation to details: open meeting preparation, review the decision) · `action` outlined (Draft follow-up) · `approve` outlined, strong border (Approve and send) · `quiet` |
| Status chips | `components/trust.tsx` | Claim chips: dot + text for Fact / Inference / Recommendation / Unknown (dashed outline), plus a screen-reader description. Status chips: icon + text for High/Medium risk, Overdue, Open (on-track style), Done (completed style), Upcoming, Ended, Pending, Decided, … |
| Page header | `ui.tsx::PageHeader` | Module tile + display title on a board band |
| Section | `ui.tsx::Section` | Tracked uppercase title, optional icon, gold rule, "more" link |
| Counter tile | `ui.tsx::CounterTile` | Tinted icon square, number, label, chevron (reference "Counter tiles") |
| Insight card | `components/insight.tsx` | Claim chip → title → metadata → why → evidence → action |
| Sidebar | `components/shell.tsx` | Midnight board, gold rook logo, active item with gold bar, white text and gold icon |

## Accessibility rules (WCAG 2.2 AA, UX §15)
- Claim types and statuses are always words. Colour, dot and icon only reinforce them.
- Icons are `aria-hidden` unless labelled. Every control keeps its accessible name.
- Focus: deep-gold ring on light surfaces and bright-gold ring on midnight, both at least 3:1.
- Gold is never body text on a light surface.
- Verified by axe (serious/critical = 0) on all P0 screens in `frontend/e2e/a11y.spec.ts`.

## Deviations from the reference (for owner approval)
See the PR that introduced this system. Each deviation is a deliberate choice for accessibility, legal or semantic correctness.

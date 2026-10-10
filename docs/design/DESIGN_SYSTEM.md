# ROOK Design System (v2)

ADR-0008. Tokens: `frontend/src/app/globals.css`. Components: `frontend/src/components/rook/` (import from `@/components/rook`).
Screenshots of every P0 screen: `docs/screenshots/` (refresh with `CAPTURE_SCREENSHOTS=1 npx playwright test e2e/screenshots.spec.ts`).

## 1. Two visual worlds
| World | Where | Surface |
|---|---|---|
| **Strategic shell** (dark) | sidebar, brand, page headers / Home hero, login, follow-up draft header | Midnight `#0B1220`, Slate squares, gold hairlines |
| **Executive workspace** (light) | everything you read and act on | Board Light `#F8F7F4` canvas, warm off-white cards `#FFFEFB` (never stark white) |

## 2. Palette (strict)
Midnight `#0B1220` · Rook Gold `#D4AF7C` · Board Light `#F8F7F4` · Chess Gray `#475569` · Slate `#1E293B` · Success `#16A34A` · Warning `#F59E0B` · Risk `#DC2626`.
Derived tones are tints/shades of these only, for AA contrast: gold-deep `#8A6420` (gold-family text and focus on light), on-dark text `#F8F7F4` / `#CBD5E1` / `#94A3B8`.
No pale-blue theme, no purple brand, no decorative gradients.

**Gold is intentional:** logo, active navigation, key actions (Draft follow-up, Sign in with Microsoft), focus ring, dividers and the "attention" marker. Never body text on light, never large fills, not every icon.

## 3. Logo
`RookMark`: a geometric rook in separated bands (crown, chamfer, tower with arrow slit, collar, plinth). Gold gradient on Midnight; solid Midnight on light. Always full strength, never low-opacity, never a Unicode glyph.
`RookLogo`: mark + Cinzel wordmark (Board Light on dark, Midnight on light), optional "Your AI Chief of Staff" and the tagline "Context for higher judgment" with a gold rule. `stacked` for login/splash. Favicon: `app/icon.svg`.

## 4. Chessboard texture
`RookChessPattern tone="dark|light" fade="right|left|down|radial|none"`: a CSS checkerboard (44px squares). Dark: Slate on Midnight; light: warm gray at 5.5% on Board Light. Always faded and decorative. Used in the sidebar brand area, every page header and the Home hero, login, and empty/loading states.

## 5. Typography
| Role | Font | Use |
|---|---|---|
| Wordmark | Cinzel 600/700 | "ROOK" only |
| Editorial headings | Cormorant Garamond 500–700 | page titles, featured insight titles, Ask question, quotes (italic) |
| UI / body | Inter (variable) | everything else; body 14–15px, metadata 12px |

Uppercase (`.rook-caps`, tracked) only for: the header eyebrow (ROOK / EXECUTIVE BRIEF), trust labels, section labels and metric labels.

## 6. Components
| Component | Notes |
|---|---|
| `RookSidebar`, `RookNavList`, `RookProfile` | Midnight rail; active item = Slate surface + 2px gold bar + Board Light text + gold icon. Top bar with scrolling nav below `md`. |
| `RookPageHeader` | Midnight panel with board texture: eyebrow "ROOK / …", serif title, tagline, meta row (trust/status), actions. `size="hero|page|detail"`. |
| `RookCard` level 1 / 2 / 3 | 1 executive insight (shadow-insight, radius 14) · 2 supporting (hairline, radius 10) · 3 metadata/evidence (sunken, no border). `flush` for divided lists. |
| `RookInsightCard` | Progressive disclosure: label → title → signals → 1–2 line explanation → "Why ROOK believes this" → "Evidence · N sources" → recommendation/action. Risk shown by a thin 2px edge, never a red background. |
| `RookMetricCard` | Uniform surface, hairline icon tile, large number, caps label, chevron; gold border + underline on hover/focus. |
| `RookStatusBadge` | `variant="trust"`: compact tinted tag, caps, square marker — FACT cool blue-neutral, INFERENCE restrained violet, RECOMMENDATION gold, UNKNOWN gray dashed. Status: text + square marker, no pill. Text is always visible; each trust label carries a screen-reader description. |
| `RookEvidence`, `RookSourceIcon` | One-line disclosure opening onto a level-3 list; generic glyphs in a neutral tile; quotes in serif italic with a gold rule. |
| `RookButton` | `primary` Midnight + gold icon · `secondary` off-white + hairline · `strategic` gold · `quiet` · `onDark`. |
| `RookAskBar` | Signature input: Midnight rook tile, "What changed, what matters, and what should I do?", Midnight submit; gold border and glow on focus. |
| `RookSection`, `RookSectionHeader` | Caps label with icon, count, optional link, hairline below. |
| `RookEmptyState`, `RookLoadingState`, `RookErrorState` | Board texture + full-strength rook; errors use a thin edge, never a coloured fill. |
| `RookIcon` | One family: 24px grid, 1.75 stroke, round joins. Module icons in `MODULE_ICON`. No per-module colour tiles. |

## 7. Page header taglines
Home: "ROOK / EXECUTIVE BRIEF", greeting, date, "N items require your attention today." · Ask ROOK: "Ask across your organizational context." · Meetings: "Prepare for the conversations that matter." · Decisions: "Know what was decided—and why." · Commitments: "Keep promises visible." · Risks: "See what could surprise you." · Sources: "Trace every important insight."

## 8. Responsive
Desktop command centre (sidebar 264px, content ≤1120px, Home two columns at xl). Tablet: sidebar kept, metric cards wrap and stretch. Phone: top bar + scrolling nav, single column.

## 9. Accessibility (WCAG 2.2 AA)
Body text ≥ 7:1 on Board Light; on-dark text ≥ 7:1 on Midnight; trust-label text ≥ 7:1 on its tint. Focus: deep-gold outline on light, gold on dark (ask bar: gold border + glow). Meaning never by colour alone. `prefers-reduced-motion` disables transitions. Axe (wcag2a/aa, 21aa, 22aa) runs on every P0 screen in `e2e/a11y.spec.ts`.

## 10. Open questions
C-009: Home metric "Waiting for" vs requested "Waiting for you" (the count is what others owe the user).

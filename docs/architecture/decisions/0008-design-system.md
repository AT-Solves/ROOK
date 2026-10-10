# ADR-0008 — ROOK design system (presentation layer)

- **Status:** v2 proposed (2026-10-10, design-system rebuild; awaiting product-owner visual approval). Supersedes v1 (2026-10-07).
- **Context:** v1 applied the palette to existing components and read as a generic dashboard. The owner asked for a rebuilt visual language: a dark strategic shell, a light executive workspace, a strong rook mark, visible chessboard texture, progressive-disclosure insight cards and a centralized component system.
- **Decision:**
  - **Tokens** live in `frontend/src/app/globals.css` (colour, type scale, spacing, radius, borders, shadows, icon sizes, sidebar/content widths, motion) and are mirrored for TypeScript in `components/rook/tokens.ts`.
  - **Primitives** live in `frontend/src/components/rook/` and are imported only through `@/components/rook`: `RookThemeProvider`, `RookLogo`, `RookMark`, `RookSidebar` (+ `RookNavList`, `RookProfile`), `RookPageHeader`, `RookChessPattern`, `RookCard` (three levels), `RookInsightCard`, `RookMetricCard`, `RookStatusBadge` (trust + status), `RookEvidence`, `RookSourceIcon`, `RookButton`, `RookAskBar`, `RookSectionHeader`/`RookSection`, `RookEmptyState`, `RookLoadingState`, `RookErrorState`, `RookIcon`.
  - **Domain components** (`trust`, `evidence`, `states`, `cards`, `actions`, `followup`, `ask`, `shell`, `tabs`) compose the primitives and own ROOK semantics (claim copy, statuses, follow-up approval). Screens use only these two layers.
  - Fonts are self-hosted from npm (`@fontsource`, loaded with `next/font/local`): builds never fetch from a font CDN.
  - No third-party icon or brand-logo libraries.
  - **No backend, API, data-model, trust, permission, audit or workflow change.**
- **Consequences:** every screen shares one header, card, badge and button vocabulary, so visual changes happen in one place. The spec is `docs/design/DESIGN_SYSTEM.md`; the open label question is C-009.

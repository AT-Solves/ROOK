# ADR-0008 — ROOK chess-inspired design system (presentation layer)

- **Status:** proposed (awaiting product-owner visual approval)
- **Context:** The product owner supplied a ROOK visual identity reference (Midnight/Gold palette, geometric rook, chessboard motif, icon family, chips, buttons, sidebar, counters).
- **Decision:**
  - Implement it as shared tokens (`globals.css`), brand components (`brand.tsx`), one icon family (`icons.tsx`) and shared primitives (`ui.tsx`, `trust.tsx`, `evidence.tsx`, `insight.tsx`, `shell.tsx`). Screens consume these components; no per-page styling systems.
  - Fonts are self-hosted with `next/font` (Cinzel, Cormorant Garamond, Inter).
  - No third-party icon or brand-logo libraries.
  - **No backend, API, data-model, trust, permission or workflow change.** UI copy only changed where the reference prescribes it (the "Ask ROOK" button).
- **Consequences:** The previous automatic OS dark theme is replaced by the reference's light-board surfaces with a midnight sidebar (deviation D-6, pending approval). The visual system is documented in `docs/design/DESIGN_SYSTEM.md`.

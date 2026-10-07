# ADR-0001 — Record architecture decisions; artifacts own product behaviour

- **Status:** accepted
- **Context:** ROOK has product artifacts (`docs/product/`) and a broad build brief (`README.md`). Engineering choices must not silently redefine the product.
- **Decision:** Engineering decisions are recorded as ADRs in this folder. Any ADR that would change product behaviour is raised in `docs/CONFLICTS.md` instead and waits for the product owner.
- **Consequences:** Every new dependency or infrastructure component, and every change to a layer boundary, needs an ADR (see `rook-architecture`).

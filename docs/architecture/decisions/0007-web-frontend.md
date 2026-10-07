# ADR-0007 — Web frontend: client-rendered Next.js over the ROOK API

- **Status:** accepted (M3)
- **Context:** M3 adds the P0 executive screens. The backend already owns all business logic, permission filtering and claim typing.
- **Decision:**
  - `frontend/` is a Next.js 16 (App Router, Cache Components) + TypeScript + Tailwind v4 app. Screens are client components that call the API through **one boundary**, `src/lib/api.ts`. Components never build URLs, interpret status codes, or derive business facts. They only render the API's claims, evidence and actions.
  - Static shells are prerendered. Dynamic routes (`/meetings/[id]`, …) resolve `params` inside `<Suspense>`, as Cache Components requires. Next keeps recently visited routes mounted but hidden, so tests assert on visible roles.
  - **Session:** the ROOK session token lives in `sessionStorage` and is sent as a Bearer header. It never goes in cookies or URLs, except the one-time fragment hand-off after Microsoft sign-in, which is removed from history immediately. Trade-off: script injection (XSS) could read it. Mitigations are no `dangerouslySetInnerHTML`, React escaping, and short token TTL. An httpOnly-cookie BFF is a hardening option before multi-tenant SaaS.
  - The API base comes from `NEXT_PUBLIC_ROOK_API_URL` (default `http://localhost:8000`). The backend CORS allow-list must include the web origin.
  - The UI adds no capability the API lacks. For example, "assign owner" is shown as advice with a link to the source, not a fake button.
- **Testing:** Vitest + Testing Library for components and the API boundary. Playwright + axe-core runs end to end against the real API in rules mode on the demo tenant.

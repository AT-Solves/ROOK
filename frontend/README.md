# ROOK web app

The P0 executive experience (M3): Home, Ask ROOK, Meetings (with preparation and outcome), Decisions, Commitments, Risks, Sources and the evidence viewer.
It is a client of the ROOK API (`../backend`). All business logic, permission filtering and claim typing stay in the API. See ADR-0007.

```bash
npm ci
NEXT_PUBLIC_ROOK_API_URL=http://localhost:8000 npm run dev     # API must allow this origin (ROOK_CORS_ORIGINS)
npm run lint && npm run typecheck && npm test
npm run build && npm run test:e2e                               # Playwright starts the API (demo tenant) and the web app
```

In cloud sessions, set `PW_CHROMIUM_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome` and never run `playwright install`.

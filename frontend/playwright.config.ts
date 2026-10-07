import { defineConfig } from "@playwright/test";

/**
 * E2E against the real ROOK API (demo tenant, rules mode) — no mocked business logic.
 * Locally: PW_CHROMIUM_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome (preinstalled; never `playwright install`).
 */
const python = process.env.ROOK_PYTHON ?? ".venv/bin/python";
const chromium = process.env.PW_CHROMIUM_PATH;

export default defineConfig({
  testDir: "./e2e",
  workers: 1,
  fullyParallel: false,
  retries: 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
    launchOptions: chromium ? { executablePath: chromium } : {},
  },
  webServer: [
    {
      command: `sh -c "rm -f e2e.db && ROOK_DATABASE_URL=sqlite:///./e2e.db ROOK_DEV_LOGIN=true ${python} -m uvicorn rook.main:app --port 8000"`,
      cwd: "../backend",
      url: "http://localhost:8000/api/health",
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
    {
      command: "npx next start -p 3000",
      url: "http://localhost:3000/login",
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
  ],
});

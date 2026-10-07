import { defineConfig } from "@playwright/test";

/**
 * E2E against the real ROOK API (demo tenant, rules mode) — no mocked business logic.
 * Locally: PW_CHROMIUM_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome (preinstalled; never `playwright install`).
 */
const python = process.env.ROOK_PYTHON ?? ".venv/bin/python";
const chromium = process.env.PW_CHROMIUM_PATH;

/**
 * Demo time zone: one where it is ~09:00 now (mirrors backend `demo_morning_timezone`), so reviews and
 * CI always see a realistic working day. The API's demo user and the browser share this zone.
 * Etc/GMT signs are inverted (Etc/GMT-5 = UTC+5).
 */
function morningTimezone(localHour = 9): string {
  const offset = ((((localHour - new Date().getUTCHours() + 12) % 24) + 24) % 24) - 12;
  return offset === 0 ? "Etc/GMT" : offset > 0 ? `Etc/GMT-${offset}` : `Etc/GMT+${-offset}`;
}
const demoTimezone = process.env.ROOK_DEMO_TIMEZONE ?? morningTimezone();

export default defineConfig({
  testDir: "./e2e",
  workers: 1,
  fullyParallel: false,
  retries: 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
    timezoneId: demoTimezone,
    launchOptions: chromium ? { executablePath: chromium } : {},
  },
  webServer: [
    {
      command: `sh -c "rm -f e2e.db && ROOK_DATABASE_URL=sqlite:///./e2e.db ROOK_DEV_LOGIN=true ROOK_DEMO_TIMEZONE=${demoTimezone} ${python} -m uvicorn rook.main:app --port 8000"`,
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

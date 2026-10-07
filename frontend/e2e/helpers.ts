import { expect, type APIRequestContext, type Page } from "@playwright/test";

export const API = "http://localhost:8000/api";

export async function signIn(page: Page, email = "yamini@acme.example") {
  await page.goto("/login");
  await page.getByLabel("Demo user email").fill(email);
  await page.getByRole("button", { name: "Enter demo" }).click();
  await expect(page).toHaveURL("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(/Good (morning|afternoon|evening)/);
}

export async function apiToken(request: APIRequestContext, email: string): Promise<string> {
  const r = await request.post(`${API}/auth/login`, { data: { email } });
  return (await r.json()).token as string;
}

/** The demo's restricted compensation email: participants are David and Sarah only. */
export async function restrictedSignalId(request: APIRequestContext, email: string): Promise<number> {
  const token = await apiToken(request, email);
  for (let id = 1; id <= 60; id++) {
    const r = await request.get(`${API}/signals/${id}`, { headers: { Authorization: `Bearer ${token}` } });
    if (r.status() === 403) return id;
  }
  throw new Error("no restricted signal found");
}

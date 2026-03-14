import { defineConfig, devices } from "@playwright/test";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: ".envrc.local" });

export const AUTH_STATE_PATH = path.join(process.cwd(), "e2e/.auth-state.json");

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  timeout: 120_000,
  reporter: process.env.CI ? "github" : "list",
  globalSetup: "./e2e/globalSetup.ts",
  globalTeardown: "./e2e/globalTeardown.ts",
  use: {
    baseURL: process.env.GADGET_APP_URL,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});

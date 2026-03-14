import { chromium } from "@playwright/test";
import dotenv from "dotenv";
import path from "path";
import { Client } from "@gadget-client/xxi";

dotenv.config({ path: path.resolve(process.cwd(), ".envrc.local") });

const AUTH_STATE_PATH = path.join(process.cwd(), "e2e/.auth-state.json");

const TEST_USER_EMAIL = process.env.TEST_USER_EMAIL!;
const TEST_USER_PASSWORD = process.env.TEST_USER_PASSWORD!;
const TEST_PREFIX = "e2e-test";

const api = new Client({
  environment: process.env.GADGET_ENVIRONMENT,
  authenticationMode: {
    apiKey: process.env.GADGET_API_KEY!,
  },
});

export default async function globalSetup() {
  // 1. Clean up leftover test data (rolls + their inventory items)
  const rolls = await api.internal.roll.findMany({
    filter: { clientSeed: { startsWith: TEST_PREFIX } },
  });
  for (const roll of rolls) {
    const invItems = await api.internal.inventoryItem.findMany({
      filter: { rollId: { equals: roll.id } },
    });
    for (const inv of invItems) {
      await api.internal.inventoryItem.delete(inv.id);
    }
    await api.internal.roll.delete(roll.id);
  }

  // 2. Ensure test user exists and can sign in
  const existing = await api.user.findMany({
    filter: { email: { equals: TEST_USER_EMAIL } },
    first: 1,
  });

  if (existing[0]) {
    if (!existing[0].emailVerified) {
      await api.internal.user.update(existing[0].id, { emailVerified: true });
    }
  } else {
    await api.internal.user.create({
      email: TEST_USER_EMAIL,
      password: TEST_USER_PASSWORD,
      emailVerified: true,
      roles: ["signed-in"],
    });
  }

  // 3. Sign in via browser and save session
  const browser = await chromium.launch();
  const page = await browser.newPage();

  await page.goto(`${process.env.GADGET_APP_URL}/sign-in`);
  await page.waitForLoadState("networkidle");
  await page.fill("#email", TEST_USER_EMAIL);
  await page.fill("#password", TEST_USER_PASSWORD);
  await page.click('button[type="submit"]');

  // Sign-in redirects to "/" (the homepage with PixiCanvas)
  await page.waitForURL(process.env.GADGET_APP_URL + "/", { timeout: 60_000 });
  await page.waitForLoadState("networkidle");

  // Save cookies + localStorage for authenticated tests
  await page.context().storageState({ path: AUTH_STATE_PATH });

  await browser.close();
}

import { expect, test } from "@playwright/test";
import { api, TEST_PREFIX, cleanupTestRolls } from "./helpers/api";
import { AUTH_STATE_PATH } from "../playwright.config";

test.beforeEach(cleanupTestRolls);
test.afterEach(cleanupTestRolls);

test.describe("anonymous rolling", () => {
  test("roll button is visible and clickable on homepage", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const rollButton = page.locator('[data-testid="roll-button"]');
    await expect(rollButton).toBeVisible({ timeout: 30_000 });
    await expect(rollButton).toHaveText("Roll");
    await expect(rollButton).toBeEnabled();
  });

  test("clicking Roll creates a roll and shows result", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Set a known client seed via the fairness panel so we can find the roll later
    await page.locator('[data-testid="fairness-trigger"]').click();
    await page.waitForLoadState("networkidle");

    const seedInput = page.locator('[data-testid="client-seed-input"]');
    await seedInput.clear();
    await seedInput.fill(`${TEST_PREFIX}-anon-roll`);

    // Close the fairness panel by pressing Escape
    await page.keyboard.press("Escape");

    // Click Roll
    const rollButton = page.locator('[data-testid="roll-button"]');
    await rollButton.click();

    // Button should show "Rolling..." while in progress
    await expect(rollButton).toHaveText("Rolling...");

    // Wait for result to appear (animation takes a few seconds)
    const result = page.locator('[data-testid="roll-result"]');
    await expect(result).toBeVisible({ timeout: 30_000 });

    // Verify roll was persisted in the database
    const rolls = await api.internal.roll.findMany({
      filter: { clientSeed: { equals: `${TEST_PREFIX}-anon-roll` } },
    });
    expect(rolls).toHaveLength(1);
    expect(rolls[0].serverSeed).toBeTruthy();
    expect(rolls[0].serverSeedHash).toBeTruthy();
    expect(rolls[0].item).toBeTruthy();
    expect(rolls[0].bundle).toBeTruthy();
    // Anonymous roll should NOT have a user
    expect(rolls[0].user).toBeNull();
  });
});

test.describe("authenticated rolling", () => {
  test.use({ storageState: AUTH_STATE_PATH });

  test("roll is linked to the signed-in user", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Confirm user is signed in (nav shows "Go to app")
    await expect(page.getByText("Go to app")).toBeVisible({ timeout: 30_000 });

    // Set a known client seed
    await page.locator('[data-testid="fairness-trigger"]').click();
    await page.waitForLoadState("networkidle");

    const seedInput = page.locator('[data-testid="client-seed-input"]');
    await seedInput.clear();
    await seedInput.fill(`${TEST_PREFIX}-auth-roll`);
    await page.keyboard.press("Escape");

    // Roll
    await page.locator('[data-testid="roll-button"]').click();
    await expect(page.locator('[data-testid="roll-result"]')).toBeVisible({ timeout: 30_000 });

    // Verify the roll is in the database AND linked to the test user
    const rolls = await api.internal.roll.findMany({
      filter: { clientSeed: { equals: `${TEST_PREFIX}-auth-roll` } },
    });
    expect(rolls).toHaveLength(1);
    expect(rolls[0].user).toBeTruthy();

    // Verify the user is the test user
    const user = await api.internal.user.findMany({
      filter: { email: { equals: process.env.TEST_USER_EMAIL! } },
      first: 1,
    });
    expect(rolls[0].user).toBe(user[0].id);
  });
});

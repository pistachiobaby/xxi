import { expect, test } from "@playwright/test";
import { api, TEST_PREFIX, cleanupTestRolls } from "./helpers/api";
import { AUTH_STATE_PATH } from "../playwright.config";

// All tests in this file need authentication (profile page requires sign-in)
test.use({ storageState: AUTH_STATE_PATH });

test.beforeEach(cleanupTestRolls);
test.afterEach(cleanupTestRolls);

test.describe("roll history on profile page", () => {
  test("shows empty state when user has no rolls", async ({ page }) => {
    await page.goto("/profile");
    await page.waitForLoadState("networkidle");

    const history = page.locator('[data-testid="roll-history"]');
    await expect(history).toBeVisible({ timeout: 30_000 });
    await expect(history.getByText("No rolls yet")).toBeVisible();
  });

  test("roll appears in history after rolling", async ({ page }) => {
    // 1. Roll on the homepage
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Set known client seed
    await page.locator('[data-testid="fairness-trigger"]').click();
    await page.waitForLoadState("networkidle");
    const seedInput = page.locator('[data-testid="client-seed-input"]');
    await seedInput.clear();
    await seedInput.fill(`${TEST_PREFIX}-history`);
    await page.keyboard.press("Escape");

    // Wait for the Sheet to close and Roll button to be enabled
    const rollButton = page.locator('[data-testid="roll-button"]');
    await expect(rollButton).toBeEnabled({ timeout: 10_000 });

    // Roll and wait for result
    await rollButton.click();
    const result = page.locator('[data-testid="roll-result"]');
    await expect(result).toBeVisible({ timeout: 30_000 });

    // Capture the item name from the result
    const itemName = await result.locator("span.text-white").textContent();

    // 2. Navigate to profile
    await page.goto("/profile");
    await page.waitForLoadState("networkidle");

    // 3. Verify the roll appears in history
    const history = page.locator('[data-testid="roll-history"]');
    await expect(history).toBeVisible({ timeout: 30_000 });
    await expect(history.getByText(itemName!)).toBeVisible({ timeout: 15_000 });
  });

  test("roll verification passes on profile page", async ({ page }) => {
    // 1. Create a roll
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    await page.locator('[data-testid="fairness-trigger"]').click();
    await page.waitForLoadState("networkidle");
    const seedInput = page.locator('[data-testid="client-seed-input"]');
    await seedInput.clear();
    await seedInput.fill(`${TEST_PREFIX}-verify`);
    await page.keyboard.press("Escape");

    await page.locator('[data-testid="roll-button"]').click();
    await expect(page.locator('[data-testid="roll-result"]')).toBeVisible({ timeout: 30_000 });

    // 2. Navigate to profile and expand the roll
    await page.goto("/profile");
    await page.waitForLoadState("networkidle");

    // Find the roll in the accordion and expand it
    const rollItem = page.locator('[data-testid^="roll-item-"]').first();
    await expect(rollItem).toBeVisible({ timeout: 15_000 });
    await rollItem.locator('[data-slot="accordion-trigger"]').click();

    // 3. Click verify button
    const verifyButton = rollItem.locator('button:has-text("Verify This Roll")');
    await expect(verifyButton).toBeVisible();
    await verifyButton.click();

    // 4. Verification results should show all checks passing
    const verificationResult = page.locator('[data-testid^="verification-result-"]').first();
    await expect(verificationResult).toBeVisible({ timeout: 15_000 });

    // Check that "Outcome verified" shows a green checkmark
    await expect(verificationResult.getByText("Outcome verified")).toBeVisible();
    const outcomeCheck = verificationResult.locator("text=Outcome verified").locator("..");
    await expect(outcomeCheck.locator(".text-green-400")).toBeVisible();
  });
});

test.describe("fairness panel inline verification", () => {
  test("verifying last roll in fairness panel shows all checks passing", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Set known client seed
    await page.locator('[data-testid="fairness-trigger"]').click();
    await page.waitForLoadState("networkidle");
    const seedInput = page.locator('[data-testid="client-seed-input"]');
    await seedInput.clear();
    await seedInput.fill(`${TEST_PREFIX}-fairness`);
    await page.keyboard.press("Escape");

    // Roll
    await page.locator('[data-testid="roll-button"]').click();
    await expect(page.locator('[data-testid="roll-result"]')).toBeVisible({ timeout: 30_000 });

    // Open fairness panel and verify
    await page.locator('[data-testid="fairness-trigger"]').click();
    await page.waitForLoadState("networkidle");

    // The panel should now show the last roll data
    const verifyButton = page.locator('[data-testid="fairness-verify-button"]');
    await expect(verifyButton).toBeVisible();
    await verifyButton.click();

    // Verification result should appear with all checks passing
    const verificationResult = page.locator('[data-testid="fairness-verification-result"]');
    await expect(verificationResult).toBeVisible({ timeout: 15_000 });
    await expect(verificationResult.getByText("Outcome verified")).toBeVisible();
    await expect(verificationResult.locator(".text-green-400")).toHaveCount(4); // hash, rollValue, winner, outcome
  });

  test("server commitment is displayed before rolling", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Open fairness panel
    await page.locator('[data-testid="fairness-trigger"]').click();
    await page.waitForLoadState("networkidle");

    // Server commitment should be visible (64-char hex SHA-256 hash)
    const commitment = page.locator('[data-testid="server-commitment"]');
    await expect(commitment).toBeVisible({ timeout: 15_000 });
    const commitmentText = await commitment.textContent();
    expect(commitmentText).toMatch(/^[a-f0-9]{64}$/);
  });
});

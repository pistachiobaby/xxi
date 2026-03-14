import { expect, test } from "@playwright/test";
import { api, TEST_PREFIX, cleanupTestRolls } from "./helpers/api";
import { AUTH_STATE_PATH } from "../playwright.config";

test.beforeEach(cleanupTestRolls);
test.afterEach(cleanupTestRolls);

test.describe("unclaimed rolls badge — anonymous", () => {
  test("shows unclaimed rolls badge after rolling and popover on hover", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Badge should not be visible before rolling
    await expect(page.locator('[data-testid="unclaimed-rolls-trigger"]')).not.toBeVisible();

    // Set a known client seed and roll
    await page.locator('[data-testid="fairness-trigger"]').click();
    await page.waitForLoadState("networkidle");
    const seedInput = page.locator('[data-testid="client-seed-input"]');
    await seedInput.clear();
    await seedInput.fill(`${TEST_PREFIX}-unclaimed-1`);
    await page.keyboard.press("Escape");

    const rollButton = page.locator('[data-testid="roll-button"]');
    await expect(rollButton).toBeEnabled({ timeout: 10_000 });
    await rollButton.click();
    await expect(page.locator('[data-testid="roll-result"]')).toBeVisible({ timeout: 30_000 });

    // Badge should now show "1 unclaimed roll"
    const trigger = page.locator('[data-testid="unclaimed-rolls-trigger"]');
    await expect(trigger).toBeVisible();
    await expect(trigger).toContainText("1 unclaimed roll");

    // CTA link should be visible
    await expect(page.locator('[data-testid="claim-cta"]')).toBeVisible();

    // Hover to open popover — should show the rolled item
    await trigger.hover();
    await expect(page.getByText("Unclaimed Rolls", { exact: true })).toBeVisible({ timeout: 5_000 });
  });

  test("badge count increments with multiple rolls", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Roll twice with different seeds
    for (const suffix of ["-unclaimed-a", "-unclaimed-b"]) {
      await page.locator('[data-testid="fairness-trigger"]').click();
      await page.waitForLoadState("networkidle");
      const seedInput = page.locator('[data-testid="client-seed-input"]');
      await seedInput.clear();
      await seedInput.fill(`${TEST_PREFIX}${suffix}`);
      await page.keyboard.press("Escape");

      const rollButton = page.locator('[data-testid="roll-button"]');
      await expect(rollButton).toBeEnabled({ timeout: 10_000 });
      await rollButton.click();
      await expect(page.locator('[data-testid="roll-result"]')).toBeVisible({ timeout: 30_000 });
    }

    // Badge should show "2 unclaimed rolls" (plural)
    await expect(page.locator('[data-testid="unclaimed-rolls-trigger"]')).toContainText("2 unclaimed rolls");
  });

  test("badge persists after page reload", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Roll once
    await page.locator('[data-testid="fairness-trigger"]').click();
    await page.waitForLoadState("networkidle");
    const seedInput = page.locator('[data-testid="client-seed-input"]');
    await seedInput.clear();
    await seedInput.fill(`${TEST_PREFIX}-unclaimed-persist`);
    await page.keyboard.press("Escape");

    await page.locator('[data-testid="roll-button"]').click();
    await expect(page.locator('[data-testid="roll-result"]')).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('[data-testid="unclaimed-rolls-trigger"]')).toBeVisible();

    // Reload the page
    await page.reload();
    await page.waitForLoadState("networkidle");

    // Badge should still be visible (loaded from localStorage)
    await expect(page.locator('[data-testid="unclaimed-rolls-trigger"]')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('[data-testid="unclaimed-rolls-trigger"]')).toContainText("1 unclaimed roll");
  });
});

test.describe("unclaimed rolls badge — authenticated", () => {
  test.use({ storageState: AUTH_STATE_PATH });

  test("badge does not appear for signed-in users", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Roll as an authenticated user
    await page.locator('[data-testid="fairness-trigger"]').click();
    await page.waitForLoadState("networkidle");
    const seedInput = page.locator('[data-testid="client-seed-input"]');
    await seedInput.clear();
    await seedInput.fill(`${TEST_PREFIX}-unclaimed-auth`);
    await page.keyboard.press("Escape");

    const rollButton = page.locator('[data-testid="roll-button"]');
    await expect(rollButton).toBeEnabled({ timeout: 10_000 });
    await rollButton.click();
    await expect(page.locator('[data-testid="roll-result"]')).toBeVisible({ timeout: 30_000 });

    // Badge should NOT appear
    await expect(page.locator('[data-testid="unclaimed-rolls-trigger"]')).not.toBeVisible();
    await expect(page.locator('[data-testid="claim-cta"]')).not.toBeVisible();
  });
});

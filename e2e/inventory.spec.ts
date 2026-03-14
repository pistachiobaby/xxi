import { expect, test } from "@playwright/test";
import { api, TEST_PREFIX, cleanupTestRolls } from "./helpers/api";
import { AUTH_STATE_PATH } from "../playwright.config";

test.beforeEach(cleanupTestRolls);
test.afterEach(cleanupTestRolls);

test.describe("inventory — authenticated roll creates inventory item", () => {
  test.use({ storageState: AUTH_STATE_PATH });

  test("rolling while signed in creates an inventoryItem in the database", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Set a known client seed
    await page.locator('[data-testid="fairness-trigger"]').click();
    await page.waitForLoadState("networkidle");
    const seedInput = page.locator('[data-testid="client-seed-input"]');
    await seedInput.clear();
    await seedInput.fill(`${TEST_PREFIX}-inv-auth`);
    await page.keyboard.press("Escape");

    const rollButton = page.locator('[data-testid="roll-button"]');
    await expect(rollButton).toBeEnabled({ timeout: 10_000 });
    await rollButton.click();

    await expect(page.locator('[data-testid="roll-result"]')).toBeVisible({ timeout: 30_000 });

    // Verify the roll exists and has an associated inventoryItem
    const rolls = await api.internal.roll.findMany({
      filter: { clientSeed: { equals: `${TEST_PREFIX}-inv-auth` } },
    });
    expect(rolls).toHaveLength(1);
    expect(rolls[0].user).toBeTruthy();

    const invItems = await api.internal.inventoryItem.findMany({
      filter: { rollId: { equals: rolls[0].id } },
    });
    expect(invItems).toHaveLength(1);
    expect(invItems[0].user).toBe(rolls[0].user);
    expect(invItems[0].value).toBeGreaterThanOrEqual(0);
    expect(invItems[0].soldAt).toBeNull();
  });
});

test.describe("inventory — anonymous roll claiming on sign-in", () => {
  test("anonymous rolls are claimed and inventoryItems created after sign-in", async ({ page }) => {
    // 1. Roll anonymously (no auth state)
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Set a known client seed
    await page.locator('[data-testid="fairness-trigger"]').click();
    await page.waitForLoadState("networkidle");
    const seedInput = page.locator('[data-testid="client-seed-input"]');
    await seedInput.clear();
    await seedInput.fill(`${TEST_PREFIX}-inv-claim`);
    await page.keyboard.press("Escape");

    const rollButton = page.locator('[data-testid="roll-button"]');
    await expect(rollButton).toBeEnabled({ timeout: 10_000 });
    await rollButton.click();

    await expect(page.locator('[data-testid="roll-result"]')).toBeVisible({ timeout: 30_000 });

    // Verify roll exists with claimToken and no user
    const rollsBefore = await api.internal.roll.findMany({
      filter: { clientSeed: { equals: `${TEST_PREFIX}-inv-claim` } },
    });
    expect(rollsBefore).toHaveLength(1);
    expect(rollsBefore[0].user).toBeNull();
    expect(rollsBefore[0].claimToken).toBeTruthy();

    // No inventory item yet
    const invBefore = await api.internal.inventoryItem.findMany({
      filter: { rollId: { equals: rollsBefore[0].id } },
    });
    expect(invBefore).toHaveLength(0);

    // 2. Sign in — this should trigger claiming
    await page.goto("/sign-in");
    await page.waitForLoadState("networkidle");

    await page.fill("#email", process.env.TEST_USER_EMAIL!);
    await page.fill("#password", process.env.TEST_USER_PASSWORD!);
    await page.click('button[type="submit"]');

    // Wait for redirect after sign-in
    await page.waitForURL("**/", { timeout: 60_000 });
    await page.waitForLoadState("networkidle");

    // 3. Wait for the roll to be claimed (ClaimAnonymousRolls fires async via useEffect)
    await expect(async () => {
      const rolls = await api.internal.roll.findMany({
        filter: { clientSeed: { equals: `${TEST_PREFIX}-inv-claim` } },
      });
      expect(rolls).toHaveLength(1);
      expect(rolls[0].user).toBeTruthy();
      expect(rolls[0].claimToken).toBeNull();
    }).toPass({ timeout: 15_000 });

    // 4. Verify inventoryItem was created
    const rollsAfter = await api.internal.roll.findMany({
      filter: { clientSeed: { equals: `${TEST_PREFIX}-inv-claim` } },
    });
    const invAfter = await api.internal.inventoryItem.findMany({
      filter: { rollId: { equals: rollsAfter[0].id } },
    });
    expect(invAfter).toHaveLength(1);
    expect(invAfter[0].user).toBe(rollsAfter[0].user);
    expect(invAfter[0].soldAt).toBeNull();
  });
});

test.describe("inventory — anonymous roll claiming on sign-up", () => {
  const signUpEmail = `${TEST_PREFIX}-claim-signup@test.example.com`;

  async function cleanupSignUpUser() {
    const users = await api.internal.user.findMany({
      filter: { email: { equals: signUpEmail } },
    });
    for (const u of users) {
      await api.internal.user.delete(u.id);
    }
  }

  test.beforeEach(cleanupSignUpUser);
  test.afterEach(cleanupSignUpUser);

  test("anonymous rolls are claimed after sign-up", async ({ page }) => {
    // 1. Roll anonymously
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    await page.locator('[data-testid="fairness-trigger"]').click();
    await page.waitForLoadState("networkidle");
    const seedInput = page.locator('[data-testid="client-seed-input"]');
    await seedInput.clear();
    await seedInput.fill(`${TEST_PREFIX}-claim-signup`);
    await page.keyboard.press("Escape");

    const rollButton = page.locator('[data-testid="roll-button"]');
    await expect(rollButton).toBeEnabled({ timeout: 10_000 });
    await rollButton.click();
    await expect(page.locator('[data-testid="roll-result"]')).toBeVisible({ timeout: 30_000 });

    // Verify roll exists with no user
    const rollsBefore = await api.internal.roll.findMany({
      filter: { clientSeed: { equals: `${TEST_PREFIX}-claim-signup` } },
    });
    expect(rollsBefore).toHaveLength(1);
    expect(rollsBefore[0].user).toBeNull();

    // 2. Sign up — this should trigger claiming
    await page.goto("/sign-up");
    await page.waitForLoadState("networkidle");

    await page.fill("#email", signUpEmail);
    await page.fill("#password", "TestPassword123!");
    await page.click('button[type="submit"]');

    await page.waitForURL("**/", { timeout: 60_000 });
    await page.waitForLoadState("networkidle");

    // Should be signed in
    await expect(page.getByText("Go to app")).toBeVisible({ timeout: 15_000 });

    // 3. Wait for the roll to be claimed
    await expect(async () => {
      const rolls = await api.internal.roll.findMany({
        filter: { clientSeed: { equals: `${TEST_PREFIX}-claim-signup` } },
      });
      expect(rolls).toHaveLength(1);
      expect(rolls[0].user).toBeTruthy();
      expect(rolls[0].claimToken).toBeNull();
    }).toPass({ timeout: 15_000 });

    // 4. Verify inventoryItem was created
    const rollsAfter = await api.internal.roll.findMany({
      filter: { clientSeed: { equals: `${TEST_PREFIX}-claim-signup` } },
    });
    const invAfter = await api.internal.inventoryItem.findMany({
      filter: { rollId: { equals: rollsAfter[0].id } },
    });
    expect(invAfter).toHaveLength(1);
    expect(invAfter[0].user).toBe(rollsAfter[0].user);
  });
});

test.describe("inventory page", () => {
  test.use({ storageState: AUTH_STATE_PATH });

  test("shows inventory items and sell works", async ({ page }) => {
    // 1. Roll to create an inventory item
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    await page.locator('[data-testid="fairness-trigger"]').click();
    await page.waitForLoadState("networkidle");
    const seedInput = page.locator('[data-testid="client-seed-input"]');
    await seedInput.clear();
    await seedInput.fill(`${TEST_PREFIX}-inv-sell`);
    await page.keyboard.press("Escape");

    const rollButton = page.locator('[data-testid="roll-button"]');
    await expect(rollButton).toBeEnabled({ timeout: 10_000 });
    await rollButton.click();

    await expect(page.locator('[data-testid="roll-result"]')).toBeVisible({ timeout: 30_000 });

    // 2. Navigate to inventory page
    await page.goto("/inventory");
    await page.waitForLoadState("networkidle");

    // 3. Verify the item appears
    const itemCard = page.locator("text=Value:").first();
    await expect(itemCard).toBeVisible({ timeout: 15_000 });

    // 4. Verify balance is displayed
    await expect(page.locator("text=Balance:")).toBeVisible();

    // 5. Click sell on the first item
    const sellButton = page.locator('button:text-is("Sell")').first();
    await expect(sellButton).toBeVisible();
    await sellButton.click();

    // 6. Wait for the item to disappear — since there's only one item, empty state should show
    await expect(page.locator("text=No items yet")).toBeVisible({ timeout: 15_000 });

    // Verify the inventoryItem is now sold in the database
    const rolls = await api.internal.roll.findMany({
      filter: { clientSeed: { equals: `${TEST_PREFIX}-inv-sell` } },
    });
    const invItems = await api.internal.inventoryItem.findMany({
      filter: { rollId: { equals: rolls[0].id } },
    });
    expect(invItems[0].soldAt).toBeTruthy();
  });

  test("selling an already-sold item is rejected", async ({ page }) => {
    // 1. Roll to create an inventory item
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    await page.locator('[data-testid="fairness-trigger"]').click();
    await page.waitForLoadState("networkidle");
    const seedInput = page.locator('[data-testid="client-seed-input"]');
    await seedInput.clear();
    await seedInput.fill(`${TEST_PREFIX}-inv-double-sell`);
    await page.keyboard.press("Escape");

    const rollButton = page.locator('[data-testid="roll-button"]');
    await expect(rollButton).toBeEnabled({ timeout: 10_000 });
    await rollButton.click();

    await expect(page.locator('[data-testid="roll-result"]')).toBeVisible({ timeout: 30_000 });

    // 2. Get the inventory item
    const rolls = await api.internal.roll.findMany({
      filter: { clientSeed: { equals: `${TEST_PREFIX}-inv-double-sell` } },
    });
    const invItems = await api.internal.inventoryItem.findMany({
      filter: { rollId: { equals: rolls[0].id } },
    });
    const itemId = invItems[0].id;

    // 3. First sell succeeds
    await api.inventoryItem.sell(itemId);
    const afterFirst = await api.internal.inventoryItem.findOne(itemId);
    expect(afterFirst.soldAt).toBeTruthy();

    // 4. Second sell is rejected — the action guard throws "already been sold"
    await expect(api.inventoryItem.sell(itemId)).rejects.toThrow(/already been sold/);
  });

  test("selling increments the user's balance", async ({ page }) => {
    // 1. Roll to create an inventory item
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    await page.locator('[data-testid="fairness-trigger"]').click();
    await page.waitForLoadState("networkidle");
    const seedInput = page.locator('[data-testid="client-seed-input"]');
    await seedInput.clear();
    await seedInput.fill(`${TEST_PREFIX}-inv-balance`);
    await page.keyboard.press("Escape");

    const rollButton = page.locator('[data-testid="roll-button"]');
    await expect(rollButton).toBeEnabled({ timeout: 10_000 });
    await rollButton.click();

    await expect(page.locator('[data-testid="roll-result"]')).toBeVisible({ timeout: 30_000 });

    // 2. Get the inventory item and check its value
    const rolls = await api.internal.roll.findMany({
      filter: { clientSeed: { equals: `${TEST_PREFIX}-inv-balance` } },
    });
    const invItems = await api.internal.inventoryItem.findMany({
      filter: { rollId: { equals: rolls[0].id } },
    });
    const itemValue = invItems[0].value ?? 0;
    const userId = rolls[0].user!;

    // 3. Record balance before sell
    const userBefore = await api.internal.user.findOne(userId);
    const balanceBefore = userBefore.balance ?? 0;

    // 4. Sell the item
    await api.inventoryItem.sell(invItems[0].id);

    // 5. Verify balance increased by the item's value
    const userAfter = await api.internal.user.findOne(userId);
    expect(userAfter.balance).toBe(balanceBefore + itemValue);
  });

  test("inventory page shows empty state with no items", async ({ page }) => {
    await page.goto("/inventory");
    await page.waitForLoadState("networkidle");

    await expect(page.locator("text=No items yet")).toBeVisible({ timeout: 15_000 });
  });
});

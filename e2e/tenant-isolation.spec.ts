import { expect, test } from "@playwright/test";
import { api, TEST_PREFIX, cleanupTestRolls } from "./helpers/api";
import { AUTH_STATE_PATH } from "../playwright.config";

const SECOND_USER_EMAIL = `${TEST_PREFIX}-other@test.example.com`;

async function ensureSecondUser() {
  const existing = await api.internal.user.findMany({
    filter: { email: { equals: SECOND_USER_EMAIL } },
  });
  if (existing.length > 0) return existing[0];
  return api.internal.user.create({
    email: SECOND_USER_EMAIL,
    password: "TestPassword123!",
    emailVerified: true,
    roles: ["signed-in"],
  });
}

/** Remove all unsold inventory items for the test user (ensures clean slate). */
async function cleanupTestUserInventory() {
  const users = await api.internal.user.findMany({
    filter: { email: { equals: process.env.TEST_USER_EMAIL! } },
  });
  if (!users.length) return;
  const items = await api.internal.inventoryItem.findMany({
    filter: { userId: { equals: users[0].id }, soldAt: { isSet: false } },
  });
  for (const item of items) {
    await api.internal.inventoryItem.delete(item.id);
  }
}

test.describe("tenant isolation", () => {
  test.use({ storageState: AUTH_STATE_PATH });

  test.beforeEach(cleanupTestRolls);
  test.afterEach(cleanupTestRolls);

  test("inventory page does not show another user's items", async ({ page }) => {
    // Ensure test user starts with an empty inventory
    await cleanupTestUserInventory();

    // Create a second user and give them an inventory item
    const otherUser = await ensureSecondUser();
    const bundles = await api.internal.bundle.findMany({ first: 1 });
    const items = await api.internal.item.findMany({
      filter: { bundleId: { equals: bundles[0].id } },
      first: 1,
    });

    const roll = await api.internal.roll.create({
      clientSeed: `${TEST_PREFIX}-tenant-other`,
      user: { _link: otherUser.id },
      item: { _link: items[0].id },
      bundle: { _link: bundles[0].id },
      serverSeed: "test-seed-tenant",
      serverSeedHash: "test-hash-tenant",
    });
    await api.internal.inventoryItem.create({
      user: { _link: otherUser.id },
      item: { _link: items[0].id },
      roll: { _link: roll.id },
      value: 100,
    });

    // Navigate to /inventory as the test user
    await page.goto("/inventory");
    await page.waitForLoadState("networkidle");

    // Test user should see empty state — the other user's item is filtered out
    await expect(page.locator("text=No items yet")).toBeVisible({ timeout: 15_000 });

    // Confirm the item actually exists in the database (tenant filter is doing its job)
    const allInv = await api.internal.inventoryItem.findMany({
      filter: { rollId: { equals: roll.id } },
    });
    expect(allInv).toHaveLength(1);
    expect(allInv[0].user).toBe(otherUser.id);
  });

});

import { expect, test } from "@playwright/test";
import { api, TEST_PREFIX } from "./helpers/api";

const EMAIL = process.env.TEST_USER_EMAIL!;
const PASSWORD = process.env.TEST_USER_PASSWORD!;

test.describe("authentication", () => {
  test("signs in with email and password", async ({ page }) => {
    await page.goto("/sign-in");
    await page.waitForLoadState("networkidle");
    await page.fill("#email", EMAIL);
    await page.fill("#password", PASSWORD);
    await page.click('button[type="submit"]');

    // Sign-in redirects to "/" (homepage)
    await page.waitForURL("/", { timeout: 60_000 });
    await page.waitForLoadState("networkidle");

    // Authenticated user sees "Go to app" link instead of "Login"
    await expect(page.getByText("Go to app")).toBeVisible();
  });

  test("shows an error for invalid credentials", async ({ page }) => {
    await page.goto("/sign-in");
    await page.waitForLoadState("networkidle");
    await page.fill("#email", EMAIL);
    await page.fill("#password", "wrong-password-12345");
    await page.click('button[type="submit"]');

    // Should stay on sign-in page and show error
    await expect(page).toHaveURL(/\/sign-in/);
    await expect(page.locator(".text-destructive")).toBeVisible();
  });

  test("redirects unauthenticated users from /profile to sign-in", async ({ page }) => {
    await page.goto("/profile");
    // AppLayout uses SignedInOrRedirect which should redirect to /sign-in
    await expect(page).toHaveURL(/\/sign-in/, { timeout: 30_000 });
  });
});

test.describe("sign-up", () => {
  const signUpEmail = `${TEST_PREFIX}-signup@test.example.com`;

  // Clean up: delete any user created during sign-up tests
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

  test("signs up with email and password", async ({ page }) => {
    await page.goto("/sign-up");
    await page.waitForLoadState("networkidle");

    await page.fill("#email", signUpEmail);
    await page.fill("#password", "TestPassword123!");
    await page.click('button[type="submit"]');

    // Wait for the user to be created in the database
    await expect(async () => {
      const users = await api.internal.user.findMany({
        filter: { email: { equals: signUpEmail } },
      });
      expect(users).toHaveLength(1);
    }).toPass({ timeout: 15_000 });

    // Verify the user was created with an unverified email
    const users = await api.internal.user.findMany({
      filter: { email: { equals: signUpEmail } },
    });
    expect(users[0].emailVerified).toBe(false);
  });

  test("sign-up redirects to homepage signed in", async ({ page }) => {
    // Collect console errors from the start to catch permission issues during redirect
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });

    await page.goto("/sign-up");
    await page.waitForLoadState("networkidle");

    await page.fill("#email", signUpEmail);
    await page.fill("#password", "TestPassword123!");
    await page.click('button[type="submit"]');

    // Should redirect to homepage
    await page.waitForURL("/", { timeout: 60_000 });
    await page.waitForLoadState("networkidle");

    // Should be signed in — nav shows "Go to app" instead of Login/Get Started
    await expect(page.getByText("Go to app")).toBeVisible({ timeout: 15_000 });

    // No permission errors during the sign-up → redirect flow
    const permErrors = consoleErrors.filter((e) => e.includes("PERMISSION_DENIED"));
    expect(permErrors).toHaveLength(0);
  });

  test("shows error for duplicate email sign-up", async ({ page }) => {
    // Pre-create a user with the same email
    await api.internal.user.create({
      email: signUpEmail,
      password: "TestPassword123!",
      emailVerified: true,
      roles: ["signed-in"],
    });

    await page.goto("/sign-up");
    await page.waitForLoadState("networkidle");

    await page.fill("#email", signUpEmail);
    await page.fill("#password", "AnotherPassword456!");
    await page.click('button[type="submit"]');

    // Should show an error (duplicate email)
    await expect(page.locator(".text-destructive")).toBeVisible({ timeout: 15_000 });
  });
});

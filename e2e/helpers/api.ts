import { Client } from "@gadget-client/xxi";

export const TEST_PREFIX = "e2e-test";
export const TEST_USER_EMAIL = process.env.TEST_USER_EMAIL!;
export const TEST_USER_PASSWORD = process.env.TEST_USER_PASSWORD!;

export const api = new Client({
  environment: process.env.GADGET_ENVIRONMENT,
  authenticationMode: {
    apiKey: process.env.GADGET_API_KEY!,
  },
});

/** Delete all rolls (and their inventory items) whose clientSeed starts with the test prefix. */
export async function cleanupTestRolls() {
  const rolls = await api.internal.roll.findMany({
    filter: { clientSeed: { startsWith: TEST_PREFIX } },
  });
  for (const roll of rolls) {
    // Delete any inventory items linked to this roll
    const invItems = await api.internal.inventoryItem.findMany({
      filter: { rollId: { equals: roll.id } },
    });
    for (const inv of invItems) {
      await api.internal.inventoryItem.delete(inv.id);
    }
    await api.internal.roll.delete(roll.id);
  }
}

/** Ensure the e2e test user exists and can sign in. Returns the user record. */
export async function ensureTestUser() {
  const existing = await api.user.findMany({
    filter: { email: { equals: TEST_USER_EMAIL } },
    first: 1,
  });

  if (existing[0]) {
    if (!existing[0].emailVerified) {
      await api.internal.user.update(existing[0].id, { emailVerified: true });
    }
    return existing[0];
  }

  return await api.internal.user.create({
    email: TEST_USER_EMAIL,
    password: TEST_USER_PASSWORD,
    emailVerified: true,
    roles: ["signed-in"],
  });
}

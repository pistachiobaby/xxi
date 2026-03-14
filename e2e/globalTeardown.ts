import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import { Client } from "@gadget-client/xxi";

dotenv.config({ path: path.resolve(process.cwd(), ".envrc.local") });

const AUTH_STATE_PATH = path.join(process.cwd(), "e2e/.auth-state.json");

const api = new Client({
  environment: process.env.GADGET_ENVIRONMENT,
  authenticationMode: {
    apiKey: process.env.GADGET_API_KEY!,
  },
});

export default async function globalTeardown() {
  // Remove test rolls and their inventory items
  const rolls = await api.internal.roll.findMany({
    filter: { clientSeed: { startsWith: "e2e-test" } },
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

  // Remove saved auth state
  if (fs.existsSync(AUTH_STATE_PATH)) {
    fs.unlinkSync(AUTH_STATE_PATH);
  }
}

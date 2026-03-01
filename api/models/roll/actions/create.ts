import { applyParams, save, ActionOptions } from "gadget-server";
import { generateServerSeed, sha256, deriveOutcome } from "../../../lib/crypto";

/** Weighted selection using a pre-computed roll value in [0, 1). Items must be sorted by id. */
function weightedSelect(rollValue: number, items: { id: string; chance: number }[]): string {
  const total = items.reduce((sum, i) => sum + i.chance, 0);
  let roll = rollValue * total;
  for (const item of items) {
    roll -= item.chance;
    if (roll <= 0) return item.id;
  }
  return items[items.length - 1].id;
}

export const run: ActionRun = async ({ params, record, api, session, logger }) => {
  logger.info({ sessionId: session?.id, user: session?.get("user"), sessionJSON: session?.toJSON() }, "roll.create fired");
  applyParams(params, record);
  const bundleId = record.bundleId;
  if (!bundleId) throw new Error("Bundle is required");

  const clientSeed = params.clientSeed as string | undefined;
  if (!clientSeed || typeof clientSeed !== "string" || clientSeed.trim() === "") {
    throw new Error("clientSeed is required");
  }

  // Fetch seed from bundleSecret (not publicly readable)
  const secrets = await api.internal.bundleSecret.findMany({
    filter: { bundleId: { equals: bundleId } },
    select: { id: true, pendingServerSeed: true },
    first: 1,
  });
  let secret = secrets[0] ?? null;

  // Lazy-init: if no bundleSecret yet (first roll or migration), create one
  let serverSeed: string;
  let serverSeedHash: string;
  if (!secret || !secret.pendingServerSeed) {
    serverSeed = generateServerSeed();
    serverSeedHash = sha256(serverSeed);
    if (!secret) {
      secret = await api.internal.bundleSecret.create({
        bundle: { _link: bundleId },
        pendingServerSeed: serverSeed,
      });
    } else {
      await api.internal.bundleSecret.update(secret.id, { pendingServerSeed: serverSeed });
    }
    await api.internal.bundle.update(bundleId, { pendingServerSeedHash: serverSeedHash });
  } else {
    serverSeed = secret.pendingServerSeed as string;
    const bundle = await api.internal.bundle.findOne(bundleId, {
      select: { pendingServerSeedHash: true },
    });
    serverSeedHash = bundle.pendingServerSeedHash as string;
  }

  // Fetch items sorted by id for deterministic selection
  const items = await api.item.findMany({
    filter: { bundleId: { equals: bundleId } },
    select: { id: true, chance: true },
    sort: { id: "Ascending" },
  });
  if (items.length === 0) throw new Error("Bundle has no items");

  // Derive outcome from HMAC-SHA256(serverSeed, clientSeed)
  const { visualSeed, rollValue } = deriveOutcome(serverSeed, clientSeed);
  const winnerId = weightedSelect(rollValue, items as { id: string; chance: number }[]);

  // Generate next server seed for the next roll
  const nextServerSeed = generateServerSeed();
  const nextServerSeedHash = sha256(nextServerSeed);

  // Save the roll with revealed server seed
  record.serverSeed = serverSeed;
  record.clientSeed = clientSeed;
  record.serverSeedHash = serverSeedHash;
  record.item = { _link: winnerId };
  const userId = session?.get("user");
  if (userId) {
    record.user = { _link: userId };
  }
  await save(record);

  // Rotate: store next seed in bundleSecret, only hash on bundle
  await api.internal.bundleSecret.update(secret.id, {
    pendingServerSeed: nextServerSeed,
  });
  await api.internal.bundle.update(bundleId, {
    pendingServerSeedHash: nextServerSeedHash,
  });
};

export const params = {
  clientSeed: { type: "string" },
};

export const options: ActionOptions = {
  actionType: "create",
};

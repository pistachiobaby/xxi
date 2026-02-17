import { generateServerSeed, sha256 } from "../lib/crypto";

export const run: ActionRun = async ({ api, logger }) => {
  // Check if a bundle already exists to avoid duplicates
  const existing = await api.bundle.maybeFindFirst({
    select: { id: true, pendingServerSeedHash: true },
  });
  if (existing) {
    // Backfill: ensure a bundleSecret exists with a pending seed
    const secrets = await api.internal.bundleSecret.findMany({
      filter: { bundleId: { equals: existing.id } },
      select: { id: true, pendingServerSeed: true },
      first: 1,
    });
    const existingSecret = secrets[0] ?? null;
    if (!existingSecret || !existingSecret.pendingServerSeed) {
      const seed = generateServerSeed();
      if (!existingSecret) {
        await api.internal.bundleSecret.create({
          bundle: { _link: existing.id },
          pendingServerSeed: seed,
        });
      } else {
        await api.internal.bundleSecret.update(existingSecret.id, {
          pendingServerSeed: seed,
        });
      }
      await api.internal.bundle.update(existing.id, {
        pendingServerSeedHash: sha256(seed),
      });
      logger.info({ bundleId: existing.id }, "Backfilled bundleSecret with pending server seed");
    } else {
      logger.info("Starter Bundle already exists, skipping seed");
    }
    return;
  }

  const pendingServerSeed = generateServerSeed();
  const pendingServerSeedHash = sha256(pendingServerSeed);
  const bundle = await api.bundle.create({
    name: "Starter Bundle",
    pendingServerSeedHash,
  });

  // Store the actual seed in the non-readable bundleSecret model
  await api.internal.bundleSecret.create({
    bundle: { _link: bundle.id },
    pendingServerSeed,
  });

  const items = [
    // Common (chance 20 each)
    { name: "Iron Sword", rarity: "Common", color: 0x8b9dad, chance: 20 },
    { name: "Wooden Shield", rarity: "Common", color: 0x8b7355, chance: 20 },
    { name: "Health Potion", rarity: "Common", color: 0xc94040, chance: 20 },
    // Rare (chance 8 each)
    { name: "Mana Crystal", rarity: "Rare", color: 0x4a90d9, chance: 8 },
    { name: "Shadow Cloak", rarity: "Rare", color: 0x3d3d5c, chance: 8 },
    { name: "Flame Ring", rarity: "Rare", color: 0xd9534f, chance: 8 },
    // Epic (chance 4 each)
    { name: "Thunder Staff", rarity: "Epic", color: 0x9b59b6, chance: 4 },
    { name: "Dragon Scale", rarity: "Epic", color: 0x27ae60, chance: 4 },
    { name: "Void Amulet", rarity: "Epic", color: 0x2c3e50, chance: 4 },
    // Legendary (chance 1 each)
    { name: "Excalibur", rarity: "Legendary", color: 0xf1c40f, chance: 1 },
    { name: "Phoenix Wing", rarity: "Legendary", color: 0xe74c3c, chance: 1 },
    { name: "Crown of Ages", rarity: "Legendary", color: 0xf39c12, chance: 1 },
  ];

  for (const item of items) {
    await api.item.create({
      name: item.name,
      rarity: item.rarity,
      color: item.color,
      chance: item.chance,
      bundle: { _link: bundle.id },
    });
  }

  logger.info({ bundleId: bundle.id }, "Seeded Starter Bundle with 12 items");
};

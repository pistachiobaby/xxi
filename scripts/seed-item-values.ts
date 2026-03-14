import { Client } from "@gadget-client/xxi";

const api = new Client({
  environment: "development",
  authenticationMode: {
    apiKey: process.env.GADGET_API_KEY!,
  },
});

const RARITY_VALUES: Record<string, number> = {
  Common: 10,
  Rare: 50,
  Epic: 250,
  Legendary: 1000,
};

async function main() {
  const items = await api.internal.item.findMany({
    select: { id: true, rarity: true, value: true },
  });

  console.log(`Found ${items.length} items`);

  for (const item of items) {
    const rarity = item.rarity as string;
    const targetValue = RARITY_VALUES[rarity];

    if (targetValue === undefined) {
      console.log(`  Skipping item ${item.id} — unknown rarity "${rarity}"`);
      continue;
    }

    if (item.value === targetValue) {
      console.log(`  Item ${item.id} (${rarity}) already has value ${targetValue}, skipping`);
      continue;
    }

    await api.internal.item.update(item.id, { value: targetValue });
    console.log(`  Updated item ${item.id} (${rarity}): ${item.value} -> ${targetValue}`);
  }

  console.log("Done!");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

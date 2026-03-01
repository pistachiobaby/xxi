import { Client } from "@gadget-client/xxi";
import { generateServerSeed, sha256 } from "../lib/crypto";

export const params = {
  models: { type: "string" },
};

/**
 * Copies records from the Development environment into the current environment.
 *
 * Setup: Set `DEV_API_KEY` environment variable to a Development API key.
 * Usage: Call with `models` param as comma-separated model names, e.g. "bundle,item".
 *        Defaults to "bundle,item" if omitted.
 *
 * Supported models: bundle, item, roll
 * - Processes in dependency order (parents before children)
 * - Preserves record IDs so relationships stay intact
 * - Upserts: creates new records, updates existing ones
 * - Regenerates bundleSecrets with fresh server seeds (not copied from dev)
 */
export const run: GlobalActionRun = async ({ params, api, logger }) => {
  const devApiKey = process.env.DEV_API_KEY;
  if (!devApiKey) {
    throw new Error("Set the DEV_API_KEY environment variable to a Development environment API key");
  }

  const devClient = new Client({
    environment: "Development",
    authenticationMode: { apiKey: devApiKey },
  });

  const requested = new Set(
    ((params.models as string) || "bundle,item")
      .split(",")
      .map((s: string) => s.trim().toLowerCase())
  );

  // Dependency order: parents before children
  const modelOrder = ["bundle", "item", "roll"] as const;
  const results: Record<string, { created: number; updated: number; total: number }> = {};

  for (const model of modelOrder) {
    if (!requested.has(model)) continue;

    const config = MODEL_CONFIGS[model];
    const devRecords = await readAll(devClient[model], config.select);

    // Collect existing IDs in target environment to decide create vs update
    const existingIds = new Set(
      (await readAllInternal(api.internal[model])).map((r: any) => r.id)
    );

    let created = 0;
    let updated = 0;

    for (const record of devRecords) {
      const fields = config.toFields(record);

      if (existingIds.has(record.id)) {
        await api.internal[model].update(record.id, fields);
        updated++;
      } else {
        await api.internal[model].create({ id: record.id, ...fields });
        created++;
      }
    }

    results[model] = { created, updated, total: devRecords.length };
    logger.info({ model, created, updated, total: devRecords.length }, `Copied ${model}`);
  }

  // Regenerate bundleSecrets — these can't be read from dev (internal-only),
  // and production should have its own server seeds anyway for provable fairness
  if (requested.has("bundle")) {
    const bundles = await readAllInternal(api.internal.bundle);
    let regenerated = 0;

    for (const bundle of bundles) {
      const existingSecrets = await api.internal.bundleSecret.findMany({
        filter: { bundleId: { equals: bundle.id } },
        select: { id: true },
        first: 1,
      });

      const seed = generateServerSeed();
      const hash = sha256(seed);

      if (existingSecrets[0]) {
        await api.internal.bundleSecret.update(existingSecrets[0].id, {
          pendingServerSeed: seed,
        });
      } else {
        await api.internal.bundleSecret.create({
          bundle: { _link: bundle.id },
          pendingServerSeed: seed,
        });
      }

      await api.internal.bundle.update(bundle.id, { pendingServerSeedHash: hash });
      regenerated++;
    }

    results.bundleSecret = { created: regenerated, updated: 0, total: regenerated };
    logger.info({ count: regenerated }, "Regenerated bundleSecrets with fresh server seeds");
  }

  logger.info({ results }, "Copy from dev complete");
  return results;
};

/** Read all records from an external API client model with cursor pagination. */
async function readAll(clientModel: any, select: Record<string, any>) {
  let page = await clientModel.findMany({ first: 250, select });
  const records = [...page];
  while (page.hasNextPage) {
    page = await page.nextPage();
    records.push(...page);
  }
  return records;
}

/** Read all records from the internal API with pagination. */
async function readAllInternal(internalModel: any) {
  const records: any[] = [];
  let page = await internalModel.findMany({ select: { id: true }, first: 250 });
  records.push(...page);
  while (page.hasNextPage) {
    page = await page.nextPage();
    records.push(...page);
  }
  return records;
}

/** Per-model config: which fields to read from dev, and how to map them for internal API writes. */
const MODEL_CONFIGS = {
  bundle: {
    select: { id: true, name: true, pendingServerSeedHash: true },
    toFields: (r: any) => ({
      name: r.name,
      pendingServerSeedHash: r.pendingServerSeedHash,
    }),
  },
  item: {
    select: {
      id: true,
      name: true,
      rarity: true,
      color: true,
      chance: true,
      bundle: { id: true },
    },
    toFields: (r: any) => ({
      name: r.name,
      rarity: r.rarity,
      color: r.color,
      chance: r.chance,
      ...(r.bundle ? { bundle: { _link: r.bundle.id } } : {}),
    }),
  },
  roll: {
    select: {
      id: true,
      clientSeed: true,
      serverSeed: true,
      serverSeedHash: true,
      bundle: { id: true },
      item: { id: true },
    },
    toFields: (r: any) => ({
      clientSeed: r.clientSeed,
      serverSeed: r.serverSeed,
      serverSeedHash: r.serverSeedHash,
      ...(r.bundle ? { bundle: { _link: r.bundle.id } } : {}),
      ...(r.item ? { item: { _link: r.item.id } } : {}),
    }),
  },
} as const;

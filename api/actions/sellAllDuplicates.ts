import type { ActionOptions } from "gadget-server";

export const run: GlobalActionRun = async ({ params, api, logger }) => {
  const userId = params.userId as string;
  if (!userId) throw new Error("userId is required");

  // Fetch all unsold inventory items for this user
  const items = await api.internal.inventoryItem.findMany({
    filter: {
      userId: { equals: userId },
      soldAt: { isSet: false },
    },
    select: { id: true, itemId: true, value: true, createdAt: true },
  });

  // Group by itemId, keep the newest (by createdAt), sell the rest
  const groups = new Map<string, typeof items>();
  for (const inv of items) {
    const key = inv.itemId;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(inv);
  }

  let totalSold = 0;
  let totalValue = 0;

  for (const [, group] of groups) {
    if (group.length <= 1) continue;

    // Sort by createdAt descending — keep the first (newest)
    group.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    const duplicates = group.slice(1);

    for (const dup of duplicates) {
      await api.internal.inventoryItem.update(dup.id, { soldAt: new Date() });
      totalValue += dup.value ?? 0;
      totalSold++;
    }
  }

  if (totalSold > 0) {
    // Atomically credit the user's balance (concurrent-safe)
    await api.internal.user.update(userId, {
      _atomics: { balance: { increment: totalValue } },
    });

    logger.info({ userId, totalSold, totalValue }, "sold all duplicates");
  }

  return { sold: totalSold, value: totalValue };
};

export const params = {
  userId: { type: "string" },
};

export const options: ActionOptions = {
  returnType: true,
};

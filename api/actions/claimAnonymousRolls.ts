import type { ActionOptions } from "gadget-server";

export const run: GlobalActionRun = async ({ params, api, logger, session }) => {
  const { claimToken } = params;
  const userId = params.userId ?? session?.get("user");
  if (!claimToken || !userId) return { claimed: 0 };

  // Find unclaimed rolls with this token
  const rolls = await api.internal.roll.findMany({
    filter: {
      claimToken: { equals: claimToken },
      userId: { isSet: false },
    },
  });

  if (rolls.length === 0) return { claimed: 0 };

  logger.info({ claimToken, userId, count: rolls.length }, "claiming anonymous rolls");

  for (const roll of rolls) {
    // Assign roll to user
    await api.internal.roll.update(roll.id, {
      user: { _link: userId },
      claimToken: null,
    });

    // Create inventory item
    const item = await api.internal.item.findOne(roll.item, {
      select: { value: true },
    });
    await api.internal.inventoryItem.create({
      user: { _link: userId },
      item: { _link: roll.item },
      roll: { _link: roll.id },
      value: item.value ?? 0,
    });
  }

  return { claimed: rolls.length };
};

export const params = {
  claimToken: { type: "string" },
  userId: { type: "string" },
};

export const options: ActionOptions = {
  returnType: true,
};

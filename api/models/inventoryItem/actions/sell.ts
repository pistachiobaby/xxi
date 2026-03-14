import { save, ActionOptions } from "gadget-server";

export const run: ActionRun = async ({ record, api, logger }) => {
  if (record.soldAt) {
    throw new Error("Item has already been sold");
  }

  record.soldAt = new Date();
  await save(record);

  // Atomically credit the user's balance (concurrent-safe)
  await api.internal.user.update(record.userId, {
    _atomics: { balance: { increment: record.value ?? 0 } },
  });

  logger.info({ userId: record.userId, value: record.value }, "item sold");
};

export const options: ActionOptions = {
  actionType: "update",
};

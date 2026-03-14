import type { GadgetModel } from "gadget-server";

// This file describes the schema for the "roll" model, go to https://xxi.gadget.app/edit to view/edit your model in Gadget
// For more information on how to update this file http://docs.gadget.dev

export const schema: GadgetModel = {
  type: "gadget/model-schema/v2",
  storageKey: "DZzZEKsUhJ2M",
  fields: {
    bundle: {
      type: "belongsTo",
      parent: { model: "bundle" },
      storageKey: "roll-bndl-bt-01",
    },
    claimToken: { type: "string", storageKey: "roll-claim-token-01" },
    clientSeed: { type: "string", storageKey: "roll-client-seed-01" },
    item: {
      type: "belongsTo",
      parent: { model: "item" },
      storageKey: "roll-item-bt-01",
    },
    serverSeed: { type: "string", storageKey: "roll-server-seed-01" },
    serverSeedHash: {
      type: "string",
      storageKey: "roll-seed-hash-01",
    },
    user: {
      type: "belongsTo",
      parent: { model: "user" },
      storageKey: "roll-user-bt-01",
    },
  },
};

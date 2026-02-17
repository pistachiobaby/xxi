import type { GadgetModel } from "gadget-server";

// This file describes the schema for the "bundle" model, go to https://xxi.gadget.app/edit to view/edit your model in Gadget
// For more information on how to update this file http://docs.gadget.dev

export const schema: GadgetModel = {
  type: "gadget/model-schema/v2",
  storageKey: "etBNYIDJYRq9",
  fields: {
    items: {
      type: "hasMany",
      children: { model: "item", belongsToField: "bundle" },
      storageKey: "bndl-items-hm-01",
    },
    name: { type: "string", storageKey: "v_pLSlT1C3nC" },
    pendingServerSeedHash: {
      type: "string",
      storageKey: "bndl-pending-hash-01",
    },
  },
};

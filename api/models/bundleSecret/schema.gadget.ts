import type { GadgetModel } from "gadget-server";

// This file describes the schema for the "bundleSecret" model, go to https://xxi.gadget.app/edit to view/edit your model in Gadget
// For more information on how to update this file http://docs.gadget.dev

export const schema: GadgetModel = {
  type: "gadget/model-schema/v2",
  storageKey: "bundleSecret-01",
  fields: {
    bundle: {
      type: "belongsTo",
      parent: { model: "bundle" },
      storageKey: "bsec-bundle-bt-01",
    },
    pendingServerSeed: {
      type: "encryptedString",
      storageKey: "bsec-pending-seed-01::String-bsec-pending-seed-01",
    },
  },
};

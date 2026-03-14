import type { GadgetModel } from "gadget-server";

// This file describes the schema for the "inventoryItem" model, go to https://xxi.gadget.app/edit to view/edit your model in Gadget
// For more information on how to update this file http://docs.gadget.dev

export const schema: GadgetModel = {
  type: "gadget/model-schema/v2",
  storageKey: "inv-item-model-01",
  fields: {
    item: {
      type: "belongsTo",
      validations: { required: true },
      parent: { model: "item" },
      storageKey: "inv-item-bt-01",
    },
    roll: {
      type: "belongsTo",
      validations: { required: true },
      parent: { model: "roll" },
      storageKey: "inv-roll-bt-01",
    },
    soldAt: {
      type: "dateTime",
      includeTime: true,
      storageKey: "inv-sold-at-01",
    },
    user: {
      type: "belongsTo",
      validations: { required: true },
      parent: { model: "user" },
      storageKey: "inv-user-bt-01",
    },
    value: {
      type: "number",
      default: 0,
      validations: { required: true },
      storageKey: "inv-value-01",
    },
  },
};

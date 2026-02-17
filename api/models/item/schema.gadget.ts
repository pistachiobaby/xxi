import type { GadgetModel } from "gadget-server";

// This file describes the schema for the "item" model, go to https://xxi.gadget.app/edit to view/edit your model in Gadget
// For more information on how to update this file http://docs.gadget.dev

export const schema: GadgetModel = {
  type: "gadget/model-schema/v2",
  storageKey: "eqUviyXEuN2O",
  fields: {
    bundle: {
      type: "belongsTo",
      parent: { model: "bundle" },
      storageKey: "bndl-item-bt-01",
    },
    chance: { type: "number", storageKey: "M_SLlaDdPqUN" },
    color: { type: "number", storageKey: "iM_AjWHkvztH" },
    name: { type: "string", storageKey: "NcPTcEVV3Ogv" },
    rarity: {
      type: "enum",
      acceptMultipleSelections: false,
      acceptUnlistedOptions: false,
      options: ["Common", "Rare", "Epic", "Legendary"],
      storageKey: "_qVsOt-OHxBN",
    },
  },
};

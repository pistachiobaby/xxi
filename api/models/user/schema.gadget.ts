import type { GadgetModel } from "gadget-server";

// This file describes the schema for the "user" model, go to https://xxi.gadget.app/edit to view/edit your model in Gadget
// For more information on how to update this file http://docs.gadget.dev

export const schema: GadgetModel = {
  type: "gadget/model-schema/v2",
  storageKey: "DataModel-AppAuth-User",
  fields: {
    email: {
      type: "email",
      validations: { required: true, unique: true },
      storageKey: "MOzOE39rxnnb",
    },
    emailVerificationToken: {
      type: "string",
      storageKey: "SdmW6FZtXvq9",
    },
    emailVerificationTokenExpiration: {
      type: "dateTime",
      includeTime: true,
      storageKey: "79NwtAfdx8oX",
    },
    emailVerified: {
      type: "boolean",
      default: false,
      storageKey: "Enw3assgOQ9e",
    },
    firstName: { type: "string", storageKey: "UvieFGUcHv2J" },
    googleImageUrl: { type: "url", storageKey: "l3yEIxsXHVpI" },
    googleProfileId: { type: "string", storageKey: "wy2gzbeyfPC5" },
    lastName: { type: "string", storageKey: "_jz6IhP-fjcm" },
    lastSignedIn: {
      type: "dateTime",
      includeTime: true,
      storageKey: "vnX6HRWcNFR8",
    },
    password: {
      type: "password",
      validations: { strongPassword: true },
      storageKey: "j-AG3HELSgMy",
    },
    profilePicture: {
      type: "file",
      allowPublicAccess: true,
      storageKey: "3WESa9j2cR_V",
    },
    resetPasswordToken: {
      type: "string",
      storageKey: "OCV2zvp7IhVh",
    },
    resetPasswordTokenExpiration: {
      type: "dateTime",
      includeTime: true,
      storageKey: "4F3ZxkXWVRfP",
    },
    roles: {
      type: "roleList",
      default: ["unauthenticated"],
      storageKey: "1P_eB4Lx5t4v",
    },
    rolls: {
      type: "hasMany",
      children: { model: "roll", belongsToField: "user" },
      storageKey: "user-rolls-hm-01",
    },
  },
};

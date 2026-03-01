import type { GadgetPermissions } from "gadget-server";

/**
 * This metadata describes the access control configuration available in your application.
 * Grants that are not defined here are set to false by default.
 *
 * View and edit your roles and permissions in the Gadget editor at https://xxi.gadget.app/edit/settings/permissions
 */
export const permissions: GadgetPermissions = {
  type: "gadget/permissions/v1",
  roles: {
    "signed-in": {
      storageKey: "signed-in",
      default: {
        read: true,
        action: true,
      },
      models: {
        bundle: {
          read: true,
          actions: {
            create: true,
            delete: true,
            update: true,
          },
        },
        item: {
          read: true,
          actions: {
            create: true,
            delete: true,
            update: true,
          },
        },
        roll: {
          read: true,
          actions: {
            create: true,
            delete: true,
            update: true,
          },
        },
        user: {
          read: {
            filter: "accessControl/filters/user/tenant.gelly",
          },
          actions: {
            changePassword: {
              filter: "accessControl/filters/user/tenant.gelly",
            },
            signOut: {
              filter: "accessControl/filters/user/tenant.gelly",
            },
            update: {
              filter: "accessControl/filters/user/tenant.gelly",
            },
          },
        },
      },
      actions: {
        copyFromDev: true,
        seedBundle: true,
      },
    },
    unauthenticated: {
      storageKey: "unauthenticated",
      models: {
        bundle: {
          read: true,
        },
        item: {
          read: true,
        },
        roll: {
          actions: {
            create: true,
          },
        },
        user: {
          actions: {
            resetPassword: true,
            sendResetPassword: true,
            sendVerifyEmail: true,
            signIn: true,
            signUp: true,
            verifyEmail: true,
          },
        },
      },
      actions: {
        seedBundle: true,
      },
    },
  },
};

import { applyParams, save, ActionOptions } from "gadget-server";

// Powers the form in the 'sign up' page

export const run: ActionRun = async ({ params, record, logger, api, session }) => {
  // Applies new 'email' and 'password' to the user record and saves to database
  applyParams(params, record);
  record.lastSignedIn = new Date();
  record.roles = ["signed-in"];
  await save(record);
  // Sign the user in immediately
  session?.set("user", { _link: record.id });
  return {
    result: "ok"
  }
};

export const onSuccess: ActionOnSuccess = async ({ params, record, logger, api, session }) => {
  if (!record.emailVerified) {
    await api.user.sendVerifyEmail({ email: record.email });
  }
};

export const options: ActionOptions = {
  actionType: "create",
  returnType: true,
  triggers: {
    googleOAuthSignUp: true,
    emailSignUp: true,
  },
};

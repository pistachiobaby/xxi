// --------------------------------------------------------------------------------------
// Auth Layout (Logged Out Pages)
// --------------------------------------------------------------------------------------
// This file defines the layout for all authentication-related routes that are accessible to logged out users.
// Typical pages using this layout include sign in, sign up, forgot password, and other authentication tasks.
// Structure:
//   - Centered content area for auth forms and flows (via <Outlet />)
//   - Handles redirecting signed-in users to logged in routes
// To extend: update the layout or add additional context as needed for your app's auth flows.
// --------------------------------------------------------------------------------------

import { SignedOutOrRedirect } from "@gadgetinc/react";
import { Outlet } from "react-router";

export default function AuthLayout() {
  return (
    <SignedOutOrRedirect>
      <div className="w-full h-full grid place-items-center">
        <Outlet />
      </div>
    </SignedOutOrRedirect>
  );
}
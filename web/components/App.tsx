import { Provider, useUser } from "@gadgetinc/react";
import { Suspense, useEffect, useRef } from "react";
import { BrowserRouter, Outlet, Route, Routes, useNavigate } from "react-router";
import { api } from "../api";
import { clearUnclaimedRolls } from "../lib/unclaimed-rolls";
import "../app.css";
import ForgotPasswordPage from "../routes/forgot-password";
import IndexPage from "../routes/index";
import NotFoundPage from "../routes/not-found";
import ProfilePage from "../routes/profile";
import InventoryPage from "../routes/inventory";
import ResetPasswordPage from "../routes/reset-password";
import SignInPage from "../routes/sign-in";
import SignUpPage from "../routes/sign-up";
import VerifyEmailPage from "../routes/verify-email";
import PublicLayout from "./layouts/public";
import AuthLayout from "./layouts/auth";
import AppLayout from "./layouts/app";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";

const POLL_INTERVAL = 60_000;

function useVersionCheck() {
  const knownVersion = useRef<number | null>(null);

  useEffect(() => {
    let id: ReturnType<typeof setInterval>;

    async function check() {
      try {
        const res = await fetch("/api/version");
        const { version } = await res.json();
        if (knownVersion.current !== null && version !== knownVersion.current) {
          toast.info("A new version is available", {
            duration: Infinity,
            action: { label: "Refresh", onClick: () => location.reload() },
          });
          clearInterval(id);
        }
        knownVersion.current = version;
      } catch {
        // network blip — skip
      }
    }

    check();
    id = setInterval(check, POLL_INTERVAL);
    return () => clearInterval(id);
  }, []);
}

const App = () => {
  useVersionCheck();

  useEffect(() => {
    document.title = `${window.gadgetConfig.env.GADGET_APP}`;
  }, []);

  return (
    <Suspense fallback={<></>}>
      <Toaster richColors />
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route element={<PublicLayout />}>
              <Route index element={<IndexPage />} />
            </Route>
            <Route element={<AuthLayout />}>
              <Route path="forgot-password" element={<ForgotPasswordPage />} />
              <Route path="sign-in" element={<SignInPage />} />
              <Route path="sign-up" element={<SignUpPage />} />
              <Route path="reset-password" element={<ResetPasswordPage />} />
              <Route path="verify-email" element={<VerifyEmailPage />} />
            </Route>
            <Route element={<AppLayout />}>
              <Route path="profile" element={<ProfilePage />} />
              <Route path="inventory" element={<InventoryPage />} />
            </Route>
          </Route>
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </BrowserRouter>
    </Suspense>
  );
};

/**
 * Claims anonymous rolls when a user signs in.
 * Reads claimToken from localStorage and calls the server-side global action.
 * Handles all auth flows: email signIn, signUp, and Google OAuth.
 */
function ClaimAnonymousRolls() {
  const user = useUser();
  const claimed = useRef(false);

  useEffect(() => {
    if (!user?.id || claimed.current) return;
    const token = localStorage.getItem("anonClaimToken");
    if (!token) return;

    claimed.current = true;
    api
      .claimAnonymousRolls({ claimToken: token, userId: user.id })
      .then(() => {
        localStorage.removeItem("anonClaimToken");
        clearUnclaimedRolls();
      })
      .catch((err) => {
        console.error("Failed to claim anonymous rolls:", err);
        toast.error("Failed to claim your rolls", {
          description: err instanceof Error ? err.message : String(err),
        });
        claimed.current = false;
      });
  }, [user?.id]);

  return null;
}

const Layout = () => {
  const navigate = useNavigate();

  return (
    <Provider api={api} navigate={navigate} auth={window.gadgetConfig.authentication}>
      <ClaimAnonymousRolls />
      <Outlet />
    </Provider>
  );
};

export default App;
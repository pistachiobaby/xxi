import { Provider } from "@gadgetinc/react";
import { Suspense, useEffect, useRef } from "react";
import { BrowserRouter, Outlet, Route, Routes, useNavigate } from "react-router";
import { api } from "../api";
import "../app.css";
import ForgotPasswordPage from "../routes/forgot-password";
import IndexPage from "../routes/index";
import NotFoundPage from "../routes/not-found";
import ProfilePage from "../routes/profile";
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
            </Route>
          </Route>
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </BrowserRouter>
    </Suspense>
  );
};

const Layout = () => {
  const navigate = useNavigate();

  return (
    <Provider api={api} navigate={navigate} auth={window.gadgetConfig.authentication}>
      <Outlet />
    </Provider>
  );
};

export default App;
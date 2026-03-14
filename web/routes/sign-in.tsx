import { SignInComponent } from "@/components/auth/sign-in";
import { useNavigate } from "react-router";
import { api } from "../api";
import { clearUnclaimedRolls } from "../lib/unclaimed-rolls";

export default function SignInPage() {
  const navigate = useNavigate();

  const options = {
    onSuccess: async () => {
      const token = localStorage.getItem("anonClaimToken");
      if (token) {
        try {
          await api.claimAnonymousRolls({ claimToken: token });
          localStorage.removeItem("anonClaimToken");
          clearUnclaimedRolls();
        } catch (e) {
          console.error("Failed to claim rolls during sign-in:", e);
        }
      }
      navigate(window.gadgetConfig.authentication!.redirectOnSuccessfulSignInPath!);
    },
  };

  return <SignInComponent options={options} />;
}

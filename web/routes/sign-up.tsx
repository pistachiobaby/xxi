import { SignUpComponent } from "@/components/auth/sign-up";
import { useNavigate } from "react-router";
import { api } from "../api";
import { clearUnclaimedRolls } from "../lib/unclaimed-rolls";

export default function SignUpPage() {
  const navigate = useNavigate();

  const options = {
    onSuccess: async () => {
      // Claim anonymous rolls before navigating so inventory is populated on arrival.
      const token = localStorage.getItem("anonClaimToken");
      if (token) {
        try {
          await api.claimAnonymousRolls({ claimToken: token });
          localStorage.removeItem("anonClaimToken");
          clearUnclaimedRolls();
        } catch (e) {
          console.error("Failed to claim rolls during sign-up:", e);
        }
      }
      navigate(window.gadgetConfig.authentication!.redirectOnSuccessfulSignInPath!);
    },
  };

  return <SignUpComponent options={options} />;
}

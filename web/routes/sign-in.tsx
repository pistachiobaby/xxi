import { SignInComponent } from "@/components/auth/sign-in";
import { useNavigate } from "react-router";

export default function SignInPage() {
  const navigate = useNavigate();
  const options = {
    onSuccess: () => navigate(window.gadgetConfig.authentication!.redirectOnSuccessfulSignInPath!),
  };

  return <SignInComponent options={options} />;
}
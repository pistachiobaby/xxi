import { SignUpComponent } from "@/components/auth/sign-up";
import { useLocation, useNavigate } from "react-router";

export default function SignUpPage() {
  const { search } = useLocation();
  const navigate = useNavigate();

  const options = {
    onSuccess: () => navigate(window.gadgetConfig.authentication!.redirectOnSuccessfulSignInPath!),
  };

  return <SignUpComponent options={options} />;
}
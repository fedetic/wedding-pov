import { SignInForm } from "@/components/auth/SignInForm";

export const metadata = { title: "Sign in — Wedding POV" };

export default function LoginPage() {
  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <SignInForm />
    </main>
  );
}

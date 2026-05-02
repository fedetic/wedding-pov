import { RegisterForm } from "@/components/auth/RegisterForm";

export const metadata = { title: "Create account — Wedding POV" };

export default function RegisterPage() {
  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <RegisterForm />
    </main>
  );
}

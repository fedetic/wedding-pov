"use client";

import { authClient } from "@/lib/auth-client";
import { useRouter } from "next/navigation";

export function SignOutButton() {
  const router = useRouter();

  async function handleSignOut() {
    await authClient.signOut();
    router.push("/login");
  }

  return (
    <button
      onClick={handleSignOut}
      className="text-sm text-gray-500 hover:text-black underline"
    >
      Sign out
    </button>
  );
}

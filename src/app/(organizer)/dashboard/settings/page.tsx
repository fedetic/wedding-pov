import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { BiometricToggle } from "./BiometricToggle";
import { DeleteAccountButton } from "./DeleteAccountButton";

export const metadata = { title: "Settings — Wedding POV" };

export default async function SettingsPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  return (
    <main className="min-h-screen px-4 py-6 sm:p-8 max-w-2xl mx-auto">
      <Link
        href="/dashboard"
        className="text-sm font-normal text-gray-500 hover:text-black"
      >
        ← Dashboard
      </Link>
      <h1 className="text-2xl font-semibold mt-4 mb-8">Settings</h1>

      <section className="border border-gray-200 rounded-lg p-6 mb-4">
        <BiometricToggle />
      </section>

      <section className="border border-gray-200 rounded-lg p-6 mb-4">
        <h2 className="text-base font-semibold mb-2">Privacy</h2>
        <Link
          href="/privacy"
          className="text-sm text-gray-700 hover:text-black underline"
        >
          Privacy Policy
        </Link>
      </section>

      <section className="border border-red-200 rounded-lg p-6">
        <h2 className="text-base font-semibold mb-3 text-red-700">Danger zone</h2>
        <DeleteAccountButton />
      </section>
    </main>
  );
}

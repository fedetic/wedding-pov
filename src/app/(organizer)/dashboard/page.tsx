import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { googleTokens } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export const metadata = { title: "Dashboard — Wedding POV" };

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ drive?: string }>;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const params = await searchParams;
  const driveStatus = params.drive; // "connected" | "error" | undefined

  // Check if Drive is already connected
  const [tokenRow] = await db
    .select({ id: googleTokens.id })
    .from(googleTokens)
    .where(eq(googleTokens.userId, session.user.id))
    .limit(1);

  const driveConnected = !!tokenRow;

  return (
    <main className="min-h-screen p-8 max-w-2xl mx-auto">
      <h1 className="text-2xl font-semibold mb-2">
        Welcome, {session.user.name}
      </h1>
      <p className="text-sm text-gray-500 mb-8">{session.user.email}</p>

      <section className="border rounded-lg p-6 mb-6">
        <h2 className="text-lg font-medium mb-3">Google Drive</h2>

        {driveStatus === "connected" && (
          <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded p-2 mb-3">
            ✓ Drive connected successfully
          </p>
        )}

        {driveStatus === "error" && (
          <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded p-2 mb-3">
            Drive connection failed. Please try again.
          </p>
        )}

        {driveConnected ? (
          <p className="text-sm text-gray-700">
            ✓ Google Drive is connected. Photos from your events will be saved
            there.
          </p>
        ) : (
          <div>
            <p className="text-sm text-gray-600 mb-3">
              Connect your Google Drive to enable photo uploads for your events.
            </p>
            <a
              href="/api/drive/connect"
              className="inline-block bg-black text-white rounded px-4 py-2 text-sm font-medium"
            >
              Connect Google Drive
            </a>
          </div>
        )}
      </section>

      <section className="border rounded-lg p-6 bg-gray-50">
        <h2 className="text-lg font-medium mb-2">Events</h2>
        <p className="text-sm text-gray-500">
          Event management coming in Phase 2.
        </p>
      </section>
    </main>
  );
}

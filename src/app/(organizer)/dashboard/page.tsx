import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { googleTokens } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { EventList } from "@/components/events/EventList";
import { EventCreatedBanner } from "@/components/events/EventCreatedBanner";
import { SignOutButton } from "@/components/SignOutButton";
import { DisconnectDriveButton } from "@/components/DisconnectDriveButton";
import { ConnectDriveButton } from "@/components/ConnectDriveButton";

export const metadata = { title: "Dashboard — Wedding POV" };

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ drive?: string; event?: string }>;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const params = await searchParams;
  const driveStatus = params.drive; // "connected" | "error" | undefined
  const eventStatus = params.event; // "created" | undefined

  // Check if Drive is already connected
  const [tokenRow] = await db
    .select({ id: googleTokens.id })
    .from(googleTokens)
    .where(eq(googleTokens.userId, session.user.id))
    .limit(1);

  const driveConnected = !!tokenRow;

  return (
    <main className="min-h-screen px-4 py-6 sm:p-8 max-w-2xl mx-auto">
      <div className="flex justify-between items-baseline mb-2">
        <h1 className="text-2xl font-semibold">
          Welcome, {session.user.name}
        </h1>
        <SignOutButton />
      </div>
      <p className="text-sm text-gray-500 mb-8">{session.user.email}</p>

      {/* Google Drive section — unchanged from Phase 1 */}
      <section className="border border-gray-200 rounded-lg p-6 mb-6">
        <h2 className="text-lg font-semibold mb-3">Google Drive</h2>

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
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-700">
              ✓ Google Drive is connected. Photos from your events will be saved
              there.
            </p>
            <DisconnectDriveButton />
          </div>
        ) : (
          <div>
            <p className="text-sm text-gray-600 mb-3">
              Connect your Google Drive to enable photo uploads for your events.
            </p>
            <ConnectDriveButton appUrl={process.env.NEXT_PUBLIC_APP_URL!} />
          </div>
        )}
      </section>

      {/* Events section — replaces Phase 1 placeholder */}
      <section className="border border-gray-200 rounded-lg p-6 bg-white">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">Events</h2>
          <a
            href="/dashboard/events/new"
            className="text-sm font-semibold underline text-black hover:text-gray-600"
          >
            Create event
          </a>
        </div>

        {eventStatus === "created" && <EventCreatedBanner />}

        <EventList userId={session.user.id} />
      </section>
    </main>
  );
}

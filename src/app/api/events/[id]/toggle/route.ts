import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { events } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { headers } from "next/headers";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }, // Next.js 15: params is a Promise
) {
  // Auth check
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params; // must await in Next.js 15

  // Ownership check — MUST use and() with both id AND organizerId.
  // Querying by id alone is an IDOR vulnerability (any organizer could toggle any event).
  const [event] = await db
    .select({ id: events.id, isActive: events.isActive })
    .from(events)
    .where(and(eq(events.id, id), eq(events.organizerId, session.user.id)))
    .limit(1);

  if (!event) {
    // Return 404 for both "not found" and "wrong owner" — don't distinguish between them
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Flip isActive
  const [updated] = await db
    .update(events)
    .set({ isActive: !event.isActive })
    .where(eq(events.id, id))
    .returning({ isActive: events.isActive });

  return NextResponse.json({ isActive: updated.isActive });
}

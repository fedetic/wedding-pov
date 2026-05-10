import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { events } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { headers } from "next/headers";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const body = (await request.json()) as { thankYouMessage?: unknown };
  const raw = body.thankYouMessage;

  if (raw !== null && raw !== undefined && typeof raw !== "string") {
    return NextResponse.json({ error: "thankYouMessage must be a string or null." }, { status: 400 });
  }

  const thankYouMessage = typeof raw === "string" ? raw.trim() || null : null;

  if (thankYouMessage !== null && thankYouMessage.length > 500) {
    return NextResponse.json(
      { error: "Thank-you message must be 500 characters or fewer." },
      { status: 400 },
    );
  }

  // Ownership check — prevents IDOR
  const [event] = await db
    .select({ id: events.id })
    .from(events)
    .where(and(eq(events.id, id), eq(events.organizerId, session.user.id)))
    .limit(1);

  if (!event) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const [updated] = await db
    .update(events)
    .set({ thankYouMessage })
    .where(eq(events.id, id))
    .returning({ thankYouMessage: events.thankYouMessage });

  return NextResponse.json({ thankYouMessage: updated.thankYouMessage });
}

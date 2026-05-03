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

  const body = (await request.json()) as { photoLimit?: unknown };
  const photoLimit = Number(body.photoLimit);

  if (!Number.isInteger(photoLimit) || photoLimit < 1 || photoLimit > 100) {
    return NextResponse.json(
      { error: "photoLimit must be an integer between 1 and 100." },
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
    .set({ photoLimit })
    .where(eq(events.id, id))
    .returning({ photoLimit: events.photoLimit });

  return NextResponse.json({ photoLimit: updated.photoLimit });
}

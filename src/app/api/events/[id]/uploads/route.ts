import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { events, uploadRecords } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { headers } from "next/headers";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  // Ownership check
  const [event] = await db
    .select({ id: events.id })
    .from(events)
    .where(and(eq(events.id, id), eq(events.organizerId, session.user.id)))
    .limit(1);

  if (!event) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const records = await db
    .select({
      id: uploadRecords.id,
      guestNickname: uploadRecords.guestNickname,
      fileName: uploadRecords.fileName,
      fileSizeBytes: uploadRecords.fileSizeBytes,
      status: uploadRecords.status,
      initiatedAt: uploadRecords.initiatedAt,
    })
    .from(uploadRecords)
    .where(eq(uploadRecords.eventId, id))
    .orderBy(desc(uploadRecords.initiatedAt));

  return NextResponse.json({ records });
}

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { events, uploadRecords } from "@/lib/db/schema";
import { eq, and, desc, count } from "drizzle-orm";
import { headers } from "next/headers";

const PAGE_SIZE = 100;

export async function GET(
  request: NextRequest,
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

  const page = Math.max(1, Number(request.nextUrl.searchParams.get("page")) || 1);
  const offset = (page - 1) * PAGE_SIZE;

  const [{ total }] = await db
    .select({ total: count() })
    .from(uploadRecords)
    .where(eq(uploadRecords.eventId, id));

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
    .orderBy(desc(uploadRecords.initiatedAt))
    .limit(PAGE_SIZE)
    .offset(offset);

  return NextResponse.json({
    records,
    total,
    page,
    totalPages: Math.ceil(total / PAGE_SIZE),
  });
}

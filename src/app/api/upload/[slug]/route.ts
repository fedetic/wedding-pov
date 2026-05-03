import { NextRequest, NextResponse } from "next/server";
import { RateLimiterRes } from "rate-limiter-flexible";
import { uploadRateLimiter } from "@/lib/rate-limiter";
import { uploadFileToDrive } from "@/lib/drive-upload";
import { db } from "@/lib/db";
import { events, uploadRecords } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { nanoid } from "nanoid";

const MAX_FILE_BYTES = 10_000_000; // 10 MB

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  // ── 1. Resolve slug ─────────────────────────────────────────────────────────
  const { slug } = await params;

  // ── 2. Rate limiting — per IP:slug ──────────────────────────────────────────
  // Railway sets X-Forwarded-For; fall back to loopback for local dev.
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded ? forwarded.split(",")[0].trim() : "127.0.0.1";

  try {
    await uploadRateLimiter.consume(`${ip}:${slug}`, 1);
  } catch (err) {
    if (err instanceof RateLimiterRes) {
      return NextResponse.json(
        { error: "Too many uploads. Please wait before uploading more photos." },
        {
          status: 429,
          headers: {
            "Retry-After": String(Math.ceil(err.msBeforeNext / 1000)),
          },
        },
      );
    }
    // Unexpected error from rate limiter — fail open (let the request proceed)
    console.error("[upload] rate limiter error:", err);
  }

  // ── 3. Parse and validate FormData ─────────────────────────────────────────
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "Invalid form data." },
      { status: 400 },
    );
  }

  const fileEntry = form.get("file");
  const nicknameEntry = form.get("nickname");

  if (!(fileEntry instanceof File)) {
    return NextResponse.json(
      { error: "Missing or invalid file field." },
      { status: 400 },
    );
  }

  const nickname =
    typeof nicknameEntry === "string" ? nicknameEntry.trim() : "";
  if (!nickname) {
    return NextResponse.json(
      { error: "Nickname is required." },
      { status: 400 },
    );
  }

  if (fileEntry.size > MAX_FILE_BYTES) {
    return NextResponse.json(
      { error: "File is too large. Maximum size is 10 MB." },
      { status: 400 },
    );
  }

  // ── 4. Event lookup ─────────────────────────────────────────────────────────
  const [event] = await db
    .select()
    .from(events)
    .where(and(eq(events.slug, slug), eq(events.isActive, true)))
    .limit(1);

  if (!event) {
    return NextResponse.json(
      { error: "Event not found or inactive." },
      { status: 404 },
    );
  }

  if (!event.driveFolderId) {
    return NextResponse.json(
      { error: "Event not ready. Please contact the organizer." },
      { status: 503 },
    );
  }

  // ── 5. Upload to Google Drive ───────────────────────────────────────────────
  let driveFileId: string;
  let finalFileName: string;
  let finalMimeType: string;

  try {
    const result = await uploadFileToDrive({
      organizerId: event.organizerId,
      driveFolderId: event.driveFolderId,
      fileName: fileEntry.name,
      mimeType: fileEntry.type,
      buffer: await fileEntry.arrayBuffer(),
      guestNickname: nickname,
    });
    driveFileId = result.driveFileId;
    finalFileName = result.finalFileName;
    finalMimeType = result.finalMimeType;
  } catch (err) {
    console.error("[upload] Drive upload failed:", err);
    return NextResponse.json(
      { error: "Upload failed. Please try again." },
      { status: 500 },
    );
  }

  // ── 6. Persist upload record ────────────────────────────────────────────────
  try {
    await db.insert(uploadRecords).values({
      id: nanoid(),
      eventId: event.id,
      organizerId: event.organizerId,
      guestNickname: nickname,
      fileName: finalFileName,
      mimeType: finalMimeType,
      fileSizeBytes: fileEntry.size,
      driveFileId,
      status: "uploaded",
      initiatedAt: new Date(),
      confirmedAt: new Date(),
    });
  } catch (err) {
    // Log but don't fail the request — the file is already in Drive.
    console.error("[upload] Failed to insert upload record:", err);
  }

  // ── 7. Return success — never include token data ────────────────────────────
  return NextResponse.json({ driveFileId, fileName: finalFileName });
}

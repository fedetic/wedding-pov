import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { googleTokens } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function DELETE() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await db.delete(googleTokens).where(eq(googleTokens.userId, session.user.id));

  return NextResponse.json({ ok: true });
}

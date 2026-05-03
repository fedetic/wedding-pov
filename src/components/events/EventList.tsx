import { db } from "@/lib/db";
import { events } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { EventListClient } from "./EventListClient";

type Props = { userId: string };

export async function EventList({ userId }: Props) {
  const rows = await db
    .select({
      id: events.id,
      name: events.name,
      slug: events.slug,
      photoLimit: events.photoLimit,
      isActive: events.isActive,
      createdAt: events.createdAt,
      driveFolderId: events.driveFolderId,
    })
    .from(events)
    .where(eq(events.organizerId, userId))
    .orderBy(events.createdAt);

  return <EventListClient initialEvents={rows} />;
}

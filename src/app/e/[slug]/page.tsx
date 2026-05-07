import { db } from '@/lib/db';
import { events } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { GuestUploadClient } from '@/components/guest/GuestUploadClient';

export const dynamic = 'force-dynamic';

function EventNotFound() {
  return (
    <main
      style={{ backgroundColor: '#faf9f7', minHeight: '100vh' }}
      className="flex items-center justify-center px-4"
    >
      <div className="bg-white rounded-2xl shadow p-8 max-w-md w-full text-center">
        <h1 className="text-3xl font-semibold text-[#1a1a1a] mb-4">Event not found</h1>
        <p className="text-base text-[#6b7280]">
          This link is not recognised. The event may have been removed — ask the organiser for help.
        </p>
      </div>
    </main>
  );
}

function EventInactive({ eventName }: { eventName: string }) {
  return (
    <main
      style={{ backgroundColor: '#faf9f7', minHeight: '100vh' }}
      className="flex items-center justify-center px-4"
    >
      <div className="bg-white rounded-2xl shadow p-8 max-w-md w-full text-center">
        <h1 className="text-3xl font-semibold text-[#1a1a1a] mb-4">
          {eventName} is no longer accepting photos
        </h1>
        <p className="text-base text-[#6b7280]">
          This event has been closed by the organiser.
        </p>
      </div>
    </main>
  );
}

export default async function GuestUploadPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const [event] = await db
    .select()
    .from(events)
    .where(eq(events.slug, slug))
    .limit(1);

  if (!event) {
    return <EventNotFound />;
  }

  if (!event.isActive) {
    return <EventInactive eventName={event.name} />;
  }

  return (
    <main style={{ backgroundColor: '#faf9f7', minHeight: '100vh' }}>
      <GuestUploadClient
        eventSlug={event.slug}
        eventName={event.name}
        photoLimit={event.photoLimit}
      />
    </main>
  );
}

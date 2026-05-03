import { CreateEventForm } from "@/components/events/CreateEventForm";

export const metadata = { title: "Create event — Wedding POV" };

export default function NewEventPage() {
  return (
    <main className="min-h-screen p-8 max-w-2xl mx-auto">
      <a
        href="/dashboard"
        className="text-sm text-gray-600 underline mb-8 inline-block hover:text-black"
      >
        ← Back to dashboard
      </a>

      <h1 className="text-2xl font-semibold mb-6">Create event</h1>

      <CreateEventForm />
    </main>
  );
}

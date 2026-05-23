import Link from "next/link";

export const metadata = { title: "Privacy Policy — Wedding POV" };

export default function PrivacyPage() {
  return (
    <main className="min-h-screen px-4 py-6 sm:p-8 max-w-2xl mx-auto">
      <Link href="/" className="text-sm font-normal text-gray-500 hover:text-black">
        ← Home
      </Link>
      <h1 className="text-2xl font-semibold mt-4 mb-8">Privacy Policy</h1>
      <p className="text-sm text-gray-500 mb-6">Last updated: 2026-05-23</p>

      <section className="mb-6">
        <h2 className="text-lg font-semibold mb-2">What we collect</h2>
        <ul className="list-disc pl-5 text-sm text-gray-700 space-y-1">
          <li>Organizer email address and name (collected at Better Auth registration).</li>
          <li>Photos uploaded by event guests, along with the guest-entered nickname.</li>
        </ul>
      </section>

      <section className="mb-6">
        <h2 className="text-lg font-semibold mb-2">How we store it</h2>
        <p className="text-sm text-gray-700 leading-relaxed">
          Organizer accounts are stored in Neon Postgres (US-East). Photos are saved to
          the organizer&apos;s own Google Drive folder via OAuth (drive.file scope — we can only
          access folders this app creates). Drive refresh tokens are encrypted with AES-256-GCM at rest.
        </p>
      </section>

      <section className="mb-6">
        <h2 className="text-lg font-semibold mb-2">What we share</h2>
        <p className="text-sm text-gray-700 leading-relaxed">
          Nothing. We do not use third-party analytics, advertising, or data brokers. We do not sell
          data. Photos remain in the organizer&apos;s Google Drive.
        </p>
      </section>

      <section className="mb-6">
        <h2 className="text-lg font-semibold mb-2">Google Drive scope</h2>
        <p className="text-sm text-gray-700 leading-relaxed">
          We request only the{" "}
          <code className="text-xs bg-gray-100 px-1 rounded">
            https://www.googleapis.com/auth/drive.file
          </code>{" "}
          scope. Our app cannot see any pre-existing Drive content; it can only access files
          and folders that this app itself creates.
        </p>
      </section>

      <section className="mb-6">
        <h2 className="text-lg font-semibold mb-2">Account deletion</h2>
        <p className="text-sm text-gray-700 leading-relaxed">
          Tap <strong>Delete Account</strong> in Settings to permanently delete your account,
          Drive credentials, events, and upload records. The deletion is immediate and
          irreversible. Photos already saved to your Google Drive remain in your Drive — we
          cannot delete them after your account credentials are removed.
        </p>
      </section>

      <section className="mb-6">
        <h2 className="text-lg font-semibold mb-2">Children</h2>
        <p className="text-sm text-gray-700 leading-relaxed">
          This service is intended for organizers aged 18 or older who are planning
          weddings or events. We do not knowingly collect personal information from
          children under 13.
        </p>
      </section>

      <section className="mb-6">
        <h2 className="text-lg font-semibold mb-2">Contact</h2>
        <p className="text-sm text-gray-700 leading-relaxed">
          Questions about this privacy policy? Email:{" "}
          <a
            href="mailto:jouyisun@gmail.com"
            className="underline hover:text-black"
          >
            jouyisun@gmail.com
          </a>
        </p>
      </section>
    </main>
  );
}

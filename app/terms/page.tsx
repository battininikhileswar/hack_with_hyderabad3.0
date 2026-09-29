import Link from 'next/link';

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-[#e6dfd3] text-[#2a2622] flex flex-col font-sans">
      <header className="px-6 py-5 max-w-4xl w-full mx-auto flex items-center justify-between">
        <Link href="/" className="font-heading font-semibold text-lg text-[#2a2622]">
          Meeting Prep Agent
        </Link>
        <Link
          href="/"
          className="px-4 py-1.5 text-xs font-medium clay-btn-secondary"
        >
          Back to Home
        </Link>
      </header>

      <main className="flex-1 max-w-3xl w-full mx-auto px-6 py-10">
        <div className="clay-card p-8 sm:p-10 space-y-6">
          <h1 className="font-heading text-2xl font-bold text-[#2a2622]">
            Terms of Demonstration
          </h1>

          <div className="space-y-4 text-sm leading-relaxed text-[#443e37]">
            <p>
              Meeting Prep Agent is an interactive prototype demonstrating persistent relationship memory using Hindsight and Groq.
            </p>

            <h2 className="font-heading text-base font-semibold text-[#2a2622] pt-2">
              1. Demo Application Status
            </h2>
            <p>
              This service is provided strictly as a technology evaluation demonstration. All company names, personal profiles, meeting notes, and relationship details shown are synthetic seed data created for testing purposes.
            </p>

            <h2 className="font-heading text-base font-semibold text-[#2a2622] pt-2">
              2. No Commercial Warranty
            </h2>
            <p>
              The system is provided on an as-is basis without warranties of any kind. It is intended to showcase memory ingestion, temporal indexing, and pre-meeting synthesis.
            </p>

            <h2 className="font-heading text-base font-semibold text-[#2a2622] pt-2">
              3. Acceptable Use
            </h2>
            <p>
              Do not enter sensitive production credentials, confidential customer records, or proprietary trade secrets into the demo interface.
            </p>
          </div>

          <div className="pt-4 border-t border-[#d8d0c2] flex items-center justify-between text-xs text-[#6e665d]">
            <span>Last revised: September 2026</span>
            <Link href="/app" className="text-[#b8623f] font-semibold hover:underline">
              Go to Demo Application
            </Link>
          </div>
        </div>
      </main>

      <footer className="py-6 text-center text-xs text-[#7d756b]">
        Demo application prototype. Powered by Hindsight memory and Groq inference.
      </footer>
    </div>
  );
}

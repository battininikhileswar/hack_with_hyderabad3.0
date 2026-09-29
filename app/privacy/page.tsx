import Link from 'next/link';

export default function PrivacyPage() {
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
            Privacy and Data Handling Notice
          </h1>

          <div className="space-y-4 text-sm leading-relaxed text-[#443e37]">
            <p>
              This document clarifies how data is processed in the Meeting Prep Agent evaluation environment.
            </p>

            <h2 className="font-heading text-base font-semibold text-[#2a2622] pt-2">
              1. Local and Demo Session Data
            </h2>
            <p>
              Authentication for this demo operates via client-side session cookies. No passwords or authentication credentials are stored on an external identity provider or authentication server.
            </p>

            <h2 className="font-heading text-base font-semibold text-[#2a2622] pt-2">
              2. Memory Bank Processing
            </h2>
            <p>
              Meeting notes and contact profiles logged through the application interface are indexed within the designated Hindsight bank instance to support semantic memory recall. Do not submit personally identifiable information (PII) or confidential business records.
            </p>

            <h2 className="font-heading text-base font-semibold text-[#2a2622] pt-2">
              3. LLM Inference
            </h2>
            <p>
              Pre-meeting briefings are synthesized using Groq model inference. Recalled memory fragments are transmitted as prompt context for briefing construction.
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

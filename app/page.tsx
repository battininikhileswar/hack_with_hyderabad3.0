import React from 'react';
import Link from 'next/link';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#e6dfd3] text-[#2a2622] flex flex-col font-sans">
      {/* 1. Header */}
      <header className="sticky top-0 z-30 bg-[#e6dfd3]/90 backdrop-blur-sm border-b border-[#ded7ca] px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="w-3.5 h-3.5 bg-[#b8623f] rounded-full inline-block" />
            <span className="font-heading font-bold text-lg tracking-tight text-[#2a2622]">
              Meeting Prep Agent
            </span>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/overview"
              className="px-4 py-2 text-xs font-semibold clay-btn-secondary"
            >
              Portfolio Overview
            </Link>
            <Link
              href="/app"
              className="px-4 py-2 text-xs font-semibold clay-btn-secondary"
            >
              Workspace
            </Link>
            <Link
              href="/login"
              className="px-4 py-2 text-xs font-semibold clay-btn-primary"
            >
              Sign In
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-6xl mx-auto w-full px-6 py-10 space-y-16">
        {/* 2. Hero Section */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center pt-4">
          <div className="lg:col-span-6 space-y-5">
            <div className="inline-block px-3 py-1 text-xs font-medium bg-[#dfe7e1] text-[#436b4d] rounded-[16px] border border-[#bcd4c0]">
              Persistent Relationship Memory
            </div>

            <h1 className="font-heading text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-[#2a2622] leading-tight">
              Walk into every meeting knowing the full relationship history.
            </h1>

            <p className="text-sm sm:text-base text-[#524a41] leading-relaxed">
              Meeting Prep Agent surfaces past commitments, unresolved objections, and shifting sentiment from previous discussions so you never miss a promise.
            </p>

            <div className="pt-2 flex items-center gap-4 flex-wrap">
              <Link
                href="/app?demo=true"
                className="px-6 py-3 text-sm font-semibold clay-btn-primary"
              >
                Open the demo
              </Link>
              <Link
                href="/overview"
                className="px-5 py-3 text-sm font-medium clay-btn-secondary"
              >
                Portfolio Risk Overview
              </Link>
            </div>
          </div>

          <div className="lg:col-span-6">
            <div className="clay-card p-3 sm:p-4 rounded-[28px] overflow-hidden">
              <div className="flex items-center justify-between pb-2 px-2 border-b border-[#ded7ca] text-xs text-[#6e665d]">
                <span className="font-medium">Elena Rostova: With-Memory Briefing</span>
                <span className="font-mono text-[10px] text-[#436b4d] font-semibold">Indexed from 7 past meetings</span>
              </div>
              <div className="mt-2 rounded-[20px] overflow-hidden border border-[#d8d0c2] bg-[#f5f1ea]">
                <img
                  src="/elena-briefing.png"
                  alt="Elena Rostova Meeting Briefing in Meeting Prep Agent"
                  className="w-full h-auto object-cover"
                />
              </div>
            </div>
          </div>
        </section>

        {/* 3. Same meeting, two briefings comparison */}
        <section className="space-y-6">
          <div className="text-center max-w-2xl mx-auto space-y-2">
            <h2 className="font-heading text-2xl sm:text-3xl font-bold text-[#2a2622]">
              Same meeting, two briefings
            </h2>
            <p className="text-xs sm:text-sm text-[#524a41]">
              Comparing the actual generated output for Elena Rostova (VP of Engineering at FinScale Corp) with and without long-term relationship memory.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Without Memory Card */}
            <div className="clay-card p-6 rounded-[24px] space-y-4">
              <div className="flex items-center justify-between border-b border-[#ded7ca] pb-3">
                <div>
                  <span className="font-heading text-xs font-bold uppercase tracking-wider text-[#7d756b] block">
                    Without Memory (Cold Baseline)
                  </span>
                  <span className="text-[11px] text-[#6e665d]">
                    Zero past notes or historical commitments available
                  </span>
                </div>
                <span className="px-2.5 py-0.5 text-[11px] font-medium clay-btn-secondary">
                  memory disabled
                </span>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <span className="font-bold text-[10px] text-[#7d756b] uppercase block mb-0.5">
                    Executive Summary
                  </span>
                  <p className="text-[#443e37] leading-relaxed">
                    Elena Rostova is VP of Engineering at FinScale Corp. The meeting will focus on a general relationship check-in and next steps.
                  </p>
                </div>

                <div className="p-2.5 clay-inset rounded-[18px]">
                  <span className="font-bold text-[10px] text-[#7d756b] uppercase block">
                    Relationship Status
                  </span>
                  <span className="font-semibold text-[#5c5750]">
                    UNKNOWN (MEMORY DISABLED)
                  </span>
                </div>

                <div>
                  <span className="font-bold text-[10px] text-[#7d756b] uppercase block mb-1">
                    Commitments and Promises (0 tracked)
                  </span>
                  <div className="p-2.5 text-xs text-[#7d756b] italic clay-inset rounded-[18px]">
                    No prior commitments on record (memory disabled)
                  </div>
                </div>

                <div>
                  <span className="font-bold text-[10px] text-[#7d756b] uppercase block mb-1">
                    Unresolved Questions (0 tracked)
                  </span>
                  <div className="p-2.5 text-xs text-[#7d756b] italic clay-inset rounded-[18px]">
                    No prior unresolved questions on record (memory disabled)
                  </div>
                </div>

                <div className="p-3 clay-inset rounded-[18px] text-[11px] text-[#7d756b] leading-relaxed">
                  Blind spot: Completely unaware that FinScale froze the pilot, that our team missed the Datadog proxy delivery date, and that Elena is evaluating Confluent as an alternative.
                </div>
              </div>
            </div>

            {/* With Memory Card */}
            <div className="clay-card p-6 rounded-[24px] space-y-4">
              <div className="flex items-center justify-between border-b border-[#ded7ca] pb-3">
                <div>
                  <span className="font-heading text-xs font-bold uppercase tracking-wider text-[#b8623f] block">
                    With Hindsight Memory
                  </span>
                  <span className="text-[11px] text-[#6e665d]">
                    Indexed from 7 past meetings across 3 months
                  </span>
                </div>
                <span className="px-2.5 py-0.5 text-[11px] font-medium bg-[#ede2df] text-[#8f3e3e] border border-[#deb8b8] rounded-[16px]">
                  at_risk
                </span>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <span className="font-bold text-[10px] text-[#7d756b] uppercase block mb-0.5">
                    Executive Summary
                  </span>
                  <p className="text-[#2a2622] leading-relaxed">
                    The relationship has deteriorated due to missed technical milestones and legal redlines, leading FinScale to threaten contract termination and a switch to Confluent.
                  </p>
                </div>

                <div className="p-2.5 clay-inset rounded-[18px] flex items-center justify-between">
                  <div>
                    <span className="font-bold text-[10px] text-[#7d756b] uppercase block">
                      Relationship Status
                    </span>
                    <span className="font-semibold text-[#8f3e3e]">
                      AT_RISK (Trust level: low)
                    </span>
                  </div>
                  <span className="text-[11px] text-[#6e665d]">
                    Sentiment decline over 3 months
                  </span>
                </div>

                <div>
                  <span className="font-bold text-[10px] text-[#7d756b] uppercase block mb-1">
                    Commitments and Promises (10 tracked)
                  </span>
                  <div className="space-y-1.5">
                    <div className="p-2.5 clay-card-flat rounded-[16px] flex flex-col gap-0.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[#2a2622] font-medium">Milestone deliverables on schedule</span>
                        <span className="px-2 py-0.5 text-[10px] font-bold text-[#8f3e3e] bg-[#ede2df] border border-[#deb8b8] rounded-[12px]">
                          BROKEN
                        </span>
                      </div>
                      <span className="text-[10px] text-[#b8623f] font-medium">Source: Sep 4 meeting</span>
                    </div>

                    <div className="p-2.5 clay-card-flat rounded-[16px] flex flex-col gap-0.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[#2a2622] font-medium">Dedicated AWS VPC peering architecture</span>
                        <span className="px-2 py-0.5 text-[10px] font-bold text-[#436b4d] bg-[#dfe7e1] border border-[#bcd4c0] rounded-[12px]">
                          KEPT
                        </span>
                      </div>
                      <span className="text-[10px] text-[#b8623f] font-medium">Source: Aug 14 meeting</span>
                    </div>
                  </div>
                </div>

                <div>
                  <span className="font-bold text-[10px] text-[#7d756b] uppercase block mb-1">
                    Unresolved Objections (5 open)
                  </span>
                  <div className="p-2.5 clay-card-flat rounded-[16px]">
                    <span className="font-medium text-[#2a2622]">
                      Direct Datadog stream vs custom proxy architecture
                    </span>
                    <p className="text-[11px] text-[#6e665d] mt-0.5">
                      Suggested response: Offer staging proxy delivery by Friday with engineering lead attendance.
                    </p>
                    <span className="text-[10px] text-[#b8623f] font-medium block mt-1">Source: Aug 21 meeting</span>
                  </div>
                </div>

                <div className="p-3 bg-[#dfe7e1]/70 border border-[#bcd4c0] rounded-[18px] text-[11px] text-[#2c4e35] leading-relaxed">
                  Strategic advantage: Focuses the entire meeting on de-escalation, addressing liability redlines directly, and securing a 30-day grace period for the pilot.
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 4. How it works (2x2 layout, not 3 cards) */}
        <section className="space-y-6">
          <div className="text-center max-w-2xl mx-auto space-y-2">
            <h2 className="font-heading text-2xl sm:text-3xl font-bold text-[#2a2622]">
              How it works
            </h2>
            <p className="text-xs sm:text-sm text-[#524a41]">
              A continuous memory loop that transforms past meeting notes into actionable pre-meeting strategy.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Step 1 */}
            <div className="clay-card p-6 rounded-[24px] space-y-3">
              <div className="flex items-center gap-3">
                <span className="w-7 h-7 rounded-full bg-[#b8623f] text-white flex items-center justify-center font-bold text-xs">
                  1
                </span>
                <h3 className="font-heading text-base font-semibold text-[#2a2622]">
                  Log meeting discussions
                </h3>
              </div>
              <p className="text-xs text-[#524a41] leading-relaxed">
                Log key discussion points, promises made by both parties, open questions, and meeting tone after each conversation.
              </p>
            </div>

            {/* Step 2 */}
            <div className="clay-card p-6 rounded-[24px] space-y-3">
              <div className="flex items-center gap-3">
                <span className="w-7 h-7 rounded-full bg-[#b8623f] text-white flex items-center justify-center font-bold text-xs">
                  2
                </span>
                <h3 className="font-heading text-base font-semibold text-[#2a2622]">
                  Hindsight retains memory
                </h3>
              </div>
              <p className="text-xs text-[#524a41] leading-relaxed">
                Hindsight ingests each note, extracting entities, temporal anchors, and commitments into persistent vector bank memory.
              </p>
            </div>

            {/* Step 3 */}
            <div className="clay-card p-6 rounded-[24px] space-y-3">
              <div className="flex items-center gap-3">
                <span className="w-7 h-7 rounded-full bg-[#b8623f] text-white flex items-center justify-center font-bold text-xs">
                  3
                </span>
                <h3 className="font-heading text-base font-semibold text-[#2a2622]">
                  Recall before the next meeting
                </h3>
              </div>
              <p className="text-xs text-[#524a41] leading-relaxed">
                When an upcoming conversation is scheduled, multi-arm semantic queries retrieve every relevant past promise, objection, and milestone.
              </p>
            </div>

            {/* Step 4 */}
            <div className="clay-card p-6 rounded-[24px] space-y-3">
              <div className="flex items-center gap-3">
                <span className="w-7 h-7 rounded-full bg-[#b8623f] text-white flex items-center justify-center font-bold text-xs">
                  4
                </span>
                <h3 className="font-heading text-base font-semibold text-[#2a2622]">
                  Actionable briefing generated
                </h3>
              </div>
              <p className="text-xs text-[#524a41] leading-relaxed">
                Groq synthesizes the recalled memory into relationship health status, broken promise alerts, sensitivities, and recommended agenda.
              </p>
            </div>
          </div>
        </section>

        {/* 5. Memory powered by Hindsight */}
        <section className="clay-card p-6 rounded-[24px] text-center space-y-3">
          <p className="text-xs sm:text-sm text-[#443e37]">
            Persistent entity and relationship memory is powered by{' '}
            <a
              href="https://github.com/vectorize-io/hindsight"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-[#b8623f] underline hover:text-[#9e5032]"
            >
              Hindsight
            </a>
            , providing semantic and temporal recall for conversational agents.
          </p>
          <div>
            <Link
              href="/app?demo=true"
              className="inline-block px-5 py-2 text-xs font-semibold clay-btn-primary"
            >
              Explore the Interactive Demo
            </Link>
          </div>
        </section>
      </main>

      {/* 6. Footer */}
      <footer className="border-t border-[#ded7ca] bg-[#e6dfd3] py-8 px-6 text-xs text-[#7d756b]">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <span className="font-heading font-semibold text-[#2a2622]">
              Meeting Prep Agent
            </span>
            <span className="ml-2 text-[#7d756b]">
              Interactive demonstration prototype.
            </span>
          </div>

          <div className="flex items-center gap-6">
            <Link href="/terms" className="hover:text-[#2a2622] transition">
              Terms of Demonstration
            </Link>
            <Link href="/privacy" className="hover:text-[#2a2622] transition">
              Privacy Notice
            </Link>
            <Link href="/login" className="hover:text-[#2a2622] transition font-medium text-[#b8623f]">
              Demo Sign In
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

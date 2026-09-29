'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PortfolioRiskSummary, ContactRiskOverview, BrokenPromiseDetail } from '@/types';

export default function PortfolioOverviewPage() {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [overviewData, setOverviewData] = useState<PortfolioRiskSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'at_risk' | 'neutral' | 'expanding'>('all');
  const [expandedContactId, setExpandedContactId] = useState<string | null>(null);

  // Authentication check
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const hasCookie = document.cookie.includes('demo_session=1');
      const hasLocal = localStorage.getItem('demo_session') === 'true';
      const hasParam = window.location.search.includes('demo=true');
      if (hasParam) {
        document.cookie = 'demo_session=1; path=/; max-age=604800';
        localStorage.setItem('demo_session', 'true');
        setIsAuthenticated(true);
      } else if (!hasCookie && !hasLocal) {
        router.push('/login');
      } else {
        setIsAuthenticated(true);
      }

      const params = new URLSearchParams(window.location.search);
      const expandedParam = params.get('expanded');
      if (expandedParam) {
        setExpandedContactId(expandedParam);
      }
    }
  }, [router]);

  // Load overview data
  useEffect(() => {
    if (isAuthenticated) {
      fetchOverviewData();
    }
  }, [isAuthenticated]);

  const fetchOverviewData = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/overview');
      const data = await res.json();
      if (data && data.contacts) {
        setOverviewData(data);
      }
    } catch (err) {
      console.error('Failed to load portfolio overview:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignOut = () => {
    document.cookie = 'demo_session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    localStorage.removeItem('demo_session');
    localStorage.removeItem('demo_user_email');
    localStorage.removeItem('demo_user_name');
    router.push('/login');
  };

  const handleOpenContactBriefing = (contactId: string) => {
    router.push(`/app?contact=${contactId}&tab=briefing`);
  };

  const toggleExpand = (e: React.MouseEvent, contactId: string) => {
    e.stopPropagation();
    setExpandedContactId((prev) => (prev === contactId ? null : contactId));
  };

  // Filter contacts
  const contacts = overviewData?.contacts || [];
  const filteredContacts = contacts.filter((c) => {
    const matchesQuery =
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.company.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.role.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.nextRecommendedAction.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus =
      statusFilter === 'all' ? true : c.relationshipStatus === statusFilter;

    return matchesQuery && matchesStatus;
  });

  const getRiskBadge = (level: 'critical' | 'high' | 'moderate' | 'low', rank: number) => {
    switch (level) {
      case 'critical':
        return (
          <span className="px-2.5 py-1 text-xs font-bold uppercase rounded-[12px] bg-[#ede2df] text-[#8f3e3e] border border-[#deb8b8]">
            Rank #{rank} Critical Risk
          </span>
        );
      case 'high':
        return (
          <span className="px-2.5 py-1 text-xs font-bold uppercase rounded-[12px] bg-[#f2e6dc] text-[#a45431] border border-[#e3bfad]">
            Rank #{rank} High Risk
          </span>
        );
      case 'moderate':
        return (
          <span className="px-2.5 py-1 text-xs font-bold uppercase rounded-[12px] bg-[#e4ded4] text-[#3d3731] border border-[#d5d4ce]">
            Rank #{rank} Moderate Risk
          </span>
        );
      case 'low':
        return (
          <span className="px-2.5 py-1 text-xs font-bold uppercase rounded-[12px] bg-[#dfe7e1] text-[#436b4d] border border-[#bcd4c0]">
            Rank #{rank} Low Risk
          </span>
        );
    }
  };

  const getStatusBadge = (status: 'at_risk' | 'neutral' | 'expanding') => {
    switch (status) {
      case 'at_risk':
        return (
          <span className="px-2.5 py-1 text-xs font-semibold uppercase rounded-[12px] bg-[#ede2df] text-[#8f3e3e] border border-[#deb8b8]">
            At Risk
          </span>
        );
      case 'neutral':
        return (
          <span className="px-2.5 py-1 text-xs font-semibold uppercase rounded-[12px] bg-[#e4ded4] text-[#3d3731] border border-[#d5d4ce]">
            Neutral
          </span>
        );
      case 'expanding':
        return (
          <span className="px-2.5 py-1 text-xs font-semibold uppercase rounded-[12px] bg-[#dfe7e1] text-[#436b4d] border border-[#bcd4c0]">
            Expanding
          </span>
        );
    }
  };

  if (isAuthenticated === null || isLoading) {
    return (
      <div className="min-h-screen bg-[#e6dfd3] flex items-center justify-center font-sans text-xs text-[#3d3731]">
        Loading portfolio risk overview...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#e6dfd3] text-[#2a2622] flex flex-col font-sans">
      {/* 1. Header */}
      <header className="sticky top-0 z-30 bg-[#e6dfd3]/95 backdrop-blur-sm border-b border-[#ded7ca] px-4 sm:px-6 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2">
              <span className="w-3.5 h-3.5 bg-[#b8623f] rounded-full inline-block" />
              <h1 className="font-heading text-base font-semibold tracking-tight text-[#2a2622]">
                Meeting Prep Agent
              </h1>
            </Link>
            <span className="px-2.5 py-1 text-xs font-medium bg-[#dfe7e1] text-[#436b4d] rounded-[16px] border border-[#bcd4c0]">
              Portfolio Risk Overview
            </span>
          </div>

          <div className="flex items-center gap-3">
            {/* System Status Indicators */}
            <div className="hidden md:flex items-center gap-3 px-3 py-1.5 bg-[#e8e2d5] border border-[#ded7ca] text-xs rounded-[20px]">
              <div className="flex items-center gap-1.5">
                <span className="text-[#3d3731] font-medium">Bank:</span>
                <span className="font-mono text-[#2a2622] font-semibold">nikhil</span>
              </div>
              <span className="text-[#d0c6b6]">|</span>
              <div className="flex items-center gap-1.5">
                <span className="text-[#3d3731] font-medium">Memory:</span>
                <span className="font-mono text-[#436b4d] font-semibold">Hindsight Active</span>
              </div>
            </div>

            <Link
              href="/app"
              className="px-3.5 py-1.5 text-xs font-semibold clay-btn-primary"
            >
              Open Workspace
            </Link>

            <button
              onClick={handleSignOut}
              className="px-3 py-1.5 text-xs font-medium clay-btn-secondary text-[#8f3e3e]"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      {/* 2. Main Container */}
      <main className="max-w-7xl mx-auto w-full px-4 sm:px-6 py-8 flex-1 space-y-8">
        {/* Title and Strategic Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-2 border-b border-[#ded7ca]">
          <div className="space-y-1">
            <div className="inline-block px-3 py-1 text-xs font-medium bg-[#dfe7e1] text-[#436b4d] rounded-[16px] border border-[#bcd4c0]">
              Executive Intelligence Dashboard
            </div>
            <h2 className="font-heading text-2xl sm:text-3xl font-bold tracking-tight text-[#2a2622]">
              Stakeholder Portfolio Ranked by Risk
            </h2>
            <p className="text-xs sm:text-sm text-[#3d3731] max-w-3xl">
              All 4 active stakeholder accounts ranked by operational friction, broken promises, and legal exposure. Every metric and recommended action is synthesized directly from persistent Hindsight memory banks.
            </p>
          </div>

          <div className="text-right shrink-0">
            <span className="text-xs text-[#3d3731] block">Memory Source</span>
            <span className="text-xs font-mono font-semibold text-[#2a2622]">
              Hindsight Bank: nikhil (275 facts total)
            </span>
          </div>
        </div>

        {/* 3. Executive Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="clay-card p-4 rounded-[22px] flex flex-col justify-between">
            <span className="text-xs font-bold text-[#3d3731] uppercase tracking-wider block">
              Monitored Accounts
            </span>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="font-heading text-3xl font-bold text-[#2a2622]">
                {overviewData?.totalContacts || 4}
              </span>
              <span className="text-xs text-[#3d3731] font-medium">Key Stakeholders</span>
            </div>
            <p className="text-xs text-[#3d3731] mt-1">
              Active engineering, product, and sales leaders
            </p>
          </div>

          <div className="clay-card p-4 rounded-[22px] flex flex-col justify-between border-l-4 border-l-[#8f3e3e]">
            <span className="text-xs font-bold text-[#8f3e3e] uppercase tracking-wider block">
              At-Risk Relationships
            </span>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="font-heading text-3xl font-bold text-[#8f3e3e]">
                {overviewData?.criticalRiskCount || 2}
              </span>
              <span className="text-xs font-semibold text-[#8f3e3e]">FinScale & Orbit</span>
            </div>
            <p className="text-xs text-[#3d3731] mt-1">
              Rank #1 Elena Rostova, Rank #2 Amara Chen
            </p>
          </div>

          <div className="clay-card p-4 rounded-[22px] flex flex-col justify-between">
            <span className="text-xs font-bold text-[#3d3731] uppercase tracking-wider block">
              Broken Commitments
            </span>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="font-heading text-3xl font-bold text-[#2a2622]">
                {overviewData?.totalBrokenPromises || 5}
              </span>
              <span className="text-xs text-[#3d3731] font-semibold">Tracked in Memory</span>
            </div>
            <p className="text-xs text-[#3d3731] mt-1">
              3 FinScale delays, 2 Orbit mobile slips
            </p>
          </div>

          <div className="clay-card p-4 rounded-[22px] flex flex-col justify-between border-l-4 border-l-[#436b4d]">
            <span className="text-xs font-bold text-[#436b4d] uppercase tracking-wider block">
              Contract Expansion
            </span>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="font-heading text-3xl font-bold text-[#436b4d]">
                $92k ARR
              </span>
              <span className="text-xs font-semibold text-[#436b4d]">HealthBridge</span>
            </div>
            <p className="text-xs text-[#3d3731] mt-1">
              Marcus Vance signed Sept 24; 0 broken promises
            </p>
          </div>
        </div>

        {/* 4. Filter & Search Controls */}
        <div className="clay-card p-4 rounded-[22px] flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-[16px] transition-all border ${
                statusFilter === 'all'
                  ? 'bg-[#2a2622] text-[#f5f1ea] border-[#2a2622]'
                  : 'clay-btn-secondary text-[#3d3731] border-[#ded7ca]'
              }`}
            >
              All Contacts ({contacts.length})
            </button>
            <button
              onClick={() => setStatusFilter('at_risk')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-[16px] transition-all border ${
                statusFilter === 'at_risk'
                  ? 'bg-[#8f3e3e] text-[#ffffff] border-[#8f3e3e]'
                  : 'clay-btn-secondary text-[#8f3e3e] border-[#deb8b8]'
              }`}
            >
              At Risk ({contacts.filter((c) => c.relationshipStatus === 'at_risk').length})
            </button>
            <button
              onClick={() => setStatusFilter('neutral')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-[16px] transition-all border ${
                statusFilter === 'neutral'
                  ? 'bg-[#3d3731] text-[#ffffff] border-[#3d3731]'
                  : 'clay-btn-secondary text-[#3d3731] border-[#d5d4ce]'
              }`}
            >
              Neutral ({contacts.filter((c) => c.relationshipStatus === 'neutral').length})
            </button>
            <button
              onClick={() => setStatusFilter('expanding')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-[16px] transition-all border ${
                statusFilter === 'expanding'
                  ? 'bg-[#436b4d] text-[#ffffff] border-[#436b4d]'
                  : 'clay-btn-secondary text-[#436b4d] border-[#bcd4c0]'
              }`}
            >
              Expanding ({contacts.filter((c) => c.relationshipStatus === 'expanding').length})
            </button>
          </div>

          <div className="w-full sm:w-72">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search contact, company, action..."
              className="w-full px-3 py-2 text-xs clay-input"
            />
          </div>
        </div>

        {/* 5. Contact Risk Ranking Table / Cards */}
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-bold uppercase tracking-wider text-[#3d3731]">
              Ranked Contacts ({filteredContacts.length})
            </span>
            <span className="text-xs text-[#3d3731] italic">
              Click any row to open that contact's full briefing
            </span>
          </div>

          {filteredContacts.map((contact) => {
            const isExpanded = expandedContactId === contact.id;

            return (
              <div
                key={contact.id}
                onClick={() => handleOpenContactBriefing(contact.id)}
                className="clay-card p-5 sm:p-6 rounded-[26px] cursor-pointer hover:border-[#3d3731] transition-all space-y-4 relative group"
              >
                {/* Top Row: Rank, Contact Info, Status & Broken Promises */}
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-[#ded7ca] pb-4">
                  {/* Left: Rank & Contact Info */}
                  <div className="flex items-start sm:items-center gap-3.5">
                    <div className="shrink-0">
                      {getRiskBadge(contact.riskLevel, contact.riskRank)}
                    </div>

                    <div>
                      <div className="flex items-baseline gap-2 flex-wrap">
                        <h3 className="font-heading text-lg font-bold text-[#2a2622] group-hover:text-[#2a2622] transition-colors">
                          {contact.name}
                        </h3>
                        <span className="text-xs text-[#3d3731] font-medium">
                          {contact.role} &bull; <strong className="text-[#2a2622]">{contact.company}</strong>
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 text-xs text-[#3d3731]">
                        <span>{contact.email}</span>
                        <span>&bull;</span>
                        <span>{contact.meetingCount} meetings on record</span>
                        <span>&bull;</span>
                        <span>Last meeting: {contact.lastMeetingDate}</span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Relationship Status, Broken Promises Count, & Open Briefing Button */}
                  <div className="flex items-center gap-3 shrink-0 self-start lg:self-center">
                    <div className="flex items-center gap-2">
                      {getStatusBadge(contact.relationshipStatus)}

                      <span className={`px-2.5 py-1 text-xs font-bold rounded-[12px] border ${
                        contact.brokenPromisesCount > 0
                          ? 'bg-[#ede2df] text-[#8f3e3e] border-[#deb8b8]'
                          : 'bg-[#e4ded4] text-[#3d3731] border-[#d5d4ce]'
                      }`}>
                        {contact.brokenPromisesCount} Broken {contact.brokenPromisesCount === 1 ? 'Promise' : 'Promises'}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenContactBriefing(contact.id);
                      }}
                      className="px-3.5 py-1.5 text-xs font-semibold clay-btn-primary flex items-center gap-1 shrink-0"
                    >
                      <span>Open Briefing</span>
                      <span>&rarr;</span>
                    </button>
                  </div>
                </div>

                {/* Middle Row: Next Recommended Action & Key Risk */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
                  {/* Next Recommended Action */}
                  <div className="lg:col-span-8 p-3.5 bg-[#eee8dc] border border-[#ded7ca] rounded-[18px] space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-[#3d3731] block">
                        Next Recommended Action (Recalled from Memory)
                      </span>
                      {contact.nextActionDeadline && (
                        <span className="px-2 py-0.5 text-xs font-mono font-semibold rounded-[8px] bg-[#ede2df] text-[#8f3e3e] border border-[#deb8b8]">
                          Target: {contact.nextActionDeadline}
                        </span>
                      )}
                    </div>
                    <p className="text-xs sm:text-sm font-semibold text-[#2a2622] leading-snug">
                      {contact.nextRecommendedAction}
                    </p>
                  </div>

                  {/* Primary Friction / Threat */}
                  <div className="lg:col-span-4 p-3.5 bg-[#e8e2d5] border border-[#ded7ca] rounded-[18px] space-y-1">
                    <span className="text-xs font-bold uppercase tracking-wider text-[#3d3731] block">
                      Primary Threat & Friction
                    </span>
                    <p className="text-xs text-[#3d3731] leading-relaxed">
                      {contact.keyRiskFactor}
                    </p>
                  </div>
                </div>

                {/* Bottom Row: Recalled Memory Facts Summary & Expandable Broken Promises */}
                <div className="pt-1 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-[#3d3731]">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-[#2a2622]">Hindsight Evidence:</span>
                    <span className="line-clamp-1">{contact.recalledMemorySummary}</span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs font-mono text-[#3d3731]">
                      {contact.memoryFactsCount} facts recalled
                    </span>

                    {contact.brokenPromises.length > 0 && (
                      <button
                        type="button"
                        onClick={(e) => toggleExpand(e, contact.id)}
                        className="text-xs font-semibold text-[#3d3731] underline decoration-[#8a7f72] hover:text-[#2a2622] cursor-pointer"
                      >
                        {isExpanded ? 'Hide Broken Promises' : `View ${contact.brokenPromises.length} Broken Promises`}
                      </button>
                    )}
                  </div>
                </div>

                {/* Expanded Broken Promises Details */}
                {isExpanded && contact.brokenPromises.length > 0 && (
                  <div
                    onClick={(e) => e.stopPropagation()}
                    className="p-3.5 bg-[#ede2df]/60 border border-[#deb8b8] rounded-[18px] space-y-2 mt-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-[#8f3e3e]">
                        Documented Broken & Delayed Commitments ({contact.brokenPromises.length})
                      </span>
                      <span className="text-xs text-[#8f3e3e] font-mono">
                        Source: Hindsight Memory Bank
                      </span>
                    </div>

                    <div className="space-y-2">
                      {contact.brokenPromises.map((bp: BrokenPromiseDetail, idx: number) => (
                        <div key={idx} className="p-2.5 bg-[#eee8dc] border border-[#ded7ca] rounded-[14px] text-xs space-y-1">
                          <div className="flex items-start justify-between gap-2">
                            <span className="font-semibold text-[#2a2622]">
                              {bp.promise}
                            </span>
                            <span className="px-2 py-0.5 text-xs font-bold uppercase rounded-[8px] bg-[#ede2df] text-[#8f3e3e] border border-[#deb8b8] shrink-0">
                              {bp.status} ({bp.date})
                            </span>
                          </div>
                          <p className="text-xs text-[#692929] italic">
                            Impact: {bp.impact}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </main>

      {/* 6. Footer */}
      <footer className="border-t border-[#ded7ca] bg-[#e6dfd3] px-6 py-6 mt-12 text-xs text-[#3d3731]">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 bg-[#b8623f] rounded-full inline-block" />
            <span className="font-medium text-[#2a2622]">Meeting Prep Agent</span>
            <span>&bull; Persistent Relationship Intelligence</span>
          </div>

          <div className="flex items-center gap-4 text-xs">
            <Link href="/app" className="hover:text-[#2a2622] underline">
              Dashboard Workspace
            </Link>
            <Link href="/" className="hover:text-[#2a2622] underline">
              Home
            </Link>
            <Link href="/terms" className="hover:text-[#2a2622] underline">
              Terms
            </Link>
            <Link href="/privacy" className="hover:text-[#2a2622] underline">
              Privacy
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

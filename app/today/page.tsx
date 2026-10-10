'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface Attendee {
  email: string;
  name?: string;
}

interface MeetingBriefingSummary {
  contactId: string;
  contactName: string;
  company: string;
  relationshipStatus: string;
  topRisk: string;
  executiveSummary: string;
  sentimentTrajectory?: string;
  trustLevel?: string;
}

interface TodayMeeting {
  id: string;
  title: string;
  description?: string;
  startTime: string;
  endTime: string;
  location?: string;
  attendees: Attendee[];
  matchedContactId?: string;
  matchedContactName?: string;
  matchedContactRole?: string;
  matchedContactCompany?: string;
  matchedContactEmail?: string;
  briefingReady: boolean;
  briefing: MeetingBriefingSummary;
}

export default function TodayPage() {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  const [meetings, setMeetings] = useState<TodayMeeting[]>([]);
  const [calendarSource, setCalendarSource] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Calendar Import Modal state
  const [showImportModal, setShowImportModal] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

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
    }
  }, [router]);

  // Load Today data
  const fetchTodayData = async (refresh = false) => {
    if (refresh) setIsRefreshing(true);
    else setIsLoading(true);

    try {
      const res = await fetch(`/api/today${refresh ? '?refresh=true' : ''}`);
      const data = await res.json();
      if (data.meetings) {
        setMeetings(data.meetings);
        setCalendarSource(data.calendarSource || '');
      }
    } catch (err) {
      console.error('Failed to load today dashboard data:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchTodayData();
    }
  }, [isAuthenticated]);

  const handleSignOut = () => {
    document.cookie = 'demo_session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    localStorage.removeItem('demo_session');
    localStorage.removeItem('demo_user_email');
    localStorage.removeItem('demo_user_name');
    router.push('/login');
  };

  const handleOpenBriefing = (contactId?: string) => {
    if (!contactId) return;
    router.push(`/app?contactId=${contactId}&tab=briefing&autoBriefing=true`);
  };

  const handleFileUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile) {
      setUploadError('Please choose an .ics calendar file to upload.');
      return;
    }

    setIsUploading(true);
    setUploadError(null);
    setUploadMessage(null);

    try {
      const formData = new FormData();
      formData.append('file', uploadFile);

      const res = await fetch('/api/calendar', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to upload calendar');
      }

      setUploadMessage(data.message || `Imported ${data.totalEventsParsed} events.`);
      await fetchTodayData(true);
      setTimeout(() => {
        setShowImportModal(false);
        setUploadFile(null);
        setUploadMessage(null);
      }, 1800);
    } catch (err) {
      setUploadError((err as Error).message || 'Failed to process calendar file');
    } finally {
      setIsUploading(false);
    }
  };

  const handleLoadSampleCalendar = async () => {
    setIsUploading(true);
    setUploadError(null);
    setUploadMessage(null);

    try {
      // Re-trigger fetch with sample calendar
      const res = await fetch('/api/today?refresh=true');
      const data = await res.json();
      if (data.meetings) {
        setMeetings(data.meetings);
        setCalendarSource(data.calendarSource || 'sample-calendar.ics');
        setUploadMessage('Loaded data/sample-calendar.ics successfully!');
        setTimeout(() => {
          setShowImportModal(false);
          setUploadMessage(null);
        }, 1200);
      }
    } catch (err) {
      setUploadError('Failed to load sample calendar.');
    } finally {
      setIsUploading(false);
    }
  };

  const formatTimeRange = (startStr: string, endStr: string) => {
    try {
      const s = new Date(startStr);
      const e = new Date(endStr);
      const timeFormat: Intl.DateTimeFormatOptions = {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      };
      return `${s.toLocaleTimeString('en-US', timeFormat)} – ${e.toLocaleTimeString('en-US', timeFormat)}`;
    } catch {
      return 'Time scheduled';
    }
  };

  const getStatusBadge = (status: string) => {
    const s = (status || '').toLowerCase();
    if (s.includes('at_risk') || s.includes('risk') || s.includes('lost')) {
      return {
        label: 'At Risk',
        bg: 'bg-[#fbe9e7]',
        text: 'text-[#c84d32]',
        border: 'border-[#ffccbc]',
      };
    }
    if (s.includes('fragile') || s.includes('stalled') || s.includes('recovering')) {
      return {
        label: 'Fragile / Guarded',
        bg: 'bg-[#fef9e7]',
        text: 'text-[#b78103]',
        border: 'border-[#fdeaa8]',
      };
    }
    if (s.includes('expanding') || s.includes('healthy') || s.includes('positive') || s.includes('advanced')) {
      return {
        label: 'Expanding / Healthy',
        bg: 'bg-[#e8f5e9]',
        text: 'text-[#2e7d32]',
        border: 'border-[#c8e6c9]',
      };
    }
    return {
      label: status ? status.toUpperCase() : 'Neutral',
      bg: 'bg-[#ede7dd]',
      text: 'text-[#5a5247]',
      border: 'border-[#ded7ca]',
    };
  };

  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen bg-[#e6dfd3] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#b8623f]" />
      </div>
    );
  }

  const atRiskCount = meetings.filter(
    (m) => m.briefing?.relationshipStatus?.toLowerCase().includes('risk')
  ).length;

  return (
    <div className="min-h-screen bg-[#e6dfd3] text-[#2a2622] flex flex-col font-sans">
      {/* 1. Sticky Navigation Header */}
      <header className="sticky top-0 z-30 bg-[#e6dfd3]/95 backdrop-blur-sm border-b border-[#ded7ca] px-6 py-3.5">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="w-3.5 h-3.5 bg-[#b8623f] rounded-full inline-block" />
            <Link href="/today" className="font-heading font-bold text-lg tracking-tight text-[#2a2622]">
              Meeting Prep Agent
            </Link>
            <span className="text-xs px-2 py-0.5 rounded-full bg-[#ded7ca] text-[#524a41] font-medium hidden sm:inline-block">
              Daily Intelligence
            </span>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              href="/today"
              className="px-3.5 py-1.5 text-xs font-semibold rounded-[14px] bg-[#2a2622] text-[#f5f0eb] shadow-sm"
            >
              Today
            </Link>
            <Link
              href="/app"
              className="px-3.5 py-1.5 text-xs font-semibold clay-btn-secondary"
            >
              Workspace
            </Link>
            <Link
              href="/overview"
              className="px-3.5 py-1.5 text-xs font-semibold clay-btn-secondary hidden md:inline-block"
            >
              Portfolio Risk
            </Link>
            <button
              onClick={() => setShowImportModal(true)}
              className="px-3.5 py-1.5 text-xs font-semibold clay-btn-secondary flex items-center gap-1.5 border-[#b8623f]/30 text-[#b8623f]"
              title="Import .ics calendar file"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span>Import Calendar</span>
            </button>
            <button
              onClick={handleSignOut}
              className="px-3 py-1.5 text-xs font-medium text-[#7d7265] hover:text-[#2a2622] transition-colors"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      {/* 2. Main Content */}
      <main className="flex-1 max-w-6xl mx-auto w-full px-6 py-8 space-y-8">
        {/* Welcome & Overview Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-2 border-b border-[#ded7ca]">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-semibold tracking-wider uppercase text-[#b8623f]">
                Executive Daily Dossier
              </span>
              <span className="text-xs text-[#7d7265]">•</span>
              <span className="text-xs text-[#7d7265]">
                {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
              </span>
            </div>
            <h1 className="font-heading text-2xl sm:text-3xl font-bold tracking-tight text-[#2a2622]">
              Today&apos;s Schedule &amp; Briefings
            </h1>
            <p className="text-xs sm:text-sm text-[#524a41] mt-1 max-w-2xl">
              All upcoming meetings synchronized from your calendar. Executive briefings and relationship risk factors are grounded in persistent memory.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => fetchTodayData(true)}
              disabled={isRefreshing}
              className="px-3.5 py-1.5 text-xs font-semibold clay-btn-secondary flex items-center gap-1.5"
              title="Refresh briefings from cache or regenerate"
            >
              <svg className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-[#b8623f]' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
            </button>

            <button
              onClick={() => setShowImportModal(true)}
              className="px-4 py-1.5 text-xs font-semibold clay-btn-primary flex items-center gap-1.5"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span>Upload .ics</span>
            </button>
          </div>
        </div>

        {/* 3. Daily Stats Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="clay-card p-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold text-[#7d7265] uppercase tracking-wider">Scheduled Today</p>
              <p className="text-2xl font-bold font-heading text-[#2a2622] mt-0.5">{meetings.length}</p>
            </div>
            <div className="w-10 h-10 rounded-[14px] bg-[#e2dcd1] flex items-center justify-center text-[#2a2622]">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
          </div>

          <div className="clay-card p-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold text-[#7d7265] uppercase tracking-wider">Briefings Ready</p>
              <p className="text-2xl font-bold font-heading text-[#2e7d32] mt-0.5">
                {meetings.filter((m) => m.briefingReady).length} / {meetings.length}
              </p>
            </div>
            <div className="w-10 h-10 rounded-[14px] bg-[#e8f5e9] flex items-center justify-center text-[#2e7d32]">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>

          <div className="clay-card p-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold text-[#7d7265] uppercase tracking-wider">High Risk Stakeholders</p>
              <p className="text-2xl font-bold font-heading text-[#c84d32] mt-0.5">{atRiskCount}</p>
            </div>
            <div className="w-10 h-10 rounded-[14px] bg-[#fbe9e7] flex items-center justify-center text-[#c84d32]">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
          </div>
        </div>

        {/* 4. Upcoming Meetings List with Briefing Cards */}
        {isLoading ? (
          <div className="clay-card p-12 text-center space-y-3">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#b8623f] mx-auto" />
            <p className="text-sm font-medium text-[#524a41]">Loading today&apos;s schedule and cached briefings...</p>
          </div>
        ) : meetings.length === 0 ? (
          <div className="clay-card p-12 text-center space-y-4">
            <div className="w-12 h-12 rounded-[16px] bg-[#ded7ca] mx-auto flex items-center justify-center text-[#7d7265]">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 className="font-heading text-lg font-semibold text-[#2a2622]">No meetings found on calendar</h3>
            <p className="text-xs sm:text-sm text-[#7d7265] max-w-md mx-auto">
              Upload your .ics calendar export or load the sample calendar to see pre-meeting briefings for today.
            </p>
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                onClick={() => setShowImportModal(true)}
                className="px-4 py-2 text-xs font-semibold clay-btn-primary"
              >
                Upload .ics Calendar
              </button>
              <button
                onClick={handleLoadSampleCalendar}
                className="px-4 py-2 text-xs font-semibold clay-btn-secondary"
              >
                Load Sample Calendar
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="flex items-center justify-between text-xs text-[#7d7265] px-1">
              <span>Calendar source: <code className="font-mono bg-[#ded7ca]/60 px-1.5 py-0.5 rounded text-[11px] text-[#2a2622]">{calendarSource || 'calendar.ics'}</code></span>
              <span>Showing {meetings.length} events</span>
            </div>

            <div className="grid grid-cols-1 gap-6">
              {meetings.map((meeting) => {
                const statusMeta = getStatusBadge(meeting.briefing?.relationshipStatus);
                const hasMatchedContact = !!meeting.matchedContactId;

                return (
                  <div
                    key={meeting.id}
                    onClick={() => hasMatchedContact && handleOpenBriefing(meeting.matchedContactId)}
                    className={`clay-card p-6 transition-all duration-200 hover:shadow-lg border border-transparent ${
                      hasMatchedContact ? 'cursor-pointer hover:border-[#b8623f]/40' : 'opacity-90'
                    }`}
                  >
                    <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6">
                      {/* Left: Meeting Details & Contact */}
                      <div className="space-y-4 flex-1">
                        {/* Time & Badges Bar */}
                        <div className="flex flex-wrap items-center gap-2.5">
                          <span className="text-xs font-bold text-[#b8623f] bg-[#f7ebe6] px-2.5 py-1 rounded-[10px] border border-[#ecd5cb]">
                            {formatTimeRange(meeting.startTime, meeting.endTime)}
                          </span>

                          {meeting.location && (
                            <span className="text-xs text-[#524a41] bg-[#ded7ca]/60 px-2.5 py-1 rounded-[10px] flex items-center gap-1">
                              <svg className="w-3 h-3 text-[#7d7265]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                              </svg>
                              <span>{meeting.location}</span>
                            </span>
                          )}

                          {/* "Briefing ready" badge */}
                          {meeting.briefingReady && (
                            <span className="text-xs font-semibold px-2.5 py-1 rounded-[10px] bg-[#e8f5e9] text-[#2e7d32] border border-[#c8e6c9] flex items-center gap-1.5 shadow-xs">
                              <span className="w-1.5 h-1.5 rounded-full bg-[#2e7d32] animate-pulse" />
                              Briefing ready
                            </span>
                          )}

                          {/* Relationship Status badge */}
                          <span className={`text-xs font-semibold px-2.5 py-1 rounded-[10px] border ${statusMeta.bg} ${statusMeta.text} ${statusMeta.border}`}>
                            Relationship: {statusMeta.label}
                          </span>
                        </div>

                        {/* Meeting Title & Description */}
                        <div>
                          <h2 className="font-heading text-lg sm:text-xl font-bold text-[#2a2622]">
                            {meeting.title}
                          </h2>
                          {meeting.description && (
                            <p className="text-xs sm:text-sm text-[#7d7265] mt-1 line-clamp-2">
                              {meeting.description}
                            </p>
                          )}
                        </div>

                        {/* Matched Contact Info Card */}
                        {hasMatchedContact ? (
                          <div className="flex items-center gap-3.5 p-3 rounded-[16px] bg-[#e8e2d5]/80 border border-[#ded7ca]">
                            <div className="w-10 h-10 rounded-full bg-[#b8623f] text-[#f5f0eb] font-heading font-bold text-sm flex items-center justify-center shrink-0 shadow-xs">
                              {meeting.matchedContactName
                                ? meeting.matchedContactName.split(' ').map((n) => n[0]).join('').slice(0, 2)
                                : 'C'}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-semibold text-sm text-[#2a2622]">
                                  {meeting.matchedContactName}
                                </span>
                                <span className="text-[11px] text-[#7d7265] bg-[#ded7ca] px-2 py-0.5 rounded-full">
                                  Matched attendee
                                </span>
                              </div>
                              <p className="text-xs text-[#524a41]">
                                {meeting.matchedContactRole} • <span className="font-medium">{meeting.matchedContactCompany}</span>
                              </p>
                            </div>
                          </div>
                        ) : (
                          <div className="p-3 rounded-[16px] bg-[#e8e2d5]/50 border border-[#ded7ca] text-xs text-[#7d7265]">
                            Attendees: {meeting.attendees.map((a) => a.name || a.email).join(', ') || 'No attendees listed'}
                          </div>
                        )}
                      </div>

                      {/* Right: Memory Intelligence & Top Risk Card */}
                      <div className="lg:w-[420px] shrink-0 flex flex-col justify-between gap-4">
                        {/* Top Risk Box */}
                        <div className="p-4 rounded-[18px] bg-[#fffaf5] border border-[#f3d3c8] shadow-xs space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold tracking-wider uppercase text-[#c84d32] flex items-center gap-1.5">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                              </svg>
                              Top Risk from Memory
                            </span>
                            <span className="text-[10px] text-[#8c8275] bg-[#ece6dc] px-1.5 py-0.5 rounded">
                              Hindsight Recall
                            </span>
                          </div>

                          <p className="text-xs sm:text-[13px] text-[#3d362e] font-medium leading-relaxed">
                            {meeting.briefing?.topRisk || 'No critical risks identified.'}
                          </p>
                        </div>

                        {/* Executive Context Synopsis */}
                        {meeting.briefing?.executiveSummary && (
                          <div className="px-2">
                            <p className="text-xs text-[#524a41] italic line-clamp-2">
                              &ldquo;{meeting.briefing.executiveSummary}&rdquo;
                            </p>
                          </div>
                        )}

                        {/* CTA: Open Full Briefing */}
                        <div className="flex items-center justify-end pt-1">
                          {hasMatchedContact ? (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenBriefing(meeting.matchedContactId);
                              }}
                              className="w-full sm:w-auto px-4 py-2 text-xs font-semibold clay-btn-primary flex items-center justify-center gap-2"
                            >
                              <span>Open Full Briefing</span>
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                              </svg>
                            </button>
                          ) : (
                            <span className="text-xs text-[#7d7265] italic">
                              Attendee not yet linked to a contact
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>

      {/* 5. Calendar Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 bg-[#2a2622]/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="clay-card max-w-lg w-full p-6 sm:p-7 space-y-5 bg-[#eee8dc]">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-heading text-lg font-bold text-[#2a2622]">
                  Import Calendar (.ics)
                </h3>
                <p className="text-xs text-[#524a41] mt-0.5">
                  Upload an iCalendar (.ics) export. Attendees are automatically mapped to contacts.
                </p>
              </div>
              <button
                onClick={() => setShowImportModal(false)}
                className="text-[#7d7265] hover:text-[#2a2622] text-sm p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleFileUpload} className="space-y-4">
              <div className="border-2 border-dashed border-[#ded7ca] rounded-[18px] p-6 text-center bg-[#e8e2d5]/60 hover:bg-[#e8e2d5] transition-colors">
                <input
                  type="file"
                  accept=".ics,text/calendar"
                  id="ics-file-input"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      setUploadFile(e.target.files[0]);
                      setUploadError(null);
                    }
                  }}
                />
                <label htmlFor="ics-file-input" className="cursor-pointer space-y-2 block">
                  <div className="w-10 h-10 rounded-[14px] bg-[#ded7ca] mx-auto flex items-center justify-center text-[#7d7265]">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                  </div>
                  <div className="text-xs font-semibold text-[#2a2622]">
                    {uploadFile ? uploadFile.name : 'Click to select an .ics file'}
                  </div>
                  <p className="text-[11px] text-[#7d7265]">
                    Supports Apple Calendar, Google Calendar, Outlook, and Microsoft 365 ICS exports.
                  </p>
                </label>
              </div>

              {uploadError && (
                <div className="p-3 rounded-[14px] bg-[#fbe9e7] border border-[#ffccbc] text-xs text-[#c84d32]">
                  {uploadError}
                </div>
              )}

              {uploadMessage && (
                <div className="p-3 rounded-[14px] bg-[#e8f5e9] border border-[#c8e6c9] text-xs text-[#2e7d32]">
                  {uploadMessage}
                </div>
              )}

              <div className="flex items-center justify-between gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleLoadSampleCalendar}
                  disabled={isUploading}
                  className="text-xs font-semibold text-[#b8623f] hover:underline"
                >
                  Load data/sample-calendar.ics
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowImportModal(false)}
                    className="px-4 py-2 text-xs font-semibold clay-btn-secondary"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isUploading || !uploadFile}
                    className="px-4 py-2 text-xs font-semibold clay-btn-primary disabled:opacity-50"
                  >
                    {isUploading ? 'Parsing...' : 'Upload & Sync'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Contact, MeetingNote, MemoryFact, MeetingOutcome, DebriefResult, LearningCurveData } from '@/types';

interface DetailedBriefing {
  executiveSummary: string;
  relationshipHealth: {
    status: string;
    sentimentTrajectory: string;
    trustLevel: string;
  };
  commitments: {
    ourPromises: Array<{
      promise: string;
      dateMade?: string;
      status: 'kept' | 'broken' | 'in_progress' | 'pending' | string;
      impact?: string;
      sourceDate?: string;
      sourceDocumentId?: string;
    }>;
    theirPromises: Array<{
      promise: string;
      status: 'fulfilled' | 'pending' | string;
      sourceDate?: string;
      sourceDocumentId?: string;
    }>;
  };
  unresolvedQuestions: Array<{
    question: string;
    recurrence?: string;
    urgency: 'high' | 'medium' | 'low' | string;
    suggestedAnswer?: string;
    sourceDate?: string;
    sourceDocumentId?: string;
  }>;
  recommendedApproach?: {
    advancingTactics: string[];
    stallingTacticsToAvoid: string[];
    strategicSummary: string;
  };
  recommendedAgenda: Array<{
    timeframe: string;
    topic: string;
    objective: string;
  }>;
  talkingPointsAndStrategy: string[];
  redFlagsAndSensitivities: Array<string | {
    text: string;
    sourceDate?: string;
    sourceDocumentId?: string;
  }>;
}

export default function MeetingPrepDashboard() {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  const [contacts, setContacts] = useState<(Contact & { meetingCount: number; latestSentiment: string })[]>([]);
  const [selectedContact, setSelectedContact] = useState<(Contact & { meetingCount: number; latestSentiment: string }) | null>(null);
  const [meetings, setMeetings] = useState<MeetingNote[]>([]);
  const [activeTab, setActiveTab] = useState<'briefing' | 'history' | 'memory' | 'learning-curve'>('briefing');
  const [searchQuery, setSearchQuery] = useState('');
  const [highlightedDate, setHighlightedDate] = useState<string | null>(null);

  // Learning Curve state
  const [learningCurveData, setLearningCurveData] = useState<LearningCurveData | null>(null);
  const [isLoadingLearningCurve, setIsLoadingLearningCurve] = useState(false);
  const [selectedStageIndex, setSelectedStageIndex] = useState<number>(3);

  const formatMeetingDate = (dateStr?: string) => {
    if (!dateStr) return '';
    try {
      const clean = dateStr.slice(0, 10);
      const [y, m, d] = clean.split('-').map(Number);
      const date = new Date(y, m - 1, d);
      const month = date.toLocaleString('en-US', { month: 'short' });
      const day = date.getDate();
      return `${month} ${day} meeting`;
    } catch {
      return `${dateStr} meeting`;
    }
  };

  const handleOpenMeeting = (sourceDate?: string, _sourceDocId?: string) => {
    setActiveTab('history');
    if (sourceDate) {
      setHighlightedDate(sourceDate);
      setTimeout(() => {
        const el = document.getElementById(`meeting-${sourceDate}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 150);
      setTimeout(() => {
        setHighlightedDate(null);
      }, 5000);
    }
  };

  // Briefing generation state
  const [upcomingAgenda, setUpcomingAgenda] = useState('');
  const [meetingGoal, setMeetingGoal] = useState('');
  const [useMemory, setUseMemory] = useState<boolean>(true);
  const [compareMode, setCompareMode] = useState<boolean>(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const [briefingWithMemory, setBriefingWithMemory] = useState<DetailedBriefing | null>(null);
  const [briefingWithoutMemory, setBriefingWithoutMemory] = useState<DetailedBriefing | null>(null);
  const [recalledMemories, setRecalledMemories] = useState<MemoryFact[]>([]);
  const [copied, setCopied] = useState(false);
  const [showMemories, setShowMemories] = useState(false);

  // Memory search state
  const [memoryQuery, setMemoryQuery] = useState('');
  const [memorySearchLoading, setMemorySearchLoading] = useState(false);
  const [memorySearchResults, setMemorySearchResults] = useState<MemoryFact[]>([]);

  // Structured error states for Hindsight and Groq
  const [briefingError, setBriefingError] = useState<{
    service: 'groq' | 'hindsight' | 'network' | 'unknown';
    title: string;
    message: string;
    rawError?: string;
    statusCode?: number;
  } | null>(null);
  const [memorySearchError, setMemorySearchError] = useState<string | null>(null);
  const [debriefError, setDebriefError] = useState<string | null>(null);

  // Modals state
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [showContactModal, setShowContactModal] = useState(false);
  const [isSubmittingNote, setIsSubmittingNote] = useState(false);

  // Debrief state
  const [showDebriefModal, setShowDebriefModal] = useState(false);
  const [debriefDate, setDebriefDate] = useState(new Date().toISOString().slice(0, 10));
  const [debriefOutcome, setDebriefOutcome] = useState<MeetingOutcome>('advanced');
  const [debriefNotes, setDebriefNotes] = useState('');
  const [isSubmittingDebrief, setIsSubmittingDebrief] = useState(false);
  const [debriefResult, setDebriefResult] = useState<DebriefResult | null>(null);

  // New Note Form
  const [newNoteDate, setNewNoteDate] = useState(new Date().toISOString().slice(0, 10));
  const [newNoteSummary, setNewNoteSummary] = useState('');
  const [newNotePromises, setNewNotePromises] = useState('');
  const [newNoteQuestions, setNewNoteQuestions] = useState('');
  const [newNoteSentiment, setNewNoteSentiment] = useState<'positive' | 'neutral' | 'negative' | 'mixed'>('neutral');
  const [newNoteRaw, setNewNoteRaw] = useState('');

  // New Contact Form
  const [newContactName, setNewContactName] = useState('');
  const [newContactCompany, setNewContactCompany] = useState('');
  const [newContactRole, setNewContactRole] = useState('');
  const [newContactEmail, setNewContactEmail] = useState('');

  // Check demo authentication
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
      const tabParam = params.get('tab');
      if (tabParam === 'history' || tabParam === 'memory' || tabParam === 'briefing' || tabParam === 'learning-curve') {
        setActiveTab(tabParam);
      }
      const stageParam = params.get('stage');
      if (stageParam === '1' || stageParam === '2' || stageParam === '3') {
        setSelectedStageIndex(parseInt(stageParam, 10));
      }
      const highlightParam = params.get('highlight');
      if (highlightParam) {
        setHighlightedDate(highlightParam);
      }
      const debriefParam = params.get('debrief');
      if (debriefParam === 'true') {
        setShowDebriefModal(true);
      }
      const debriefStoredParam = params.get('debriefStored');
      if (debriefStoredParam === 'true') {
        setShowDebriefModal(true);
        setDebriefResult({
          success: true,
          contact: {
            id: 'contact-elena-rostova',
            name: 'Elena Rostova',
            company: 'FinScale Corp',
            role: 'VP of Engineering',
            email: 'elena.rostova@finscale.io',
          },
          meetingNote: {
            contactId: 'contact-elena-rostova',
            date: '2026-09-28',
            summary: 'Elena agreed that the temporary Datadog proxy resolved the staging latency bottleneck and formally lifted the POC freeze.',
            promisesMade: [
              'Deliver VPC peering documentation by Oct 5',
              'Hold joint General Counsel call with FinScale legal by Oct 2',
            ],
            openQuestions: ['When will FinScale accept revised liability clause redlines?'],
            sentiment: 'positive',
            outcome: 'advanced',
          },
          outcome: 'advanced',
          retainedNoteMemory: {
            content: 'Meeting with Elena Rostova on 2026-09-28 (Outcome: advanced). Demonstrated Datadog proxy at 42ms latency. Customer lifted POC freeze and agreed to 30-day grace period pending MSA redlines.',
            tags: [
              'contact:contact-elena-rostova',
              'outcome:advanced',
              'type:debrief',
              'type:meeting',
            ],
          },
          extractedPromises: {
            ourPromises: [
              {
                promise: 'Deliver VPC peering documentation and architecture diagram',
                dueDate: '2026-10-05',
                owner: 'Engineering Team',
              },
              {
                promise: 'Conduct executive legal sync call between respective General Counsels',
                dueDate: '2026-10-02',
                owner: 'Legal Team',
              },
            ],
            theirPromises: [
              {
                promise: 'Return final redlines on Master Services Agreement liability clauses',
                dueDate: '2026-10-04',
                owner: 'Elena Rostova',
              },
            ],
          },
          retainedPromiseCount: 3,
        });
      }
    }
  }, [router]);

  const handleSignOut = () => {
    document.cookie = 'demo_session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    localStorage.removeItem('demo_session');
    localStorage.removeItem('demo_user_email');
    localStorage.removeItem('demo_user_name');
    router.push('/login');
  };

  // Fetch contacts
  const fetchContacts = async () => {
    try {
      const res = await fetch('/api/contacts');
      const data = await res.json();
      if (data.contacts && data.contacts.length > 0) {
        setContacts(data.contacts);
        const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
        const targetContactId = params?.get('contact') || params?.get('contactId');
        const initialContact = targetContactId
          ? data.contacts.find((c: any) => c.id === targetContactId) || data.contacts[0]
          : data.contacts[0];
        selectContact(initialContact);
      }
    } catch (e) {
      console.error('Failed to load contacts:', e);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchContacts();
    }
  }, [isAuthenticated]);

  // Load meeting notes for selected contact
  const selectContact = async (contact: Contact & { meetingCount: number; latestSentiment: string }) => {
    setSelectedContact(contact);
    setBriefingWithMemory(null);
    setBriefingWithoutMemory(null);
    setRecalledMemories([]);
    setMemorySearchResults([]);
    setMemoryQuery('');

    // Prepopulate realistic upcoming context for each stakeholder
    if (contact.name.includes('Elena')) {
      setUpcomingAgenda('Address liability redlines, staging Datadog proxy status, and prevent Confluent migration');
      setMeetingGoal('De-escalate tension, commit to General Counsel call, and secure 30-day grace period for POC');
    } else if (contact.name.includes('Amara')) {
      setUpcomingAgenda('Review Dallas 100-truck depot rollout readiness, static egress IP whitelisting, and 24/7 on-call escalation rotation');
      setMeetingGoal('Lock in Dallas test deployment schedule for Oct 1 and reassure Amara on engineering velocity ahead of Q4 shipping surge');
    } else if (contact.name.includes('Devon')) {
      setUpcomingAgenda('Finalize Pilot Order Form execution, sandbox tenant provisioning timeline, and Okta SCIM seat de-provisioning confirmation');
      setMeetingGoal('Secure executed pilot order agreement and establish technical onboarding champion for week 1 deployment');
    } else if (contact.name.includes('Marcus')) {
      setUpcomingAgenda('Q4 enterprise contract rollout kickoff, joint customer summit keynote alignment, and predictive license alert engine roadmap preview');
      setMeetingGoal('Align on customer case study draft outline by Oct 8 and confirm Marcus keynote session for November summit');
    } else {
      setUpcomingAgenda('');
      setMeetingGoal('');
    }

    try {
      const res = await fetch(`/api/notes?contactId=${contact.id}`);
      const data = await res.json();
      setMeetings(data.notes || data.meetings || []);
    } catch (e) {
      console.error('Failed to load meeting notes:', e);
      setMeetings([]);
    }

    // Load pre-generated learning curve timeline for contact
    fetchLearningCurveData(contact.id);
  };

  const fetchLearningCurveData = async (contactId: string) => {
    setIsLoadingLearningCurve(true);
    try {
      const res = await fetch(`/api/learning-curve?contactId=${contactId}`);
      const data = await res.json();
      if (res.ok && data.stages) {
        setLearningCurveData(data);
      } else {
        setLearningCurveData(null);
      }
    } catch (e) {
      console.error('Failed to load learning curve data:', e);
      setLearningCurveData(null);
    } finally {
      setIsLoadingLearningCurve(false);
    }
  };

  // Auto-run comparison on load if query param ?compare=true
  useEffect(() => {
    if (typeof window !== 'undefined' && selectedContact && window.location.search.includes('compare=true')) {
      setCompareMode(true);
      (async () => {
        setIsGenerating(true);
        try {
          const [resWith, resWithout] = await Promise.all([
            generateSingleBriefing(true),
            generateSingleBriefing(false),
          ]);
          if (resWith?.briefing) {
            setBriefingWithMemory(resWith.briefing);
            setRecalledMemories(resWith.relevantMemories || []);
          }
          if (resWithout?.briefing) {
            setBriefingWithoutMemory(resWithout.briefing);
          }
        } finally {
          setIsGenerating(false);
        }
      })();
    }
  }, [selectedContact]);

  // Generate briefing API call
  const generateSingleBriefing = async (withMem: boolean) => {
    if (!selectedContact) return null;
    const res = await fetch('/api/briefing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contactId: selectedContact.id,
        upcomingAgenda,
        meetingGoal,
        useMemory: withMem,
      }),
    });
    return await res.json();
  };

  // Generate pre-meeting briefing
  const handleGenerateBriefing = async (overrideMemory?: boolean) => {
    if (!selectedContact) return;
    setIsGenerating(true);
    setBriefingError(null);

    const memMode = overrideMemory !== undefined ? overrideMemory : useMemory;

    try {
      if (compareMode) {
        const [resWith, resWithout] = await Promise.all([
          generateSingleBriefing(true),
          generateSingleBriefing(false),
        ]);

        if (resWith?.error || resWithout?.error) {
          const errRes = resWith?.error ? resWith : resWithout;
          setBriefingError({
            service: errRes.service || 'unknown',
            title: errRes.service === 'groq'
              ? (errRes.statusCode === 429 ? 'Groq Rate Limit Exceeded' : 'Groq LLM Service Unavailable')
              : errRes.service === 'hindsight'
              ? 'Hindsight Memory Bank Error'
              : 'Briefing Generation Failed',
            message: errRes.error || 'Failed to generate comparison briefing',
            rawError: errRes.rawError,
            statusCode: errRes.statusCode,
          });
        }

        if (resWith?.briefing) {
          setBriefingWithMemory(resWith.briefing);
          setRecalledMemories(resWith.relevantMemories || []);
        }
        if (resWithout?.briefing) {
          setBriefingWithoutMemory(resWithout.briefing);
        }
      } else {
        const data = await generateSingleBriefing(memMode);
        if (data?.briefing) {
          if (memMode) {
            setBriefingWithMemory(data.briefing);
            setRecalledMemories(data.relevantMemories || []);
          } else {
            setBriefingWithoutMemory(data.briefing);
          }
        } else {
          setBriefingError({
            service: data?.service || 'unknown',
            title: data?.service === 'groq'
              ? (data?.statusCode === 429 ? 'Groq Rate Limit Exceeded' : 'Groq LLM Service Unavailable')
              : data?.service === 'hindsight'
              ? 'Hindsight Memory Bank Error'
              : 'Briefing Generation Failed',
            message: data?.error || 'Failed to generate pre-meeting briefing',
            rawError: data?.rawError,
            statusCode: data?.statusCode,
          });
        }
      }
    } catch (e) {
      console.error('Error generating briefing:', e);
      setBriefingError({
        service: 'network',
        title: 'Network Communication Error',
        message: 'Could not connect to the briefing generation API. Please ensure the local server is running and reachable.',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  // Live Memory Search
  const handleMemorySearch = async (queryText?: string) => {
    const q = queryText || memoryQuery;
    if (!q) return;
    setMemorySearchLoading(true);
    setMemorySearchError(null);
    try {
      const res = await fetch('/api/memory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: q,
          contactId: selectedContact?.id,
          budget: 'high',
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setMemorySearchError(data.error || 'Failed to recall facts from Hindsight memory bank');
      } else {
        setMemorySearchResults(data.facts || []);
      }
    } catch (e) {
      console.error('Memory search error:', e);
      setMemorySearchError('Network error connecting to Hindsight memory service.');
    } finally {
      setMemorySearchLoading(false);
    }
  };

  // Create new meeting note
  const handleCreateNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedContact || !newNoteSummary) return;

    setIsSubmittingNote(true);
    try {
      const promisesList = newNotePromises
        .split('\n')
        .map((p) => p.trim())
        .filter(Boolean);
      const questionsList = newNoteQuestions
        .split('\n')
        .map((q) => q.trim())
        .filter(Boolean);

      const res = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contactId: selectedContact.id,
          date: newNoteDate,
          summary: newNoteSummary,
          promisesMade: promisesList,
          openQuestions: questionsList,
          sentiment: newNoteSentiment,
          rawNotes: newNoteRaw,
        }),
      });

      if (res.ok) {
        setShowNoteModal(false);
        setNewNoteSummary('');
        setNewNotePromises('');
        setNewNoteQuestions('');
        setNewNoteRaw('');
        selectContact(selectedContact);
        fetchContacts();
      }
    } catch (e) {
      console.error('Error logging note:', e);
    } finally {
      setIsSubmittingNote(false);
    }
  };

  // Create new contact
  const handleCreateContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newContactName || !newContactCompany) return;

    try {
      const res = await fetch('/api/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newContactName,
          company: newContactCompany,
          role: newContactRole,
          email: newContactEmail,
        }),
      });

      if (res.ok) {
        setShowContactModal(false);
        setNewContactName('');
        setNewContactCompany('');
        setNewContactRole('');
        setNewContactEmail('');
        fetchContacts();
      }
    } catch (e) {
      console.error('Error creating contact:', e);
    }
  };

  // Submit Post-Meeting Debrief
  const handleSubmitDebrief = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedContact || !debriefNotes.trim()) return;

    setIsSubmittingDebrief(true);
    setDebriefError(null);
    try {
      const res = await fetch('/api/debrief', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contactId: selectedContact.id,
          date: debriefDate,
          outcome: debriefOutcome,
          rawNotes: debriefNotes,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setDebriefResult(data);
        selectContact(selectedContact);
        fetchContacts();
      } else {
        setDebriefError(data.error || 'Failed to submit post-meeting debrief');
      }
    } catch (err) {
      console.error('Debrief error:', err);
      setDebriefError('Network error connecting to post-meeting debrief service.');
    } finally {
      setIsSubmittingDebrief(false);
    }
  };

  // Copy briefing text
  const copyBriefingToClipboard = (targetBriefing: DetailedBriefing, title: string) => {
    if (!targetBriefing || !selectedContact) return;
    const isStage1 = title.includes('Stage 1');
    const isMem = !title.includes('Without Memory');
    const defaultPlaceholder = isStage1 ? 'No meetings on record before this date.' : 'No prior commitments on record (memory disabled)';
    const ourPromisesList = targetBriefing.commitments?.ourPromises || [];
    const theirPromisesList = targetBriefing.commitments?.theirPromises || [];
    const questionsList = targetBriefing.unresolvedQuestions || [];
    const agendaList = targetBriefing.recommendedAgenda || [];
    const talkingPointsList = targetBriefing.talkingPointsAndStrategy || [];
    const redFlagsList = targetBriefing.redFlagsAndSensitivities || [];

    const ourPromisesText = ourPromisesList.length > 0
      ? ourPromisesList.map((p) => `- [${p.status.toUpperCase()}] ${p.promise}${p.impact ? ` (Impact: ${p.impact})` : ''}`).join('\n')
      : !isMem ? defaultPlaceholder : 'No prior commitments by our team on record';

    const theirPromisesText = theirPromisesList.length > 0
      ? theirPromisesList.map((p) => `- [${p.status.toUpperCase()}] ${p.promise}`).join('\n')
      : !isMem ? defaultPlaceholder : 'No prior commitments by contact on record';

    const questionsText = questionsList.length > 0
      ? questionsList.map((q) => `- [${q.urgency.toUpperCase()}] ${q.question}\n  Suggested Response: ${q.suggestedAnswer}`).join('\n')
      : !isMem ? (isStage1 ? 'No meetings on record before this date.' : 'No prior unresolved questions on record (memory disabled)') : 'No unresolved questions recorded';

    const sentimentText = (!isMem && (!targetBriefing.relationshipHealth?.sentimentTrajectory || targetBriefing.relationshipHealth.sentimentTrajectory.toLowerCase().includes('no prior')))
      ? (isStage1 ? 'No meetings on record before this date.' : 'No prior sentiment trajectory on record (memory disabled)')
      : (targetBriefing.relationshipHealth?.sentimentTrajectory || (!isMem ? (isStage1 ? 'No meetings on record before this date.' : 'No prior sentiment trajectory on record (memory disabled)') : 'No sentiment trajectory recorded'));

    const talkingPointsText = talkingPointsList.length > 0
      ? talkingPointsList.map((tp) => `- ${tp}`).join('\n')
      : !isMem ? (isStage1 ? 'No meetings on record before this date.' : 'No prior customized talking points on record (memory disabled)') : 'No specific talking points recorded';

    const redFlagsText = redFlagsList.length > 0
      ? redFlagsList.map((rf) => `- ${rf}`).join('\n')
      : !isMem ? (isStage1 ? 'No meetings on record before this date.' : 'No prior sensitivities or cautions on record (memory disabled)') : 'No specific sensitivities or cautions identified';

    const recApproach = targetBriefing.recommendedApproach;
    const advancingText = recApproach?.advancingTactics && recApproach.advancingTactics.length > 0
      ? recApproach.advancingTactics.map((t) => `+ ${t}`).join('\n')
      : !isMem ? (isStage1 ? 'No meetings on record before this date.' : 'No historical outcome data on record (memory disabled)') : 'No advancing tactics recorded';
    const stallingText = recApproach?.stallingTacticsToAvoid && recApproach.stallingTacticsToAvoid.length > 0
      ? recApproach.stallingTacticsToAvoid.map((t) => `- ${t}`).join('\n')
      : !isMem ? (isStage1 ? 'No meetings on record before this date.' : 'No historical outcome data on record (memory disabled)') : 'No stalling tactics recorded';
    const strategicApproachSummary = recApproach?.strategicSummary || (!isMem ? (isStage1 ? 'No meetings on record before this date.' : 'No historical outcome data on record (memory disabled)') : '');

    const text = `
Pre-Meeting Briefing [${title}]: ${selectedContact.name} (${selectedContact.company})
Date: ${new Date().toLocaleDateString()}
Status: ${!isMem ? (isStage1 ? 'UNKNOWN (NO PRIOR MEETINGS)' : 'UNKNOWN (MEMORY DISABLED)') : `${targetBriefing.relationshipHealth?.status?.toUpperCase() || 'UNKNOWN'} (Trust: ${targetBriefing.relationshipHealth?.trustLevel || 'unknown'})`}

Executive Summary:
${targetBriefing.executiveSummary || (!isMem ? (isStage1 ? 'No meetings on record before this date.' : 'No prior relationship context on record (memory disabled)') : 'No executive summary available.')}

Sentiment Trajectory:
${sentimentText}

Commitments and Promises:
Our Commitments:
${ourPromisesText}

Their Commitments:
${theirPromisesText}

Unresolved Questions:
${questionsText}

Recommended Agenda:
${agendaList.map((a) => `- ${a.timeframe} (${a.topic}): ${a.objective}`).join('\n')}

Key Talking Points:
${talkingPointsText}

Recommended Tactical Approach:
Advancing Tactics:
${advancingText}

Tactics to Avoid (Stalled Past Meetings):
${stallingText}
${strategicApproachSummary ? `\nStrategic Approach Summary:\n${strategicApproachSummary}` : ''}

Sensitivities and Cautions:
${redFlagsText}
    `.trim();

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const filteredContacts = contacts.filter(
    (c) =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.company.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.role.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getSentimentBadge = (sentiment: string) => {
    switch (sentiment) {
      case 'positive':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-medium bg-[#dfe7e1] text-[#436b4d] rounded-[16px] border border-[#bcd4c0]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#436b4d]" />
            Positive
          </span>
        );
      case 'negative':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-medium bg-[#ede2df] text-[#8f3e3e] rounded-[16px] border border-[#deb8b8]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#8f3e3e]" />
            Critical
          </span>
        );
      case 'mixed':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-medium bg-[#f2e7d8] text-[#7a4f1a] rounded-[16px] border border-[#e5cfac]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#7a4f1a]" />
            Mixed
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-medium bg-[#e4ded4] text-[#3d3731] rounded-[16px] border border-[#d5d4ce]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#5c5750]" />
            Neutral
          </span>
        );
    }
  };

  // Helper component to render a briefing column
  const renderBriefingCard = (b: DetailedBriefing, isMemory: boolean) => {
    const ourPromises = b.commitments?.ourPromises || [];
    const theirPromises = b.commitments?.theirPromises || [];
    const unresolvedQuestions = b.unresolvedQuestions || [];
    const recommendedAgenda = b.recommendedAgenda || [];
    const talkingPoints = b.talkingPointsAndStrategy || [];
    const redFlags = b.redFlagsAndSensitivities || [];
    const isSentimentDisabled =
      !isMemory &&
      (!b.relationshipHealth?.sentimentTrajectory ||
        b.relationshipHealth.sentimentTrajectory.toLowerCase().includes('no prior'));

    return (
      <div className="clay-card p-5 sm:p-6 flex flex-col gap-4 text-xs">
        {/* Header Banner */}
        <div className="flex items-center justify-between pb-3 border-b border-[#ded7ca]">
          <div>
            <span className="font-heading font-semibold text-xs uppercase tracking-wider text-[#2a2622] block">
              {isMemory ? 'With Hindsight Memory' : 'Without Memory (Cold Baseline)'}
            </span>
            <p className="text-xs text-[#3d3731] mt-0.5">
              {isMemory
                ? `Indexed from ${meetings.length} past meetings (${recalledMemories.length} facts recalled)`
                : 'No historical notes or past commitment records'}
            </p>
          </div>

          <button
            onClick={() => copyBriefingToClipboard(b, isMemory ? 'With Memory' : 'Without Memory')}
            className="px-3 py-1 text-xs font-medium clay-btn-secondary"
          >
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>

        {/* Executive Summary */}
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-[#3d3731] block mb-1">
            Executive Summary
          </span>
          <p className="text-xs leading-relaxed font-normal text-[#2a2622]">
            {b.executiveSummary ||
              (!isMemory
                ? 'No prior relationship context on record (memory disabled)'
                : 'No executive summary available.')}
          </p>
        </div>

        {/* Relationship Health */}
        <div className="p-3 clay-inset rounded-[20px] flex items-center justify-between">
          <div>
            <span className="text-xs text-[#3d3731] block uppercase font-medium">Relationship status:</span>
            <span className="font-bold text-[#2a2622] text-xs">
              {!isMemory
                ? 'UNKNOWN (MEMORY DISABLED)'
                : `${b.relationshipHealth?.status?.toUpperCase() || 'UNKNOWN'} (Trust: ${b.relationshipHealth?.trustLevel || 'unknown'})`}
            </span>
          </div>
          <span className="px-2.5 py-0.5 text-xs font-medium clay-btn-secondary">
            {!isMemory ? 'memory disabled' : b.relationshipHealth?.status || 'unknown'}
          </span>
        </div>

        {/* Sentiment Trajectory */}
        <div>
          <span className="text-xs font-bold text-[#3d3731] uppercase tracking-wider block mb-1">
            Sentiment Trajectory:
          </span>
          {isSentimentDisabled ? (
            <div className="p-2.5 text-xs text-[#3d3731] italic clay-inset rounded-[18px]">
              No prior sentiment trajectory on record (memory disabled)
            </div>
          ) : (
            <p className="text-xs text-[#443e37] leading-relaxed">
              {b.relationshipHealth?.sentimentTrajectory ||
                (!isMemory
                  ? 'No prior sentiment trajectory on record (memory disabled)'
                  : 'No sentiment trajectory recorded')}
            </p>
          )}
        </div>

        {/* Promises and Commitments */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-bold text-[#3d3731] uppercase tracking-wider block">
              Commitments and Promises
            </span>
            <span className="text-xs text-[#3d3731] font-medium">
              {ourPromises.length + theirPromises.length} tracked
            </span>
          </div>

          <div className="space-y-2.5">
            {/* Our Commitments */}
            <div>
              <span className="text-xs font-semibold text-[#3d3731] block mb-1">
                Our Commitments ({ourPromises.length})
              </span>
              <div className="space-y-1.5">
                {ourPromises.length > 0 ? (
                  ourPromises.map((p, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 clay-card-flat rounded-[18px] flex flex-col gap-0.5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-medium text-[#2a2622] text-xs">
                          {p.promise}
                        </span>
                        <span
                          className={`px-2 py-0.5 text-xs font-bold uppercase shrink-0 rounded-[14px] border ${
                            p.status === 'broken'
                              ? 'bg-[#ede2df] text-[#8f3e3e] border-[#deb8b8]'
                              : p.status === 'kept'
                              ? 'bg-[#dfe7e1] text-[#436b4d] border-[#bcd4c0]'
                              : 'bg-[#e4ded4] text-[#3d3731] border-[#d5d4ce]'
                          }`}
                        >
                          {p.status}
                        </span>
                      </div>
                      {p.impact && (
                        <p className="text-xs text-[#3d3731] italic mt-0.5">
                          Impact: {p.impact}
                        </p>
                      )}
                      {p.sourceDate && (
                        <div className="mt-1">
                          <button
                            type="button"
                            onClick={() => handleOpenMeeting(p.sourceDate, p.sourceDocumentId)}
                            className="inline-flex items-center gap-1 text-xs font-medium text-[#3d3731] hover:text-[#2a2622] underline decoration-[#8a7f72] transition-colors cursor-pointer"
                          >
                            Source: {formatMeetingDate(p.sourceDate)}
                          </button>
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="p-2.5 text-xs text-[#3d3731] italic clay-inset rounded-[18px]">
                    {!isMemory
                      ? 'No prior commitments on record (memory disabled)'
                      : 'No prior commitments by our team on record'}
                  </div>
                )}
              </div>
            </div>

            {/* Their Commitments */}
            <div>
              <span className="text-xs font-semibold text-[#3d3731] block mb-1">
                Their Commitments ({theirPromises.length})
              </span>
              <div className="space-y-1.5">
                {theirPromises.length > 0 ? (
                  theirPromises.map((p, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 clay-card-flat rounded-[18px] flex flex-col gap-0.5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-medium text-[#2a2622] text-xs">
                          {p.promise}
                        </span>
                        <span
                          className={`px-2 py-0.5 text-xs font-bold uppercase shrink-0 rounded-[14px] border ${
                            p.status === 'fulfilled' || p.status === 'kept'
                              ? 'bg-[#dfe7e1] text-[#436b4d] border-[#bcd4c0]'
                              : 'bg-[#e4ded4] text-[#3d3731] border-[#d5d4ce]'
                          }`}
                        >
                          {p.status}
                        </span>
                      </div>
                      {p.sourceDate && (
                        <div className="mt-1">
                          <button
                            type="button"
                            onClick={() => handleOpenMeeting(p.sourceDate, p.sourceDocumentId)}
                            className="inline-flex items-center gap-1 text-xs font-medium text-[#3d3731] hover:text-[#2a2622] underline decoration-[#8a7f72] transition-colors cursor-pointer"
                          >
                            Source: {formatMeetingDate(p.sourceDate)}
                          </button>
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="p-2.5 text-xs text-[#3d3731] italic clay-inset rounded-[18px]">
                    {!isMemory
                      ? 'No prior commitments on record (memory disabled)'
                      : 'No prior commitments by contact on record'}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Unresolved Questions */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-bold text-[#3d3731] uppercase tracking-wider block">
              Unresolved Questions and Objections
            </span>
            <span className="text-xs text-[#3d3731] font-medium">
              {unresolvedQuestions.length} tracked
            </span>
          </div>
          <div className="space-y-1.5">
            {unresolvedQuestions.length > 0 ? (
              unresolvedQuestions.map((q, idx) => (
                <div
                  key={idx}
                  className="p-2.5 clay-card-flat rounded-[18px] flex flex-col gap-1"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-bold text-xs text-[#2a2622]">
                      {q.question}
                    </span>
                    <span className="text-xs font-medium px-2 py-0.5 bg-[#e4ded4] border border-[#d5d4ce] text-[#3d3731] rounded-[14px] shrink-0">
                      {q.urgency} urgency
                    </span>
                  </div>
                  {q.suggestedAnswer && (
                    <p className="text-xs text-[#443e37]">
                      <span className="font-semibold text-[#2a2622]">Suggested response:</span> {q.suggestedAnswer}
                    </p>
                  )}
                  {q.sourceDate && (
                    <div className="mt-1">
                      <button
                        type="button"
                        onClick={() => handleOpenMeeting(q.sourceDate, q.sourceDocumentId)}
                        className="inline-flex items-center gap-1 text-xs font-medium text-[#3d3731] hover:text-[#2a2622] underline decoration-[#8a7f72] transition-colors cursor-pointer"
                      >
                        Source: {formatMeetingDate(q.sourceDate)}
                      </button>
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="p-2.5 text-xs text-[#3d3731] italic clay-inset rounded-[18px]">
                {!isMemory
                  ? 'No prior unresolved questions on record (memory disabled)'
                  : 'No unresolved questions recorded'}
              </div>
            )}
          </div>
        </div>

        {/* Recommended Agenda */}
        <div>
          <span className="text-xs font-bold text-[#3d3731] uppercase tracking-wider block mb-1.5">
            Recommended Agenda
          </span>
          <div className="space-y-1">
            {recommendedAgenda.length > 0 ? (
              recommendedAgenda.map((item, idx) => (
                <div
                  key={idx}
                  className="p-2 clay-card-flat rounded-[18px] text-xs"
                >
                  <span className="font-semibold text-[#2a2622]">{item.timeframe}:</span>{' '}
                  <span className="font-medium text-[#2a2622]">{item.topic}</span>
                  <p className="text-xs text-[#3d3731] mt-0.5">{item.objective}</p>
                </div>
              ))
            ) : (
              <div className="p-2.5 text-xs text-[#3d3731] italic clay-inset rounded-[18px]">
                {!isMemory
                  ? 'Standard agenda only (memory disabled)'
                  : 'No recommended agenda available'}
              </div>
            )}
          </div>
        </div>

        {/* Talking Points & Strategy */}
        <div>
          <span className="text-xs font-bold text-[#3d3731] uppercase tracking-wider block mb-1.5">
            Key Talking Points
          </span>
          <div className="space-y-1">
            {talkingPoints.length > 0 ? (
              talkingPoints.map((tp, idx) => (
                <div
                  key={idx}
                  className="p-2 clay-card-flat rounded-[18px] text-xs flex items-start gap-1.5"
                >
                  <span className="text-[#3d3731] font-bold shrink-0">-</span>
                  <span className="text-[#2a2622]">{tp}</span>
                </div>
              ))
            ) : (
              <div className="p-2.5 text-xs text-[#3d3731] italic clay-inset rounded-[18px]">
                {!isMemory
                  ? 'No prior customized talking points on record (memory disabled)'
                  : 'No specific talking points recorded'}
              </div>
            )}
          </div>
        </div>

        {/* Recommended Tactical Approach */}
        <div className="clay-card-flat p-3.5 rounded-[20px] space-y-2 border border-[#ded7ca]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#3d3731] uppercase tracking-wider block">
              Recommended Tactical Approach
            </span>
            {isMemory && (
              <span className="px-2 py-0.5 text-xs font-semibold bg-[#dfe7e1] text-[#436b4d] rounded-[12px] border border-[#bcd4c0] uppercase">
                Hindsight Reflect Synthesis
              </span>
            )}
          </div>

          {!isMemory ? (
            <div className="p-2.5 text-xs text-[#3d3731] italic clay-inset rounded-[18px]">
              No historical outcome data on record (memory disabled)
            </div>
          ) : b.recommendedApproach ? (
            <div className="space-y-2.5 text-xs">
              {b.recommendedApproach.strategicSummary && (
                <p className="text-xs text-[#2a2622] leading-relaxed font-medium bg-[#eee8dc] p-2.5 rounded-[16px] border border-[#ded7ca]">
                  {b.recommendedApproach.strategicSummary}
                </p>
              )}

              {/* Advancing Tactics */}
              {b.recommendedApproach.advancingTactics && b.recommendedApproach.advancingTactics.length > 0 && (
                <div>
                  <span className="text-xs font-semibold text-[#436b4d] flex items-center gap-1.5 mb-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#436b4d]" />
                    Tactics That Advanced Past Meetings
                  </span>
                  <div className="space-y-1">
                    {b.recommendedApproach.advancingTactics.map((tactic, idx) => (
                      <div key={idx} className="p-2 bg-[#dfe7e1]/50 border border-[#bcd4c0] rounded-[16px] text-xs text-[#2a2622]">
                        {tactic}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Stalling Tactics to Avoid */}
              {b.recommendedApproach.stallingTacticsToAvoid && b.recommendedApproach.stallingTacticsToAvoid.length > 0 && (
                <div>
                  <span className="text-xs font-semibold text-[#8f3e3e] flex items-center gap-1.5 mb-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#8f3e3e]" />
                    Tactics That Stalled Meetings (Avoid)
                  </span>
                  <div className="space-y-1">
                    {b.recommendedApproach.stallingTacticsToAvoid.map((tactic, idx) => (
                      <div key={idx} className="p-2 bg-[#ede2df]/60 border border-[#deb8b8] rounded-[16px] text-xs text-[#2a2622]">
                        {tactic}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="p-2.5 text-xs text-[#3d3731] italic clay-inset rounded-[18px]">
              No past outcome patterns synthesized yet.
            </div>
          )}
        </div>

        {/* Red Flags / Sensitivities */}
        <div
          className={`p-3 rounded-[20px] ${
            !isMemory ? 'clay-inset' : 'bg-[#ede2df] border border-[#deb8b8] rounded-[20px]'
          }`}
        >
          <span
            className={`text-xs font-bold uppercase tracking-wider block mb-1 ${
              !isMemory ? 'text-[#3d3731]' : 'text-[#8f3e3e]'
            }`}
          >
            Sensitivities and Cautions
          </span>
          {redFlags.length > 0 ? (
            <ul className="space-y-1.5">
              {redFlags.map((rf, idx) => {
                const rfText = typeof rf === 'string' ? rf : rf.text;
                const rfDate = typeof rf === 'object' && rf ? rf.sourceDate : undefined;
                const rfDocId = typeof rf === 'object' && rf ? rf.sourceDocumentId : undefined;
                return (
                  <li
                    key={idx}
                    className={`text-xs flex flex-col gap-0.5 leading-snug ${
                      !isMemory ? 'text-[#443e37]' : 'text-[#692929]'
                    }`}
                  >
                    <div className="flex items-start gap-1.5">
                      <span
                        className={`font-bold shrink-0 ${!isMemory ? 'text-[#3d3731]' : 'text-[#8f3e3e]'}`}
                      >
                        -
                      </span>
                      <span>{rfText}</span>
                    </div>
                    {rfDate && (
                      <div className="ml-3">
                        <button
                          type="button"
                          onClick={() => handleOpenMeeting(rfDate, rfDocId)}
                          className="inline-flex items-center gap-1 text-xs font-medium text-[#3d3731] hover:text-[#2a2622] underline decoration-[#8a7f72] transition-colors cursor-pointer"
                        >
                          Source: {formatMeetingDate(rfDate)}
                        </button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="text-xs text-[#3d3731] italic">
              {!isMemory
                ? 'No prior sensitivities or cautions on record (memory disabled)'
                : 'No specific sensitivities or cautions identified'}
            </div>
          )}
        </div>
      </div>
    );
  };

  // Helper component to render the selected Learning Curve Stage at full width with a two-column layout
  const renderLearningCurveSelectedStage = (stage: import('@/types').LearningCurveStage) => {
    const b = stage.briefing;
    const ourPromises = b.commitments?.ourPromises || [];
    const theirPromises = b.commitments?.theirPromises || [];
    const questions = b.unresolvedQuestions || [];
    const agenda = b.recommendedAgenda || [];
    const talkingPoints = b.talkingPointsAndStrategy || [];
    const redFlags = b.redFlagsAndSensitivities || [];
    const isStage1 = stage.stageIndex === 1;
    const isStage2 = stage.stageIndex === 2;

    return (
      <div key={stage.stageIndex} className="clay-card p-5 sm:p-6 space-y-5 text-xs">
        {/* Stage Header Banner */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-[#ded7ca] gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  stage.stageIndex === 1 ? 'bg-[#7d756b]' : stage.stageIndex === 2 ? 'bg-[#436b4d]' : 'bg-[#b8623f]'
                }`}
              />
              <h3 className="font-heading font-bold text-sm uppercase tracking-wider text-[#2a2622]">
                {stage.title}
              </h3>
            </div>
            <p className="text-xs text-[#3d3731] mt-0.5">{stage.subtitle}</p>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <span className="px-2.5 py-1 text-xs font-mono font-semibold bg-[#e4ded4] text-[#3d3731] rounded-[10px] border border-[#d5d4ce]">
                {stage.meetingThreshold}
              </span>
              <span className="px-2.5 py-1 text-xs font-mono text-[#3d3731] bg-[#eee8dc] rounded-[10px] border border-[#ded7ca]">
                Cutoff: &lt; {stage.cutoffDate}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => copyBriefingToClipboard(b as any, stage.title)}
              className="px-3.5 py-1.5 text-xs font-medium clay-btn-secondary shrink-0 cursor-pointer"
            >
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
        </div>

        {/* Two-Column Inner Layout: Left (Summary & Commitments, Tactical, Talking Points) / Right (Questions, Sensitivities, Agenda) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          {/* Left Column: Summary and Commitments */}
          <div className="space-y-4">
            {/* Executive Summary */}
            <div className="clay-card-flat p-4 rounded-[20px] border border-[#ded7ca] space-y-1.5">
              <span className="text-xs font-bold uppercase tracking-wider text-[#3d3731] block">
                Executive Summary
              </span>
              <p className="text-xs leading-relaxed text-[#2a2622]">
                {b.executiveSummary}
              </p>
            </div>

            {/* Relationship Health */}
            <div className="clay-card-flat p-4 rounded-[20px] border border-[#ded7ca] space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs text-[#3d3731] block uppercase font-medium">Relationship status:</span>
                  <span className="font-bold text-[#2a2622] text-xs">
                    {b.relationshipHealth.status} (Trust: {b.relationshipHealth.trustLevel})
                  </span>
                </div>
                <span
                  className={`px-2.5 py-0.5 text-xs font-bold uppercase rounded-[12px] border ${
                    isStage1
                      ? 'bg-[#e4ded4] text-[#3d3731] border-[#d5d4ce]'
                      : isStage2
                      ? 'bg-[#dfe7e1] text-[#436b4d] border-[#bcd4c0]'
                      : 'bg-[#ede2df] text-[#8f3e3e] border-[#deb8b8]'
                  }`}
                >
                  {isStage1 ? 'baseline' : b.relationshipHealth.status}
                </span>
              </div>

              <div>
                <span className="text-xs font-bold text-[#3d3731] uppercase tracking-wider block mb-1">
                  Sentiment Trajectory:
                </span>
                <p className="text-xs text-[#443e37] leading-relaxed italic">
                  {b.relationshipHealth.sentimentTrajectory}
                </p>
              </div>
            </div>

            {/* Commitments & Promises */}
            <div className="clay-card-flat p-4 rounded-[20px] border border-[#ded7ca] space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#3d3731] uppercase tracking-wider block">
                  Commitments & Promises
                </span>
                <span className="text-xs text-[#3d3731] font-mono">
                  {stage.metrics.promisesTracked} tracked
                </span>
              </div>

              {/* Our Commitments */}
              <div className="space-y-1.5">
                <span className="text-xs font-semibold text-[#3d3731] block">
                  Our Commitments ({ourPromises.length})
                </span>
                {ourPromises.length > 0 ? (
                  <div className="space-y-2">
                    {ourPromises.map((p, idx) => (
                      <div key={idx} className="p-2.5 bg-[#eee8dc] rounded-[16px] border border-[#ded7ca] flex flex-col gap-0.5">
                        <div className="flex items-start justify-between gap-1.5">
                          <span className="font-medium text-[#2a2622] text-xs leading-snug">
                            {p.promise}
                          </span>
                          <span
                            className={`px-1.5 py-0.5 text-xs font-bold uppercase shrink-0 rounded-[10px] border ${
                              p.status === 'broken'
                                ? 'bg-[#ede2df] text-[#8f3e3e] border-[#deb8b8]'
                                : p.status === 'kept'
                                ? 'bg-[#dfe7e1] text-[#436b4d] border-[#bcd4c0]'
                                : 'bg-[#e4ded4] text-[#3d3731] border-[#d5d4ce]'
                            }`}
                          >
                            {p.status}
                          </span>
                        </div>
                        {p.impact && (
                          <p className="text-xs text-[#3d3731] italic mt-0.5">{p.impact}</p>
                        )}
                        {p.sourceDate && (
                          <div className="mt-1">
                            <button
                              type="button"
                              onClick={() => handleOpenMeeting(p.sourceDate || undefined, p.sourceDocumentId || undefined)}
                              className="inline-flex items-center gap-1 text-xs font-medium text-[#3d3731] hover:text-[#2a2622] underline decoration-[#8a7f72] cursor-pointer"
                            >
                              Source: {formatMeetingDate(p.sourceDate)}
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-2.5 text-xs text-[#3d3731] italic bg-[#eee8dc] rounded-[16px] border border-[#ded7ca]">
                    No meetings on record before this date.
                  </div>
                )}
              </div>

              {/* Their Commitments */}
              <div className="space-y-1.5 pt-1">
                <span className="text-xs font-semibold text-[#3d3731] block">
                  Their Commitments ({theirPromises.length})
                </span>
                {theirPromises.length > 0 ? (
                  <div className="space-y-2">
                    {theirPromises.map((p, idx) => (
                      <div key={idx} className="p-2.5 bg-[#eee8dc] rounded-[16px] border border-[#ded7ca] flex flex-col gap-0.5">
                        <div className="flex items-start justify-between gap-1.5">
                          <span className="font-medium text-[#2a2622] text-xs leading-snug">
                            {p.promise}
                          </span>
                          <span className="px-1.5 py-0.5 text-xs font-bold uppercase shrink-0 rounded-[10px] bg-[#dfe7e1] text-[#436b4d] border border-[#bcd4c0]">
                            {p.status}
                          </span>
                        </div>
                        {p.sourceDate && (
                          <div className="mt-1">
                            <button
                              type="button"
                              onClick={() => handleOpenMeeting(p.sourceDate || undefined, p.sourceDocumentId || undefined)}
                              className="inline-flex items-center gap-1 text-xs font-medium text-[#3d3731] hover:text-[#2a2622] underline decoration-[#8a7f72] cursor-pointer"
                            >
                              Source: {formatMeetingDate(p.sourceDate)}
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-2.5 text-xs text-[#3d3731] italic bg-[#eee8dc] rounded-[16px] border border-[#ded7ca]">
                    No meetings on record before this date.
                  </div>
                )}
              </div>
            </div>

            {/* Recommended Tactical Approach */}
            {isStage1 ? (
              <div className="clay-card-flat p-4 rounded-[20px] space-y-2 border border-[#ded7ca]">
                <span className="text-xs font-bold text-[#3d3731] uppercase tracking-wider block">
                  Recommended Tactical Approach
                </span>
                <div className="p-2.5 text-xs text-[#3d3731] italic bg-[#eee8dc] rounded-[16px] border border-[#ded7ca]">
                  No meetings on record before this date.
                </div>
              </div>
            ) : b.recommendedApproach ? (
              <div className="clay-card-flat p-4 rounded-[20px] space-y-2.5 border border-[#ded7ca]">
                <span className="text-xs font-bold text-[#3d3731] uppercase tracking-wider block">
                  Recommended Tactical Approach
                </span>
                {b.recommendedApproach.strategicSummary && (
                  <p className="text-xs text-[#2a2622] leading-relaxed font-medium bg-[#eee8dc] p-2.5 rounded-[16px] border border-[#ded7ca]">
                    {b.recommendedApproach.strategicSummary}
                  </p>
                )}
                {b.recommendedApproach.advancingTactics && b.recommendedApproach.advancingTactics.length > 0 && (
                  <div>
                    <span className="text-xs font-semibold text-[#436b4d] block mb-1">
                      Tactics That Advanced Meetings
                    </span>
                    <div className="space-y-1">
                      {b.recommendedApproach.advancingTactics.map((t, idx) => (
                        <div key={idx} className="p-2 bg-[#dfe7e1]/50 border border-[#bcd4c0] rounded-[14px] text-xs text-[#2a2622]">
                          {t}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {b.recommendedApproach.stallingTacticsToAvoid && b.recommendedApproach.stallingTacticsToAvoid.length > 0 && (
                  <div>
                    <span className="text-xs font-semibold text-[#8f3e3e] block mb-1">
                      Tactics to Avoid (Stalled Meetings)
                    </span>
                    <div className="space-y-1">
                      {b.recommendedApproach.stallingTacticsToAvoid.map((t, idx) => (
                        <div key={idx} className="p-2 bg-[#ede2df]/60 border border-[#deb8b8] rounded-[14px] text-xs text-[#2a2622]">
                          {t}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : null}

            {/* Key Talking Points */}
            {talkingPoints.length > 0 && (
              <div className="clay-card-flat p-4 rounded-[20px] border border-[#ded7ca] space-y-2">
                <span className="text-xs font-bold text-[#3d3731] uppercase tracking-wider block">
                  Key Talking Points
                </span>
                <div className="space-y-1.5">
                  {talkingPoints.map((tp, idx) => (
                    <div key={idx} className="p-2 bg-[#eee8dc] rounded-[14px] border border-[#ded7ca] text-xs flex items-start gap-1.5">
                      <span className="text-[#3d3731] font-bold shrink-0">-</span>
                      <span className="text-[#2a2622]">{tp}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Questions, Sensitivities, Agenda */}
          <div className="space-y-4">
            {/* Unresolved Questions */}
            <div className="clay-card-flat p-4 rounded-[20px] border border-[#ded7ca] space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#3d3731] uppercase tracking-wider block">
                  Unresolved Questions & Objections ({questions.length})
                </span>
              </div>
              {questions.length > 0 ? (
                <div className="space-y-2">
                  {questions.map((q, idx) => (
                    <div key={idx} className="p-2.5 bg-[#eee8dc] rounded-[16px] border border-[#ded7ca] flex flex-col gap-1">
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-bold text-xs text-[#2a2622]">{q.question}</span>
                        <span className="text-xs font-medium px-1.5 py-0.5 bg-[#e4ded4] border border-[#d5d4ce] text-[#3d3731] rounded-[10px] shrink-0">
                          {q.urgency}
                        </span>
                      </div>
                      {q.suggestedAnswer && (
                        <p className="text-xs text-[#443e37]">
                          <span className="font-semibold text-[#2a2622]">Suggested response:</span> {q.suggestedAnswer}
                        </p>
                      )}
                      {q.sourceDate && (
                        <div className="mt-0.5">
                          <button
                            type="button"
                            onClick={() => handleOpenMeeting(q.sourceDate || undefined, q.sourceDocumentId || undefined)}
                            className="inline-flex items-center gap-1 text-xs font-medium text-[#3d3731] hover:text-[#2a2622] underline decoration-[#8a7f72] cursor-pointer"
                          >
                            Source: {formatMeetingDate(q.sourceDate)}
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-2.5 text-xs text-[#3d3731] italic bg-[#eee8dc] rounded-[16px] border border-[#ded7ca]">
                  No meetings on record before this date.
                </div>
              )}
            </div>

            {/* Sensitivities and Cautions */}
            <div
              className={`p-4 rounded-[20px] border ${
                isStage1 ? 'bg-[#eee8dc] border-[#ded7ca]' : 'bg-[#ede2df] border-[#deb8b8]'
              }`}
            >
              <span
                className={`text-xs font-bold uppercase tracking-wider block mb-2 ${
                  isStage1 ? 'text-[#3d3731]' : 'text-[#8f3e3e]'
                }`}
              >
                Sensitivities & Cautions ({redFlags.length})
              </span>
              {redFlags.length > 0 ? (
                <ul className="space-y-1.5">
                  {redFlags.map((rf, idx) => {
                    const rfText = typeof rf === 'string' ? rf : rf.text;
                    const rfDate = typeof rf === 'object' && rf ? rf.sourceDate : undefined;
                    const rfDocId = typeof rf === 'object' && rf ? rf.sourceDocumentId : undefined;
                    return (
                      <li key={idx} className="text-xs text-[#692929] flex flex-col gap-0.5">
                        <div className="flex items-start gap-1.5">
                          <span className="font-bold text-[#8f3e3e] shrink-0">-</span>
                          <span>{rfText}</span>
                        </div>
                        {rfDate && (
                          <div className="ml-3">
                            <button
                              type="button"
                              onClick={() => handleOpenMeeting(rfDate || undefined, rfDocId || undefined)}
                              className="inline-flex items-center gap-1 text-xs font-medium text-[#3d3731] hover:text-[#2a2622] underline decoration-[#8a7f72] cursor-pointer"
                            >
                              Source: {formatMeetingDate(rfDate)}
                            </button>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <div className="text-xs text-[#3d3731] italic">
                  No meetings on record before this date.
                </div>
              )}
            </div>

            {/* Recommended Agenda */}
            <div className="clay-card-flat p-4 rounded-[20px] border border-[#ded7ca] space-y-2">
              <span className="text-xs font-bold text-[#3d3731] uppercase tracking-wider block">
                Recommended Agenda
              </span>
              <div className="space-y-1.5">
                {agenda.map((item, idx) => (
                  <div key={idx} className="p-2.5 bg-[#eee8dc] rounded-[16px] border border-[#ded7ca] text-xs">
                    <span className="font-semibold text-[#2a2622]">{item.timeframe}:</span>{' '}
                    <span className="font-medium text-[#2a2622]">{item.topic}</span>
                    <p className="text-xs text-[#3d3731] mt-0.5">{item.objective}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen bg-[#e6dfd3] flex items-center justify-center font-sans text-xs text-[#3d3731]">
        Verifying demo session...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#e6dfd3] text-[#2a2622] flex flex-col font-sans">
      {/* Top Header */}
      <header className="sticky top-0 z-30 bg-[#e6dfd3]/90 backdrop-blur-sm border-b border-[#ded7ca] px-4 sm:px-6 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2">
              <span className="w-3.5 h-3.5 bg-[#b8623f] rounded-full inline-block" />
              <h1 className="font-heading text-base font-semibold tracking-tight text-[#2a2622]">
                Meeting Prep Agent
              </h1>
            </Link>
            <span className="px-2.5 py-0.5 text-xs font-medium bg-[#dfe7e1] text-[#436b4d] rounded-[16px] border border-[#bcd4c0]">
              Demo Workspace
            </span>
          </div>

          <div className="flex items-center gap-3">
            {/* System Status Indicators */}
            <div className="hidden md:flex items-center gap-3 px-3 py-1.5 clay-inset text-xs rounded-[20px]">
              <div className="flex items-center gap-1.5">
                <span className="text-[#3d3731] font-medium">Bank:</span>
                <span className="font-mono text-[#2a2622] font-semibold">nikhil</span>
              </div>
              <span className="text-[#d0c6b6]">|</span>
              <div className="flex items-center gap-1.5">
                <span className="text-[#3d3731] font-medium">Model:</span>
                <span className="font-mono text-[#2a2622] font-semibold">gpt-oss-120b</span>
              </div>
            </div>

            <Link
              href="/overview"
              className="px-3 py-1.5 text-xs font-medium clay-btn-secondary"
            >
              Overview
            </Link>

            <button
              onClick={handleSignOut}
              className="px-3 py-1.5 text-xs font-medium clay-btn-secondary text-[#8f3e3e]"
            >
              Sign Out
            </button>

            <button
              onClick={() => setShowContactModal(true)}
              className="px-3.5 py-1.5 text-xs font-semibold clay-btn-primary"
            >
              New Contact
            </button>
          </div>
        </div>
      </header>

      {/* Main Workspace Layout */}
      <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 py-6 flex-1 flex flex-col lg:flex-row gap-6">
        {/* Left Column: Contact Directory */}
        <aside className="w-full lg:w-80 shrink-0 space-y-4">
          <div className="clay-card p-4 sm:p-5 flex flex-col gap-3">
            <div className="flex items-center justify-between border-b border-[#ded7ca] pb-2.5">
              <h2 className="font-heading text-xs font-semibold uppercase tracking-wider text-[#3d3731]">
                Contacts Directory
              </h2>
              <span className="text-xs text-[#3d3731] font-mono">{contacts.length} Total</span>
            </div>

            <Link
              href="/overview"
              className="w-full py-2 px-3 text-xs font-semibold clay-btn-secondary flex items-center justify-between text-[#2a2622] rounded-[16px]"
            >
              <span>Portfolio Risk Overview</span>
              <span className="text-xs uppercase font-mono px-1.5 py-0.5 rounded-[8px] bg-[#ede2df] text-[#8f3e3e] border border-[#deb8b8]">
                4 Ranked
              </span>
            </Link>

            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search contacts, company, role..."
                className="w-full px-3 py-1.5 text-xs clay-input"
              />
            </div>

            {/* Contact Cards List */}
            <div className="space-y-2 max-h-[calc(100vh-250px)] overflow-y-auto pr-1">
              {filteredContacts.map((contact) => {
                const isSelected = selectedContact?.id === contact.id;
                return (
                  <div
                    key={contact.id}
                    onClick={() => selectContact(contact)}
                    className={`p-3 cursor-pointer transition-all rounded-[20px] text-xs flex flex-col gap-1.5 ${
                      isSelected
                        ? 'bg-[#eee8dc] border-2 border-[#b8623f]'
                        : 'clay-card-flat hover:border-[#b8623f]/40'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-1">
                      <div className="font-semibold text-[#2a2622] text-xs">
                        {contact.name}
                      </div>
                      <span className="text-xs px-2 py-0.5 rounded-[12px] bg-[#e4ded4] text-[#3d3731] border border-[#d5d4ce] font-medium shrink-0">
                        {contact.meetingCount} meetings
                      </span>
                    </div>

                    <div className="text-xs text-[#3d3731]">
                      {contact.role}
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-[#ded7ca]">
                      <span className="font-medium text-[#2a2622] text-xs">
                        {contact.company}
                      </span>
                      {getSentimentBadge(contact.latestSentiment)}
                    </div>
                  </div>
                );
              })}

              {filteredContacts.length === 0 && (
                <div className="p-4 text-center text-xs text-[#3d3731] italic clay-inset rounded-[20px]">
                  No contacts found matching search criteria.
                </div>
              )}
            </div>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 space-y-4">
          {selectedContact ? (
            <>
              {/* Contact Profile Banner */}
              <div className="clay-card p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2.5">
                    <h2 className="font-heading text-lg font-bold text-[#2a2622]">
                      {selectedContact.name}
                    </h2>
                    {getSentimentBadge(selectedContact.latestSentiment)}
                  </div>
                  <p className="text-xs text-[#3d3731]">
                    <span className="font-medium text-[#2a2622]">{selectedContact.role}</span> at{' '}
                    <span className="font-semibold text-[#2a2622]">{selectedContact.company}</span>
                    {selectedContact.email && ` | ${selectedContact.email}`}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <button
                    onClick={() => {
                      setDebriefResult(null);
                      setDebriefNotes('');
                      setDebriefDate(new Date().toISOString().slice(0, 10));
                      setDebriefOutcome('advanced');
                      setShowDebriefModal(true);
                    }}
                    className="px-3.5 py-1.5 text-xs font-semibold clay-btn-primary"
                  >
                    Post-Meeting Debrief
                  </button>

                  {/* Tab Switcher */}
                  <div className="clay-inset p-1 flex rounded-[22px] self-start sm:self-auto">
                    <button
                      onClick={() => setActiveTab('briefing')}
                      className={`px-3 py-1 text-xs font-medium rounded-[18px] transition-all ${
                        activeTab === 'briefing'
                          ? 'clay-btn-secondary font-semibold text-[#2a2622]'
                          : 'text-[#3d3731] hover:text-[#2a2622]'
                      }`}
                    >
                      Briefing
                    </button>
                    <button
                      onClick={() => setActiveTab('history')}
                      className={`px-3 py-1 text-xs font-medium rounded-[18px] transition-all ${
                        activeTab === 'history'
                          ? 'clay-btn-secondary font-semibold text-[#2a2622]'
                          : 'text-[#3d3731] hover:text-[#2a2622]'
                      }`}
                    >
                      Meetings ({meetings.length})
                    </button>
                    <button
                      onClick={() => setActiveTab('memory')}
                      className={`px-3 py-1 text-xs font-medium rounded-[18px] transition-all ${
                        activeTab === 'memory'
                          ? 'clay-btn-secondary font-semibold text-[#2a2622]'
                          : 'text-[#3d3731] hover:text-[#2a2622]'
                      }`}
                    >
                      Memory Inspector
                    </button>
                    <button
                      onClick={() => {
                        setActiveTab('learning-curve');
                        if (selectedContact) fetchLearningCurveData(selectedContact.id);
                      }}
                      className={`px-3 py-1 text-xs font-medium rounded-[18px] transition-all ${
                        activeTab === 'learning-curve'
                          ? 'clay-btn-secondary font-semibold text-[#2a2622]'
                          : 'text-[#3d3731] hover:text-[#2a2622]'
                      }`}
                    >
                      Learning Curve
                    </button>
                  </div>
                </div>
              </div>

              {/* Tab 1: Briefing Generator */}
              {activeTab === 'briefing' && (
                <div className="space-y-4">
                  {/* Briefing Generation Parameters */}
                  <div className="clay-card p-5 sm:p-6 space-y-4">
                    <div className="flex items-center justify-between border-b border-[#ded7ca] pb-2">
                      <h3 className="font-heading text-xs font-semibold uppercase tracking-wider text-[#3d3731]">
                        Meeting Context and Memory Mode
                      </h3>
                      <span className="text-xs text-[#3d3731]">
                        {selectedContact.name} ({meetings.length} past meetings)
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="block text-xs font-medium text-[#443e37]">
                          Upcoming Agenda and Topics:
                        </label>
                        <textarea
                          rows={2}
                          value={upcomingAgenda}
                          onChange={(e) => setUpcomingAgenda(e.target.value)}
                          placeholder="e.g. Discuss liability redlines, staging Datadog proxy status..."
                          className="w-full px-3 py-2 text-xs clay-input"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="block text-xs font-medium text-[#443e37]">
                          Meeting Goal and Desired Outcome:
                        </label>
                        <textarea
                          rows={2}
                          value={meetingGoal}
                          onChange={(e) => setMeetingGoal(e.target.value)}
                          placeholder="e.g. De-escalate tension, commit to General Counsel call..."
                          className="w-full px-3 py-2 text-xs clay-input"
                        />
                      </div>
                    </div>

                    {/* Mode Toggle Controls */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-[#443e37]">Memory Mode:</span>
                        <div className="clay-inset p-1 flex rounded-[22px]">
                          <button
                            type="button"
                            onClick={() => {
                              setUseMemory(true);
                              setCompareMode(false);
                            }}
                            className={`px-3 py-1 text-xs font-medium rounded-[18px] transition-all ${
                              useMemory && !compareMode
                                ? 'clay-btn-secondary font-semibold text-[#2a2622]'
                                : 'text-[#3d3731] hover:text-[#2a2622]'
                            }`}
                          >
                            With Memory
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setUseMemory(false);
                              setCompareMode(false);
                            }}
                            className={`px-3 py-1 text-xs font-medium rounded-[18px] transition-all ${
                              !useMemory && !compareMode
                                ? 'clay-btn-secondary font-semibold text-[#2a2622]'
                                : 'text-[#3d3731] hover:text-[#2a2622]'
                            }`}
                          >
                            Without Memory
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setCompareMode(true);
                            }}
                            className={`px-3 py-1 text-xs font-medium rounded-[18px] transition-all ${
                              compareMode
                                ? 'clay-btn-primary font-semibold text-white'
                                : 'text-[#3d3731] hover:text-[#2a2622]'
                            }`}
                          >
                            Side-by-Side Compare
                          </button>
                        </div>
                      </div>

                      <button
                        onClick={() => handleGenerateBriefing()}
                        disabled={isGenerating}
                        className="px-4 py-2 text-xs font-semibold clay-btn-primary disabled:opacity-50"
                      >
                        {isGenerating
                          ? 'Generating briefing...'
                          : compareMode
                          ? 'Generate Side-by-Side Comparison'
                          : useMemory
                          ? 'Generate Pre-Meeting Briefing (With Memory)'
                          : 'Generate Pre-Meeting Briefing (Without Memory)'}
                      </button>
                    </div>
                  </div>

                  {/* Error Alert Banner for Groq & Hindsight Failures */}
                  {briefingError && (
                    <div className="clay-card p-5 rounded-[24px] bg-[#ede2df] border-2 border-[#deb8b8] space-y-3 shadow-md animate-fadeIn">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`px-2.5 py-0.5 text-xs font-bold uppercase rounded-[10px] border ${
                            briefingError.service === 'groq'
                              ? 'bg-[#f4ede2] text-[#b8623f] border-[#d8cbbb]'
                              : briefingError.service === 'hindsight'
                              ? 'bg-[#dfe7e1] text-[#436b4d] border-[#bcd4c0]'
                              : 'bg-[#e4ded4] text-[#3d3731] border-[#d5d4ce]'
                          }`}>
                            {briefingError.service === 'groq' ? 'Groq LLM Service' : briefingError.service === 'hindsight' ? 'Hindsight Memory Bank' : 'Service Alert'}
                          </span>
                          <h4 className="font-heading text-sm font-bold text-[#8f3e3e]">
                            {briefingError.title}
                          </h4>
                        </div>

                        <button
                          type="button"
                          onClick={() => setBriefingError(null)}
                          className="text-xs font-semibold text-[#8f3e3e] hover:text-[#5e2727] cursor-pointer"
                        >
                          Dismiss
                        </button>
                      </div>

                      <p className="text-xs text-[#3d3731] leading-relaxed">
                        {briefingError.message}
                      </p>

                      {briefingError.rawError && (
                        <div className="p-2 bg-[#f8f5f0] border border-[#deb8b8] rounded-[12px] text-xs font-mono text-[#692929] break-all">
                          Diagnostic: {briefingError.rawError}
                        </div>
                      )}

                      <div className="flex items-center gap-2 pt-1 flex-wrap">
                        <button
                          type="button"
                          onClick={() => handleGenerateBriefing()}
                          className="px-3.5 py-1.5 text-xs font-semibold clay-btn-primary"
                        >
                          Retry
                        </button>

                        {briefingError.service === 'groq' && useMemory && (
                          <button
                            type="button"
                            onClick={() => {
                              setUseMemory(false);
                              handleGenerateBriefing(false);
                            }}
                            className="px-3.5 py-1.5 text-xs font-semibold clay-btn-secondary text-[#2a2622]"
                          >
                            Try Without Memory (Lightweight Prompt)
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => setBriefingError(null)}
                          className="px-3 py-1.5 text-xs font-medium clay-btn-secondary"
                        >
                          Close
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Contrast Notice if both are present */}
                  {briefingWithMemory && briefingWithoutMemory && (
                    <div className="clay-card p-4 text-xs space-y-1">
                      <h4 className="font-heading font-semibold text-[#2a2622]">
                        Side-by-Side Contrast Report
                      </h4>
                      <p className="text-[#3d3731] text-xs leading-relaxed">
                        Notice how the With Memory briefing captures specific broken promises, unresolved compliance blockers, and competitor migration threats, whereas the Without Memory briefing is completely generic.
                      </p>
                    </div>
                  )}

                  {/* Briefing Render Container */}
                  {(briefingWithMemory || briefingWithoutMemory) && (
                    <div className="space-y-4">
                      {briefingWithMemory && briefingWithoutMemory ? (
                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                          {renderBriefingCard(briefingWithMemory, true)}
                          {renderBriefingCard(briefingWithoutMemory, false)}
                        </div>
                      ) : briefingWithMemory ? (
                        <div>{renderBriefingCard(briefingWithMemory, true)}</div>
                      ) : briefingWithoutMemory ? (
                        <div>{renderBriefingCard(briefingWithoutMemory, false)}</div>
                      ) : null}

                      {/* Recalled Memory Facts Evidence Accordion */}
                      {briefingWithMemory && recalledMemories.length > 0 && (
                        <div className="clay-card p-4 space-y-3">
                          <button
                            onClick={() => setShowMemories(!showMemories)}
                            className="w-full flex items-center justify-between text-left text-xs font-semibold text-[#2a2622]"
                          >
                            <span className="font-heading">
                              Hindsight Memory Bank Citations ({recalledMemories.length} facts retrieved)
                            </span>
                            <span className="text-xs font-sans text-[#3d3731]">{showMemories ? 'Hide' : 'Show'}</span>
                          </button>

                          {showMemories && (
                            <div className="space-y-2 max-h-72 overflow-y-auto pt-2 border-t border-[#ded7ca]">
                              {recalledMemories.map((fact, idx) => (
                                <div
                                  key={idx}
                                  className="p-2.5 clay-card-flat rounded-[18px] text-xs flex flex-col gap-0.5"
                                >
                                  <p className="text-[#2a2622] font-normal">{fact.text}</p>
                                  <div className="flex items-center gap-3 text-xs text-[#3d3731]">
                                    {fact.occurredStart && <span>Date: {fact.occurredStart.slice(0, 10)}</span>}
                                    {fact.context && <span>Context: {fact.context}</span>}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {!briefingWithMemory && !briefingWithoutMemory && !isGenerating && (
                    <div className="clay-card p-10 text-center text-xs text-[#3d3731] flex flex-col items-center gap-2">
                      <h4 className="font-heading font-semibold text-[#2a2622] text-sm">
                        Ready to generate briefing for {selectedContact.name}
                      </h4>
                      <p className="text-[#3d3731] max-w-md">
                        Toggle between With Memory and Without Memory, or select Side-by-Side Compare to observe the difference.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Tab 2: Past Meeting History */}
              {activeTab === 'history' && (
                <div className="space-y-3">
                  <div className="clay-card p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h3 className="font-heading text-xs font-semibold uppercase tracking-wider text-[#3d3731]">
                        Past Meeting Timeline ({meetings.length} meetings)
                      </h3>
                      <p className="text-xs text-[#3d3731] mt-0.5">
                        Historical chronology stored and indexed in Hindsight memory bank
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setDebriefResult(null);
                          setDebriefNotes('');
                          setDebriefDate(new Date().toISOString().slice(0, 10));
                          setDebriefOutcome('advanced');
                          setShowDebriefModal(true);
                        }}
                        className="px-3.5 py-1.5 text-xs font-semibold clay-btn-primary"
                      >
                        Post-Meeting Debrief
                      </button>
                      <button
                        onClick={() => setShowNoteModal(true)}
                        className="px-3 py-1.5 text-xs font-medium clay-btn-secondary"
                      >
                        Log Note
                      </button>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {meetings.map((meeting, idx) => (
                      <div
                        key={meeting.id || idx}
                        id={`meeting-${meeting.date}`}
                        className={`p-4 sm:p-5 flex flex-col gap-3 text-xs transition-all ${
                          highlightedDate === meeting.date
                            ? 'clay-card border-2 border-[#b8623f] shadow-lg '
                            : 'clay-card'
                        }`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#ded7ca] pb-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-bold text-[#2a2622] text-xs">
                              {meeting.date}
                            </span>
                            <span className="text-[#d0c6b6]">|</span>
                            <span className="text-[#3d3731]">Meeting #{meetings.length - idx}</span>
                            {meeting.outcome && (
                              <>
                                <span className="text-[#d0c6b6]">|</span>
                                <span
                                  className={`px-2 py-0.5 text-xs font-bold uppercase rounded-[14px] border ${
                                    meeting.outcome === 'advanced'
                                      ? 'bg-[#dfe7e1] text-[#436b4d] border-[#bcd4c0]'
                                      : meeting.outcome === 'stalled'
                                      ? 'bg-[#f2e7d8] text-[#7a4f1a] border-[#e5cfac]'
                                      : 'bg-[#ede2df] text-[#8f3e3e] border-[#deb8b8]'
                                  }`}
                                >
                                  Outcome: {meeting.outcome.replace('_', ' ')}
                                </span>
                              </>
                            )}
                          </div>
                          {getSentimentBadge(meeting.sentiment)}
                        </div>

                        <div>
                          <p className="text-[#2a2622] font-normal leading-relaxed">
                            {meeting.summary}
                          </p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                          {/* Promises */}
                          <div className="p-3 clay-inset rounded-[18px]">
                            <span className="font-semibold text-xs text-[#3d3731] block mb-1">
                              Promises Made:
                            </span>
                            <ul className="space-y-0.5">
                              {Array.isArray(meeting.promisesMade) ? (
                                meeting.promisesMade.map((p, i) => (
                                  <li key={i} className="text-[#2a2622] text-xs flex items-start gap-1 leading-snug">
                                    <span className="text-[#3d3731]">-</span>
                                    <span>{p}</span>
                                  </li>
                                ))
                              ) : (
                                <li className="text-[#2a2622] text-xs">{meeting.promisesMade}</li>
                              )}
                            </ul>
                          </div>

                          {/* Open Questions */}
                          <div className="p-3 clay-inset rounded-[18px]">
                            <span className="font-semibold text-xs text-[#3d3731] block mb-1">
                              Open Questions:
                            </span>
                            <ul className="space-y-0.5">
                              {Array.isArray(meeting.openQuestions) ? (
                                meeting.openQuestions.map((q, i) => (
                                  <li key={i} className="text-[#2a2622] text-xs flex items-start gap-1 leading-snug">
                                    <span className="text-[#3d3731]">-</span>
                                    <span>{q}</span>
                                  </li>
                                ))
                              ) : (
                                <li className="text-[#2a2622] text-xs">{meeting.openQuestions}</li>
                              )}
                            </ul>
                          </div>
                        </div>

                        {meeting.rawNotes && (
                          <div className="mt-1 pt-2 border-t border-[#ded7ca] text-xs text-[#3d3731] italic">
                            Context: &quot;{meeting.rawNotes}&quot;
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Tab 3: Memory Inspector */}
              {activeTab === 'memory' && (
                <div className="space-y-3">
                  <div className="clay-card p-5 flex flex-col gap-3">
                    <h3 className="font-heading text-xs font-semibold uppercase tracking-wider text-[#3d3731]">
                      Hindsight Semantic Memory Explorer
                    </h3>
                    <p className="text-xs text-[#3d3731]">
                      Query the Hindsight Vectorize memory bank (bank: <code className="font-mono font-bold text-[#2a2622]">nikhil</code>) scoped to {selectedContact.name}.
                    </p>

                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={memoryQuery}
                        onChange={(e) => setMemoryQuery(e.target.value)}
                        placeholder="Search: pricing, broken promises, compliance, objections..."
                        onKeyDown={(e) => e.key === 'Enter' && handleMemorySearch()}
                        className="flex-1 px-3 py-2 text-xs clay-input"
                      />
                      <button
                        onClick={() => handleMemorySearch()}
                        disabled={memorySearchLoading}
                        className="px-4 py-2 text-xs font-semibold clay-btn-primary disabled:opacity-50"
                      >
                        {memorySearchLoading ? 'Searching...' : 'Recall'}
                      </button>
                    </div>

                    {/* Preset query chips */}
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      <span className="text-xs text-[#3d3731] font-medium self-center mr-1">Suggestions:</span>
                      {[
                        'What promises were made?',
                        'What are their biggest objections?',
                        'Pricing and commercial terms',
                        'Compliance and security deadlines',
                      ].map((preset, i) => (
                        <button
                          key={i}
                          onClick={() => {
                            setMemoryQuery(preset);
                            handleMemorySearch(preset);
                          }}
                          className="px-2.5 py-1 text-xs font-medium clay-btn-secondary"
                        >
                          {preset}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Memory Search Error Banner */}
                  {memorySearchError && (
                    <div className="clay-card p-4 rounded-[20px] bg-[#ede2df] border border-[#deb8b8] text-xs text-[#8f3e3e] flex items-center justify-between gap-3 shadow-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs uppercase px-2 py-0.5 rounded-[8px] bg-[#deb8b8] text-[#5e2727] shrink-0">
                          Hindsight Memory Error
                        </span>
                        <span>{memorySearchError}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setMemorySearchError(null)}
                        className="text-xs font-semibold text-[#8f3e3e] hover:underline shrink-0"
                      >
                        Dismiss
                      </button>
                    </div>
                  )}

                  {/* Results */}
                  <div className="space-y-2">
                    {memorySearchResults.map((fact, idx) => (
                      <div
                        key={idx}
                        className="clay-card p-3.5 text-xs flex flex-col gap-1"
                      >
                        <p className="font-medium text-[#2a2622]">{fact.text}</p>
                        <div className="flex items-center gap-3 text-xs text-[#3d3731]">
                          {fact.occurredStart && <span>Date: {fact.occurredStart.slice(0, 10)}</span>}
                          {fact.context && <span>Context: {fact.context}</span>}
                          {fact.sourceChunk && <span className="truncate max-w-xs">Chunk: {fact.sourceChunk}</span>}
                        </div>
                      </div>
                    ))}

                    {memorySearchResults.length === 0 && !memorySearchLoading && (
                      <div className="clay-card p-8 text-center text-xs text-[#3d3731]">
                        Enter a query above to inspect memories retrieved by Hindsight.
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Tab 4: Learning Curve Evolution */}
              {activeTab === 'learning-curve' && (
                <div className="space-y-4">
                  {/* Learning Curve Overview Header Card */}
                  <div className="clay-card p-5 sm:p-6 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#ded7ca] pb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="w-3 h-3 rounded-full bg-[#2a2622]" />
                          <h3 className="font-heading text-sm font-bold uppercase tracking-wider text-[#2a2622]">
                            Long-Term Memory Learning Curve
                          </h3>
                        </div>
                        <p className="text-xs text-[#3d3731] mt-0.5">
                          Same upcoming agenda tested across 3 historical memory thresholds to demonstrate compounding intelligence.
                        </p>
                      </div>

                      <div className="flex items-center gap-2 self-start sm:self-auto">
                        <span className="px-2.5 py-1 text-xs font-mono font-semibold bg-[#dfe7e1] text-[#436b4d] rounded-[12px] border border-[#bcd4c0]">
                          Instant Load (Pre-Generated Cache)
                        </span>
                        <button
                          onClick={() => {
                            if (selectedContact) fetchLearningCurveData(selectedContact.id);
                          }}
                          className="px-3 py-1 text-xs font-medium clay-btn-secondary"
                        >
                          Refresh
                        </button>
                      </div>
                    </div>

                    {/* Shared Agenda and Goal Callout */}
                    <div className="p-3.5 clay-inset rounded-[20px] grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                      <div>
                        <span className="font-semibold text-xs text-[#3d3731] block mb-0.5">
                          Fixed Upcoming Agenda Tested:
                        </span>
                        <p className="text-[#2a2622] leading-relaxed">
                          {learningCurveData?.upcomingAgenda || 'Address liability redlines, staging Datadog proxy status, and prevent Confluent migration'}
                        </p>
                      </div>
                      <div>
                        <span className="font-semibold text-xs text-[#3d3731] block mb-0.5">
                          Meeting Objective:
                        </span>
                        <p className="text-[#2a2622] leading-relaxed">
                          {learningCurveData?.meetingGoal || 'De-escalate tension, commit to General Counsel call, and secure 30-day grace period for POC'}
                        </p>
                      </div>
                    </div>

                    {/* Progression Metric Delta Bar */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="p-3 bg-[#eee8dc] border border-[#ded7ca] rounded-[18px] flex items-center justify-between">
                        <div>
                          <span className="text-xs font-bold uppercase text-[#3d3731] block">Promises Tracked</span>
                          <span className="font-mono text-sm font-bold text-[#2a2622]">
                            0 &rarr; 2 &rarr; 5
                          </span>
                        </div>
                        <span className="px-2 py-0.5 text-xs font-bold bg-[#dfe7e1] text-[#436b4d] rounded-[10px]">
                          +5 Commitments
                        </span>
                      </div>

                      <div className="p-3 bg-[#eee8dc] border border-[#ded7ca] rounded-[18px] flex items-center justify-between">
                        <div>
                          <span className="text-xs font-bold uppercase text-[#3d3731] block">Risks Identified</span>
                          <span className="font-mono text-sm font-bold text-[#8f3e3e]">
                            0 &rarr; 1 &rarr; 3
                          </span>
                        </div>
                        <span className="px-2 py-0.5 text-xs font-bold bg-[#ede2df] text-[#8f3e3e] rounded-[10px]">
                          +3 Churn Threats
                        </span>
                      </div>

                      <div className="p-3 bg-[#eee8dc] border border-[#ded7ca] rounded-[18px] flex items-center justify-between">
                        <div>
                          <span className="text-xs font-bold uppercase text-[#3d3731] block">Open Questions</span>
                          <span className="font-mono text-sm font-bold text-[#436b4d]">
                            0 &rarr; 2 &rarr; 3
                          </span>
                        </div>
                        <span className="px-2 py-0.5 text-xs font-bold bg-[#dfe7e1] text-[#436b4d] rounded-[10px]">
                          +3 Blockers
                        </span>
                      </div>
                    </div>

                    {/* Compact Comparison Table */}
                    {learningCurveData && learningCurveData.stages && (
                      <div className="space-y-2 pt-1">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold uppercase tracking-wider text-[#3d3731]">
                            Stage Milestone Comparison (Click a row to inspect full briefing)
                          </span>
                        </div>
                        <div className="overflow-x-auto rounded-[20px] border border-[#ded7ca] bg-[#eee8dc]/70">
                          <table className="w-full text-left text-xs border-collapse">
                            <thead>
                              <tr className="border-b border-[#ded7ca] text-[#3d3731] font-semibold uppercase tracking-wider bg-[#e6dfd3]">
                                <th className="py-2.5 px-3">Stage & Cutoff</th>
                                <th className="py-2.5 px-2 text-center">Promises</th>
                                <th className="py-2.5 px-2 text-center">Risks</th>
                                <th className="py-2.5 px-2 text-center">Questions</th>
                                <th className="py-2.5 px-3">Relationship Status</th>
                                <th className="py-2.5 px-3">Executive Summary</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-[#ded7ca]">
                              {learningCurveData.stages.map((st) => {
                                const isSelected = selectedStageIndex === st.stageIndex;
                                return (
                                  <tr
                                    key={st.stageIndex}
                                    onClick={() => setSelectedStageIndex(st.stageIndex)}
                                    className={`cursor-pointer transition-colors ${
                                      isSelected
                                        ? 'bg-[#ded6c7] font-medium'
                                        : 'hover:bg-[#e4ded4]'
                                    }`}
                                  >
                                    <td className="py-2.5 px-3 whitespace-nowrap">
                                      <div className="flex items-center gap-2">
                                        <span
                                          className={`w-2 h-2 rounded-full ${
                                            st.stageIndex === 1
                                              ? 'bg-[#7d756b]'
                                              : st.stageIndex === 2
                                              ? 'bg-[#436b4d]'
                                              : 'bg-[#b8623f]'
                                          }`}
                                        />
                                        <div>
                                          <span className="font-bold text-[#2a2622] block">
                                            {st.stageIndex === 1
                                              ? 'Stage 1: Cold start'
                                              : st.stageIndex === 2
                                              ? 'Stage 2: Early relationship'
                                              : 'Stage 3: Deep history and crisis'}
                                          </span>
                                          <span className="text-xs text-[#3d3731] font-mono">
                                            &lt; {st.cutoffDate}
                                          </span>
                                        </div>
                                      </div>
                                    </td>
                                    <td className="py-2.5 px-2 text-center font-mono font-bold text-[#2a2622]">
                                      {st.metrics.promisesTracked}
                                    </td>
                                    <td className="py-2.5 px-2 text-center font-mono font-bold text-[#8f3e3e]">
                                      {st.metrics.risksIdentified}
                                    </td>
                                    <td className="py-2.5 px-2 text-center font-mono font-bold text-[#436b4d]">
                                      {st.metrics.openQuestionsFound}
                                    </td>
                                    <td className="py-2.5 px-3 whitespace-nowrap">
                                      <span
                                        className={`px-2 py-0.5 text-xs font-semibold uppercase rounded-[10px] border ${
                                          st.stageIndex === 1
                                            ? 'bg-[#e4ded4] text-[#3d3731] border-[#d5d4ce]'
                                            : st.stageIndex === 2
                                            ? 'bg-[#dfe7e1] text-[#436b4d] border-[#bcd4c0]'
                                            : 'bg-[#ede2df] text-[#8f3e3e] border-[#deb8b8]'
                                        }`}
                                      >
                                        {st.stageIndex === 1 ? 'BASELINE (NO PRIOR MEETINGS)' : st.briefing.relationshipHealth.status}
                                      </span>
                                    </td>
                                    <td className="py-2.5 px-3 max-w-xs md:max-w-md">
                                      <p className="line-clamp-2 text-xs text-[#3d3731] leading-snug">
                                        {st.briefing.executiveSummary}
                                      </p>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Stage Selector Segmented Control & Full-Width Selected Stage Briefing */}
                  {learningCurveData && learningCurveData.stages ? (
                    <div className="space-y-4">
                      {/* Segmented Control */}
                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-1.5 bg-[#ded6c7] rounded-[22px] border border-[#ded7ca]">
                        <div className="inline-flex flex-wrap sm:flex-nowrap gap-1">
                          {[
                            { id: 1, label: 'Stage 1: Cold start' },
                            { id: 2, label: 'Stage 2: Early relationship' },
                            { id: 3, label: 'Stage 3: Deep history and crisis' }
                          ].map((stageOpt) => {
                            const isSelected = selectedStageIndex === stageOpt.id;
                            return (
                              <button
                                key={stageOpt.id}
                                type="button"
                                onClick={() => setSelectedStageIndex(stageOpt.id)}
                                className={`px-4 py-2 text-xs font-semibold rounded-[18px] transition-all cursor-pointer ${
                                  isSelected
                                    ? 'clay-btn-primary text-white shadow-sm'
                                    : 'text-[#3d3731] hover:text-[#2a2622] hover:bg-[#e4ded4]'
                                }`}
                              >
                                {stageOpt.label}
                              </button>
                            );
                          })}
                        </div>
                        <div className="px-3 py-1 text-xs text-[#3d3731] font-mono self-end sm:self-center">
                          Viewing: {
                            (learningCurveData.stages.find((s) => s.stageIndex === selectedStageIndex) || learningCurveData.stages[2]).meetingThreshold
                          }
                        </div>
                      </div>

                      {/* Selected Stage Full Briefing Card */}
                      {(() => {
                        const selectedStage =
                          learningCurveData.stages.find((s) => s.stageIndex === selectedStageIndex) ||
                          learningCurveData.stages[2];
                        return renderLearningCurveSelectedStage(selectedStage);
                      })()}
                    </div>
                  ) : isLoadingLearningCurve ? (
                    <div className="clay-card p-12 text-center text-xs text-[#3d3731]">
                      Loading pre-generated learning curve milestones...
                    </div>
                  ) : (
                    <div className="clay-card p-10 text-center text-xs text-[#3d3731] space-y-2">
                      <h4 className="font-heading font-semibold text-sm text-[#2a2622]">
                        Learning Curve Timeline for Elena Rostova
                      </h4>
                      <p>
                        The 3-stage comparative timeline is configured for Elena Rostova (our primary enterprise case study). Select Elena Rostova from the directory to inspect the memory learning curve.
                      </p>
                      {contacts.find((c) => c.name.includes('Elena')) && (
                        <button
                          onClick={() => {
                            const elena = contacts.find((c) => c.name.includes('Elena'));
                            if (elena) {
                              selectContact(elena);
                              setActiveTab('learning-curve');
                            }
                          }}
                          className="px-3.5 py-1.5 text-xs font-semibold clay-btn-primary"
                        >
                          Select Elena Rostova
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            <div className="clay-card p-10 text-center text-[#3d3731] text-xs">
              Select a contact from the directory to view profile and generate pre-meeting briefs.
            </div>
          )}
        </main>
      </div>

      {/* Modal: Log Meeting Note */}
      {showNoteModal && (
        <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4">
          <div className="clay-card max-w-lg w-full p-6 flex flex-col gap-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#ded7ca] pb-3">
              <div>
                <h3 className="font-heading text-sm font-semibold uppercase tracking-wider text-[#2a2622]">Log Past or Recent Meeting Note</h3>
                <p className="text-xs text-[#3d3731]">
                  Saves to local database and retains into Hindsight memory bank
                </p>
              </div>
              <button
                onClick={() => setShowNoteModal(false)}
                className="text-[#3d3731] hover:text-[#2a2622] text-xs font-bold px-2 py-1 clay-btn-secondary"
              >
                Close
              </button>
            </div>

            <form onSubmit={handleCreateNote} className="space-y-3 text-xs">
              <div>
                <label className="block font-medium mb-1 text-[#443e37]">Contact</label>
                <select
                  value={selectedContact?.id}
                  onChange={(e) => {
                    const c = contacts.find((contact) => contact.id === e.target.value);
                    if (c) selectContact(c);
                  }}
                  className="w-full px-3 py-2 text-xs clay-input"
                >
                  {contacts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.company})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-medium mb-1 text-[#443e37]">Date of Meeting</label>
                <input
                  type="date"
                  required
                  value={newNoteDate}
                  onChange={(e) => setNewNoteDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs clay-input"
                />
              </div>

              <div>
                <label className="block font-medium mb-1 text-[#443e37]">Summary / Highlights</label>
                <textarea
                  required
                  rows={2}
                  value={newNoteSummary}
                  onChange={(e) => setNewNoteSummary(e.target.value)}
                  placeholder="Key discussion points, outcomes, or roadblocks..."
                  className="w-full px-3 py-2 text-xs clay-input"
                />
              </div>

              <div>
                <label className="block font-medium mb-1 text-[#443e37]">Promises Made (one per line)</label>
                <textarea
                  rows={2}
                  value={newNotePromises}
                  onChange={(e) => setNewNotePromises(e.target.value)}
                  placeholder="e.g. Provide updated SOC2 report by Friday&#10;Fix billing rate issue"
                  className="w-full px-3 py-2 text-xs clay-input"
                />
              </div>

              <div>
                <label className="block font-medium mb-1 text-[#443e37]">Open Questions (one per line)</label>
                <textarea
                  rows={2}
                  value={newNoteQuestions}
                  onChange={(e) => setNewNoteQuestions(e.target.value)}
                  placeholder="e.g. What is the budget approval timeline?&#10;Who needs SSO access?"
                  className="w-full px-3 py-2 text-xs clay-input"
                />
              </div>

              <div>
                <label className="block font-medium mb-1 text-[#443e37]">Overall Meeting Sentiment</label>
                <select
                  value={newNoteSentiment}
                  onChange={(e) => setNewNoteSentiment(e.target.value as 'positive' | 'neutral' | 'negative' | 'mixed')}
                  className="w-full px-3 py-2 text-xs clay-input"
                >
                  <option value="positive">Positive</option>
                  <option value="neutral">Neutral</option>
                  <option value="mixed">Mixed</option>
                  <option value="negative">Critical / Negative</option>
                </select>
              </div>

              <div>
                <label className="block font-medium mb-1 text-[#443e37]">Raw Notes / Extra Context</label>
                <textarea
                  rows={2}
                  value={newNoteRaw}
                  onChange={(e) => setNewNoteRaw(e.target.value)}
                  placeholder="Optional transcript snippets or internal impressions..."
                  className="w-full px-3 py-2 text-xs clay-input"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowNoteModal(false)}
                  className="px-3.5 py-1.5 text-xs font-medium clay-btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingNote}
                  className="px-4 py-1.5 text-xs font-semibold clay-btn-primary disabled:opacity-50"
                >
                  {isSubmittingNote ? 'Saving & Retaining...' : 'Save & Retain in Memory'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: New Contact */}
      {showContactModal && (
        <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4">
          <div className="clay-card max-w-md w-full p-6 flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-[#ded7ca] pb-3">
              <div>
                <h3 className="font-heading text-sm font-semibold uppercase tracking-wider text-[#2a2622]">Create New Contact Profile</h3>
                <p className="text-xs text-[#3d3731]">
                  Adds to local roster for memory indexing
                </p>
              </div>
              <button
                onClick={() => setShowContactModal(false)}
                className="text-[#3d3731] hover:text-[#2a2622] text-xs font-bold px-2 py-1 clay-btn-secondary"
              >
                Close
              </button>
            </div>

            <form onSubmit={handleCreateContact} className="space-y-3 text-xs">
              <div>
                <label className="block font-medium mb-1 text-[#443e37]">Full Name *</label>
                <input
                  type="text"
                  required
                  value={newContactName}
                  onChange={(e) => setNewContactName(e.target.value)}
                  placeholder="e.g. Rachel Sterling"
                  className="w-full px-3 py-2 text-xs clay-input"
                />
              </div>

              <div>
                <label className="block font-medium mb-1 text-[#443e37]">Company *</label>
                <input
                  type="text"
                  required
                  value={newContactCompany}
                  onChange={(e) => setNewContactCompany(e.target.value)}
                  placeholder="e.g. Apex Health Systems"
                  className="w-full px-3 py-2 text-xs clay-input"
                />
              </div>

              <div>
                <label className="block font-medium mb-1 text-[#443e37]">Role / Title</label>
                <input
                  type="text"
                  value={newContactRole}
                  onChange={(e) => setNewContactRole(e.target.value)}
                  placeholder="e.g. Chief Information Officer"
                  className="w-full px-3 py-2 text-xs clay-input"
                />
              </div>

              <div>
                <label className="block font-medium mb-1 text-[#443e37]">Email Address</label>
                <input
                  type="email"
                  value={newContactEmail}
                  onChange={(e) => setNewContactEmail(e.target.value)}
                  placeholder="rachel@apexhealth.io"
                  className="w-full px-3 py-2 text-xs clay-input"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowContactModal(false)}
                  className="px-3.5 py-1.5 text-xs font-medium clay-btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-semibold clay-btn-primary"
                >
                  Create Contact
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Post-Meeting Debrief */}
      {showDebriefModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="clay-card max-w-2xl w-full p-6 flex flex-col gap-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#ded7ca] pb-3">
              <div>
                <h3 className="font-heading text-sm font-semibold uppercase tracking-wider text-[#2a2622]">
                  Post-Meeting Debrief Flow
                </h3>
                <p className="text-xs text-[#3d3731]">
                  {debriefResult
                    ? 'Summary of retained memories, tags, and extracted commitments'
                    : 'Paste raw notes to extract promises, retain tagged memories, and calibrate tactics'}
                </p>
              </div>
              <button
                onClick={() => {
                  setShowDebriefModal(false);
                  setDebriefResult(null);
                }}
                className="text-[#3d3731] hover:text-[#2a2622] text-xs font-bold px-2 py-1 clay-btn-secondary"
              >
                Close
              </button>
            </div>

            {!debriefResult ? (
              <form onSubmit={handleSubmitDebrief} className="space-y-4 text-xs">
                {debriefError && (
                  <div className="p-3 rounded-[16px] bg-[#ede2df] border border-[#deb8b8] text-xs text-[#8f3e3e] flex items-center justify-between gap-2 shadow-xs">
                    <span className="leading-snug">{debriefError}</span>
                    <button
                      type="button"
                      onClick={() => setDebriefError(null)}
                      className="text-xs font-semibold text-[#8f3e3e] hover:underline shrink-0"
                    >
                      Dismiss
                    </button>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-medium mb-1 text-[#443e37]">Contact Account</label>
                    <input
                      type="text"
                      disabled
                      value={`${selectedContact?.name} (${selectedContact?.company})`}
                      className="w-full px-3 py-2 text-xs clay-input opacity-80 cursor-not-allowed"
                    />
                  </div>
                  <div>
                    <label className="block font-medium mb-1 text-[#443e37]">Meeting Date</label>
                    <input
                      type="date"
                      required
                      value={debriefDate}
                      onChange={(e) => setDebriefDate(e.target.value)}
                      className="w-full px-3 py-2 text-xs clay-input"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-medium mb-1.5 text-[#443e37]">Meeting Outcome *</label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setDebriefOutcome('advanced')}
                      className={`p-3 text-left rounded-[18px] transition-all flex flex-col gap-1 border ${
                        debriefOutcome === 'advanced'
                          ? 'bg-[#dfe7e1] border-[#436b4d] shadow-inner text-[#436b4d]'
                          : 'clay-card-flat border-[#ded7ca] text-[#2a2622]'
                      }`}
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-[#436b4d]" />
                        <span className="font-bold text-xs uppercase">Advanced</span>
                      </div>
                      <span className="text-xs text-[#3d3731] leading-tight">
                        Progress made, next steps agreed, positive motion
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setDebriefOutcome('stalled')}
                      className={`p-3 text-left rounded-[18px] transition-all flex flex-col gap-1 border ${
                        debriefOutcome === 'stalled'
                          ? 'bg-[#f2e7d8] border-[#7a4f1a] shadow-inner text-[#7a4f1a]'
                          : 'clay-card-flat border-[#ded7ca] text-[#2a2622]'
                      }`}
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-[#7a4f1a]" />
                        <span className="font-bold text-xs uppercase">Stalled</span>
                      </div>
                      <span className="text-xs text-[#3d3731] leading-tight">
                        Blocked, missed deadlines, no forward decision
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setDebriefOutcome('lost_ground')}
                      className={`p-3 text-left rounded-[18px] transition-all flex flex-col gap-1 border ${
                        debriefOutcome === 'lost_ground'
                          ? 'bg-[#ede2df] border-[#8f3e3e] shadow-inner text-[#8f3e3e]'
                          : 'clay-card-flat border-[#ded7ca] text-[#2a2622]'
                      }`}
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-[#8f3e3e]" />
                        <span className="font-bold text-xs uppercase">Lost Ground</span>
                      </div>
                      <span className="text-xs text-[#3d3731] leading-tight">
                        Pushback, competitor threats, escalated risk
                      </span>
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block font-medium mb-1 text-[#443e37]">
                    Raw Meeting Notes / Minutes *
                  </label>
                  <textarea
                    required
                    rows={6}
                    value={debriefNotes}
                    onChange={(e) => setDebriefNotes(e.target.value)}
                    placeholder="Paste unedited notes, discussion points, commitments, and feedback from the call. e.g. Customer was pleased with latency benchmarks. We promised to deliver the SOC2 report by next Tuesday. Elena agreed to schedule legal review..."
                    className="w-full px-3 py-2 text-xs clay-input leading-relaxed"
                  />
                  <p className="text-xs text-[#3d3731] mt-1">
                    Groq will parse commitments (our promises & their promises) with due dates, and retain memories into Hindsight tagged with date, contact, and outcome.
                  </p>
                </div>

                <div className="pt-2 flex justify-end gap-2 border-t border-[#ded7ca]">
                  <button
                    type="button"
                    onClick={() => setShowDebriefModal(false)}
                    className="px-3.5 py-1.5 text-xs font-medium clay-btn-secondary"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingDebrief || !debriefNotes.trim()}
                    className="px-4 py-1.5 text-xs font-semibold clay-btn-primary disabled:opacity-50"
                  >
                    {isSubmittingDebrief ? 'Extracting & Retaining Memory...' : 'Process Debrief & Retain Memory'}
                  </button>
                </div>
              </form>
            ) : (
              /* Confirmation Screen: What was stored */
              <div className="space-y-4 text-xs">
                <div className="p-3.5 bg-[#dfe7e1]/70 border border-[#bcd4c0] rounded-[20px] flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#436b4d]" />
                    <span className="font-bold text-[#436b4d] text-xs">
                      Debrief Successfully Stored into Hindsight Memory Bank
                    </span>
                  </div>
                  <span
                    className={`px-2 py-0.5 text-xs font-bold uppercase rounded-[12px] border ${
                      debriefResult.outcome === 'advanced'
                        ? 'bg-[#dfe7e1] text-[#436b4d] border-[#bcd4c0]'
                        : debriefResult.outcome === 'stalled'
                        ? 'bg-[#f2e7d8] text-[#7a4f1a] border-[#e5cfac]'
                        : 'bg-[#ede2df] text-[#8f3e3e] border-[#deb8b8]'
                    }`}
                  >
                    Outcome: {debriefResult.outcome.replace('_', ' ')}
                  </span>
                </div>

                {/* Stored Debrief Memory Note */}
                <div className="clay-card-flat p-3.5 rounded-[20px] space-y-2 border border-[#ded7ca]">
                  <span className="text-xs font-bold text-[#3d3731] uppercase tracking-wider block">
                    Retained Meeting Memory
                  </span>
                  <p className="text-xs text-[#2a2622] leading-relaxed">
                    {debriefResult.retainedNoteMemory.content}
                  </p>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    <span className="text-xs text-[#3d3731] self-center">Tags:</span>
                    {debriefResult.retainedNoteMemory.tags.map((tag, i) => (
                      <span
                        key={i}
                        className="px-2 py-0.5 text-xs bg-[#e6dfd3] border border-[#ded7ca] text-[#3d3731] rounded-[10px] font-mono"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Extracted Promises */}
                <div className="clay-card-flat p-3.5 rounded-[20px] space-y-3 border border-[#ded7ca]">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#3d3731] uppercase tracking-wider block">
                      Extracted Commitments ({debriefResult.retainedPromiseCount} retained separately)
                    </span>
                    <span className="text-xs font-mono text-[#b8623f] font-semibold">
                      Hindsight Bank: nikhil
                    </span>
                  </div>

                  {/* Our Promises */}
                  <div>
                    <span className="text-xs font-semibold text-[#3d3731] block mb-1">
                      Our Commitments ({debriefResult.extractedPromises.ourPromises.length})
                    </span>
                    {debriefResult.extractedPromises.ourPromises.length > 0 ? (
                      <div className="space-y-1.5">
                        {debriefResult.extractedPromises.ourPromises.map((p, idx) => (
                          <div
                            key={idx}
                            className="p-2.5 bg-[#eee8dc] border border-[#ded7ca] rounded-[16px] flex flex-col gap-1"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <span className="font-medium text-[#2a2622] text-xs">
                                {p.promise}
                              </span>
                              {p.dueDate && (
                                <span className="px-2 py-0.5 text-xs font-semibold bg-[#dfe7e1] text-[#436b4d] rounded-[12px] border border-[#bcd4c0] shrink-0">
                                  Due: {p.dueDate}
                                </span>
                              )}
                            </div>
                            <div className="flex flex-wrap gap-1 mt-0.5">
                              <span className="px-1.5 py-0.2 text-xs bg-[#e4ded4] text-[#3d3731] rounded font-mono">
                                tag: promise:our
                              </span>
                              <span className="px-1.5 py-0.2 text-xs bg-[#e4ded4] text-[#3d3731] rounded font-mono">
                                tag: outcome:{debriefResult.outcome}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-[#3d3731] italic">No our commitments detected.</p>
                    )}
                  </div>

                  {/* Their Promises */}
                  <div>
                    <span className="text-xs font-semibold text-[#3d3731] block mb-1">
                      Their Commitments ({debriefResult.extractedPromises.theirPromises.length})
                    </span>
                    {debriefResult.extractedPromises.theirPromises.length > 0 ? (
                      <div className="space-y-1.5">
                        {debriefResult.extractedPromises.theirPromises.map((p, idx) => (
                          <div
                            key={idx}
                            className="p-2.5 bg-[#eee8dc] border border-[#ded7ca] rounded-[16px] flex flex-col gap-1"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <span className="font-medium text-[#2a2622] text-xs">
                                {p.promise}
                              </span>
                              {p.dueDate && (
                                <span className="px-2 py-0.5 text-xs font-semibold bg-[#f2e7d8] text-[#7a4f1a] rounded-[12px] border border-[#e5cfac] shrink-0">
                                  Due: {p.dueDate}
                                </span>
                              )}
                            </div>
                            <div className="flex flex-wrap gap-1 mt-0.5">
                              <span className="px-1.5 py-0.2 text-xs bg-[#e4ded4] text-[#3d3731] rounded font-mono">
                                tag: promise:their
                              </span>
                              <span className="px-1.5 py-0.2 text-xs bg-[#e4ded4] text-[#3d3731] rounded font-mono">
                                tag: outcome:{debriefResult.outcome}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-[#3d3731] italic">No contact commitments detected.</p>
                    )}
                  </div>
                </div>

                <div className="pt-2 flex justify-end gap-2 border-t border-[#ded7ca]">
                  <button
                    type="button"
                    onClick={() => {
                      setShowDebriefModal(false);
                      setDebriefResult(null);
                    }}
                    className="px-3.5 py-1.5 text-xs font-medium clay-btn-secondary"
                  >
                    Done
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowDebriefModal(false);
                      setDebriefResult(null);
                      setActiveTab('history');
                      if (debriefResult.meetingNote?.date) {
                        setHighlightedDate(debriefResult.meetingNote.date);
                      }
                    }}
                    className="px-4 py-1.5 text-xs font-semibold clay-btn-primary"
                  >
                    View in Timeline
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

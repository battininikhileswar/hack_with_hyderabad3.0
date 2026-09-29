/**
 * Core Data Models for Meeting Prep Agent
 */

export type SentimentType = 'positive' | 'neutral' | 'negative' | 'mixed';

/**
 * Contact representation
 */
export interface Contact {
  id: string;
  name: string;
  company: string;
  role: string;
  email?: string;
  avatarUrl?: string;
  createdAt?: string;
}

export type MeetingOutcome = 'advanced' | 'stalled' | 'lost_ground';

/**
 * Structured meeting note stored and synced into memory
 */
export interface MeetingNote {
  id?: string;
  contactId: string;
  date: string; // ISO date string (YYYY-MM-DD or full timestamp)
  summary: string;
  promisesMade: string[] | string;
  openQuestions: string[] | string;
  sentiment: SentimentType | string;
  outcome?: MeetingOutcome;
  rawNotes?: string;
  actionItems?: string[];
  createdAt?: string;
}

export interface ExtractedPromise {
  promise: string;
  dueDate?: string | null;
  owner?: string;
}

export interface DebriefResult {
  success: boolean;
  contact: Contact;
  meetingNote: MeetingNote;
  outcome: MeetingOutcome;
  retainedNoteMemory: {
    content: string;
    tags: string[];
    timestamp?: string;
  };
  extractedPromises: {
    ourPromises: ExtractedPromise[];
    theirPromises: ExtractedPromise[];
  };
  retainedPromiseCount: number;
}

/**
 * Metadata passed to Hindsight retain calls
 */
export interface MemoryMetadata {
  bankId?: string;
  contactId?: string;
  contactName?: string;
  noteId?: string;
  date?: string;
  context?: string;
  tags?: string[];
  [key: string]: unknown;
}

/**
 * Filter parameters for Hindsight recall operations
 */
export interface RecallFilters {
  bankId?: string;
  contactId?: string;
  tags?: string[];
  types?: ('world' | 'experience' | 'observation')[];
  preferObservations?: boolean;
  budget?: 'low' | 'mid' | 'high';
  maxTokens?: number;
  temporalWindow?: {
    start: string;
    end: string;
  };
}

/**
 * Memory recall hit structure returned by recall
 */
export interface MemoryFact {
  id?: string;
  text: string;
  context?: string;
  occurredStart?: string;
  occurredEnd?: string;
  mentionedAt?: string;
  sourceChunk?: string;
  documentId?: string;
}

export interface RecallResult {
  facts: MemoryFact[];
  rawSummaryPrompt?: string;
  entities?: Record<string, unknown>;
  rawResponse?: unknown;
}

/**
 * AI-generated briefing tailored for an upcoming meeting with a contact
 */
export interface MeetingBriefing {
  contact: Contact;
  executiveSummary: string;
  relationshipContext: string;
  promisesMade: {
    byUs: string[];
    byContact: string[];
  };
  openQuestions: string[];
  recommendedAgenda: string[];
  detectedSensitivities: string[];
  relevantMemories: MemoryFact[];
  generatedAt: string;
}

export interface LearningCurveMetrics {
  promisesTracked: number;
  risksIdentified: number;
  openQuestionsFound: number;
}

export interface LearningCurveStage {
  stageIndex: number;
  title: string;
  subtitle: string;
  cutoffDate: string;
  meetingThreshold: string;
  meetingCount: number;
  memoriesRecalledCount: number;
  metrics: LearningCurveMetrics;
  briefing: {
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
        status: string;
        impact?: string;
        sourceDate?: string | null;
        sourceDocumentId?: string | null;
      }>;
      theirPromises: Array<{
        promise: string;
        status: string;
        sourceDate?: string | null;
        sourceDocumentId?: string | null;
      }>;
    };
    unresolvedQuestions: Array<{
      question: string;
      recurrence?: string;
      urgency: string;
      suggestedAnswer: string;
      sourceDate?: string | null;
      sourceDocumentId?: string | null;
    }>;
    recommendedApproach?: {
      advancingTactics?: string[];
      stallingTacticsToAvoid?: string[];
      strategicSummary?: string;
    };
    recommendedAgenda: Array<{
      timeframe: string;
      topic: string;
      objective: string;
    }>;
    talkingPointsAndStrategy: string[];
    redFlagsAndSensitivities: Array<
      | string
      | {
          text: string;
          sourceDate?: string | null;
          sourceDocumentId?: string | null;
        }
    >;
  };
}

export interface LearningCurveData {
  contact: Contact;
  upcomingAgenda: string;
  meetingGoal: string;
  stages: LearningCurveStage[];
  generatedAt: string;
}

export interface BrokenPromiseDetail {
  date: string;
  promise: string;
  impact: string;
  status: 'broken' | 'delayed' | 'missed';
  sourceDate?: string;
  sourceDocId?: string;
}

export interface ContactRiskOverview {
  id: string;
  name: string;
  company: string;
  role: string;
  email?: string;
  meetingCount: number;
  riskRank: number;
  riskLevel: 'critical' | 'high' | 'moderate' | 'low';
  relationshipStatus: 'at_risk' | 'neutral' | 'expanding';
  brokenPromisesCount: number;
  brokenPromises: BrokenPromiseDetail[];
  nextRecommendedAction: string;
  nextActionDeadline?: string;
  recalledMemorySummary: string;
  keyRiskFactor: string;
  lastMeetingDate: string;
  memoryFactsCount: number;
}

export interface PortfolioRiskSummary {
  totalContacts: number;
  criticalRiskCount: number;
  totalBrokenPromises: number;
  expandingCount: number;
  contacts: ContactRiskOverview[];
  generatedAt: string;
}

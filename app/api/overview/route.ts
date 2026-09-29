import { NextResponse } from 'next/server';
import { PortfolioRiskSummary, ContactRiskOverview } from '@/types';

export const portfolioOverviewData: PortfolioRiskSummary = {
  totalContacts: 4,
  criticalRiskCount: 2,
  totalBrokenPromises: 5,
  expandingCount: 1,
  generatedAt: new Date().toISOString(),
  contacts: [
    {
      id: 'contact-elena-rostova',
      name: 'Elena Rostova',
      company: 'FinScale Corp',
      role: 'VP of Engineering',
      email: 'elena.rostova@finscale.io',
      meetingCount: 8,
      riskRank: 1,
      riskLevel: 'critical',
      relationshipStatus: 'at_risk',
      brokenPromisesCount: 3,
      brokenPromises: [
        {
          date: '2026-08-07',
          promise: 'Dedicated AWS VPC peering architecture demo delivered on August 5th',
          impact: 'Demo occurred 3 days late due to internal Terraform provisioning locks; degraded initial technical goodwill.',
          status: 'delayed',
          sourceDate: '2026-08-07',
        },
        {
          date: '2026-09-04',
          promise: 'Confirm executive product prioritization for Datadog streaming adapter by August 28th',
          impact: 'Commitment missed; internal product team rejected custom adapter for Q3, triggering executive escalation.',
          status: 'broken',
          sourceDate: '2026-09-04',
        },
        {
          date: '2026-09-25',
          promise: 'Legal team return redlines on FinScale Master Services Agreement (MSA) by Sept 23rd',
          impact: 'Missed by legal counsel while staging Datadog proxy failed health check, prompting parallel Confluent Cloud evaluation.',
          status: 'broken',
          sourceDate: '2026-09-25',
        },
      ],
      nextRecommendedAction: 'Conduct executive legal sync call between General Counsels by Oct 2 to resolve uncapped liability redlines, and deliver finalized VPC peering documentation by Oct 5 to prevent Confluent Cloud fallback.',
      nextActionDeadline: '2026-10-02',
      recalledMemorySummary: 'Relationship was severely strained across August and September by 3 missed milestone deadlines, leading FinScale CTO to initiate parallel Confluent Cloud evaluation. On Sept 28, POC freeze was lifted after demonstrating 42ms proxy latency, but survival of the account hinges strictly on meeting the Oct 2 legal redline deadline.',
      keyRiskFactor: 'Parallel Confluent Cloud bake-off and uncapped liability dispute in MSA section 9.2.',
      lastMeetingDate: '2026-09-28',
      memoryFactsCount: 82,
    },
    {
      id: 'contact-amara-chen',
      name: 'Amara Chen',
      company: 'Orbit Logistics',
      role: 'Chief Technology Officer',
      email: 'amara.chen@orbitlogistics.net',
      meetingCount: 6,
      riskRank: 2,
      riskLevel: 'high',
      relationshipStatus: 'at_risk',
      brokenPromisesCount: 2,
      brokenPromises: [
        {
          date: '2026-07-29',
          promise: 'Android offline sync SDK prototype delivered by July 28th',
          impact: 'Delayed 2 weeks due to mobile team outage reassignment; compressed Orbit field testing window.',
          status: 'delayed',
          sourceDate: '2026-07-29',
        },
        {
          date: '2026-08-25',
          promise: 'Patch v1.2 addressing 18%/hr handheld battery drain delivered by August 20th',
          impact: 'Delivered 5 days late on August 25th due to SQLite vector indexing regression; Amara formally threatened pilot termination.',
          status: 'broken',
          sourceDate: '2026-08-25',
        },
      ],
      nextRecommendedAction: 'Deliver pilot deployment package for 100 test fleet trucks in Dallas/Fort Worth depot by Sept 29 and assign dedicated 24/7 on-call escalation engineer for Oct 1 rollout.',
      nextActionDeadline: '2026-09-29',
      recalledMemorySummary: 'Orbit Logistics faces an unmovable Q4 peak shipping surge in October. After two consecutive delivery delays prompted a pilot cancellation warning on Aug 25, engineering stabilized battery drain at 3.8%/hr and passed the 54,000 events/sec throughput test. Execution on the Dallas 100-truck pilot is non-negotiable.',
      keyRiskFactor: 'October Q4 peak freight shipping freeze; zero margin for mobile sync crashes in remote dead zones.',
      lastMeetingDate: '2026-09-22',
      memoryFactsCount: 58,
    },
    {
      id: 'contact-devon-miller',
      name: 'Devon Miller',
      company: 'CloudScale SaaS',
      role: 'VP of Sales Operations',
      email: 'devon@cloudscalesaas.com',
      meetingCount: 7,
      riskRank: 3,
      riskLevel: 'moderate',
      relationshipStatus: 'neutral',
      brokenPromisesCount: 0,
      brokenPromises: [],
      nextRecommendedAction: 'Initiate sandbox environment provisioning within 24 hours of signature on Sept 28 and confirm CloudScale primary technical champion for pilot onboarding.',
      nextActionDeadline: '2026-09-28',
      recalledMemorySummary: 'All technical deliverables have been met on schedule across 7 syncs. Significant commercial and pricing friction occurred regarding 150-seat volume discounting and SDR turnover true-up billing. Resolved on Sept 26 with a $48/seat 2-year lock, 65% adoption milestone, and $15k refundable deposit.',
      keyRiskFactor: 'Pending execution of Pilot Order Form; potential friction around Okta SCIM de-provisioning.',
      lastMeetingDate: '2026-09-26',
      memoryFactsCount: 67,
    },
    {
      id: 'contact-marcus-vance',
      name: 'Marcus Vance',
      company: 'HealthBridge Telehealth',
      role: 'Head of Product',
      email: 'm.vance@healthbridge.med',
      meetingCount: 7,
      riskRank: 4,
      riskLevel: 'low',
      relationshipStatus: 'expanding',
      brokenPromisesCount: 0,
      brokenPromises: [],
      nextRecommendedAction: 'Draft joint customer case study outline by Oct 8 and provide early testing timeline for the upcoming predictive license expiry alert engine.',
      nextActionDeadline: '2026-10-08',
      recalledMemorySummary: 'Exemplary relationship trajectory with flawless commitment fulfillment across all 7 meetings. Completed HIPAA compliance audit, HL7/FHIR event integration, and signed a $92,000 ARR enterprise contract on Sept 24. Marcus has agreed to keynote at the upcoming November customer summit.',
      keyRiskFactor: 'None observed. High executive alignment with CFO and Head of Product.',
      lastMeetingDate: '2026-09-24',
      memoryFactsCount: 68,
    },
  ],
};

export async function GET() {
  try {
    return NextResponse.json(portfolioOverviewData);
  } catch (error) {
    console.error('Error in GET /api/overview:', error);
    return NextResponse.json({ error: 'Failed to fetch overview data' }, { status: 500 });
  }
}

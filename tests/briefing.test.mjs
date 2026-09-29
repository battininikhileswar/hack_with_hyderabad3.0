import test from 'node:test';
import assert from 'node:assert';

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';

test('Briefing API Route Suite', async (t) => {
  await t.test('POST /api/briefing returns 400 when contactId is missing', async () => {
    const res = await fetch(`${BASE_URL}/api/briefing`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        upcomingAgenda: 'Testing without contactId',
      }),
    });

    assert.strictEqual(res.status, 400);
    const data = await res.json();
    assert.strictEqual(data.error, 'contactId is required');
  });

  await t.test('POST /api/briefing returns 404 when contact does not exist', async () => {
    const res = await fetch(`${BASE_URL}/api/briefing`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contactId: 'contact-non-existent-99999',
        upcomingAgenda: 'Testing missing contact',
      }),
    });

    assert.strictEqual(res.status, 404);
    const data = await res.json();
    assert.strictEqual(data.error, 'Contact not found');
  });

  await t.test('POST /api/briefing WITHOUT memory (useMemory: false)', async () => {
    const res = await fetch(`${BASE_URL}/api/briefing`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contactId: 'contact-elena-rostova',
        upcomingAgenda: 'Address liability redlines and staging Datadog proxy status',
        meetingGoal: 'De-escalate tension and secure 30-day grace period',
        useMemory: false,
      }),
    });

    assert.strictEqual(res.status, 200);
    const data = await res.json();

    // Verify memory mode is disabled and no memories were pulled
    assert.strictEqual(data.useMemory, false);
    assert.deepStrictEqual(data.relevantMemories, []);
    assert.strictEqual(data.contact.name, 'Elena Rostova');

    // Verify explicit empty-state placeholders (not blank or missing)
    assert.ok(data.briefing, 'Briefing object must be generated');
    assert.ok(data.briefing.executiveSummary, 'Executive summary should be generated');

    const sentimentTrajectory = data.briefing.relationshipHealth?.sentimentTrajectory;
    assert.ok(
      sentimentTrajectory && sentimentTrajectory.includes('memory disabled'),
      'Sentiment trajectory must display intentional placeholder when memory is disabled'
    );

    assert.strictEqual(data.briefing.commitments?.ourPromises?.length, 0);
    assert.strictEqual(data.briefing.commitments?.theirPromises?.length, 0);
    assert.strictEqual(data.briefing.unresolvedQuestions?.length, 0);

    const advancingTactics = data.briefing.recommendedApproach?.advancingTactics;
    assert.ok(
      advancingTactics && advancingTactics[0].includes('memory disabled'),
      'Advancing tactics must reflect memory disabled placeholder'
    );
  });

  await t.test('POST /api/briefing WITH memory (useMemory: true)', async () => {
    const res = await fetch(`${BASE_URL}/api/briefing`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contactId: 'contact-elena-rostova',
        upcomingAgenda: 'Address liability redlines and staging Datadog proxy status',
        meetingGoal: 'De-escalate tension and secure 30-day grace period for POC',
        useMemory: true,
      }),
    });

    assert.strictEqual(res.status, 200);
    const data = await res.json();

    // Verify memory mode is active and facts were recalled from Hindsight
    assert.strictEqual(data.useMemory, true);
    assert.ok(Array.isArray(data.relevantMemories), 'Relevant memories must be an array');
    assert.ok(data.relevantMemories.length > 0, 'Relevant memories must be recalled from Hindsight');

    // Verify structured briefing components
    assert.ok(data.briefing.executiveSummary, 'Executive summary must be present');
    assert.ok(data.briefing.relationshipHealth?.status, 'Relationship status must be present');
    assert.ok(data.briefing.commitments?.ourPromises?.length > 0, 'Our promises must be recalled');
    assert.ok(data.briefing.unresolvedQuestions?.length > 0, 'Unresolved questions must be recalled');
    assert.ok(data.briefing.recommendedApproach?.advancingTactics?.length > 0, 'Advancing tactics must be synthesized');

    // Verify provenance attributes exist on commitments
    const samplePromise = data.briefing.commitments.ourPromises[0];
    assert.ok(samplePromise.promise, 'Promise description must exist');
    assert.ok('sourceDate' in samplePromise, 'Promise must contain sourceDate field');
    assert.ok('sourceDocumentId' in samplePromise, 'Promise must contain sourceDocumentId field');
  });
});

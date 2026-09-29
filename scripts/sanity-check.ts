import { loadEnvConfig } from '@next/env';

// Load environment variables from .env.local / .env
loadEnvConfig(process.cwd());

import { retain, recall, deleteDocument } from '../lib/hindsight';
import { chatCompletion } from '../lib/groq';

async function main() {
  console.log('====================================================');
  console.log('1. ENVIRONMENT VARIABLES VERIFICATION');
  console.log('====================================================');
  const envCheck = {
    HINDSIGHT_API_KEY: process.env.HINDSIGHT_API_KEY ? 'SET (non-empty)' : 'MISSING (empty/undefined)',
    HINDSIGHT_ENDPOINT: process.env.HINDSIGHT_ENDPOINT ? `SET (${process.env.HINDSIGHT_ENDPOINT})` : 'MISSING (empty/undefined)',
    GROQ_API_KEY: process.env.GROQ_API_KEY ? 'SET (non-empty)' : 'MISSING (empty/undefined)',
  };
  console.log('Environment status:');
  console.log(JSON.stringify(envCheck, null, 2));

  console.log('\n====================================================');
  console.log('2. HINDSIGHT: retain() TEST');
  console.log('====================================================');
  const testDocId = `sanity-test-${Date.now()}`;
  let retainSuccess = false;
  let bankUsed = 'meeting-prep-agent';

  try {
    const retainPayload = {
      content: 'Test memory: discussed pricing on a demo call.',
      metadata: {
        contactId: 'test-contact',
        contactName: 'Test Contact',
        documentId: testDocId,
        date: new Date().toISOString(),
      },
    };
    console.log('Calling retain() with payload:', JSON.stringify(retainPayload, null, 2));
    const retainResult = await retain(retainPayload.content, retainPayload.metadata);
    retainSuccess = true;
    bankUsed = retainResult.bankId;
    console.log('>>> retain() SUCCEEDED:');
    console.log(JSON.stringify(retainResult, null, 2));
  } catch (error: unknown) {
    console.error('>>> retain() FAILED:');
    const err = error as Record<string, unknown>;
    console.error('Error message:', (error as Error).message);
    console.error('Full Error Object:', JSON.stringify(err, Object.getOwnPropertyNames(err), 2));
  }

  console.log('\n====================================================');
  console.log('3. HINDSIGHT: recall() TEST');
  console.log('====================================================');
  try {
    const recallQuery = 'pricing';
    const recallFilters = { contactId: 'test-contact' };
    console.log(`Calling recall() with query: "${recallQuery}", filters:`, JSON.stringify(recallFilters));
    const recallResult = await recall(recallQuery, recallFilters);
    console.log('>>> recall() SUCCEEDED:');
    console.log(JSON.stringify(recallResult, null, 2));
  } catch (error: unknown) {
    console.error('>>> recall() FAILED:');
    const err = error as Record<string, unknown>;
    console.error('Error message:', (error as Error).message);
    console.error('Full Error Object:', JSON.stringify(err, Object.getOwnPropertyNames(err), 2));
  }

  console.log('\n====================================================');
  console.log('4. GROQ: chatCompletion() TEST');
  console.log('====================================================');
  try {
    console.log('Calling chatCompletion() with prompt: "Say hello in one sentence"');
    const groqResult = await chatCompletion({
      messages: [{ role: 'user', content: 'Say hello in one sentence' }],
      max_tokens: 100,
    });
    console.log('>>> Groq SUCCEEDED:');
    console.log('Model:', groqResult.model);
    console.log('Response text:', groqResult.content);
    console.log('Token usage:', JSON.stringify(groqResult.usage, null, 2));
    console.log('Full Raw Response:', JSON.stringify(groqResult.rawResponse, null, 2));
  } catch (error: unknown) {
    console.error('>>> Groq FAILED:');
    const err = error as Record<string, unknown>;
    console.error('Error message:', (error as Error).message);
    console.error('Full Error Object:', JSON.stringify(err, Object.getOwnPropertyNames(err), 2));
  }

  console.log('\n====================================================');
  console.log('5. HINDSIGHT: TEST MEMORY CLEANUP');
  console.log('====================================================');
  if (retainSuccess) {
    try {
      console.log(`Attempting to delete test document "${testDocId}" from bank "${bankUsed}"...`);
      await deleteDocument(bankUsed, testDocId);
      console.log(`>>> Cleanup SUCCEEDED: Test document "${testDocId}" deleted from bank "${bankUsed}".`);
    } catch (cleanupError: unknown) {
      console.warn('>>> Cleanup notice/error (SDK deletion attempt):', (cleanupError as Error).message);
    }
  } else {
    console.log('Skipping cleanup because retain() was not successful.');
  }

  console.log('\n====================================================');
  console.log('SANITY CHECK COMPLETE');
  console.log('====================================================');
}

main().catch((e) => {
  console.error('Fatal unhandled error in sanity-check script:', e);
  process.exit(1);
});

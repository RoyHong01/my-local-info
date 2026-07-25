'use strict';

const assert = require('assert');
const {
  AnthropicBudgetGuard,
  callSyncFallback,
  collectBatchResults,
  configFromEnv,
  pollBatch,
  promptHash,
  submitBatch,
} = require('./lib/anthropic-blog-batch');

function makeConfig(overrides = {}) {
  return {
    ...configFromEnv({}),
    model: 'claude-sonnet-5',
    dailyBudgetKrw: 1500,
    warnRatio: 0.8,
    usdKrw: 1400,
    inputUsdPerMillion: 3,
    outputUsdPerMillion: 15,
    batchDiscount: 0.5,
    charsPerToken: 2,
    ...overrides,
  };
}

function makeRequest(customId, prompt = `prompt-${customId}`, maxTokens = 100) {
  return { customId, prompt, maxTokens, promptHash: promptHash(prompt) };
}

function makeResult(customId, text = `result-${customId}`) {
  return {
    custom_id: customId,
    result: {
      type: 'succeeded',
      message: {
        stop_reason: 'end_turn',
        usage: { input_tokens: 20, output_tokens: 30 },
        content: [{ type: 'text', text }],
      },
    },
  };
}

async function testSingleBatchAndResultMapping() {
  const requests = [makeRequest('blog-1'), makeRequest('curation-1'), makeRequest('versus-1')];
  let createCalls = 0;
  const client = {
    messages: {
      batches: {
        async create(body) {
          createCalls++;
          assert.strictEqual(body.requests.length, 3);
          assert.deepStrictEqual(body.requests.map((item) => item.custom_id), ['blog-1', 'curation-1', 'versus-1']);
          return { id: 'batch-1', processing_status: 'in_progress' };
        },
        async results() {
          return (async function* resultsIterator() {
            yield makeResult('versus-1');
            yield makeResult('blog-1');
            yield makeResult('curation-1');
          }());
        },
      },
    },
  };
  const budgetGuard = new AnthropicBudgetGuard(makeConfig());
  const submitted = await submitBatch({ client, requests, config: makeConfig(), budgetGuard });
  assert.strictEqual(createCalls, 1);
  assert.strictEqual(submitted.accepted.length, 3);

  const requestsById = new Map(submitted.accepted.map((request) => [request.customId, request]));
  const results = await collectBatchResults({ client, batchId: 'batch-1', requestsById, budgetGuard });
  assert.strictEqual(results.get('blog-1').text, 'result-blog-1');
  assert.strictEqual(results.get('curation-1').source, 'batch');
  assert.strictEqual(results.get('versus-1').promptHash, promptHash('prompt-versus-1'));
  assert.ok(budgetGuard.actualCostKrw > 0);
}

async function testFixedPollingAndTimeout() {
  let nowMs = 0;
  let retrieveCalls = 0;
  const sleepDurations = [];
  const client = {
    messages: {
      batches: {
        async retrieve() {
          retrieveCalls++;
          return { id: 'batch-timeout', processing_status: 'in_progress' };
        },
      },
    },
  };

  const result = await pollBatch({
    client,
    batchId: 'batch-timeout',
    pollIntervalMs: 20_000,
    timeoutMs: 60_000,
    now: () => nowMs,
    sleepFn: async (ms) => {
      sleepDurations.push(ms);
      nowMs += ms;
    },
  });

  assert.strictEqual(result.timedOut, true);
  assert.strictEqual(result.durationMs, 60_000);
  assert.deepStrictEqual(sleepDurations, [20_000, 20_000, 20_000]);
  assert.strictEqual(retrieveCalls, 4);
}

async function testBudgetWarningAndFallbackStop() {
  const warningGuard = new AnthropicBudgetGuard(makeConfig());
  warningGuard.actualCostKrw = 1200;
  assert.strictEqual(warningGuard.warningReached, true);

  const stopGuard = new AnthropicBudgetGuard(makeConfig());
  stopGuard.actualCostKrw = 1499.9;
  let syncCalls = 0;
  const client = {
    messages: {
      async create() {
        syncCalls++;
        return makeResult('fallback').result.message;
      },
    },
  };
  const result = await callSyncFallback({
    client,
    request: makeRequest('fallback', '긴 프롬프트'.repeat(100), 8192),
    config: makeConfig(),
    budgetGuard: stopGuard,
  });

  assert.strictEqual(result.status, 'budget_stopped');
  assert.strictEqual(syncCalls, 0);
  assert.strictEqual(stopGuard.stopped, true);
  assert.match(stopGuard.stopReason, /warning_budget_stop/);
}

async function testPromptHashIsStable() {
  const prompt = '프롬프트 텍스트는 변경하지 않습니다.\n동일 입력';
  assert.strictEqual(promptHash(prompt), promptHash(prompt));
  assert.notStrictEqual(promptHash(prompt), promptHash(`${prompt}!`));
}

async function run() {
  await testSingleBatchAndResultMapping();
  await testFixedPollingAndTimeout();
  await testBudgetWarningAndFallbackStop();
  await testPromptHashIsStable();
  console.log('anthropic-blog-batch fake client tests: PASS');
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});

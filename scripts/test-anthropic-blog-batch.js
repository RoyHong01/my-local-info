'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  AnthropicBudgetGuard,
  callSyncFallback,
  collectBatchResults,
  configFromEnv,
  defaultPricingForModel,
  estimateRequestCostKrw,
  makeApiSafeCustomId,
  pollBatch,
  promptHash,
  resolveReferenceKstDate,
  submitBatch,
} = require('./lib/anthropic-blog-batch');
const {
  FIXED_POLL_INTERVAL_MS,
  FIXED_TIMEOUT_MS,
  OUTPUT_KEYS,
  publishGithubOutputs,
  runAnthropicBlogBatch,
} = require('./run-anthropic-blog-batch');

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

function makeFailedResult(customId, message = 'batch request failed', usage = null) {
  const payload = {
    custom_id: customId,
    result: {
      type: 'errored',
      error: { message },
    },
  };
  if (usage) payload.result.usage = usage;
  return payload;
}

function expectedCostFromUsage(usage, isBatch = true, config = makeConfig()) {
  const inputTokens = Number(usage.input_tokens || 0)
    + Number(usage.cache_creation_input_tokens || 0)
    + Number(usage.cache_read_input_tokens || 0);
  const outputTokens = Number(usage.output_tokens || 0);
  const inputUsd = (inputTokens / 1_000_000) * config.inputUsdPerMillion;
  const outputUsd = (outputTokens / 1_000_000) * config.outputUsdPerMillion;
  const discount = isBatch ? config.batchDiscount : 1;
  return (inputUsd + outputUsd) * config.usdKrw * discount;
}

function assertClose(actual, expected, tolerance = 1e-9) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `expected ${expected}, got ${actual}`);
}

async function testFailedResultUsageCountsTowardActualCost() {
  const request = makeRequest('failed-usage-1');
  const budgetGuard = new AnthropicBudgetGuard(makeConfig());
  budgetGuard.reserve(request, true);
  const failedUsage = { input_tokens: 100, output_tokens: 50 };
  const client = {
    messages: {
      batches: {
        async results() {
          return (async function* resultsIterator() {
            yield makeFailedResult('failed-usage-1', 'overloaded', failedUsage);
          }());
        },
      },
    },
  };

  const results = await collectBatchResults({
    client,
    batchId: 'batch-failed-usage',
    requestsById: new Map([[request.customId, request]]),
    budgetGuard,
    results: new Map(),
  });

  assert.strictEqual(results.get('failed-usage-1').status, 'errored');
  assert.deepStrictEqual(results.get('failed-usage-1').usage, failedUsage);
  assert.strictEqual(budgetGuard.reservedCostKrw, 0);
  const expected = expectedCostFromUsage(failedUsage, true, makeConfig());
  assertClose(budgetGuard.actualCostKrw, expected);
}

async function testFailedSyncFallbackUsageCountsTowardActualCost() {
  const config = makeConfig();
  const budgetGuard = new AnthropicBudgetGuard(config);
  const usage = { input_tokens: 120, output_tokens: 90 };
  const client = {
    messages: {
      async create() {
        const error = new Error('sync fallback failed');
        error.response = { body: { usage } };
        throw error;
      },
    },
  };

  await assert.rejects(
    callSyncFallback({ client, request: makeRequest('sync-fail-usage', 'fallback prompt', 256), config, budgetGuard }),
    /sync fallback failed/
  );

  const expected = expectedCostFromUsage(usage, false, config);
  assertClose(budgetGuard.actualCostKrw, expected);
}

function makeGenerator(requests, finalizedIds) {
  return {
    name: 'fake',
    async prepare() {
      return requests;
    },
    async finalize(request, result) {
      assert.strictEqual(result.status, 'succeeded');
      finalizedIds.push(request.customId);
      return true;
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

async function testCustomIdNormalizationToAsciiForBatchApi() {
  const rawCustomId = 'blog-전국보조금·복지 정책-강서구 전세피해지원금(이사비)-0728';
  const request = makeRequest(rawCustomId, 'normalization-check', 100);
  let capturedCustomId = '';
  const client = {
    messages: {
      batches: {
        async create(body) {
          capturedCustomId = body.requests?.[0]?.custom_id || '';
          return { id: 'batch-custom-id', processing_status: 'in_progress' };
        },
      },
    },
  };
  const budgetGuard = new AnthropicBudgetGuard(makeConfig());
  const submitted = await submitBatch({ client, requests: [request], config: makeConfig(), budgetGuard });

  assert.ok(capturedCustomId.length > 0);
  assert.match(capturedCustomId, /^[a-zA-Z0-9_-]{1,64}$/);
  assert.strictEqual(/[가-힣]/.test(capturedCustomId), false);
  assert.strictEqual(submitted.accepted[0].customId, capturedCustomId);
  assert.strictEqual(makeApiSafeCustomId(rawCustomId), capturedCustomId);
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

async function testFallbackEstimateUsesLastUsageOrConservativeConstant() {
  const config = makeConfig({ fallbackOutputTokensEstimate: 3000 });
  const budgetGuard = new AnthropicBudgetGuard(config);
  const request = makeRequest('fallback-estimate', 'x'.repeat(200), 8192);

  const estimatedWithoutUsage = estimateRequestCostKrw(request, config, false, {
    outputTokensEstimate: budgetGuard.estimateFallbackOutputTokens(request.maxTokens),
  });
  const estimatedWithMaxTokens = estimateRequestCostKrw(request, config, false);
  assert.ok(estimatedWithoutUsage < estimatedWithMaxTokens);

  budgetGuard.lastSuccessfulOutputTokens = 1200;
  const estimatedWithLastUsage = estimateRequestCostKrw(request, config, false, {
    outputTokensEstimate: budgetGuard.estimateFallbackOutputTokens(request.maxTokens),
  });
  assert.ok(estimatedWithLastUsage < estimatedWithoutUsage);
}

async function testSubmitFailureReleasesReservations() {
  const requests = [makeRequest('submit-failure-1'), makeRequest('submit-failure-2')];
  const budgetGuard = new AnthropicBudgetGuard(makeConfig());
  const client = {
    messages: {
      batches: {
        async create() {
          throw new Error('submit failed');
        },
      },
    },
  };

  await assert.rejects(
    submitBatch({ client, requests, config: makeConfig(), budgetGuard }),
    /submit failed/
  );
  assert.strictEqual(budgetGuard.reservedCostKrw, 0);
}

async function testPartialResultsRemainAvailableAfterStreamFailure() {
  const request = makeRequest('partial-1');
  const budgetGuard = new AnthropicBudgetGuard(makeConfig());
  budgetGuard.reserve(request, true);
  const results = new Map();
  const client = {
    messages: {
      batches: {
        async results() {
          return (async function* resultsIterator() {
            yield makeResult('partial-1');
            throw new Error('result stream failed');
          }());
        },
      },
    },
  };

  await assert.rejects(
    collectBatchResults({
      client,
      batchId: 'batch-partial',
      requestsById: new Map([[request.customId, request]]),
      budgetGuard,
      results,
    }),
    /result stream failed/
  );
  assert.strictEqual(results.get('partial-1').text, 'result-partial-1');
  assert.strictEqual(budgetGuard.reservedCostKrw, 0);
}

async function testRunnerTimeoutUsesPartialResultsAndFallbacksOnlyUnresolved() {
  const requests = [makeRequest('partial-success'), makeRequest('needs-fallback')];
  const finalizedIds = [];
  const sleepDurations = [];
  let nowMs = 0;
  let createBatchCalls = 0;
  let cancelCalls = 0;
  let syncCalls = 0;
  const budgetGuard = new AnthropicBudgetGuard(makeConfig());
  const client = {
    messages: {
      batches: {
        async create() {
          createBatchCalls++;
          return { id: 'batch-timeout-partial', processing_status: 'in_progress' };
        },
        async retrieve() {
          return { id: 'batch-timeout-partial', processing_status: 'in_progress' };
        },
        async cancel() {
          cancelCalls++;
          return { id: 'batch-timeout-partial', processing_status: 'canceling' };
        },
        async results() {
          return (async function* resultsIterator() {
            yield makeResult('partial-success');
          }());
        },
      },
      async create() {
        syncCalls++;
        return makeResult('needs-fallback').result.message;
      },
    },
  };

  const outputs = await runAnthropicBlogBatch({
    client,
    config: makeConfig(),
    budgetGuard,
    generators: [makeGenerator(requests, finalizedIds)],
    now: () => nowMs,
    sleepFn: async (ms) => {
      sleepDurations.push(ms);
      nowMs += ms * 12;
    },
  });

  assert.strictEqual(createBatchCalls, 1);
  assert.strictEqual(cancelCalls, 1);
  assert.strictEqual(syncCalls, 1);
  assert.ok(sleepDurations.length > 0);
  assert.ok(sleepDurations.every((ms) => ms === FIXED_POLL_INTERVAL_MS));
  assert.strictEqual(outputs.batch_status, 'timed_out');
  assert.strictEqual(outputs.batch_duration_ms, FIXED_TIMEOUT_MS);
  assert.strictEqual(outputs.batch_success_count, 1);
  assert.strictEqual(outputs.batch_failure_count, 1);
  assert.strictEqual(outputs.fallback_attempted_count, 1);
  assert.strictEqual(outputs.fallback_success_count, 1);
  assert.strictEqual(outputs.unpublished_count, 0);
  assert.deepStrictEqual(finalizedIds.sort(), ['needs-fallback', 'partial-success']);
  assert.strictEqual(budgetGuard.reservedCostKrw, 0);
}

async function testRunnerBudgetStopPreventsFallbackCall() {
  const request = makeRequest('budget-stop-fallback', 'short prompt', 100);
  const finalizedIds = [];
  let syncCalls = 0;
  const config = makeConfig({ dailyBudgetKrw: 1.5 });
  const budgetGuard = new AnthropicBudgetGuard(config);
  const client = {
    messages: {
      batches: {
        async create() {
          return { id: 'batch-budget-stop', processing_status: 'in_progress' };
        },
        async retrieve() {
          return { id: 'batch-budget-stop', processing_status: 'ended' };
        },
        async results() {
          return (async function* resultsIterator() {
            yield makeFailedResult(request.customId);
          }());
        },
      },
      async create() {
        syncCalls++;
        return makeResult(request.customId).result.message;
      },
    },
  };

  const outputs = await runAnthropicBlogBatch({
    client,
    config,
    budgetGuard,
    generators: [makeGenerator([request], finalizedIds)],
  });

  assert.strictEqual(syncCalls, 0);
  assert.strictEqual(outputs.fallback_attempted_count, 0);
  assert.strictEqual(outputs.fallback_success_count, 0);
  assert.strictEqual(outputs.unpublished_count, 1);
  assert.match(outputs.unpublished_reasons, /warning_budget_stop/);
  assert.strictEqual(outputs.budget_stopped, true);
  assert.deepStrictEqual(finalizedIds, []);
  assert.strictEqual(budgetGuard.reservedCostKrw, 0);
}

async function testBlogQualityRetryUsesSameBudgetGuard() {
  const request = {
    ...makeRequest('blog-quality-retry', 'short prompt', 100),
    generator: 'blog',
    context: { candidate: { _category: '전국 보조금·복지 정책' } },
  };
  const config = makeConfig({ dailyBudgetKrw: 1.5 });
  const budgetGuard = new AnthropicBudgetGuard(config);
  let syncCalls = 0;
  const client = {
    messages: {
      batches: {
        async create() {
          return { id: 'batch-quality-retry', processing_status: 'in_progress' };
        },
        async retrieve() {
          return { id: 'batch-quality-retry', processing_status: 'ended' };
        },
        async results() {
          return (async function* resultsIterator() {
            yield makeResult(request.customId);
          }());
        },
      },
      async create() {
        syncCalls++;
        return makeResult(request.customId).result.message;
      },
    },
  };
  const generator = {
    name: 'blog',
    async prepare() {
      return [request];
    },
    async finalize(preparedRequest, modelResult, requestModel, options = {}) {
      assert.strictEqual(modelResult.status, 'succeeded');
      if (options.allowQualityRetry === false) {
        return false;
      }
      await requestModel({
        customId: preparedRequest.customId,
        prompt: `${preparedRequest.prompt}\nquality retry`,
        maxTokens: preparedRequest.maxTokens,
        promptHash: promptHash(`${preparedRequest.prompt}\nquality retry`),
      });
      return true;
    },
  };

  const outputs = await runAnthropicBlogBatch({ client, config, budgetGuard, generators: [generator] });

  assert.strictEqual(syncCalls, 0);
  assert.strictEqual(outputs.batch_success_count, 1);
  assert.strictEqual(outputs.fallback_attempted_count, 0);
  assert.strictEqual(outputs.fallback_success_count, 0);
  assert.strictEqual(outputs.fallback_failure_count, 0);
  assert.strictEqual(outputs.unpublished_count, 1);
  assert.match(outputs.unpublished_reasons, /finalize_rejected/);
  assert.strictEqual(outputs.budget_stopped, false);
  assert.strictEqual(budgetGuard.reservedCostKrw, 0);
}

async function testSonnet5IntroPricingDefaultsByKstDate() {
  const introConfig = configFromEnv({
    ANTHROPIC_BLOG_MODEL: 'claude-sonnet-5',
    ANTHROPIC_PRICING_REFERENCE_DATE_KST: '2026-08-31',
  });
  assert.strictEqual(introConfig.inputUsdPerMillion, 2);
  assert.strictEqual(introConfig.outputUsdPerMillion, 10);

  const regularConfig = configFromEnv({
    ANTHROPIC_BLOG_MODEL: 'claude-sonnet-5',
    ANTHROPIC_PRICING_REFERENCE_DATE_KST: '2026-09-01',
  });
  assert.strictEqual(regularConfig.inputUsdPerMillion, 3);
  assert.strictEqual(regularConfig.outputUsdPerMillion, 15);

  const explicitOverride = configFromEnv({
    ANTHROPIC_BLOG_MODEL: 'claude-sonnet-5',
    ANTHROPIC_PRICING_REFERENCE_DATE_KST: '2026-08-15',
    ANTHROPIC_INPUT_USD_PER_MILLION: '3',
    ANTHROPIC_OUTPUT_USD_PER_MILLION: '15',
  });
  assert.strictEqual(explicitOverride.inputUsdPerMillion, 3);
  assert.strictEqual(explicitOverride.outputUsdPerMillion, 15);

  const introDefaults = defaultPricingForModel('claude-sonnet-5', {
    ANTHROPIC_PRICING_REFERENCE_DATE_KST: '2026-08-20',
  });
  assert.deepStrictEqual(introDefaults, {
    inputUsdPerMillion: 2,
    outputUsdPerMillion: 10,
  });

  const fallbackDefaults = defaultPricingForModel('claude-sonnet-5', {
    ANTHROPIC_PRICING_REFERENCE_DATE_KST: '2026-09-20',
  });
  assert.deepStrictEqual(fallbackDefaults, {
    inputUsdPerMillion: 3,
    outputUsdPerMillion: 15,
  });

  assert.strictEqual(resolveReferenceKstDate({ ANTHROPIC_PRICING_REFERENCE_DATE_KST: '2026-08-31' }), '2026-08-31');
}

async function testPreparedContextIsDeliveredToFinalize() {
  const request = {
    ...makeRequest('context-pass-through', 'context pipeline check', 120),
    generator: 'blog',
    context: {
      candidate: { _category: '전국 축제·여행', name: '테스트 축제' },
      category: 'festival',
      title: '컨텍스트 전달 검증',
    },
  };
  const client = {
    messages: {
      batches: {
        async create() {
          return { id: 'batch-context', processing_status: 'in_progress' };
        },
        async retrieve() {
          return { id: 'batch-context', processing_status: 'ended' };
        },
        async results() {
          return (async function* resultsIterator() {
            yield makeResult('context-pass-through', 'context ok');
          }());
        },
      },
    },
  };
  const generator = {
    name: 'blog',
    async prepare() {
      return [request];
    },
    async finalize(preparedRequest, modelResult) {
      assert.strictEqual(modelResult.status, 'succeeded');
      assert.ok(preparedRequest.context);
      assert.strictEqual(preparedRequest.context.category, 'festival');
      assert.strictEqual(preparedRequest.context.title, '컨텍스트 전달 검증');
      assert.strictEqual(preparedRequest.context.candidate._category, '전국 축제·여행');
      assert.strictEqual(preparedRequest.context.candidate.name, '테스트 축제');
      return true;
    },
  };

  const outputs = await runAnthropicBlogBatch({
    client,
    config: makeConfig(),
    budgetGuard: new AnthropicBudgetGuard(makeConfig()),
    generators: [generator],
  });

  assert.strictEqual(outputs.batch_success_count, 1);
  assert.strictEqual(outputs.unpublished_count, 0);
}

async function testRunnerPublishesEveryRequiredGithubOutput() {
  const outputPath = path.join(os.tmpdir(), `anthropic-blog-output-${process.pid}-${Date.now()}.txt`);
  const outputs = Object.fromEntries(OUTPUT_KEYS.map((key) => [key, key === 'budget_enabled']));
  publishGithubOutputs(outputs, outputPath);
  const lines = fs.readFileSync(outputPath, 'utf8').trim().split(/\r?\n/);
  fs.unlinkSync(outputPath);

  assert.deepStrictEqual(
    lines.map((line) => line.slice(0, line.indexOf('='))),
    OUTPUT_KEYS
  );
}

async function testPromptHashIsStable() {
  const prompt = '프롬프트 텍스트는 변경하지 않습니다.\n동일 입력';
  assert.strictEqual(promptHash(prompt), promptHash(prompt));
  assert.notStrictEqual(promptHash(prompt), promptHash(`${prompt}!`));
}

async function run() {
  await testSingleBatchAndResultMapping();
  await testFailedResultUsageCountsTowardActualCost();
  await testFailedSyncFallbackUsageCountsTowardActualCost();
  await testCustomIdNormalizationToAsciiForBatchApi();
  await testFixedPollingAndTimeout();
  await testBudgetWarningAndFallbackStop();
  await testFallbackEstimateUsesLastUsageOrConservativeConstant();
  await testSubmitFailureReleasesReservations();
  await testPartialResultsRemainAvailableAfterStreamFailure();
  await testRunnerTimeoutUsesPartialResultsAndFallbacksOnlyUnresolved();
  await testRunnerBudgetStopPreventsFallbackCall();
  await testBlogQualityRetryUsesSameBudgetGuard();
  await testSonnet5IntroPricingDefaultsByKstDate();
  await testPreparedContextIsDeliveredToFinalize();
  await testRunnerPublishesEveryRequiredGithubOutput();
  await testPromptHashIsStable();
  console.log('anthropic-blog-batch fake client tests: PASS');
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});

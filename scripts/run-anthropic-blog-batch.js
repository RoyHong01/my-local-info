'use strict';

const fs = require('fs');
const {
  AnthropicBudgetGuard,
  callSyncFallback,
  cancelTimedOutBatch,
  collectBatchResults,
  configFromEnv,
  createAnthropicClient,
  estimateRequestCostKrw,
  normalizeRequest,
  pollBatch,
  submitBatch,
} = require('./lib/anthropic-blog-batch');

const FIXED_POLL_INTERVAL_MS = 300_000;
const FIXED_TIMEOUT_MS = 21_600_000;
const DISABLE_FINALIZE_SYNC_RETRY = String(process.env.ANTHROPIC_DISABLE_FINALIZE_SYNC_RETRY || 'true').trim().toLowerCase() !== 'false';

const OUTPUT_KEYS = [
  'model',
  'batch_id',
  'batch_status',
  'batch_duration_ms',
  'batch_request_count',
  'batch_success_count',
  'batch_failure_count',
  'fallback_attempted_count',
  'fallback_success_count',
  'fallback_failure_count',
  'unpublished_count',
  'unpublished_reasons',
  'budget_enabled',
  'budget_limit_krw',
  'budget_warn_threshold_krw',
  'estimated_cost_krw',
  'actual_cost_krw',
  'budget_warning',
  'budget_stopped',
  'budget_stop_reason',
  'mid_image_inserted_count',
  'mid_image_omitted_count',
];

function getDefaultGenerators() {
  const {
    prepareBlogRequests,
    finalizeBlogRequest,
  } = require('./generate-blog-post');
  const {
    prepareCurationRequests,
    finalizeCurationRequest,
  } = require('./generate-curation-posts');
  const {
    prepareFestivalVersusRequests,
    finalizeFestivalVersusRequest,
  } = require('./generate-festival-versus-post');

  return [
    { name: 'blog', prepare: prepareBlogRequests, finalize: finalizeBlogRequest },
    { name: 'curation', prepare: prepareCurationRequests, finalize: finalizeCurationRequest },
    { name: 'festival-versus', prepare: prepareFestivalVersusRequests, finalize: finalizeFestivalVersusRequest },
  ];
}

function errorMessage(error) {
  return String(error?.message || error || 'unknown error').replace(/[\r\n]+/g, ' ').trim();
}

function createInitialOutputs(config) {
  return {
    model: config.model,
    batch_id: '',
    batch_status: 'not_submitted',
    batch_duration_ms: 0,
    batch_request_count: 0,
    batch_success_count: 0,
    batch_failure_count: 0,
    fallback_attempted_count: 0,
    fallback_success_count: 0,
    fallback_failure_count: 0,
    unpublished_count: 0,
    unpublished_reasons: '[]',
    budget_enabled: config.dailyBudgetKrw > 0,
    budget_limit_krw: config.dailyBudgetKrw,
    budget_warn_threshold_krw: config.dailyBudgetKrw * config.warnRatio,
    estimated_cost_krw: 0,
    actual_cost_krw: 0,
    budget_warning: false,
    budget_stopped: false,
    budget_stop_reason: '',
    mid_image_inserted_count: 0,
    mid_image_omitted_count: 0,
  };
}

function outputValue(value) {
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '0';
  return String(value ?? '').replace(/[\r\n]+/g, ' ');
}

function publishGithubOutputs(outputs, outputPath = process.env.GITHUB_OUTPUT) {
  if (!outputPath) return;
  const lines = OUTPUT_KEYS.map((key) => `${key}=${outputValue(outputs[key])}`);
  fs.appendFileSync(outputPath, `${lines.join('\n')}\n`, 'utf8');
}

function buildMidImageOutcome(preparedRequest, finalModelResult) {
  if (preparedRequest.generator !== 'blog') return '';
  if (preparedRequest.context?.candidate?._category !== '전국 축제·여행') return '';
  if (!preparedRequest.context?.midImageUrl) return 'omitted';
  return /!\[[^\]]*\]\([^\)]+\)/.test(String(finalModelResult?.text || ''))
    ? 'omitted'
    : 'inserted';
}

async function collectPreparedRequests(generators, config, unpublished) {
  const prepared = [];
  const owners = new Map();
  const seenIds = new Set();

  for (const generator of generators) {
    let requests;
    try {
      requests = await generator.prepare();
    } catch (error) {
      console.error(`[anthropic-batch] ${generator.name} 준비 실패: ${errorMessage(error)}`);
      continue;
    }

    for (const [index, rawRequest] of (Array.isArray(requests) ? requests : []).entries()) {
      try {
        const request = normalizeRequest(rawRequest, config);
        request.generator = rawRequest.generator || generator.name;
        request.context = rawRequest.context || {};
        if (seenIds.has(request.customId)) {
          throw new Error(`duplicate customId: ${request.customId}`);
        }
        seenIds.add(request.customId);
        prepared.push(request);
        owners.set(request.customId, generator);
      } catch (error) {
        const customId = rawRequest?.customId || `${generator.name}-prepare-${index + 1}`;
        unpublished.set(customId, `prepare_error:${errorMessage(error)}`);
        console.error(`[anthropic-batch] ${customId} 준비 항목 제외: ${errorMessage(error)}`);
      }
    }
  }

  return { prepared, owners };
}

function releaseRequests(budgetGuard, requests) {
  for (const request of requests) budgetGuard.release(request.customId);
}

async function runAnthropicBlogBatch(options = {}) {
  const config = {
    ...configFromEnv(options.env || process.env),
    ...(options.config || {}),
    pollIntervalMs: FIXED_POLL_INTERVAL_MS,
    timeoutMs: FIXED_TIMEOUT_MS,
  };
  const outputs = createInitialOutputs(config);
  const budgetGuard = options.budgetGuard || new AnthropicBudgetGuard(config);
  const unpublished = new Map();
  const generators = options.generators || getDefaultGenerators();
  const { prepared, owners } = await collectPreparedRequests(generators, config, unpublished);

  if (prepared.length === 0) {
    outputs.batch_status = 'no_requests';
    outputs.unpublished_count = unpublished.size;
    outputs.unpublished_reasons = JSON.stringify([...unpublished.entries()].map(([customId, reason]) => ({ customId, reason })));
    return outputs;
  }

  const client = options.client || createAnthropicClient();
  const batchStartedAt = Date.now();
  let accepted = [];
  let batchResults = new Map();
  let batch;
  let timedOut = false;

  try {
    const submission = await submitBatch({ client, requests: prepared, config, budgetGuard });
    accepted = submission.accepted;
    outputs.batch_request_count = accepted.length;
    outputs.estimated_cost_krw += accepted.reduce(
      (sum, request) => sum + estimateRequestCostKrw(request, config, true),
      0
    );
    for (const request of submission.budgetStopped) {
      unpublished.set(request.customId, 'warning_budget_stop');
    }

    batch = submission.batch;
    if (!batch) {
      outputs.batch_status = 'budget_stopped';
    } else {
      outputs.batch_id = String(batch.id || '');
      const pollResult = await pollBatch({
        client,
        batchId: batch.id,
        pollIntervalMs: FIXED_POLL_INTERVAL_MS,
        timeoutMs: FIXED_TIMEOUT_MS,
        now: options.now,
        sleepFn: options.sleepFn,
      });
      timedOut = pollResult.timedOut;
      outputs.batch_duration_ms = pollResult.durationMs;
      outputs.batch_status = timedOut
        ? 'timed_out'
        : String(pollResult.batch?.processing_status || 'ended');

      if (timedOut) {
        await cancelTimedOutBatch({ client, batchId: batch.id });
      }

      const requestsById = new Map(accepted.map((request) => [request.customId, request]));
      try {
        await collectBatchResults({
          client,
          batchId: batch.id,
          requestsById,
          budgetGuard,
          results: batchResults,
        });
      } catch (error) {
        console.error(`[anthropic-batch] 결과 수집 일부 실패: ${errorMessage(error)}`);
        if (!timedOut) outputs.batch_status = 'result_collection_failed';
      }
    }
  } catch (error) {
    outputs.batch_status = 'submit_or_poll_failed';
    outputs.batch_duration_ms = Date.now() - batchStartedAt;
    accepted = prepared.filter((request) => !unpublished.has(request.customId));
    outputs.batch_request_count = accepted.length;
    releaseRequests(budgetGuard, accepted);
    console.error(`[anthropic-batch] 배치 오케스트레이션 실패, 동기 fallback 전환: ${errorMessage(error)}`);
  }

  const acceptedIds = new Set(accepted.map((request) => request.customId));
  outputs.batch_success_count = [...batchResults.values()].filter((result) => result?.status === 'succeeded').length;
  outputs.batch_failure_count = Math.max(0, acceptedIds.size - outputs.batch_success_count);

  async function guardedSyncFallback(request, previousUsage = {}) {
    budgetGuard.release(request.customId);
    const estimatedOutputTokens = budgetGuard.estimateFallbackOutputTokens(request.maxTokens);
    const estimatedInputTokens = Number(previousUsage?.input_tokens || 0);
    const estimatedCacheWriteTokens = Number(previousUsage?.cache_creation_input_tokens || 0);
    const estimatedCacheReadTokens = Number(previousUsage?.cache_read_input_tokens || 0);
    const estimatedCost = estimateRequestCostKrw(request, config, false, {
      outputTokensEstimate: estimatedOutputTokens,
      inputTokensEstimate: estimatedInputTokens,
      cacheWriteTokensEstimate: estimatedCacheWriteTokens,
      cacheReadTokensEstimate: estimatedCacheReadTokens,
    });
    if (!budgetGuard.canSpend(estimatedCost)) {
      console.log(`[budget-diag] customId=${request.customId} promptLen=${String(request.prompt || '').length} maxTokens=${request.maxTokens} in=${estimatedInputTokens} cacheW=${estimatedCacheWriteTokens} cacheR=${estimatedCacheReadTokens} out=${estimatedOutputTokens} est=${estimatedCost.toFixed(2)} projected=${budgetGuard.projectedCostKrw.toFixed(2)} actual=${budgetGuard.actualCostKrw.toFixed(2)} limit=${config.dailyBudgetKrw}`);
      budgetGuard.stop(
        `warning_budget_stop: fallback 예상 ${Number(budgetGuard.projectedCostKrw + estimatedCost).toFixed(2)}원 / 한도 ${config.dailyBudgetKrw}원`
      );
      return {
        status: 'budget_stopped',
        error: budgetGuard.stopReason,
        promptHash: request.promptHash,
        source: 'sync-fallback',
      };
    }

    outputs.fallback_attempted_count++;
    outputs.estimated_cost_krw += estimatedCost;
    try {
      const result = await callSyncFallback({ client, request, config, budgetGuard });
      if (result.status === 'succeeded') outputs.fallback_success_count++;
      else outputs.fallback_failure_count++;
      return result;
    } catch (error) {
      outputs.fallback_failure_count++;
      return {
        status: 'fallback_failed',
        error: errorMessage(error),
        promptHash: request.promptHash,
        source: 'sync-fallback',
      };
    }
  }

  for (const request of accepted) {
    let modelResult = batchResults.get(request.customId);
    if (!modelResult || modelResult.status !== 'succeeded') {
      modelResult = await guardedSyncFallback(request, modelResult?.usage || {});
    }

    if (modelResult?.status === 'budget_stopped') {
      unpublished.set(request.customId, 'warning_budget_stop');
      continue;
    }
    if (!modelResult || modelResult.status !== 'succeeded') {
      unpublished.set(request.customId, `${modelResult?.status || 'unresolved'}:${modelResult?.error || 'no result'}`);
      continue;
    }

    const owner = owners.get(request.customId);
    let finalModelResult = modelResult;
    const retryWithGuard = async (retryRequest) => {
      const normalizedRetry = normalizeRequest({
        ...retryRequest,
        model: retryRequest.model || request.model,
      }, config);
      const retryResult = await guardedSyncFallback(normalizedRetry);
      if (retryResult.status === 'budget_stopped') {
        throw new Error(`BLOG_BUDGET_STOP:${retryResult.error || budgetGuard.stopReason}`);
      }
      if (retryResult.status !== 'succeeded') {
        throw new Error(retryResult.error || retryResult.status);
      }
      finalModelResult = retryResult;
      return retryResult;
    };

    try {
      const finalizeOptions = request.generator === 'blog'
        ? { allowQualityRetry: !DISABLE_FINALIZE_SYNC_RETRY }
        : {};
      const published = await owner.finalize(request, modelResult, retryWithGuard, finalizeOptions);
      if (!published) {
        unpublished.set(request.customId, 'finalize_rejected');
        continue;
      }
      const midImageOutcome = buildMidImageOutcome(request, finalModelResult);
      if (midImageOutcome === 'inserted') outputs.mid_image_inserted_count++;
      if (midImageOutcome === 'omitted') outputs.mid_image_omitted_count++;
    } catch (error) {
      const message = errorMessage(error);
      const reason = message.startsWith('BLOG_BUDGET_STOP:')
        ? 'warning_budget_stop'
        : `finalize_error:${message}`;
      unpublished.set(request.customId, reason);
      console.error(`[anthropic-batch] ${request.customId} finalize 실패: ${message}`);
    }
  }

  for (const request of prepared) {
    budgetGuard.release(request.customId);
  }

  const budget = budgetGuard.snapshot();
  outputs.unpublished_count = unpublished.size;
  outputs.unpublished_reasons = JSON.stringify([...unpublished.entries()].map(([customId, reason]) => ({ customId, reason })));
  outputs.actual_cost_krw = budget.actualCostKrw;
  outputs.budget_warning = outputs.estimated_cost_krw >= outputs.budget_warn_threshold_krw
    || budget.actualCostKrw >= outputs.budget_warn_threshold_krw
    || budget.stopped;
  outputs.budget_stopped = budget.stopped;
  outputs.budget_stop_reason = budget.stopReason;

  return outputs;
}

async function main() {
  const config = {
    ...configFromEnv(process.env),
    pollIntervalMs: FIXED_POLL_INTERVAL_MS,
    timeoutMs: FIXED_TIMEOUT_MS,
  };
  let outputs = createInitialOutputs(config);
  try {
    outputs = await runAnthropicBlogBatch({ config });
    console.log('[anthropic-batch] 완료:', JSON.stringify(outputs));
  } catch (error) {
    outputs.batch_status = 'orchestration_fatal';
    outputs.unpublished_reasons = JSON.stringify([{ customId: 'orchestration', reason: errorMessage(error) }]);
    outputs.unpublished_count = 1;
    console.error('[anthropic-batch] 치명적 오케스트레이션 오류:', errorMessage(error));
    process.exitCode = 1;
  } finally {
    publishGithubOutputs(outputs);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  FIXED_POLL_INTERVAL_MS,
  FIXED_TIMEOUT_MS,
  OUTPUT_KEYS,
  createInitialOutputs,
  publishGithubOutputs,
  runAnthropicBlogBatch,
};
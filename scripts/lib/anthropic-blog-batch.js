'use strict';

const crypto = require('crypto');
const Anthropic = require('@anthropic-ai/sdk');

const DEFAULT_MODEL = 'claude-sonnet-5';
const DEFAULT_POLL_INTERVAL_MS = 20_000;
const DEFAULT_TIMEOUT_MS = 30 * 60 * 1000;
const DEFAULT_DAILY_BUDGET_KRW = 1500;
const DEFAULT_WARN_RATIO = 0.8;
const DEFAULT_USD_KRW = 1470;
const DEFAULT_INPUT_USD_PER_MILLION = 3;
const DEFAULT_OUTPUT_USD_PER_MILLION = 15;
const CACHE_READ_RATIO = 0.1;
const CACHE_WRITE_RATIO = 1.25;
const DEFAULT_BATCH_DISCOUNT = 0.5;
const DEFAULT_CHARS_PER_TOKEN = 2;
const DEFAULT_FALLBACK_OUTPUT_TOKENS_ESTIMATE = 3000;
const SONNET5_INTRO_INPUT_USD_PER_MILLION = 2;
const SONNET5_INTRO_OUTPUT_USD_PER_MILLION = 10;
const SONNET5_INTRO_END_DATE_KST = '2026-08-31';

function numberFrom(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function toKstDate(date = new Date()) {
  const kst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  const year = kst.getUTCFullYear();
  const month = String(kst.getUTCMonth() + 1).padStart(2, '0');
  const day = String(kst.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function resolveReferenceKstDate(env = process.env) {
  const raw = String(env.ANTHROPIC_PRICING_REFERENCE_DATE_KST || '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  return toKstDate();
}

function defaultPricingForModel(model, env = process.env) {
  const normalizedModel = String(model || '').trim().toLowerCase();
  const referenceDate = resolveReferenceKstDate(env);

  if (normalizedModel === 'claude-sonnet-5' && referenceDate <= SONNET5_INTRO_END_DATE_KST) {
    return {
      inputUsdPerMillion: SONNET5_INTRO_INPUT_USD_PER_MILLION,
      outputUsdPerMillion: SONNET5_INTRO_OUTPUT_USD_PER_MILLION,
    };
  }

  return {
    inputUsdPerMillion: DEFAULT_INPUT_USD_PER_MILLION,
    outputUsdPerMillion: DEFAULT_OUTPUT_USD_PER_MILLION,
  };
}

function configFromEnv(env = process.env) {
  const model = env.ANTHROPIC_BLOG_MODEL || DEFAULT_MODEL;
  const pricingDefaults = defaultPricingForModel(model, env);
  return {
    model,
    pollIntervalMs: numberFrom(env.ANTHROPIC_BATCH_POLL_INTERVAL_MS, DEFAULT_POLL_INTERVAL_MS),
    timeoutMs: numberFrom(env.ANTHROPIC_BATCH_TIMEOUT_MS, DEFAULT_TIMEOUT_MS),
    dailyBudgetKrw: numberFrom(env.ANTHROPIC_DAILY_BUDGET_KRW, DEFAULT_DAILY_BUDGET_KRW),
    warnRatio: numberFrom(env.ANTHROPIC_BUDGET_WARN_RATIO, DEFAULT_WARN_RATIO),
    usdKrw: numberFrom(env.ANTHROPIC_USD_KRW, DEFAULT_USD_KRW),
    inputUsdPerMillion: numberFrom(env.ANTHROPIC_INPUT_USD_PER_MILLION, pricingDefaults.inputUsdPerMillion),
    outputUsdPerMillion: numberFrom(env.ANTHROPIC_OUTPUT_USD_PER_MILLION, pricingDefaults.outputUsdPerMillion),
    batchDiscount: numberFrom(env.ANTHROPIC_BATCH_DISCOUNT, DEFAULT_BATCH_DISCOUNT),
    charsPerToken: Math.max(1, numberFrom(env.ANTHROPIC_ESTIMATE_CHARS_PER_TOKEN, DEFAULT_CHARS_PER_TOKEN)),
    fallbackOutputTokensEstimate: Math.max(1, numberFrom(
      env.ANTHROPIC_FALLBACK_OUTPUT_TOKENS_ESTIMATE,
      DEFAULT_FALLBACK_OUTPUT_TOKENS_ESTIMATE
    )),
  };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function promptHash(prompt) {
  return crypto.createHash('sha256').update(String(prompt || ''), 'utf8').digest('hex');
}

function estimateInputTokens(prompt, charsPerToken = DEFAULT_CHARS_PER_TOKEN) {
  return Math.max(1, Math.ceil(String(prompt || '').length / Math.max(1, charsPerToken)));
}

function makeApiSafeCustomId(customId, fallbackPrefix = 'req') {
  const raw = String(customId || '').trim();
  const hash = crypto.createHash('sha1').update(raw || fallbackPrefix, 'utf8').digest('hex').slice(0, 8);

  let normalized = raw
    .replace(/[^A-Za-z0-9_-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/_{2,}/g, '_')
    .replace(/^[-_]+|[-_]+$/g, '');

  if (!normalized) {
    normalized = `${fallbackPrefix}-${hash}`;
  }

  if (!/^[A-Za-z0-9]/.test(normalized)) {
    normalized = `${fallbackPrefix}-${normalized}`;
  }

  if (normalized.length > 64) {
    const headLength = 64 - 1 - hash.length;
    normalized = `${normalized.slice(0, headLength)}-${hash}`;
  }

  if (!/^[a-zA-Z0-9_-]{1,64}$/.test(normalized)) {
    normalized = `${fallbackPrefix}-${hash}`;
  }

  return normalized;
}

function usageTokens(usage = {}) {
  const inputTokens = Number(usage.input_tokens || 0)
    + Number(usage.cache_creation_input_tokens || 0)
    + Number(usage.cache_read_input_tokens || 0);
  const outputTokens = Number(usage.output_tokens || 0);
  return { inputTokens, outputTokens };
}

function hasBilledUsage(usage = {}) {
  const { inputTokens, outputTokens } = usageTokens(usage);
  return inputTokens > 0 || outputTokens > 0;
}

function extractUsageFromBatchItem(item = {}) {
  if (item?.result?.message?.usage) return item.result.message.usage;
  if (item?.result?.usage) return item.result.usage;
  if (item?.result?.error?.usage) return item.result.error.usage;
  return {};
}

function extractUsageFromError(error) {
  const candidates = [
    error?.usage,
    error?.error?.usage,
    error?.response?.usage,
    error?.response?.error?.usage,
    error?.response?.body?.usage,
    error?.response?.body?.error?.usage,
  ];

  for (const usage of candidates) {
    if (hasBilledUsage(usage || {})) return usage;
  }
  return {};
}

function calculateCostKrw({
  inputTokens = 0,
  cacheWriteTokens = 0,
  cacheReadTokens = 0,
  outputTokens = 0,
  isBatch = false,
}, config = configFromEnv()) {
  const inputUsd = (Number(inputTokens || 0) / 1_000_000) * config.inputUsdPerMillion;
  const cacheWriteUsd = (Number(cacheWriteTokens || 0) / 1_000_000)
    * config.inputUsdPerMillion
    * CACHE_WRITE_RATIO;
  const cacheReadUsd = (Number(cacheReadTokens || 0) / 1_000_000)
    * config.inputUsdPerMillion
    * CACHE_READ_RATIO;
  const outputUsd = (Number(outputTokens || 0) / 1_000_000) * config.outputUsdPerMillion;
  const discount = isBatch ? config.batchDiscount : 1;
  return (inputUsd + cacheWriteUsd + cacheReadUsd + outputUsd) * config.usdKrw * discount;
}

function estimateRequestCostKrw(request, config = configFromEnv(), isBatch = true, options = {}) {
  const fallbackOutputTokens = Number(options.outputTokensEstimate || 0);
  const fallbackInputTokens = Number(options.inputTokensEstimate || 0);
  const fallbackCacheWriteTokens = Number(options.cacheWriteTokensEstimate || 0);
  const fallbackCacheReadTokens = Number(options.cacheReadTokensEstimate || 0);
  const boundedOutputTokens = fallbackOutputTokens > 0
    ? Math.min(Number(request.maxTokens || 0), fallbackOutputTokens)
    : Number(request.maxTokens || 0);
  const boundedInputTokens = fallbackInputTokens > 0
    ? fallbackInputTokens
    : estimateInputTokens(request.prompt, config.charsPerToken);

  return calculateCostKrw({
    inputTokens: boundedInputTokens,
    cacheWriteTokens: fallbackCacheWriteTokens,
    cacheReadTokens: fallbackCacheReadTokens,
    outputTokens: boundedOutputTokens,
    isBatch,
  }, config);
}

function normalizeRequest(request, config = configFromEnv()) {
  if (!request || !request.customId || !request.prompt) {
    throw new Error('Anthropic batch request requires customId and prompt');
  }
  return {
    customId: makeApiSafeCustomId(request.customId, request.generator || 'req'),
    prompt: String(request.prompt),
    promptHash: request.promptHash || promptHash(request.prompt),
    maxTokens: Math.max(1, Number(request.maxTokens || 4096)),
    model: request.model || config.model,
    metadata: request.metadata || {},
  };
}

function toBatchRequest(request, config = configFromEnv()) {
  const normalized = normalizeRequest(request, config);
  return {
    custom_id: normalized.customId,
    params: {
      model: normalized.model,
      max_tokens: normalized.maxTokens,
      messages: [{ role: 'user', content: normalized.prompt }],
    },
  };
}

function extractMessageText(message) {
  return (message?.content || [])
    .filter((part) => part?.type === 'text')
    .map((part) => part.text || '')
    .join('\n')
    .trim();
}

class AnthropicBudgetGuard {
  constructor(config = configFromEnv()) {
    this.config = config;
    this.actualCostKrw = 0;
    this.lastSuccessfulOutputTokens = 0;
    this.reservations = new Map();
    this.stopped = false;
    this.stopReason = '';
  }

  get reservedCostKrw() {
    return [...this.reservations.values()].reduce((sum, value) => sum + value, 0);
  }

  get projectedCostKrw() {
    return this.actualCostKrw + this.reservedCostKrw;
  }

  get warnThresholdKrw() {
    return this.config.dailyBudgetKrw * this.config.warnRatio;
  }

  get warningReached() {
    return this.projectedCostKrw >= this.warnThresholdKrw;
  }

  canSpend(amountKrw) {
    return this.projectedCostKrw + Number(amountKrw || 0) <= this.config.dailyBudgetKrw;
  }

  stop(reason) {
    this.stopped = true;
    this.stopReason = reason || 'warning_budget_stop';
  }

  reserve(request, isBatch = true) {
    const amount = estimateRequestCostKrw(request, this.config, isBatch);
    if (!this.canSpend(amount)) {
      this.stop(`warning_budget_stop: 예상 ${Number(this.projectedCostKrw + amount).toFixed(2)}원 / 한도 ${this.config.dailyBudgetKrw}원`);
      return false;
    }
    this.reservations.set(request.customId, amount);
    return true;
  }

  release(customId) {
    this.reservations.delete(customId);
  }

  settle(customId, usage, isBatch) {
    this.release(customId);
    const tokens = usageTokens(usage);
    if (tokens.outputTokens > 0) {
      this.lastSuccessfulOutputTokens = tokens.outputTokens;
    }
    const amount = calculateCostKrw({ ...tokens, isBatch }, this.config);
    this.actualCostKrw += amount;
    if (this.actualCostKrw >= this.config.dailyBudgetKrw) {
      this.stop(`warning_budget_stop: 실제 ${this.actualCostKrw.toFixed(2)}원 / 한도 ${this.config.dailyBudgetKrw}원`);
    }
    return amount;
  }

  estimateFallbackOutputTokens(maxTokens) {
    const preferred = this.lastSuccessfulOutputTokens > 0
      ? this.lastSuccessfulOutputTokens
      : this.config.fallbackOutputTokensEstimate;
    return Math.max(1, Math.min(Number(maxTokens || 0), Number(preferred || 1)));
  }

  snapshot() {
    return {
      enabled: this.config.dailyBudgetKrw > 0,
      limitKrw: this.config.dailyBudgetKrw,
      warnThresholdKrw: this.warnThresholdKrw,
      warningReached: this.warningReached,
      actualCostKrw: this.actualCostKrw,
      reservedCostKrw: this.reservedCostKrw,
      projectedCostKrw: this.projectedCostKrw,
      stopped: this.stopped,
      stopReason: this.stopReason,
    };
  }
}

async function submitBatch({ client, requests, config = configFromEnv(), budgetGuard }) {
  const normalized = requests.map((request) => ({
    ...request,
    ...normalizeRequest(request, config),
  }));
  const accepted = [];
  const budgetStopped = [];

  for (const request of normalized) {
    if (budgetGuard && !budgetGuard.reserve(request, true)) {
      budgetStopped.push(request);
      continue;
    }
    accepted.push(request);
  }

  if (accepted.length === 0) {
    return { batch: null, accepted, budgetStopped };
  }

  try {
    const batch = await client.messages.batches.create({
      requests: accepted.map((request) => toBatchRequest(request, config)),
    });
    return { batch, accepted, budgetStopped };
  } catch (error) {
    if (budgetGuard) {
      for (const request of accepted) budgetGuard.release(request.customId);
    }
    throw error;
  }
}

async function pollBatch({
  client,
  batchId,
  pollIntervalMs = DEFAULT_POLL_INTERVAL_MS,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  now = () => Date.now(),
  sleepFn = sleep,
}) {
  const startedAtMs = now();
  let batch = await client.messages.batches.retrieve(batchId);

  while (batch?.processing_status !== 'ended') {
    const elapsedMs = now() - startedAtMs;
    if (elapsedMs >= timeoutMs) {
      return { batch, timedOut: true, durationMs: elapsedMs };
    }
    await sleepFn(pollIntervalMs);
    batch = await client.messages.batches.retrieve(batchId);
  }

  return { batch, timedOut: false, durationMs: now() - startedAtMs };
}

async function collectBatchResults({ client, batchId, requestsById, budgetGuard, results = new Map() }) {
  for await (const item of await client.messages.batches.results(batchId)) {
    const customId = String(item.custom_id || '');
    const request = requestsById.get(customId);
    if (!request) continue;

    if (item.result?.type === 'succeeded') {
      const message = item.result.message;
      if (budgetGuard) budgetGuard.settle(customId, message?.usage || {}, true);
      results.set(customId, {
        status: 'succeeded',
        text: extractMessageText(message),
        finishReason: message?.stop_reason || '',
        usage: message?.usage || {},
        promptHash: request.promptHash,
        source: 'batch',
      });
    } else {
      const usage = extractUsageFromBatchItem(item);
      if (budgetGuard) {
        if (hasBilledUsage(usage)) budgetGuard.settle(customId, usage, true);
        else budgetGuard.release(customId);
      }
      results.set(customId, {
        status: item.result?.type || 'errored',
        error: item.result?.error?.message || item.result?.type || 'unknown batch error',
        usage,
        promptHash: request.promptHash,
        source: 'batch',
      });
    }
  }
  return results;
}

async function cancelTimedOutBatch({ client, batchId }) {
  try {
    return await client.messages.batches.cancel(batchId);
  } catch (error) {
    return { id: batchId, processing_status: 'cancel_error', error: error?.message || String(error) };
  }
}

async function callSyncFallback({ client, request, config = configFromEnv(), budgetGuard }) {
  const normalized = normalizeRequest(request, config);
  const estimatedCostKrw = estimateRequestCostKrw(normalized, config, false);
  if (budgetGuard && !budgetGuard.canSpend(estimatedCostKrw)) {
    budgetGuard.stop(`warning_budget_stop: fallback 예상 ${Number(budgetGuard.projectedCostKrw + estimatedCostKrw).toFixed(2)}원 / 한도 ${config.dailyBudgetKrw}원`);
    return {
      status: 'budget_stopped',
      error: budgetGuard.stopReason,
      promptHash: normalized.promptHash,
      source: 'sync-fallback',
    };
  }

  try {
    const message = await client.messages.create({
      model: normalized.model,
      max_tokens: normalized.maxTokens,
      messages: [{ role: 'user', content: normalized.prompt }],
    });
    if (budgetGuard) budgetGuard.settle(normalized.customId, message?.usage || {}, false);
    return {
      status: 'succeeded',
      text: extractMessageText(message),
      finishReason: message?.stop_reason || '',
      usage: message?.usage || {},
      promptHash: normalized.promptHash,
      source: 'sync-fallback',
    };
  } catch (error) {
    const usage = extractUsageFromError(error);
    if (budgetGuard && hasBilledUsage(usage)) {
      budgetGuard.settle(normalized.customId, usage, false);
    }
    throw error;
  }
}

function createAnthropicClient(apiKey = process.env.ANTHROPIC_API_KEY) {
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is missing');
  return new Anthropic({ apiKey });
}

module.exports = {
  AnthropicBudgetGuard,
  calculateCostKrw,
  callSyncFallback,
  cancelTimedOutBatch,
  collectBatchResults,
  configFromEnv,
  createAnthropicClient,
  estimateInputTokens,
  estimateRequestCostKrw,
  extractMessageText,
  makeApiSafeCustomId,
  normalizeRequest,
  pollBatch,
  promptHash,
  submitBatch,
  toBatchRequest,
  extractUsageFromError,
  extractUsageFromBatchItem,
  hasBilledUsage,
  usageTokens,
  defaultPricingForModel,
  resolveReferenceKstDate,
  toKstDate,
};

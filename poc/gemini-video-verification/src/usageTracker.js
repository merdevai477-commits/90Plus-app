import fs from 'node:fs';
import path from 'node:path';
import { pocPaths, ensureDirs } from './loadEnv.js';

/**
 * Documented paid-tier list prices (USD per 1M tokens) for cost *estimates*.
 * Free tier may bill $0 — we always report both estimate and "observed free if no invoice".
 * Source: https://ai.google.dev/gemini-api/docs/pricing (checked during POC).
 */
export const DOCUMENTED_PRICING_USD_PER_1M = {
  'gemini-2.5-flash-lite': { input: 0.1, output: 0.4, freeTierListed: true },
  'gemini-2.5-flash': { input: 0.3, output: 2.5, freeTierListed: true },
  'gemini-2.0-flash': { input: 0.1, output: 0.4, freeTierListed: true },
  'gemini-2.0-flash-lite': { input: 0.075, output: 0.3, freeTierListed: true },
  'gemini-3-flash-preview': { input: 0.3, output: 2.5, freeTierListed: true },
  'gemini-3.5-flash': { input: 0.3, output: 2.5, freeTierListed: true },
  'gemini-3.5-flash-lite': { input: 0.1, output: 0.4, freeTierListed: true },
  'gemini-3.1-flash-lite': { input: 0.1, output: 0.4, freeTierListed: true },
};

export function estimateCostUsd(model, promptTokens, candidatesTokens) {
  // Prefer longest id match so flash-lite does not collapse to flash pricing.
  const key =
    Object.keys(DOCUMENTED_PRICING_USD_PER_1M)
      .filter((k) => model === k || model.includes(k))
      .sort((a, b) => b.length - a.length)[0] || null;
  const pricing = key ? DOCUMENTED_PRICING_USD_PER_1M[key] : null;
  if (!pricing) {
    return { estimatedUsd: null, pricingModel: null, note: 'No local pricing table entry for this model' };
  }
  const estimatedUsd =
    (promptTokens / 1_000_000) * pricing.input + (candidatesTokens / 1_000_000) * pricing.output;
  return {
    estimatedUsd,
    pricingModel: key,
    freeTierListed: pricing.freeTierListed,
    note: 'Estimate from documented paid rates; free-tier requests may cost $0',
  };
}

function readUsageMetadata(response) {
  const meta = response?.usageMetadata || response?.usage_metadata || {};
  return {
    promptTokenCount: meta.promptTokenCount ?? meta.prompt_token_count ?? null,
    candidatesTokenCount: meta.candidatesTokenCount ?? meta.candidates_token_count ?? null,
    totalTokenCount: meta.totalTokenCount ?? meta.total_token_count ?? null,
    thoughtsTokenCount: meta.thoughtsTokenCount ?? meta.thoughts_token_count ?? null,
    cachedContentTokenCount: meta.cachedContentTokenCount ?? meta.cached_content_token_count ?? null,
    promptTokensDetails: meta.promptTokensDetails ?? meta.prompt_tokens_details ?? null,
    raw: meta,
  };
}

export class UsageTracker {
  constructor(runId = `run-${Date.now()}`) {
    ensureDirs();
    this.runId = runId;
    this.records = [];
    this.filePath = path.join(pocPaths().usageDir, `${runId}.jsonl`);
  }

  start(label, model) {
    return {
      label,
      model,
      startedAt: Date.now(),
      retryAttempts: 0,
    };
  }

  finish(ctx, { response = null, httpStatus = 200, error = null, extra = {} } = {}) {
    const endedAt = Date.now();
    const usage = response ? readUsageMetadata(response) : {};
    const promptTokens = usage.promptTokenCount ?? 0;
    const candidatesTokens = usage.candidatesTokenCount ?? 0;
    const cost = estimateCostUsd(ctx.model, promptTokens, candidatesTokens);

    const record = {
      runId: this.runId,
      label: ctx.label,
      model: ctx.model,
      startedAt: new Date(ctx.startedAt).toISOString(),
      durationMs: endedAt - ctx.startedAt,
      httpStatus,
      retryAttempts: ctx.retryAttempts,
      success: !error,
      error: error
        ? {
            name: error.name,
            message: String(error.message || error).slice(0, 500),
            status: error.status ?? error.code ?? null,
          }
        : null,
      usageMetadata: {
        promptTokenCount: usage.promptTokenCount,
        candidatesTokenCount: usage.candidatesTokenCount,
        totalTokenCount: usage.totalTokenCount,
        thoughtsTokenCount: usage.thoughtsTokenCount,
        cachedContentTokenCount: usage.cachedContentTokenCount,
        promptTokensDetails: usage.promptTokensDetails,
      },
      costEstimate: cost,
      ...extra,
    };

    this.records.push(record);
    fs.appendFileSync(this.filePath, `${JSON.stringify(record)}\n`, 'utf8');
    return record;
  }

  summary() {
    const ok = this.records.filter((r) => r.success);
    const fail = this.records.filter((r) => !r.success);
    const totalPrompt = ok.reduce((s, r) => s + (r.usageMetadata.promptTokenCount || 0), 0);
    const totalOut = ok.reduce((s, r) => s + (r.usageMetadata.candidatesTokenCount || 0), 0);
    const totalAll = ok.reduce((s, r) => s + (r.usageMetadata.totalTokenCount || 0), 0);
    const avgLatency =
      ok.length === 0 ? null : ok.reduce((s, r) => s + r.durationMs, 0) / ok.length;
    const estimatedCostSum = ok.reduce((s, r) => s + (r.costEstimate.estimatedUsd || 0), 0);
    const rateLimited = this.records.filter(
      (r) => r.httpStatus === 429 || r.error?.status === 429 || /429|RESOURCE_EXHAUSTED/i.test(r.error?.message || ''),
    ).length;

    return {
      runId: this.runId,
      totalRequests: this.records.length,
      successCount: ok.length,
      failureCount: fail.length,
      failureRate: this.records.length ? fail.length / this.records.length : 0,
      rateLimitedCount: rateLimited,
      averageLatencyMs: avgLatency,
      tokens: {
        prompt: totalPrompt,
        candidates: totalOut,
        total: totalAll,
      },
      estimatedPaidCostUsd: estimatedCostSum,
      note: 'Remaining quota is NOT exposed by the API; see report for documented vs observed.',
      filePath: this.filePath,
    };
  }

  writeSummary(name = 'usage-summary') {
    // Keep usage dumps distinct from analyzer/benchmark result payloads.
    const out = path.join(pocPaths().reportsDir, `usage-${name}-${this.runId}.json`);
    fs.writeFileSync(out, JSON.stringify({ summary: this.summary(), records: this.records }, null, 2));
    return out;
  }
}

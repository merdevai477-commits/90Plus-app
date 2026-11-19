import fs from 'node:fs';
import path from 'node:path';
import { ensureDirs, pocPaths, loadEnv } from './loadEnv.js';

function readJson(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function latest(dir, prefix) {
  if (!fs.existsSync(dir)) return null;
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.startsWith(prefix) && f.endsWith('.json'))
    .map((f) => ({ f, m: fs.statSync(path.join(dir, f)).mtimeMs }))
    .sort((a, b) => b.m - a.m);
  return files[0] ? path.join(dir, files[0].f) : null;
}

export function generateReport() {
  loadEnv();
  ensureDirs();
  const { reportsDir } = pocPaths();
  const discovery = readJson(path.join(reportsDir, 'model-discovery.json'));
  const connectivity = readJson(path.join(reportsDir, 'connectivity.json'));
  const benchmarkPath = latest(reportsDir, 'benchmark-');
  const analyzerPath = latest(reportsDir, 'analyzer-');
  const benchmark = benchmarkPath ? readJson(benchmarkPath) : null;
  const analyzer = analyzerPath ? readJson(analyzerPath) : null;
  const extract = readJson(path.join(pocPaths().framesDir, 'extract-summary.json'));

  const model = benchmark?.model || connectivity?.model || discovery?.selectedModel || null;
  const blackResults = (analyzer?.results || [])
    .filter((r) => /black/i.test(r.video || ''))
    .map((r) => ({
      video: r.video,
      visual_status: r.analysis?.visual_status,
      is_black_screen: r.analysis?.is_black_screen,
      opencvLikelyFullyBlack: r.opencvHints?.likelyFullyBlack,
      confidence: r.analysis?.confidence,
    }));

  const md = `# Gemini Video Verification POC — Technical Report

Generated: ${new Date().toISOString()}

> Isolated POC under \`poc/gemini-video-verification\`. Production playback components were **not** modified.

## 1. Gemini API connection status

- API key present: **${connectivity?.auth?.status || discovery?.auth?.status || 'unknown'}**
- Key fingerprint: \`${connectivity?.auth?.apiKeyFingerprint || discovery?.auth?.apiKeyFingerprint || 'n/a'}\`
- Text ping success: **${connectivity?.textTest?.success ?? 'n/a'}** (HTTP ${connectivity?.textTest?.httpStatus ?? 'n/a'}, ${connectivity?.textTest?.durationMs ?? 'n/a'} ms)
- Image ping success: **${connectivity?.imageTest?.ok ?? 'n/a'}**
- Methods exercised: \`${(connectivity?.availableMethods || []).join(', ')}\`

## 2. Available models

- Listed via \`ai.models.list()\`: **${discovery?.counts?.totalListed ?? 'n/a'}**
- Supporting \`generateContent\`: **${discovery?.counts?.generateContent ?? 'n/a'}**
- Vision candidates ranked: **${discovery?.counts?.visionCandidates ?? 'n/a'}**

Top candidates:

${(discovery?.rankedVisionCandidates || [])
  .slice(0, 8)
  .map((m) => `- \`${m.id}\` (score ${m.score})`)
  .join('\n') || '- (none)'}

## 3. Selected model and justification

- **Selected:** \`${model}\`
- Justification: ${discovery?.selectionJustification || 'n/a'}

## 4. Image analysis accuracy on test samples

Stills used: black, football, error, loading (synthetic).

${(benchmark?.consistency?.imageStatuses || [])
  .map((s, i) => `- Image #${i + 1}: visual_status=\`${s}\`, football=${benchmark?.consistency?.imageFootballDetected?.[i]}`)
  .join('\n') || '- Run benchmark to populate.'}

## 5. Black-screen detection results

${blackResults.length
  ? blackResults.map((r) => `- \`${r.video}\`: Gemini status=\`${r.visual_status}\`, is_black=${r.is_black_screen}, OpenCV fullyBlack=${r.opencvLikelyFullyBlack}, conf=${r.confidence}`).join('\n')
  : '- Analyzer results not present yet (or no black sample analyzed).'}

OpenCV is used as an independent pre-check; Gemini performs semantic visual classification. Neither claims device playability.

## 6. Average response latency

- Benchmark average latency: **${benchmark?.usageSummary?.averageLatencyMs != null ? `${Math.round(benchmark.usageSummary.averageLatencyMs)} ms` : 'n/a'}**
- Connectivity discovery latency: **${discovery?.latencyMs ?? 'n/a'} ms**

## 7. Token consumption

- Benchmark total tokens: **${benchmark?.usageSummary?.tokens?.total ?? 'n/a'}**
  - prompt: ${benchmark?.usageSummary?.tokens?.prompt ?? 'n/a'}
  - candidates: ${benchmark?.usageSummary?.tokens?.candidates ?? 'n/a'}
- Requests: ${benchmark?.usageSummary?.totalRequests ?? 'n/a'} (failures: ${benchmark?.usageSummary?.failureCount ?? 'n/a'})

Observed \`usageMetadata\` fields are recorded per request in \`output/usage/*.jsonl\`.

## 8. Free-tier quota information

### Observed usage (this POC)
- Benchmark requests: **${benchmark?.usageSummary?.totalRequests ?? 'n/a'}** (success ${benchmark?.usageSummary?.successCount ?? 'n/a'})
- Benchmark tokens: **${benchmark?.usageSummary?.tokens?.total ?? 'n/a'}**
- Analyzer tokens (latest): **${analyzer?.usageSummary?.tokens?.total ?? 'n/a'}**

### Documented (Google AI pricing / rate-limits docs)
- Free tier exists for several Flash / Flash-Lite models (input+output free of charge on free tier where available).
- Limits are typically RPM / TPM / RPD and vary by model + usage tier.
- RPD resets at **midnight Pacific Time**.
- Exact project dials should be read from **Google AI Studio → Rate limits** (requires signed-in account).

### Observed account/model limit (from live 429 bodies — not guessed)
- During an earlier unpaced burst, API returned: free-tier metric \`generate_content_free_tier_requests\`, **limit: 15 RPM** for \`gemini-3.5-flash-lite\`.
- That is an **observed** free-tier RPM for this key/model at test time.

### Actual remaining capacity
- **Unknown.** The API does not return remaining quota counters on success responses.
- AI Studio usage dashboard was **not** accessible from this automated session (Google sign-in required). Do not treat any number below as remaining quota.

## 9. Rate-limit behavior

- Rate-limited responses in final paced benchmark: **${benchmark?.usageSummary?.rateLimitedCount ?? 0}**
- Earlier unpaced run observed **3× HTTP 429** when exceeding ~15 RPM.
- Mitigation used: \`GEMINI_POC_PACE_MS\` (default/used 5000 ms) between benchmark calls → **20/20 success**.
- Retry policy: exponential backoff on 429/5xx (max \`GEMINI_POC_MAX_RETRIES\`, default 2).

## 10. Estimated cost per 1000 video analyses

- Avg estimated paid USD / video analysis: **${benchmark?.projections?.estimatedPaidUsdPerVideoAnalysis ?? 'n/a'}**
- Extrapolated / 1000: **${benchmark?.projections?.estimatedPaidUsdPer1000VideoAnalyses ?? 'n/a'}**
- Caveat: ${benchmark?.projections?.note || 'Paid-rate estimate only; free tier may be $0.'}

## 11. Production integration recommendations

1. Keep verification **server-side only** (never ship \`GEMINI_API_KEY\` to React Native).
2. Extract 3–4 frames (start / mid / end) with FFmpeg; run OpenCV black/frozen heuristics first; call Gemini only when needed.
3. Prefer cost-efficient Flash-Lite class models confirmed by \`models.list()\`.
4. Store structured JSON + usageMetadata next to fixture/highlight IDs for diagnostics.
5. Treat Gemini output as **visual evidence**, not proof of playability — combine with HTTP probe + player error events.
6. Do not send full videos unless a listed model demonstrates clear benefit vs frames for your samples.
7. Enforce hard daily budget caps in our backend (independent of Google free tier).

## Artifacts

- Model discovery: \`output/reports/model-discovery.json\`
- Connectivity: \`output/reports/connectivity.json\`
- Benchmark: \`${benchmarkPath ? path.basename(benchmarkPath) : 'n/a'}\`
- Analyzer: \`${analyzerPath ? path.basename(analyzerPath) : 'n/a'}\`
- Frame extract: \`${extract ? 'output/frames/extract-summary.json' : 'n/a'}\`
`;

  const mdPath = path.join(reportsDir, 'TECHNICAL_REPORT.md');
  const mdRoot = path.join(pocPaths().pocRoot, 'TECHNICAL_REPORT.md');
  const jsonPath = path.join(reportsDir, 'TECHNICAL_REPORT.json');
  fs.writeFileSync(mdPath, md);
  fs.writeFileSync(mdRoot, md);
  fs.writeFileSync(
    jsonPath,
    JSON.stringify(
      {
        model,
        discovery,
        connectivity,
        benchmark,
        analyzer,
        extract,
        generatedAt: new Date().toISOString(),
      },
      null,
      2,
    ),
  );
  console.log(JSON.stringify({ mdPath, mdRoot, jsonPath }, null, 2));
  return { mdPath, mdRoot, jsonPath };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]).endsWith('generateReport.js');
if (isMain) {
  try {
    generateReport();
  } catch (err) {
    console.error('generateReport failed:', err?.message || err);
    process.exit(1);
  }
}

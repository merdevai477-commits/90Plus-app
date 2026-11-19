import fs from 'node:fs';
import path from 'node:path';
import { createGeminiClient, withRetries, extractHttpStatus, responseText } from './geminiClient.js';
import { UsageTracker } from './usageTracker.js';
import { ensureDirs, pocPaths, loadEnv } from './loadEnv.js';
import { discoverModels } from './discoverModels.js';
import { GeminiVideoAnalyzer } from './GeminiVideoAnalyzer.js';

function pickStills() {
  const dir = pocPaths().samplesDir;
  const names = ['still_football.png', 'still_black.png', 'still_error.png', 'still_loading.png', 'still_football.png'];
  return names.map((n) => path.join(dir, n)).filter((p) => fs.existsSync(p));
}

function pickFrameSets() {
  const framesRoot = pocPaths().framesDir;
  if (!fs.existsSync(framesRoot)) return [];
  const sets = [];
  for (const entry of fs.readdirSync(framesRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const dir = path.join(framesRoot, entry.name);
    const reportPath = path.join(dir, 'extract-report.json');
    let hints = null;
    if (fs.existsSync(reportPath)) {
      try {
        hints = JSON.parse(fs.readFileSync(reportPath, 'utf8')).opencvHints || null;
      } catch {
        hints = null;
      }
    }
    const frames = fs
      .readdirSync(dir)
      .filter((f) => f.endsWith('.jpg'))
      .map((f) => path.join(dir, f))
      .sort();
    // Cap frames sent to Gemini (cost control): first, mid, last-ish
    const selected =
      frames.length <= 3
        ? frames
        : [frames[0], frames[Math.floor(frames.length / 2)], frames[frames.length - 1]];
    if (selected.length) sets.push({ name: entry.name, frames: selected, opencvHints: hints });
  }
  return sets;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function runBenchmark() {
  loadEnv();
  ensureDirs();
  const discovery = await discoverModels({ skipProbe: Boolean(process.env.GEMINI_VISION_MODEL) });
  const model = process.env.GEMINI_VISION_MODEL || discovery.selectedModel;
  if (!model) throw new Error('No model available for benchmark');

  const { ai } = createGeminiClient();
  const tracker = new UsageTracker(`bench-${Date.now()}`);
  const analyzer = new GeminiVideoAnalyzer({ model, tracker });
  const results = { model, text: [], images: [], videos: [] };
  // Free-tier observation: gemini-3.5-flash-lite ~15 RPM. Pace requests to stay under.
  const paceMs = Number(process.env.GEMINI_POC_PACE_MS || 4500);

  // 5 text requests
  for (let i = 0; i < 5; i += 1) {
    if (i > 0) await sleep(paceMs);
    const ctx = tracker.start(`text-${i + 1}`, model);
    try {
      const response = await withRetries(async (attempt) => {
        ctx.retryAttempts = attempt;
        return ai.models.generateContent({
          model,
          contents: `Benchmark text #${i + 1}: return JSON {"n":${i + 1},"ok":true}`,
          config: { responseMimeType: 'application/json', temperature: 0 },
        });
      });
      results.text.push(
        tracker.finish(ctx, {
          response,
          httpStatus: 200,
          extra: { preview: responseText(response).slice(0, 80) },
        }),
      );
    } catch (error) {
      results.text.push(tracker.finish(ctx, { httpStatus: extractHttpStatus(error) || 500, error }));
    }
  }

  // 5 image-analysis requests
  const stills = pickStills();
  for (let i = 0; i < 5; i += 1) {
    await sleep(paceMs);
    const image = stills[i % Math.max(1, stills.length)];
    if (!image) break;
    const r = await analyzer.analyzeSingleImage(image, `image-${i + 1}-${path.basename(image)}`);
    results.images.push(r);
  }

  // 10 video-frame analysis requests (reuse sets round-robin, max 10)
  const sets = pickFrameSets();
  for (let i = 0; i < 10; i += 1) {
    if (!sets.length) break;
    await sleep(paceMs);
    const set = sets[i % sets.length];
    const r = await analyzer.analyzeFrames(set.frames, {
      label: `video-frames-${i + 1}-${set.name}`,
      opencvHints: set.opencvHints,
    });
    results.videos.push(r);
  }

  const summary = tracker.summary();
  const perAnalysis = results.videos.filter((v) => v.ok);
  const avgTokensPerVideo =
    perAnalysis.length === 0
      ? null
      : perAnalysis.reduce((s, v) => s + (v.usage?.usageMetadata?.totalTokenCount || 0), 0) / perAnalysis.length;
  const avgCostPerVideo =
    perAnalysis.length === 0
      ? null
      : perAnalysis.reduce((s, v) => s + (v.usage?.costEstimate?.estimatedUsd || 0), 0) / perAnalysis.length;

  const report = {
    createdAt: new Date().toISOString(),
    model,
    discoverySelected: discovery.selectedModel,
    counts: {
      text: results.text.length,
      images: results.images.length,
      videoFrameAnalyses: results.videos.length,
    },
    usageSummary: summary,
    projections: {
      avgTokensPerVideoAnalysis: avgTokensPerVideo,
      estimatedPaidUsdPerVideoAnalysis: avgCostPerVideo,
      estimatedPaidUsdPer1000VideoAnalyses: avgCostPerVideo == null ? null : avgCostPerVideo * 1000,
      note: 'Paid-rate estimate only. Free-tier may be $0. Remaining quota unknown via API.',
    },
    consistency: {
      imageFootballDetected: results.images.map((r) => r.analysis?.contains_football_content),
      imageStatuses: results.images.map((r) => r.analysis?.visual_status),
      videoStatuses: results.videos.map((r) => r.analysis?.visual_status),
    },
    recordsFile: summary.filePath,
  };

  const out = path.join(pocPaths().reportsDir, `benchmark-${tracker.runId}.json`);
  fs.writeFileSync(out, JSON.stringify(report, null, 2));
  tracker.writeSummary('benchmark');
  console.log(JSON.stringify({ out, summary }, null, 2));
  return report;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]).endsWith('benchmark.js');
if (isMain) {
  runBenchmark().catch((err) => {
    console.error('benchmark failed:', err?.message || err);
    process.exit(1);
  });
}

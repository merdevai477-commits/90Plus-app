import fs from 'node:fs';
import path from 'node:path';
import { ensureDirs, pocPaths, loadEnv } from './loadEnv.js';
import { discoverModels } from './discoverModels.js';
import { GeminiVideoAnalyzer } from './GeminiVideoAnalyzer.js';
import { UsageTracker } from './usageTracker.js';

export async function runAnalyzer() {
  loadEnv();
  ensureDirs();
  const discovery = await discoverModels({ skipProbe: Boolean(process.env.GEMINI_VISION_MODEL) });
  const model = process.env.GEMINI_VISION_MODEL || discovery.selectedModel;
  const tracker = new UsageTracker(`analyze-${Date.now()}`);
  const analyzer = new GeminiVideoAnalyzer({ model, tracker });

  const framesRoot = pocPaths().framesDir;
  const results = [];

  for (const entry of fs.readdirSync(framesRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const dir = path.join(framesRoot, entry.name);
    const reportPath = path.join(dir, 'extract-report.json');
    let opencvHints = null;
    if (fs.existsSync(reportPath)) {
      try {
        opencvHints = JSON.parse(fs.readFileSync(reportPath, 'utf8')).opencvHints;
      } catch {
        opencvHints = null;
      }
    }
    const frames = fs
      .readdirSync(dir)
      .filter((f) => /\.jpe?g$/i.test(f))
      .map((f) => path.join(dir, f))
      .sort();
    if (!frames.length) continue;
    const selected =
      frames.length <= 4
        ? frames
        : [frames[0], frames[Math.floor(frames.length / 3)], frames[Math.floor((2 * frames.length) / 3)], frames[frames.length - 1]];

    const result = await analyzer.analyzeFrames(selected, {
      label: `analyze-${entry.name}`,
      opencvHints,
    });
    results.push({ video: entry.name, ...result, opencvHints });
  }

  const out = path.join(pocPaths().reportsDir, `analyzer-${tracker.runId}.json`);
  fs.writeFileSync(
    out,
    JSON.stringify({ model, results, usageSummary: tracker.summary() }, null, 2),
  );
  tracker.writeSummary('analyzer');
  console.log(JSON.stringify({ out, videos: results.length }, null, 2));
  return { out, results };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]).endsWith('runAnalyzer.js');
if (isMain) {
  runAnalyzer().catch((err) => {
    console.error('runAnalyzer failed:', err?.message || err);
    process.exit(1);
  });
}

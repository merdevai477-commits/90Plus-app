import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const phase2 = path.resolve(__dirname, '../phase2');
const outDir = path.join(__dirname, 'dataset');

const dataset = JSON.parse(fs.readFileSync(path.join(phase2, 'dataset/dataset-30.json'), 'utf8'));
const raw = JSON.parse(fs.readFileSync(path.join(phase2, 'reports/phase2-raw-results.json'), 'utf8'));
const gt = JSON.parse(fs.readFileSync(path.join(phase2, 'ground-truth/ground-truth-30.json'), 'utf8'));

const byId = Object.fromEntries(raw.results.map((r) => [r.datasetId, r]));
const gtById = Object.fromEntries(gt.labels.map((g) => [g.datasetId, g]));

const videos = dataset.videos.map((v) => {
  const p2 = byId[v.datasetId] || {};
  const g = gtById[v.datasetId] || {};
  return {
    datasetId: v.datasetId,
    highlightlyId: v.highlightlyId,
    fixtureId: v.fixtureId,
    category: v.category,
    title: v.title,
    url: v.url,
    embedUrl: v.embedUrl,
    playbackUrl: v.playbackUrl,
    sourceClass: v.sourceClass,
    source: v.source,
    phase2: {
      httpStatus: p2.http?.playback?.status ?? p2.http?.primary?.status ?? null,
      decodingOk: Boolean(p2.decodingOk),
      codec: p2.probe?.codec ?? null,
      width: p2.probe?.width ?? null,
      height: p2.probe?.height ?? null,
      durationSec: p2.probe?.durationSec ?? null,
      geminiStatus: p2.gemini?.analysis?.visual_status ?? null,
      geminiFootball: p2.gemini?.analysis?.contains_football_content ?? null,
      geminiOk: Boolean(p2.gemini?.ok),
      errors: p2.errors || [],
    },
    groundTruth: {
      gtVisual: g.gtVisual ?? null,
      gtPlayableHint: g.gtPlayableHint ?? null,
    },
  };
});

fs.mkdirSync(outDir, { recursive: true });
const payload = {
  createdAt: new Date().toISOString(),
  note: 'Exact Phase 2 set preserved. No replacement of failed videos.',
  selectedCount: videos.length,
  videos,
};
fs.writeFileSync(path.join(outDir, 'phase3-dataset-30.json'), JSON.stringify(payload, null, 2));
console.log(JSON.stringify({ out: path.join(outDir, 'phase3-dataset-30.json'), count: videos.length }, null, 2));

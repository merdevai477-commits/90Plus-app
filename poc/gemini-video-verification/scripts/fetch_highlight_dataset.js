import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pocRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(pocRoot, '../..');
dotenv.config({ path: path.join(pocRoot, '.env') });
dotenv.config({ path: path.join(repoRoot, '.env') });

const require = createRequire(path.join(repoRoot, 'package.json'));
const { PrismaClient } = require('@prisma/client');

const STREAMIN_HOSTS = new Set(['streamin.link', 'streamin.me']);

function resolvePlaybackUrl(pageUrl) {
  const trimmed = (pageUrl || '').trim();
  if (!trimmed) return trimmed;
  try {
    const parsed = new URL(trimmed);
    const host = parsed.hostname.replace(/^www\./, '').toLowerCase();
    if (STREAMIN_HOSTS.has(host) || host.endsWith('.streamin.link') || host.endsWith('.streamin.me')) {
      const id = parsed.pathname.split('/').filter(Boolean).pop() ?? '';
      if (/^[a-z0-9]+$/i.test(id)) return `https://c-cdn.streamin.top/uploads/${id}.mp4`;
    }
  } catch {
    return trimmed;
  }
  return trimmed.split('#')[0];
}

function classifySource(url, embedUrl, source) {
  const u = (url || '').toLowerCase();
  const e = (embedUrl || '').toLowerCase();
  const s = (source || '').toLowerCase();
  if (u.includes('youtube') || u.includes('youtu.be') || e.includes('youtube') || s === 'youtube') {
    return 'youtube';
  }
  if (/\.m3u8(\?|$)/i.test(u) || /\.m3u8(\?|$)/i.test(e)) return 'hls';
  if (/\.mp4(\?|$)/i.test(u) || u.includes('streamin') || u.includes('c-cdn.streamin')) return 'direct_mp4';
  if (/\.mp4(\?|$)/i.test(resolvePlaybackUrl(url))) return 'direct_mp4';
  return 'other';
}

function pickBalanced(rows, target = 30) {
  const buckets = { goal_youtube: [], goal_mp4: [], goal_hls: [], goal_other: [], summary_youtube: [], summary_mp4: [], summary_hls: [], summary_other: [] };
  for (const row of rows) {
    const kind = row.category === 'goal-clip' ? 'goal' : row.category === 'match-highlights' ? 'summary' : null;
    if (!kind) continue;
    const src = classifySource(row.url, row.embedUrl, row.source);
    const key = `${kind}_${src === 'direct_mp4' ? 'mp4' : src === 'hls' ? 'hls' : src === 'youtube' ? 'youtube' : 'other'}`;
    if (!buckets[key]) continue;
    buckets[key].push(row);
  }

  const selected = [];
  const seen = new Set();
  const take = (arr, n) => {
    for (const row of arr) {
      if (selected.length >= target) break;
      if (seen.has(row.highlightlyId)) continue;
      seen.add(row.highlightlyId);
      selected.push(row);
      if ([...seen].length && --n <= 0) break;
    }
  };

  // Prefer diversity: goals + summaries, YouTube + MP4 (+ HLS/other if present)
  take(buckets.goal_mp4, 8);
  take(buckets.summary_mp4, 8);
  take(buckets.goal_youtube, 7);
  take(buckets.summary_youtube, 7);
  take(buckets.goal_hls, 3);
  take(buckets.summary_hls, 3);
  take(buckets.goal_other, 2);
  take(buckets.summary_other, 2);

  // Fill remainder from any remaining linked clips
  if (selected.length < target) {
    for (const row of rows) {
      if (selected.length >= target) break;
      if (seen.has(row.highlightlyId)) continue;
      if (row.category !== 'goal-clip' && row.category !== 'match-highlights') continue;
      seen.add(row.highlightlyId);
      selected.push(row);
    }
  }
  return selected.slice(0, target);
}

async function main() {
  const prisma = new PrismaClient();
  try {
    const total = await prisma.matchHighlight.count();
    const rows = await prisma.matchHighlight.findMany({
      where: { fixtureId: { not: null }, OR: [{ url: { not: '' } }, { embedUrl: { not: null } }] },
      orderBy: { updatedAt: 'desc' },
      take: 400,
      select: {
        highlightlyId: true,
        fixtureId: true,
        category: true,
        type: true,
        title: true,
        description: true,
        url: true,
        embedUrl: true,
        source: true,
        imgUrl: true,
        matchDate: true,
        homeTeamName: true,
        awayTeamName: true,
        leagueName: true,
      },
    });

    const selected = pickBalanced(rows, 30).map((row, index) => {
      const sourceClass = classifySource(row.url, row.embedUrl, row.source);
      const playbackUrl = resolvePlaybackUrl(row.url || row.embedUrl || '');
      return {
        datasetId: `hl-${index + 1}`,
        highlightlyId: row.highlightlyId,
        fixtureId: row.fixtureId,
        category: row.category,
        type: row.type,
        title: row.title,
        description: row.description,
        url: row.url,
        embedUrl: row.embedUrl,
        source: row.source,
        sourceClass,
        playbackUrl,
        thumbnail: row.imgUrl,
        matchDate: row.matchDate,
        homeTeamName: row.homeTeamName,
        awayTeamName: row.awayTeamName,
        leagueName: row.leagueName,
      };
    });

    const distribution = selected.reduce((acc, row) => {
      const key = `${row.category}|${row.sourceClass}`;
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    const outDir = path.join(pocRoot, 'phase2', 'dataset');
    fs.mkdirSync(outDir, { recursive: true });
    const outPath = path.join(outDir, 'dataset-30.json');
    const payload = {
      createdAt: new Date().toISOString(),
      totalInDb: total,
      candidatePool: rows.length,
      selectedCount: selected.length,
      distribution,
      note: 'URLs taken from MatchHighlight table only. No invented URLs.',
      videos: selected,
    };
    fs.writeFileSync(outPath, JSON.stringify(payload, null, 2));
    console.log(JSON.stringify({ outPath, selectedCount: selected.length, distribution, totalInDb: total }, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

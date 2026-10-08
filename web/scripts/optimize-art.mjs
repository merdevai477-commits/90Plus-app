// Converts the mobile app's artwork (front/assets/images) into web-sized WebP files.
// Run from web/: `node scripts/optimize-art.mjs` (uses sharp from the repo root).
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const webRoot = fileURLToPath(new URL('..', import.meta.url));
const src = path.resolve(webRoot, '../front/assets/images');
const out = path.resolve(webRoot, 'src/assets/art');
mkdirSync(out, { recursive: true });

const jobs = [
  { from: 'plear 90Plus.png', to: 'hero-player', width: 1600, quality: 74 },
  { from: 'arena.png', to: 'arena', width: 1600, quality: 70 },
  { from: 'team of the month.png', to: 'stadium-top', width: 1400, quality: 70 },
  { from: '90Plus world cup.png', to: 'world-cup', width: 1600, quality: 74 },
  { from: 'player-connection.png', to: 'player-connection', width: 640, quality: 80 },
  { from: 'top-challenge.png', to: 'top-10', width: 560, quality: 80 },
  { from: 'share.png', to: 'share-phone', width: 520, quality: 80 },
  { from: 'growth.png', to: 'most-engaging', width: 520, quality: 80 },
  { from: '1st.png', to: 'rank-1', width: 420, quality: 80 },
  { from: '2st.png', to: 'rank-2', width: 420, quality: 80 },
  { from: '3st.png', to: 'rank-3', width: 420, quality: 80 },
];

for (const job of jobs) {
  const file = path.join(out, `${job.to}.webp`);
  const info = await sharp(path.join(src, job.from))
    .resize({ width: job.width, withoutEnlargement: true })
    .webp({ quality: job.quality, alphaQuality: 90, effort: 6 })
    .toFile(file);
  console.log(`${job.to}.webp  ${info.width}x${info.height}  ${(info.size / 1024).toFixed(0)} KB`);
}

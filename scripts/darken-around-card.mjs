// One-off asset tweak: crush the dark navy/purple haze in the profile card
// glow (`around-card.png`) down to pure black, while preserving the bright
// purple electricity. Uses a per-pixel black-point lift (out = a*in + b).
//
// Run from repo root:  node scripts/darken-around-card.mjs
import sharp from 'sharp';
import { existsSync } from 'node:fs';
import { copyFile } from 'node:fs/promises';
import path from 'node:path';

const IMG = path.resolve('front/assets/images/around-card.png');
const BACKUP = path.resolve('front/assets/images/around-card.original.png');

// Black-point lift: subtract a floor then rescale. Anything dimmer than
// ~ (B / A) collapses to black; the bright purple core (near 255) is retained.
const A = 1.35;
const B = -58;

async function main() {
  if (!existsSync(IMG)) throw new Error(`Missing image: ${IMG}`);

  if (!existsSync(BACKUP)) {
    await copyFile(IMG, BACKUP);
    console.log(`Backed up original -> ${BACKUP}`);
  }

  const src = sharp(BACKUP); // always process from the pristine original
  const meta = await src.metadata();
  console.log(`Source: ${meta.width}x${meta.height}, channels=${meta.channels}, alpha=${meta.hasAlpha}`);

  const buf = await src.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { data, info } = buf;
  const { width, height, channels } = info;

  for (let i = 0; i < data.length; i += channels) {
    // Only lift RGB; leave alpha untouched.
    for (let c = 0; c < 3; c++) {
      const v = A * data[i + c] + B;
      data[i + c] = v <= 0 ? 0 : v >= 255 ? 255 : Math.round(v);
    }
  }

  await sharp(data, { raw: { width, height, channels } })
    .png()
    .toFile(IMG);

  console.log(`Wrote darkened glow -> ${IMG}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

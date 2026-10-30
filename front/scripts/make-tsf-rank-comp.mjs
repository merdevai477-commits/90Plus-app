import sharp from 'sharp';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const out = path.join(root, 'assets/images/rank/comp-top-scorers-five.jpg');

const W = 816;
const H = 1076;
const half = Math.floor(W / 2);
const overlap = 40;
const cellW = half + overlap;

async function coverCell(src) {
  return sharp(src)
    .resize(cellW, H, { fit: 'cover', position: 'top' })
    .toBuffer();
}

const europeSrc = path.join(root, 'assets/images/top-scorers-five/hero.jpg');
const egyptSrc = path.join(root, 'assets/images/top-scorers-five/hero-egypt.jpg');

const [leftBuf, rightBuf] = await Promise.all([
  coverCell(europeSrc),
  coverCell(egyptSrc),
]);

const dividerSvg = Buffer.from(`<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#000" stop-opacity="0"/>
      <stop offset="46%" stop-color="#000" stop-opacity="0"/>
      <stop offset="50%" stop-color="#8B5CF6" stop-opacity="0.9"/>
      <stop offset="54%" stop-color="#000" stop-opacity="0"/>
      <stop offset="100%" stop-color="#000" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="vignette" x1="0" y1="0" x2="0" y2="1">
      <stop offset="50%" stop-color="#030008" stop-opacity="0"/>
      <stop offset="100%" stop-color="#030008" stop-opacity="0.6"/>
    </linearGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#g)"/>
  <rect width="100%" height="100%" fill="url(#vignette)"/>
</svg>`);

await sharp({
  create: { width: W, height: H, channels: 3, background: '#14052E' },
})
  .composite([
    { input: leftBuf, left: 0, top: 0 },
    { input: rightBuf, left: half - overlap, top: 0 },
    { input: dividerSvg, left: 0, top: 0 },
  ])
  .jpeg({ quality: 86, mozjpeg: true })
  .toFile(out);

const st = fs.statSync(out);
console.log('wrote', out, `${Math.round(st.size / 1024)}kb`, `${W}x${H}`);

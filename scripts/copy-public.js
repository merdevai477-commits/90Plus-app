/**
 * Recursively copy public/ → dist/public for production builds, then overlay the
 * Vite-built site (web/dist: home + news pages and hashed /assets) on top.
 * The inline one-liner failed when public/legal/ was added (EISDIR).
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const src = path.join(root, 'public');
const webDist = path.join(root, 'web', 'dist');
const dest = path.join(root, 'dist', 'public');

function copyRecursive(from, to) {
  const stat = fs.statSync(from);
  if (stat.isDirectory()) {
    fs.mkdirSync(to, { recursive: true });
    for (const entry of fs.readdirSync(from)) {
      copyRecursive(path.join(from, entry), path.join(to, entry));
    }
    return;
  }
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
}

fs.mkdirSync(dest, { recursive: true });

if (fs.existsSync(src)) {
  for (const entry of fs.readdirSync(src)) {
    copyRecursive(path.join(src, entry), path.join(dest, entry));
  }
  console.log('✅ Public folder copied (recursive)');
} else {
  console.log('⚠️ Public folder not found, skipping copy');
}

if (!fs.existsSync(path.join(webDist, 'index.html'))) {
  console.error('❌ web/dist/index.html missing — run `npm run build:web` before copy:public');
  process.exit(1);
}

// Old hashed bundles are never referenced again; start /assets clean each build.
fs.rmSync(path.join(dest, 'assets'), { recursive: true, force: true });
for (const entry of fs.readdirSync(webDist)) {
  copyRecursive(path.join(webDist, entry), path.join(dest, entry));
}
console.log('✅ Website (web/dist) overlaid onto dist/public');

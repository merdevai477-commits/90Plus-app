/**
 * Recursively copy public/ → dist/public for production builds.
 * The inline one-liner failed when public/legal/ was added (EISDIR).
 */
const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, '..', 'public');
const dest = path.join(__dirname, '..', 'dist', 'public');

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

if (!fs.existsSync(src)) {
  console.log('⚠️ Public folder not found, skipping copy');
  process.exit(0);
}

fs.mkdirSync(dest, { recursive: true });
for (const entry of fs.readdirSync(src)) {
  copyRecursive(path.join(src, entry), path.join(dest, entry));
}
console.log('✅ Public folder copied (recursive)');

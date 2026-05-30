/**
 * Clears Metro / Expo bundler caches (fixes EMFILE & stale bundles on Windows).
 */
const fs = require('fs');
const path = require('path');
const os = require('os');

const roots = [
  path.join(__dirname, '..', '.metro-cache'),
  path.join(__dirname, '..', 'node_modules', '.cache'),
  path.join(os.tmpdir(), 'metro-cache'),
];

function rmDir(dir) {
  if (!fs.existsSync(dir)) return;
  fs.rmSync(dir, { recursive: true, force: true });
  console.log(`Removed: ${dir}`);
}

for (const dir of roots) {
  try {
    rmDir(dir);
  } catch (err) {
    console.warn(`Could not remove ${dir}:`, err.message);
  }
}

console.log('Metro cache cleared. Run: npm run start:clear');

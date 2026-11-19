import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ensureDirs, loadEnv, pocPaths } from './loadEnv.js';
import { runConnectivityTest } from './connectivityTest.js';
import { runAnalyzer } from './runAnalyzer.js';
import { runBenchmark } from './benchmark.js';
import { generateReport } from './generateReport.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pocRoot = path.resolve(__dirname, '..');

function runPython(scriptRel) {
  const script = path.join(pocRoot, scriptRel);
  const attempts = [
    ['python', [script]],
    ['py', ['-3', script]],
    ['python3', [script]],
  ];
  for (const [cmd, args] of attempts) {
    const res = spawnSync(cmd, args, { cwd: pocRoot, encoding: 'utf8' });
    if (res.error && res.error.code === 'ENOENT') continue;
    if (res.status === 0) {
      if (res.stdout) process.stdout.write(res.stdout);
      return;
    }
    console.error(res.stderr || res.stdout || `${cmd} failed`);
    throw new Error(`Python step failed: ${scriptRel} (exit ${res.status})`);
  }
  throw new Error('No Python interpreter found (tried python, py -3, python3)');
}

async function main() {
  loadEnv();
  ensureDirs();
  console.log('=== POC: generate sample assets ===');
  runPython('scripts/generate_sample_assets.py');
  console.log('=== POC: extract frames ===');
  runPython('scripts/extract_frames.py');
  console.log('=== POC: connectivity + model discovery ===');
  await runConnectivityTest();
  console.log('=== POC: analyzer pass ===');
  await runAnalyzer();
  console.log('=== POC: controlled benchmark (5 text + 5 image + 10 video-frame) ===');
  await runBenchmark();
  console.log('=== POC: technical report ===');
  const report = generateReport();
  console.log('POC complete.');
  console.log(JSON.stringify({ reportsDir: pocPaths().reportsDir, report }, null, 2));
}

main().catch((err) => {
  console.error('runFullPoc failed:', err?.message || err);
  process.exit(1);
});

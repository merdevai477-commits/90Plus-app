import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pocRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(pocRoot, '../..');

/** Load POC .env first, then repo-root .env without overriding existing process.env. */
export function loadEnv() {
  dotenv.config({ path: path.join(pocRoot, '.env') });
  dotenv.config({ path: path.join(repoRoot, '.env') });
}

export function requireGeminiApiKey() {
  loadEnv();
  const key = (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '').trim();
  if (!key) {
    throw new Error('GEMINI_API_KEY is missing. Set it in repo .env or poc/gemini-video-verification/.env');
  }
  return key;
}

/** Never log the raw key. */
export function maskSecret(value) {
  if (!value) return '(empty)';
  if (value.length <= 8) return '****';
  return `${value.slice(0, 4)}…${value.slice(-4)} (len=${value.length})`;
}

export function pocPaths() {
  return {
    pocRoot,
    samplesDir: path.join(pocRoot, 'samples'),
    framesDir: path.join(pocRoot, 'output', 'frames'),
    reportsDir: path.join(pocRoot, 'output', 'reports'),
    usageDir: path.join(pocRoot, 'output', 'usage'),
  };
}

export function ensureDirs() {
  const { samplesDir, framesDir, reportsDir, usageDir } = pocPaths();
  for (const dir of [samplesDir, framesDir, reportsDir, usageDir]) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

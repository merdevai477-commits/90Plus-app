/**
 * Smoke-test voice → text through OpenRouter.
 * npx ts-node scripts/test-openrouter-transcribe.ts <audio-file> [ar|en]
 */
import 'dotenv/config';
import { readFileSync } from 'fs';
import { extname } from 'path';
import { transcribeAudioWithOpenRouter } from '../src/services/openrouter-transcribe.client';

const MIME_BY_EXT: Record<string, string> = {
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg',
  '.aac': 'audio/aac',
  '.m4a': 'audio/mp4',
  '.ogg': 'audio/ogg',
  '.flac': 'audio/flac',
};

async function main(): Promise<void> {
  const [file, lang] = process.argv.slice(2);
  if (!file) throw new Error('Usage: ts-node scripts/test-openrouter-transcribe.ts <audio-file> [ar|en]');
  const mimeType = MIME_BY_EXT[extname(file).toLowerCase()];
  if (!mimeType) throw new Error(`Unknown audio extension: ${file}`);

  const started = Date.now();
  const { text, model } = await transcribeAudioWithOpenRouter({
    audio: readFileSync(file),
    mimeType,
    language: lang === 'en' ? 'en' : 'ar',
  });
  console.log(JSON.stringify({ model, ms: Date.now() - started, text }, null, 2));
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});

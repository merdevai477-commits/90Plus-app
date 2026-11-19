import fs from 'node:fs';
import path from 'node:path';
import { createGeminiClient, withRetries, extractHttpStatus, responseText } from './geminiClient.js';
import { UsageTracker } from './usageTracker.js';
import { ensureDirs, pocPaths, loadEnv } from './loadEnv.js';
import { discoverModels } from './discoverModels.js';
import { GeminiVideoAnalyzer } from './GeminiVideoAnalyzer.js';

function tinyPngBase64() {
  // 1x1 PNG (black pixel) — minimal image probe
  return 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO5XU5cAAAAASUVORK5CYII=';
}

export async function runConnectivityTest() {
  loadEnv();
  ensureDirs();
  const discovery = await discoverModels({ skipProbe: false });
  const model = discovery.selectedModel || process.env.GEMINI_VISION_MODEL;
  if (model) process.env.GEMINI_VISION_MODEL = model;
  if (!model) throw new Error('No model selected from discovery');

  const { ai, apiKeyFingerprint } = createGeminiClient();
  const tracker = new UsageTracker(`connect-${Date.now()}`);
  const results = {
    auth: { status: 'authenticated', apiKeyFingerprint },
    model,
    textTest: null,
    imageTest: null,
    availableMethods: ['models.list', 'models.generateContent'],
  };

  // Text generation
  {
    const ctx = tracker.start('text-ping', model);
    try {
      const response = await withRetries(async (attempt) => {
        ctx.retryAttempts = attempt;
        return ai.models.generateContent({
          model,
          contents: 'Reply with exactly the word PONG and nothing else.',
        });
      });
      const text = responseText(response).trim();
      results.textTest = tracker.finish(ctx, {
        response,
        httpStatus: 200,
        extra: { reply: text.slice(0, 80) },
      });
    } catch (error) {
      results.textTest = tracker.finish(ctx, {
        httpStatus: extractHttpStatus(error) || 500,
        error,
      });
    }
  }

  // Tiny image analysis
  {
    const samplePath = path.join(pocPaths().samplesDir, 'connect-black-1x1.png');
    fs.writeFileSync(samplePath, Buffer.from(tinyPngBase64(), 'base64'));
    const analyzer = new GeminiVideoAnalyzer({ model, tracker });
    const imageResult = await analyzer.analyzeSingleImage(samplePath, 'image-ping-black-pixel');
    results.imageTest = {
      ok: imageResult.ok,
      analysis: imageResult.analysis,
      usage: imageResult.usage,
    };
  }

  const out = path.join(pocPaths().reportsDir, 'connectivity.json');
  const payload = {
    ...results,
    usageSummary: tracker.summary(),
    discoverySelected: discovery.selectedModel,
    discoveryLatencyMs: discovery.latencyMs,
  };
  fs.writeFileSync(out, JSON.stringify(payload, null, 2));
  tracker.writeSummary('connectivity');
  console.log(JSON.stringify({ out, textOk: results.textTest?.success, imageOk: results.imageTest?.ok }, null, 2));
  return payload;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]).endsWith('connectivityTest.js');
if (isMain) {
  runConnectivityTest().catch((err) => {
    console.error('connectivityTest failed:', err?.message || err);
    process.exit(1);
  });
}

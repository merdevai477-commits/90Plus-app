import fs from 'node:fs';
import path from 'node:path';
import { createGeminiClient } from './geminiClient.js';
import { ensureDirs, pocPaths, loadEnv } from './loadEnv.js';

function supportsMethod(model, method) {
  const methods = model.supportedActions || model.supportedGenerationMethods || [];
  return methods.map(String).includes(method);
}

function inferModalities(model) {
  const name = String(model.name || model.displayName || '').toLowerCase();
  const input = model.inputTokenLimit ? ['text'] : [];
  // Heuristics from model id + documented capabilities when API omits modality lists.
  const isImageGenerator =
    /imagen/i.test(name) ||
    /flash-image|lite-image|pro-image|nano.?banana/i.test(name) ||
    /image-preview/i.test(name);
  const image =
    /flash|pro|lite|vision/i.test(name) && !/embed|tts|imagen|veo/i.test(name) && !isImageGenerator;
  const videoInput =
    /flash|pro|lite/i.test(name) && !/embed|tts|imagen|veo/i.test(name) && !isImageGenerator;
  return {
    generateContent: supportsMethod(model, 'generateContent'),
    likelyImageInput: image,
    likelyVideoInput: videoInput,
    isImageGenerator,
    isVideoGenerator: /veo/i.test(name),
  };
}

/**
 * Cost-efficiency ranking for *visual frame verification* (image in → JSON out).
 * Prefer Flash-Lite / Flash with free-tier listing over Pro.
 */
export function rankVisionCandidates(models) {
  const scored = models
    .map((m) => {
      const id = String(m.name || '').replace(/^models\//, '');
      const caps = inferModalities(m);
      if (!caps.generateContent || !caps.likelyImageInput) return null;
      if (caps.isImageGenerator || caps.isVideoGenerator) return null;
      let score = 0;
      if (/flash-lite/i.test(id)) score += 100;
      else if (/flash/i.test(id)) score += 80;
      else if (/pro/i.test(id)) score += 40;
      // Prefer current Flash-Lite family; 2.5 aliases may list but reject new accounts.
      if (/3\.5-flash-lite/i.test(id)) score += 45;
      else if (/3\.1-flash-lite/i.test(id)) score += 35;
      else if (/2\.5-flash-lite/i.test(id)) score += 15;
      if (/preview|exp/i.test(id)) score -= 10;
      if (/tts|embed|robotics|computer-use/i.test(id)) score -= 100;
      return { id, score, caps, displayName: m.displayName || id, raw: m };
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score);
  return scored;
}

async function probeModel(ai, modelId) {
  try {
    await ai.models.generateContent({
      model: modelId,
      contents: 'Reply with OK',
      config: { maxOutputTokens: 8, temperature: 0 },
    });
    return { id: modelId, ok: true, error: null };
  } catch (error) {
    return {
      id: modelId,
      ok: false,
      error: String(error?.message || error).slice(0, 400),
      status: error?.status ?? null,
    };
  }
}

export async function discoverModels({ skipProbe = false } = {}) {
  loadEnv();
  ensureDirs();
  const { ai, apiKeyFingerprint } = createGeminiClient();
  const started = Date.now();
  const models = [];

  // Official SDK pager
  const pager = await ai.models.list({ config: { pageSize: 50 } });
  for await (const model of pager) {
    models.push(model);
  }

  const withGenerate = models.filter((m) => supportsMethod(m, 'generateContent'));
  const ranked = rankVisionCandidates(models);

  // Prefer env override only if it actually works.
  const preferred = process.env.GEMINI_VISION_MODEL?.trim() || null;
  const probeOrder = [
    ...(preferred ? [{ id: preferred, score: 999 }] : []),
    ...ranked,
  ];

  const probes = [];
  let selected = null;

  if (skipProbe && preferred) {
    selected = preferred;
    probes.push({ id: preferred, ok: true, error: null, skippedProbe: true });
  } else {
    for (const candidate of probeOrder.slice(0, 8)) {
      const probe = await probeModel(ai, candidate.id);
      probes.push(probe);
      if (probe.ok) {
        selected = candidate.id;
        break;
      }
    }
  }

  const report = {
    discoveredAt: new Date().toISOString(),
    auth: { apiKeyPresent: true, apiKeyFingerprint, status: 'ok' },
    latencyMs: Date.now() - started,
    counts: {
      totalListed: models.length,
      generateContent: withGenerate.length,
      visionCandidates: ranked.length,
    },
    selectedModel: selected,
    selectionJustification: selected
      ? 'Listed via models.list(), ranked for cost-efficient vision (Flash-Lite first), then verified with a live generateContent probe. Listing alone is insufficient — deprecated aliases can still appear.'
      : 'No probed vision candidate accepted generateContent; set GEMINI_VISION_MODEL to a working model.',
    probeResults: probes,
    rankedVisionCandidates: ranked.slice(0, 15).map(({ id, score, displayName, caps }) => ({
      id,
      displayName,
      score,
      ...caps,
    })),
    allModels: models.map((m) => ({
      name: m.name,
      displayName: m.displayName,
      description: m.description?.slice?.(0, 160) || null,
      supportedActions: m.supportedActions || m.supportedGenerationMethods || null,
      inputTokenLimit: m.inputTokenLimit ?? null,
      outputTokenLimit: m.outputTokenLimit ?? null,
    })),
    pricingNotes: {
      documentedFreeTier: [
        'gemini-2.5-flash-lite / gemini-3.5-flash-lite — Free of charge (input/output) on free tier per Google pricing docs (model availability varies by account)',
        'gemini-2.5-flash — Free of charge on free tier per Google pricing docs where still available',
      ],
      caveat:
        'Account-specific remaining quota is NOT returned by models.list or generateContent. Check AI Studio Rate Limits / usage dashboard.',
    },
  };

  const out = path.join(pocPaths().reportsDir, 'model-discovery.json');
  fs.writeFileSync(out, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ selectedModel: selected, totalListed: models.length, out }, null, 2));
  return report;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]).endsWith('discoverModels.js');
if (isMain) {
  discoverModels().catch((err) => {
    console.error('discoverModels failed:', err?.message || err);
    process.exit(1);
  });
}

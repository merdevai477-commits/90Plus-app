import fs from 'node:fs';
import path from 'node:path';
import { createGeminiClient, withRetries, extractHttpStatus, responseText } from './geminiClient.js';
import { UsageTracker } from './usageTracker.js';

export const ANALYSIS_PROMPT = `You are a visual video quality verification system.

Analyze the supplied video frames.

Determine:

1. Is the screen completely black?
2. Is the screen mostly black?
3. Is the image frozen?
4. Is there a visible loading screen?
5. Is there a visible error message?
6. Does the frame contain actual football footage?
7. Is the visual content meaningful?
8. Is the image corrupted or severely distorted?

Return strictly structured JSON:

{
  "visual_status": "valid | black_screen | frozen | loading | error_screen | corrupted | unknown",
  "contains_football_content": true,
  "contains_error_message": false,
  "is_black_screen": false,
  "is_frozen": false,
  "confidence": 0.0,
  "reason": "",
  "recommended_action": "accept | retry | inspect | reject"
}

Do not claim that a video is playable simply because its frames look valid.
Respond with JSON only.`;

const EMPTY_RESULT = {
  visual_status: 'unknown',
  contains_football_content: false,
  contains_error_message: false,
  is_black_screen: false,
  is_frozen: false,
  confidence: 0,
  reason: 'parse_failed',
  recommended_action: 'inspect',
};

function parseJsonLoose(text) {
  if (!text) return { ...EMPTY_RESULT };
  const trimmed = text.trim();
  try {
    return { ...EMPTY_RESULT, ...JSON.parse(trimmed) };
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (!match) return { ...EMPTY_RESULT, reason: 'no_json_in_response' };
    try {
      return { ...EMPTY_RESULT, ...JSON.parse(match[0]) };
    } catch {
      return { ...EMPTY_RESULT, reason: 'json_parse_error', rawSnippet: trimmed.slice(0, 300) };
    }
  }
}

function mimeFor(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.gif') return 'image/gif';
  return 'image/png';
}

/**
 * GeminiVideoAnalyzer — frame-based visual verification only.
 * Does NOT judge HTTP availability or device playback.
 */
export class GeminiVideoAnalyzer {
  constructor({ model, tracker } = {}) {
    const { ai } = createGeminiClient();
    this.ai = ai;
    this.model = model || process.env.GEMINI_VISION_MODEL || 'gemini-3.5-flash-lite';
    this.tracker = tracker || new UsageTracker(`analyzer-${Date.now()}`);
    this.maxRetries = Number(process.env.GEMINI_POC_MAX_RETRIES || 2);
  }

  async analyzeFrames(framePaths, { label = 'frame-analysis', opencvHints = null } = {}) {
    const files = framePaths.filter((p) => fs.existsSync(p));
    if (!files.length) {
      throw new Error('No frame files found for analysis');
    }

    const parts = [
      { text: ANALYSIS_PROMPT },
      {
        text: `\nFrames provided: ${files.length}. OpenCV precheck hints (optional, independent): ${JSON.stringify(opencvHints || {})}`,
      },
    ];

    for (const filePath of files) {
      const bytes = fs.readFileSync(filePath);
      parts.push({
        inlineData: {
          mimeType: mimeFor(filePath),
          data: bytes.toString('base64'),
        },
      });
      parts.push({ text: `Frame file: ${path.basename(filePath)}` });
    }

    const ctx = this.tracker.start(label, this.model);
    try {
      const response = await withRetries(
        async (attempt) => {
          ctx.retryAttempts = attempt;
          return this.ai.models.generateContent({
            model: this.model,
            contents: [{ role: 'user', parts }],
            config: {
              temperature: 0.1,
              responseMimeType: 'application/json',
            },
          });
        },
        { maxRetries: this.maxRetries, label },
      );

      const text = responseText(response);
      const parsed = parseJsonLoose(text);
      const usageRecord = this.tracker.finish(ctx, {
        response,
        httpStatus: 200,
        extra: {
          frameCount: files.length,
          frameNames: files.map((f) => path.basename(f)),
          opencvHints,
        },
      });

      return {
        ok: true,
        model: this.model,
        analysis: parsed,
        usage: usageRecord,
        rawText: text,
      };
    } catch (error) {
      const usageRecord = this.tracker.finish(ctx, {
        httpStatus: extractHttpStatus(error) || 500,
        error,
        extra: { frameCount: files.length },
      });
      return {
        ok: false,
        model: this.model,
        analysis: {
          ...EMPTY_RESULT,
          reason: String(error.message || error).slice(0, 300),
          recommended_action: 'inspect',
        },
        usage: usageRecord,
        error,
      };
    }
  }

  async analyzeSingleImage(imagePath, label = 'image-analysis') {
    return this.analyzeFrames([imagePath], { label });
  }
}

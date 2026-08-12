/**
 * Tolerant JSON extraction for model output.
 *
 * Models wrap JSON in ```json fences, add a sentence of prose in front of it,
 * use smart quotes, or leave a trailing comma. These helpers recover the object
 * in those cases without ever guessing at missing content — a payload that
 * cannot be parsed comes back as null so the caller can retry or fail loudly.
 *
 * Shared by the daily quiz generator and the Questions-hub AI generator.
 */

/** Strip a ```json fence even when the model wraps it in prose. */
export function stripMarkdownFences(text: string): string {
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fenceMatch ? fenceMatch[1] : text;
  return body
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .trim();
}

/** Normalize smart quotes and drop trailing commas before `}`/`]`. */
export function repairJsonText(jsonText: string): string {
  return jsonText
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/,\s*([}\]])/g, '$1');
}

/**
 * Extract the first balanced JSON object/array from a string that may contain
 * surrounding prose ("Here is your quiz: { ... }"). Respects string literals
 * and escapes so braces inside text don't break the scan.
 */
export function extractBalancedJson(text: string): string | null {
  const startObj = text.indexOf('{');
  const startArr = text.indexOf('[');
  const candidates = [startObj, startArr].filter((n) => n >= 0);
  if (!candidates.length) return null;
  const start = Math.min(...candidates);
  const open = text[start];
  const close = open === '{' ? '}' : ']';

  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i += 1) {
    const ch = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === open) depth += 1;
    else if (ch === close) {
      depth -= 1;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

/** Parse model output as JSON, or null. Never throws. */
export function tryParseJson(text: string): unknown | null {
  try {
    return JSON.parse(repairJsonText(text));
  } catch {
    const balanced = extractBalancedJson(text);
    if (balanced && balanced !== text) {
      try {
        return JSON.parse(repairJsonText(balanced));
      } catch {
        return null;
      }
    }
    return null;
  }
}

/** Strip fences then parse. The usual entry point for a model's JSON reply. */
export function parseModelJson(content: string): unknown | null {
  return tryParseJson(stripMarkdownFences(String(content ?? '').trim()));
}

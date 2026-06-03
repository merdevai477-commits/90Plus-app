import { getApiUrl } from '../utils/getApiUrl';
import type { Language } from '../src/i18n/types';

const BATCH_LIMIT = 200;

export async function fetchFootballNameTranslations(
  texts: string[],
  targetLang: Language = 'ar',
): Promise<Record<string, string>> {
  const unique = [...new Set(texts.map((t) => t.trim()).filter(Boolean))].slice(0, BATCH_LIMIT);
  if (unique.length === 0) return {};

  try {
    const res = await fetch(`${getApiUrl()}/i18n/football-names`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ texts: unique, targetLang }),
    });

    if (!res.ok) return {};

    const data = (await res.json()) as { translations?: Record<string, string> };
    return data.translations ?? {};
  } catch {
    return {};
  }
}

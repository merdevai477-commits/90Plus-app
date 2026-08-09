import {
  isValidSeasonKey,
  normalizeCampaignLabel,
  normalizeSeasonKey,
  pickMajorityCampaignLabel,
  resolveKnowledgeSeason,
  resolveKnowledgeSeasonFromObservations,
} from '../knowledge-season-resolver.util';

describe('knowledge-season-resolver', () => {
  it('resolves seasonKey=2026 to 2025/2026 via canonical mapping', () => {
    const resolved = resolveKnowledgeSeason(2026);
    expect(resolved.seasonKey).toBe('2026');
    expect(resolved.seasonLabel).toBe('2025/2026');
    expect(resolved.source).toBe('canonical_365_end_year');
    expect(resolved.confidence).toBe('HIGH');
  });

  it('prefers provider career campaign label over canonical', () => {
    const resolved = resolveKnowledgeSeason('2026', '2025/2026');
    expect(resolved.seasonLabel).toBe('2025/2026');
    expect(resolved.source).toBe('provider_career_label');
  });

  it('normalizes short provider labels 2025/26 → 2025/2026', () => {
    expect(normalizeCampaignLabel('2025/26')).toBe('2025/2026');
    const resolved = resolveKnowledgeSeason('2026', '2025/26');
    expect(resolved.seasonLabel).toBe('2025/2026');
  });

  it('rejects invalid seasonKey', () => {
    expect(isValidSeasonKey('')).toBe(false);
    expect(isValidSeasonKey('-1')).toBe(false);
    expect(isValidSeasonKey('abc')).toBe(false);
    expect(normalizeSeasonKey(null)).toBeNull();
  });

  it('picks majority campaign label from observations', () => {
    const label = pickMajorityCampaignLabel(['2026', '2025/2026', '2025/2026', '2024/2026']);
    expect(label).toBe('2025/2026');
    const resolved = resolveKnowledgeSeasonFromObservations('2026', [
      '2026',
      '2025/2026',
      '2025/2026',
    ]);
    expect(resolved.seasonLabel).toBe('2025/2026');
    expect(resolved.source).toBe('provider_career_label');
  });
});

import {
  COMMON_PLAYER_MAPPINGS,
  matchPlayerMapping,
  resolvePlayerName,
  toCachedMapping,
  type CachedMapping,
} from '../player-name-resolver.service';
import { normalizeName } from '../quiz-name-match.util';

jest.mock('../../lib/prisma', () => ({
  prisma: {
    playerNameMapping: {
      findMany: jest.fn(),
      upsert: jest.fn(),
      deleteMany: jest.fn(),
      update: jest.fn(),
    },
  },
}));

import { prisma } from '../../lib/prisma';
import { invalidateMappingCache } from '../player-name-resolver.service';

const accentCases = [
  { input: 'Desire Doue', canonical: 'Désiré Doué', apiPlayerId: 343027 },
  { input: 'Kylian Mbappe', canonical: 'Kylian Mbappé', apiPlayerId: 278 },
  { input: 'Joao Felix', canonical: 'João Félix', apiPlayerId: 583 },
  { input: 'Angel Di Maria', canonical: 'Ángel Di María', apiPlayerId: 266 },
] as const;

function mappingFor(canonical: string, apiPlayerId: number): CachedMapping {
  const seed = COMMON_PLAYER_MAPPINGS.find((m) => m.apiPlayerId === apiPlayerId);
  if (!seed) throw new Error(`missing seed for ${canonical}`);
  return toCachedMapping(seed);
}

describe('player name resolver — accented names', () => {
  beforeEach(() => {
    invalidateMappingCache();
    const rows = accentCases.map(({ canonical, apiPlayerId }) => {
      const seed = COMMON_PLAYER_MAPPINGS.find((m) => m.apiPlayerId === apiPlayerId)!;
      return {
        arabicName: seed.arabicName,
        englishName: canonical,
        normalizedName: normalizeName(canonical),
        aliases: seed.aliases,
        apiPlayerId,
      };
    });
    (prisma.playerNameMapping.findMany as jest.Mock).mockResolvedValue(rows);
  });

  test.each(accentCases)(
    '$input resolves to $canonical via normalized or alias match',
    async ({ input, canonical, apiPlayerId }) => {
      const resolved = await resolvePlayerName(input);
      expect(resolved).not.toBeNull();
      expect(resolved!.english).toBe(canonical);
      expect(resolved!.apiPlayerId).toBe(apiPlayerId);
      expect(['exact', 'normalized', 'alias']).toContain(resolved!.resolvedBy);
      expect(resolved!.confidenceScore).toBeGreaterThanOrEqual(0.95);
    },
  );

  test('exact match preserves accents on canonical spelling', async () => {
    const resolved = await resolvePlayerName('Kylian Mbappé');
    expect(resolved?.english).toBe('Kylian Mbappé');
    expect(resolved?.resolvedBy).toBe('exact');
    expect(resolved?.confidenceScore).toBe(1);
  });

  test('normalizeName strips diacritics for cross-accent comparison', () => {
    expect(normalizeName('Désiré Doué')).toBe(normalizeName('Desire Doue'));
    expect(normalizeName('Kylian Mbappé')).toBe(normalizeName('Kylian Mbappe'));
    expect(normalizeName('João Félix')).toBe(normalizeName('Joao Felix'));
    expect(normalizeName('Ángel Di María')).toBe(normalizeName('Angel Di Maria'));
  });
});

describe('matchPlayerMapping', () => {
  test('classifies normalized vs alias vs exact', () => {
    const doue = mappingFor('Désiré Doué', 343027);
    const mbappe = mappingFor('Kylian Mbappé', 278);

    expect(matchPlayerMapping('Désiré Doué', normalizeName('Désiré Doué'), doue)).toEqual({
      resolvedBy: 'exact',
      confidenceScore: 1,
    });
    expect(matchPlayerMapping('Desire Doue', normalizeName('Desire Doue'), doue)).toEqual({
      resolvedBy: 'normalized',
      confidenceScore: 0.98,
    });
    expect(matchPlayerMapping('Mbappe', normalizeName('Mbappe'), mbappe)).toEqual({
      resolvedBy: 'alias',
      confidenceScore: 0.95,
    });
  });
});

import { footballService } from './football.service';
import { logger } from '../utils/logger';
import type { StoredQuizQuestion } from '../types/quiz.types';
import {
  isImageDependentQuestionText,
  isRetiredLegendPlayerName,
} from './quiz-image-legends';

function normalizeName(name: string): string {
  return name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
}

function getAliases(name: string): string[] {
  const aliases = new Set<string>();
  aliases.add(name);
  
  let cleaned = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  
  const stopWords = ['fc', 'cf', 'sc', 'afc', 'national football team', 'national team', 'football club'];
  let shortName = cleaned;
  for (const word of stopWords) {
    const regex = new RegExp(`\\b${word}\\b`, 'gi');
    shortName = shortName.replace(regex, '');
  }
  shortName = shortName.trim().replace(/\s+/g, ' ');
  
  if (shortName && shortName !== cleaned && shortName.length > 0) {
    aliases.add(shortName);
    aliases.add(shortName.replace(/\b\w/g, (c) => c.toUpperCase()));
  }

  const withoutPrefix = name
    .replace(/^\s*(?:FC|CF|SC|AFC)\.?\s+/i, '')
    .trim();
  if (withoutPrefix && withoutPrefix !== name) {
    aliases.add(withoutPrefix);
  }
  
  return Array.from(aliases);
}

function getPlayerSearchAliases(name: string): string[] {
  const aliases = new Set(getAliases(name));
  const noSuffix = name
    .replace(/\s+jr\.?\s*$/i, '')
    .replace(/\s+sr\.?\s*$/i, '')
    .replace(/\s+ii\s*$/i, '')
    .replace(/\s+iii\s*$/i, '')
    .trim();
  if (noSuffix && noSuffix !== name) aliases.add(noSuffix);

  const noDots = name.replace(/\./g, ' ').replace(/\s+/g, ' ').trim();
  if (noDots && noDots !== name) aliases.add(noDots);

  const firstToken = name.split(/\s+/)[0]?.replace(/\./g, '');
  if (firstToken && firstToken.length >= 4) aliases.add(firstToken);

  const lastToken = name.split(/\s+/).pop()?.replace(/\./g, '');
  if (lastToken && lastToken.length >= 4) aliases.add(lastToken);

  return Array.from(aliases).filter((a) => a.trim().length >= 2);
}

function editDistance(s1: string, s2: string): number {
  s1 = s1.toLowerCase();
  s2 = s2.toLowerCase();

  const costs = new Array();
  for (let i = 0; i <= s1.length; i++) {
    let lastValue = i;
    for (let j = 0; j <= s2.length; j++) {
      if (i == 0) costs[j] = j;
      else {
        if (j > 0) {
          let newValue = costs[j - 1];
          if (s1.charAt(i - 1) != s2.charAt(j - 1))
            newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
          costs[j - 1] = lastValue;
          lastValue = newValue;
        }
      }
    }
    if (i > 0) costs[s2.length] = lastValue;
  }
  return costs[s2.length];
}

function getSimilarity(s1: string, s2: string): number {
  let longer = s1;
  let shorter = s2;
  if (s1.length < s2.length) {
    longer = s2;
    shorter = s1;
  }
  const longerLength = longer.length;
  if (longerLength === 0) {
    return 1.0;
  }
  return (longerLength - editDistance(longer, shorter)) / parseFloat(longerLength.toString());
}

function getVenueSearchAliases(name: string): string[] {
  const aliases = new Set(getAliases(name));
  const ascii = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  aliases.add(ascii);

  const stripped = ascii
    .replace(/\b(stadium|arena|ground|field|park|estadio|stade|stadion)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (stripped) aliases.add(stripped);

  const bernabeu = name.match(/bernab[eé]u/i);
  if (bernabeu) aliases.add('Bernabeu');
  if (/camp\s+nou/i.test(name)) aliases.add('Camp Nou');
  if (/old\s+trafford/i.test(name)) aliases.add('Old Trafford');
  if (/anfield/i.test(name)) aliases.add('Anfield');
  if (/san\s+siro|giuseppe\s+meazza/i.test(name)) aliases.add('San Siro');

  return Array.from(aliases).filter((a) => a.trim().length >= 3);
}

function scorePlayerMatch(
  entityName: string,
  targetNames: string[],
  player: { name?: string; firstname?: string; lastname?: string; photo?: string | null },
): number {
  const candidates = new Set<string>();
  if (player.name) candidates.add(player.name);
  if (player.firstname && player.lastname) {
    candidates.add(`${player.firstname} ${player.lastname}`);
    candidates.add(player.lastname);
  }

  let maxScore = 0;
  for (const candidate of candidates) {
    const normalizedCandidate = normalizeName(candidate);
    for (const tName of targetNames) {
      if (normalizedCandidate === tName) return 1;
      maxScore = Math.max(maxScore, getSimilarity(tName, normalizedCandidate));
    }
  }

  const entityTokens = entityName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .split(/\s+/)
    .filter(Boolean);
  const entityLast = normalizeName(entityTokens[entityTokens.length - 1] ?? '');
  if (entityLast.length >= 4) {
    if (player.lastname && normalizeName(player.lastname) === entityLast) {
      maxScore = Math.max(maxScore, 0.96);
    }
    for (const candidate of candidates) {
      const normalizedCandidate = normalizeName(candidate);
      if (
        normalizedCandidate.endsWith(entityLast) ||
        normalizedCandidate.includes(entityLast)
      ) {
        maxScore = Math.max(maxScore, 0.92);
      }
    }
  }

  return maxScore;
}

function scoreVenueMatch(entityName: string, venueName: string, targetNames: string[]): number {
  const venueNorm = normalizeName(venueName);
  let maxScore = getSimilarity(normalizeName(entityName), venueNorm);

  const entityCore = normalizeName(
    entityName.replace(/\b(stadium|estadio|stade|arena|ground|field|park)\b/gi, ' '),
  );
  const venueCore = normalizeName(
    venueName.replace(/\b(stadium|estadio|stade|arena|ground|field|park)\b/gi, ' '),
  );
  maxScore = Math.max(maxScore, getSimilarity(entityCore, venueCore));

  for (const tName of targetNames) {
    if (venueNorm.includes(tName) || tName.includes(venueNorm)) {
      maxScore = Math.max(maxScore, 0.9);
    }
    if (venueCore.includes(tName) || tName.includes(venueCore)) {
      maxScore = Math.max(maxScore, 0.88);
    }
  }

  return maxScore;
}

function resolveMatchThreshold(kind: StoredQuizQuestion['type'], bindingKind: string): number {
  if (bindingKind === 'player') return 0.8;
  if (bindingKind === 'venue') return 0.68;
  if (bindingKind === 'team' && kind === 'logo') return 0.8;
  return 0.85;
}

async function resolveTeamId(teamName: string | undefined): Promise<number | undefined> {
  if (!teamName?.trim()) return undefined;
  const teamAliases = getAliases(teamName);
  let bestTeamId: number | undefined;
  let bestTeamScore = 0;

  for (const tAlias of teamAliases) {
    const teamRes = await footballService.searchTeams(tAlias);
    for (const row of teamRes ?? []) {
      if (!row?.team?.id) continue;
      const score = getSimilarity(normalizeName(tAlias), normalizeName(row.team.name));
      if (score > bestTeamScore) {
        bestTeamScore = score;
        bestTeamId = row.team.id;
      }
    }
  }

  return bestTeamScore >= 0.75 ? bestTeamId : undefined;
}

function degradeToNormalTextQuestion(q: StoredQuizQuestion): StoredQuizQuestion {
  return {
    ...q,
    type: 'normal',
    imageBinding: null,
    imageUrl: null,
    imageLayout: 'square',
  };
}

function handleUnresolvedImageQuestion(
  q: StoredQuizQuestion,
  binding: NonNullable<StoredQuizQuestion['imageBinding']>,
  maxScore: number,
): StoredQuizQuestion | null {
  const imageDependent = isImageDependentQuestionText(q.question);
  const isGuessPlayer = q.type === 'guess_player' && binding.kind === 'player';

  if (isGuessPlayer) {
    logger.warn(
      `[QuizImage] Player image unavailable for "${binding.entityName}", likely retired/legend or not in API-Football.`,
    );
    if (imageDependent) {
      logger.info(
        `[QuizImage] Discarded ${q.id} guess_player — image required but unavailable for "${binding.entityName}"`,
      );
      return null;
    }
    if (isRetiredLegendPlayerName(binding.entityName) || maxScore < 0.85) {
      logger.info(
        `[QuizImage] Degraded ${q.id} guess_player to normal text (no photo): "${binding.entityName}"`,
      );
      return degradeToNormalTextQuestion(q);
    }
  }

  logger.warn(
    `[QuizImage] Rejected ${q.id} (${q.type}): ${binding.kind} "${binding.entityName}". Best match score: ${maxScore.toFixed(2)}`,
  );

  if (q.type === 'image' && !imageDependent) {
    logger.info(`[QuizImage] Degraded ${q.id} to normal (image failed but answerable text)`);
    return degradeToNormalTextQuestion(q);
  }

  logger.info(`[QuizImage] Discarded ${q.id} because it relies on image and resolution failed`);
  return null;
}

export async function enrichQuizImages(
  questions: StoredQuizQuestion[],
  dateStr: string,
): Promise<(StoredQuizQuestion | null)[]> {
  if (!footballService.isConfigured()) {
    return questions.map(q => {
      if (q.type === 'normal') return q;
      if (q.type === 'image' && !isImageDependentQuestionText(q.question)) {
        return degradeToNormalTextQuestion(q);
      }
      if (q.type === 'guess_player' && q.imageBinding?.kind === 'player') {
        if (!isImageDependentQuestionText(q.question)) {
          return degradeToNormalTextQuestion(q);
        }
        return null;
      }
      return null;
    });
  }

  const out: (StoredQuizQuestion | null)[] = [];

  for (const q of questions) {
    if (q.type === 'normal') {
      q.imageBinding = null;
      q.imageUrl = null;
      out.push(q);
      continue;
    }

    if (!q.imageBinding) {
      logger.warn(`[QuizImage] Missing imageBinding for non-normal question ${q.id}. Discarding.`);
      out.push(null);
      continue;
    }

    const binding = q.imageBinding;

    if (
      q.type === 'guess_player' &&
      binding.kind === 'player' &&
      isRetiredLegendPlayerName(binding.entityName)
    ) {
      if (!isImageDependentQuestionText(q.question)) {
        logger.info(
          `[QuizImage] Skipped image lookup for legend "${binding.entityName}" — using normal text question`,
        );
        out.push(degradeToNormalTextQuestion(q));
        continue;
      }
      logger.warn(
        `[QuizImage] Player image unavailable for "${binding.entityName}", likely retired/legend or not in API-Football.`,
      );
      logger.info(`[QuizImage] Discarded ${q.id} — image-required legend guess_player`);
      out.push(null);
      continue;
    }

    const aliases =
      binding.kind === 'player'
        ? getPlayerSearchAliases(binding.entityName)
        : getAliases(binding.entityName);
    const lastToken = binding.entityName.split(/\s+/).pop();
    if (binding.kind === 'player' && lastToken && lastToken.length >= 4) {
      aliases.push(lastToken.replace(/\./g, ''));
    }
    const matchNames =
      binding.kind === 'venue' ? getVenueSearchAliases(binding.entityName) : aliases;
    const targetNames = matchNames.map(normalizeName);
    
    let bestMatchUrl: string | null = null;
    let bestMatchId: number | undefined;
    let maxScore = 0;

    let results: any[] = [];
    try {
      switch (binding.kind) {
        case 'player': {
          const teamId = await resolveTeamId(binding.teamName);
          
          if (!teamId) {
             logger.warn(`[QuizImages] Could not resolve team "${binding.teamName}" for player "${binding.entityName}". Attempting global search.`);
          }
          
          for (const pAlias of aliases) {
             try {
               const pRes = await footballService.searchPlayers(pAlias, undefined, teamId);
               if (pRes && pRes.length > 0) results = results.concat(pRes);
             } catch (e) {
               logger.warn(`[QuizImages] Player search failed for "${pAlias}"`, e);
             }
          }

          if (teamId) {
            try {
              const squadRows = await footballService.getTeamSquad(teamId);
              const squadPlayers = squadRows?.[0]?.players ?? [];
              for (const p of squadPlayers) {
                if (p?.id && p?.name) {
                  results.push({
                    player: {
                      id: p.id,
                      name: p.name,
                      photo: p.photo ?? null,
                      lastname: typeof p.name === 'string' ? p.name.split(/\s+/).pop() : undefined,
                    },
                  });
                }
              }
            } catch (e) {
              logger.warn(`[QuizImages] Squad fallback failed for team ${teamId}`, e);
            }
          }
          break;
        }
        case 'team':
          for (const alias of aliases) {
            const tRes = await footballService.searchTeams(alias);
            if (tRes && tRes.length > 0) results = results.concat(tRes);
          }
          break;
        case 'league':
          for (const alias of aliases) {
            const lRes = await footballService.searchLeagues(alias);
            if (lRes && lRes.length > 0) results = results.concat(lRes);
          }
          break;
        case 'venue':
          for (const alias of getVenueSearchAliases(binding.entityName)) {
            const vRes = await footballService.searchVenues(alias);
            if (vRes && vRes.length > 0) results = results.concat(vRes);
          }
          break;
      }
    } catch (e) {
      logger.warn(`[QuizImages] API search wrapper failed for ${binding.kind} "${binding.entityName}"`, e);
    }

    for (const item of results) {
      let name = '';
      let url = null;
      let id = undefined;

      if (binding.kind === 'player' && item.player) {
        name = item.player.name;
        url = item.player.photo;
        id = item.player.id;
        const playerScore = scorePlayerMatch(binding.entityName, targetNames, item.player);
        if (playerScore > maxScore && url) {
          maxScore = playerScore;
          bestMatchUrl = url;
          bestMatchId = id;
        }
        if (maxScore >= 1) break;
        continue;
      } else if (binding.kind === 'venue') {
        name = item.name;
        url = item.image;
        id = item.id;
        const venueScore = scoreVenueMatch(binding.entityName, name, targetNames);
        if (venueScore > maxScore && url) {
          maxScore = venueScore;
          bestMatchUrl = url;
          bestMatchId = id;
        }
        if (maxScore >= 1) break;
        continue;
      } else if (binding.kind === 'team' && item.team) {
        name = item.team.name;
        url = item.team.logo;
        id = item.team.id;
      } else if (binding.kind === 'league' && item.league) {
        name = item.league.name;
        url = item.league.logo;
        id = item.league.id;
      }

      if (!name || !url) continue;

      const normalizedItemName = normalizeName(name);
      
      for (const tName of targetNames) {
        if (normalizedItemName === tName) {
          bestMatchUrl = url;
          bestMatchId = id;
          maxScore = 1.0;
          break;
        }

        const score = getSimilarity(tName, normalizedItemName);
        if (score > maxScore) {
          maxScore = score;
          bestMatchUrl = url;
          bestMatchId = id;
        }
      }
      if (maxScore === 1.0) break;
    }

    const threshold = resolveMatchThreshold(q.type, binding.kind);
    if (maxScore >= threshold && bestMatchUrl) {
      if (q.type === 'guess_player' && binding.kind === 'player') {
        if (!bestMatchUrl.trim()) {
          out.push(handleUnresolvedImageQuestion(q, binding, maxScore));
          continue;
        }
      }
      q.imageUrl = bestMatchUrl;
      q.imageBinding.imageUrl = bestMatchUrl;
      q.imageBinding.apiId = bestMatchId;
      logger.info(`[QuizImage] Resolved ${q.id} (${q.type}): ${binding.kind} "${binding.entityName}" -> ${bestMatchUrl} (score: ${maxScore.toFixed(2)})`);
      out.push(q);
    } else {
      const resolved = handleUnresolvedImageQuestion(q, binding, maxScore);
      out.push(resolved);
    }
  }

  return out;
}

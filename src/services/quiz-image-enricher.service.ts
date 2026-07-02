import { footballService } from './football.service';
import { logger } from '../utils/logger';
import type { StoredQuizQuestion } from '../types/quiz.types';
import {
  isImageDependentQuestionText,
  isRetiredLegendPlayerName,
  hasGuessPlayerClue,
} from './quiz-image-legends';
import {
  normalizeName,
  getSimilarity,
  scorePlayerMatch,
  scoreEntityNameMatch,
  isCrossScriptNamePair,
} from './quiz-name-match.util';
import {
  getCachedQuizImageUrl,
  setCachedQuizImageUrl,
} from './quiz-image-cache.service';
import { resolve365QuizPlayerImage } from './quiz-365-player.service';

/** Known API-Football team IDs for names that search often misses. */
const KNOWN_TEAM_IDS: Readonly<Record<string, number>> = {
  'bayer leverkusen': 168,
  'bayer 04 leverkusen': 168,
  'leverkusen': 168,
  'bayern munich': 157,
  'bayern munchen': 157,
  'fc bayern': 157,
  'borussia dortmund': 165,
  'dortmund': 165,
  'rb leipzig': 173,
  'borussia monchengladbach': 163,
  'monchengladbach': 163,
  'fc schalke 04': 174,
  'schalke': 174,
  'real madrid': 541,
  'barcelona': 529,
  'liverpool': 40,
  'manchester city': 50,
  'manchester united': 33,
  'arsenal': 42,
  'chelsea': 49,
  'tottenham': 47,
  'juventus': 496,
  'inter milan': 505,
  'ac milan': 489,
  'psg': 85,
  'paris saint germain': 85,
};

const KNOWN_VENUE_SEARCH_TERMS: Readonly<Record<string, string[]>> = {
  'veltins arena': ['Veltins Arena', 'Arena AufSchalke', 'VELTINS-Arena'],
  'veltins-arena': ['Veltins Arena', 'Arena AufSchalke', 'VELTINS-Arena'],
  'allianz arena': ['Allianz Arena'],
  'signal iduna park': ['Signal Iduna Park', 'Westfalenstadion'],
  'olympiastadion berlin': ['Olympiastadion Berlin', 'Olympiastadion'],
  'emirates stadium': ['Emirates Stadium'],
  'old trafford': ['Old Trafford'],
  'anfield': ['Anfield'],
  'camp nou': ['Camp Nou'],
  'santiago bernabeu': ['Santiago Bernabeu', 'Bernabeu'],
  'san siro': ['San Siro', 'Giuseppe Meazza'],
};

function getAliases(name: string): string[] {
  const aliases = new Set<string>();
  aliases.add(name);

  const ascii = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (ascii !== name) aliases.add(ascii);

  let cleaned = ascii.toLowerCase();

  const withoutNumbers = cleaned.replace(/\b\d{2,4}\b/g, ' ').replace(/\s+/g, ' ').trim();
  if (withoutNumbers && withoutNumbers !== cleaned) {
    aliases.add(withoutNumbers.replace(/\b\w/g, (c) => c.toUpperCase()));
    aliases.add(withoutNumbers);
  }

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

  const hyphenAsSpace = name.replace(/-/g, ' ').replace(/\s+/g, ' ').trim();
  if (hyphenAsSpace && hyphenAsSpace !== name) aliases.add(hyphenAsSpace);

  return Array.from(aliases);
}

function expandKnownEntityAliases(kind: string, name: string): string[] {
  const key = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  const out = new Set(getAliases(name));

  if (kind === 'team') {
    const teamId = KNOWN_TEAM_IDS[key];
    if (teamId) {
      for (const [label, id] of Object.entries(KNOWN_TEAM_IDS)) {
        if (id === teamId) out.add(label.replace(/\b\w/g, (c) => c.toUpperCase()));
      }
    }
    for (const [label, id] of Object.entries(KNOWN_TEAM_IDS)) {
      if (key.includes(label) || label.includes(key)) {
        for (const [aliasLabel, aliasId] of Object.entries(KNOWN_TEAM_IDS)) {
          if (aliasId === id) out.add(aliasLabel.replace(/\b\w/g, (c) => c.toUpperCase()));
        }
      }
    }
  }

  if (kind === 'venue') {
    const venueTerms = KNOWN_VENUE_SEARCH_TERMS[key];
    if (venueTerms) venueTerms.forEach((t) => out.add(t));
    for (const [label, terms] of Object.entries(KNOWN_VENUE_SEARCH_TERMS)) {
      if (key.includes(label.replace(/-/g, ' ')) || label.replace(/-/g, ' ').includes(key)) {
        terms.forEach((t) => out.add(t));
      }
    }
  }

  return Array.from(out).filter((a) => a.trim().length >= 2);
}

function getPlayerSearchAliases(name: string): string[] {
  const aliases = new Set(expandKnownEntityAliases('player', name));
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

function dedupeSearchResults(results: any[], kind: string): any[] {
  const seen = new Set<string>();
  const out: any[] = [];
  for (const item of results) {
    let id: string | number | undefined;
    if (kind === 'player' && item.player?.id) id = item.player.id;
    else if (kind === 'team' && item.team?.id) id = item.team.id;
    else if (kind === 'league' && item.league?.id) id = item.league.id;
    else if (kind === 'venue' && item.id) id = item.id;
    const key = id != null ? String(id) : JSON.stringify(item);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
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
  if (bindingKind === 'player') return kind === 'guess_player' ? 0.82 : 0.88;
  if (bindingKind === 'venue') return 0.62;
  if (bindingKind === 'team' && kind === 'logo') return 0.75;
  return 0.85;
}

async function resolveTeamId(teamName: string | undefined): Promise<number | undefined> {
  if (!teamName?.trim()) return undefined;

  const teamKey = teamName.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  const knownId = KNOWN_TEAM_IDS[teamKey];
  if (knownId) return knownId;
  for (const [label, id] of Object.entries(KNOWN_TEAM_IDS)) {
    if (teamKey.includes(label) || label.includes(teamKey)) return id;
  }

  const teamAliases = expandKnownEntityAliases('team', teamName);
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
    if (hasGuessPlayerClue(q.question)) {
      logger.info(
        `[QuizImage] Degraded ${q.id} guess_player to normal text (clue-rich, no photo): "${binding.entityName}"`,
      );
      return degradeToNormalTextQuestion(q);
    }
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
  const apiFootballReady = footballService.isConfigured();

  if (!apiFootballReady) {
    logger.info('[QuizImage] API-Football not configured — using 365Scores for player photos where possible');
  }

  const out: (StoredQuizQuestion | null)[] = [];

  for (const q of questions) {
    if (q.type === 'normal') {
      q.imageBinding = null;
      q.imageUrl = null;
      out.push(q);
      continue;
    }

    if (q.type === 'guess_player' && !hasGuessPlayerClue(q.question)) {
      logger.info(`[QuizImage] Discarded ${q.id} — guess_player without factual clue`);
      out.push(null);
      continue;
    }

    if (!q.imageBinding) {
      logger.warn(`[QuizImage] Missing imageBinding for non-normal question ${q.id}. Discarding.`);
      out.push(null);
      continue;
    }

    const binding = q.imageBinding;

    if (q.imageUrl?.trim()) {
      out.push(q);
      continue;
    }

    const correctAnswerText =
      q.options.find((o) => o.key === q.correctKey)?.text?.trim() ?? '';

    if (binding.kind === 'player') {
      const athleteIdFromEntity =
        binding.entityId?.startsWith('365:') ?
          Number.parseInt(binding.entityId.slice(4), 10)
        : undefined;

      if (athleteIdFromEntity && Number.isFinite(athleteIdFromEntity)) {
        const cached365 = await getCachedQuizImageUrl('365player', athleteIdFromEntity);
        if (cached365) {
          q.imageUrl = cached365;
          q.imageBinding = { ...binding, imageUrl: cached365, apiId: athleteIdFromEntity };
          out.push(q);
          continue;
        }
      }

      if (binding.apiId) {
        const cached365 = await getCachedQuizImageUrl('365player', binding.apiId);
        if (cached365) {
          q.imageUrl = cached365;
          q.imageBinding = { ...binding, imageUrl: cached365 };
          out.push(q);
          continue;
        }
      }

      const aliases = getPlayerSearchAliases(binding.entityName);
      const matchNames = aliases;
      const targetNames = matchNames.map(normalizeName);
      const threshold = resolveMatchThreshold(q.type, 'player');

      const from365 = await resolve365QuizPlayerImage({
        entityName: binding.entityName,
        teamName: binding.teamName,
        correctAnswerText,
        targetNames,
      });

      if (from365 && from365.score >= threshold && from365.imageUrl?.trim()) {
        q.imageUrl = from365.imageUrl;
        q.imageBinding = {
          ...binding,
          entityName: from365.name,
          imageUrl: from365.imageUrl,
          apiId: from365.athleteId,
          entityId: binding.entityId ?? `365:${from365.athleteId}`,
        };
        void setCachedQuizImageUrl('365player', from365.athleteId, from365.imageUrl);
        logger.info(
          `[QuizImage] Resolved ${q.id} via 365Scores: "${binding.entityName}" -> ${from365.imageUrl}`,
        );
        out.push(q);
        continue;
      }
    }

    if (!apiFootballReady) {
      if (binding.kind === 'player') {
        out.push(handleUnresolvedImageQuestion(q, binding, 0));
      } else {
        logger.warn(`[QuizImage] Skipped ${q.id} — ${binding.kind} needs API-Football`);
        out.push(null);
      }
      continue;
    }

    if (binding.apiId) {
      const cachedUrl = await getCachedQuizImageUrl(binding.kind, binding.apiId);
      if (cachedUrl) {
        q.imageUrl = cachedUrl;
        q.imageBinding = { ...binding, imageUrl: cachedUrl };
        out.push(q);
        continue;
      }
    }

    if (binding.apiId && binding.kind === 'player') {
      try {
        const rows = await footballService.getPlayerById(binding.apiId);
        const photo = rows?.[0]?.player?.photo;
        if (photo?.trim()) {
          q.imageUrl = photo;
          q.imageBinding = { ...binding, imageUrl: photo };
          void setCachedQuizImageUrl('player', binding.apiId, photo);
          out.push(q);
          continue;
        }
      } catch (e) {
        logger.warn(`[QuizImage] Direct player lookup failed for apiId ${binding.apiId}`, e);
      }
    }

    if (binding.apiId && binding.kind === 'team') {
      try {
        const rows = await footballService.getTeamById(binding.apiId);
        const logo = rows?.[0]?.team?.logo;
        if (logo?.trim()) {
          q.imageUrl = logo;
          q.imageBinding = { ...binding, imageUrl: logo };
          void setCachedQuizImageUrl('team', binding.apiId, logo);
          out.push(q);
          continue;
        }
      } catch (e) {
        logger.warn(`[QuizImage] Direct team lookup failed for apiId ${binding.apiId}`, e);
      }
    }

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
        : expandKnownEntityAliases(binding.kind, binding.entityName);
    const lastToken = binding.entityName.split(/\s+/).pop();
    if (binding.kind === 'player' && lastToken && lastToken.length >= 4) {
      aliases.push(lastToken.replace(/\./g, ''));
    }
    const matchNames =
      binding.kind === 'venue'
        ? [...new Set([...getVenueSearchAliases(binding.entityName), ...expandKnownEntityAliases('venue', binding.entityName)])]
        : aliases;
    const targetNames = matchNames.map(normalizeName);

    // Internal consistency: for player photos the correct answer option MUST be
    // the same person as the image entity. Skip when cross-script (ar options +
    // English entityName) — API photo resolution is the guard instead.
    if (
      binding.kind === 'player' &&
      correctAnswerText &&
      binding.entityName &&
      !isCrossScriptNamePair(correctAnswerText, binding.entityName)
    ) {
      const consistency = scoreEntityNameMatch(correctAnswerText, binding.entityName);
      if (consistency < 0.7) {
        logger.warn(
          `[QuizImage] Discarded ${q.id}: correct answer "${correctAnswerText}" doesn't match image entity "${binding.entityName}" (${consistency.toFixed(2)})`,
        );
        out.push(null);
        continue;
      }
    }

    // Track whether a team was named but we could NOT confirm it — used to
    // tighten the homonym guard (a global player search may hit a same-named
    // player on a different club).
    const teamSpecified = binding.kind === 'player' && !!binding.teamName?.trim();
    let teamResolved = false;

    let bestMatchUrl: string | null = null;
    let bestMatchId: number | undefined;
    let bestMatchPlayerName: string | null = null;
    let maxScore = 0;

    let results: any[] = [];
    try {
      switch (binding.kind) {
        case 'player': {
          const teamId = await resolveTeamId(binding.teamName);
          teamResolved = !!teamId;

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

    results = dedupeSearchResults(results, binding.kind);

    for (const item of results) {
      let name = '';
      let url = null;
      let id = undefined;

      if (binding.kind === 'player' && item.player) {
        name = item.player.name;
        url = item.player.photo;
        id = item.player.id;
        let playerScore = scorePlayerMatch(binding.entityName, targetNames, item.player);
        if (correctAnswerText) {
          const answerScore = scoreEntityNameMatch(correctAnswerText, name);
          if (answerScore < 0.78) {
            playerScore *= 0.55;
          } else {
            playerScore = Math.max(playerScore, answerScore);
          }
        }
        if (playerScore > maxScore && url) {
          maxScore = playerScore;
          bestMatchUrl = url;
          bestMatchId = id;
          bestMatchPlayerName = name;
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
        if (correctAnswerText && bestMatchPlayerName) {
          const answerMatch = scoreEntityNameMatch(correctAnswerText, bestMatchPlayerName);
          const crossScript = isCrossScriptNamePair(correctAnswerText, bestMatchPlayerName);
          // Tighten the bar when a club was named but unconfirmed: a global
          // search can surface a same-named player from another team.
          const requiredAnswerMatch =
            crossScript ? 0.5 : teamSpecified && !teamResolved ? 0.9 : 0.82;
          if (!crossScript && answerMatch < requiredAnswerMatch) {
            logger.warn(
              `[QuizImage] Rejected ${q.id}: photo is "${bestMatchPlayerName}" but answer is "${correctAnswerText}" (${answerMatch.toFixed(2)}, required ${requiredAnswerMatch})`,
            );
            out.push(handleUnresolvedImageQuestion(q, binding, maxScore));
            continue;
          }
          q.imageBinding.entityName = bestMatchPlayerName;
        }
      }
      q.imageUrl = bestMatchUrl;
      q.imageBinding.imageUrl = bestMatchUrl;
      q.imageBinding.apiId = bestMatchId;
      if (bestMatchId) {
        void setCachedQuizImageUrl(binding.kind, bestMatchId, bestMatchUrl);
      }
      logger.info(`[QuizImage] Resolved ${q.id} (${q.type}): ${binding.kind} "${binding.entityName}" -> ${bestMatchUrl} (score: ${maxScore.toFixed(2)})`);
      out.push(q);
    } else {
      const resolved = handleUnresolvedImageQuestion(q, binding, maxScore);
      out.push(resolved);
    }
  }

  return out;
}

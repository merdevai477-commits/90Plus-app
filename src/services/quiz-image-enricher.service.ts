import { footballService } from './football.service';
import { logger } from '../utils/logger';
import type { StoredQuizQuestion } from '../types/quiz.types';

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
  }
  
  return Array.from(aliases);
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

export async function enrichQuizImages(
  questions: StoredQuizQuestion[],
  dateStr: string,
): Promise<(StoredQuizQuestion | null)[]> {
  if (!footballService.isConfigured()) {
    // If not configured, we degrade all image questions to normal if safe, else discard.
    return questions.map(q => {
      if (q.type === 'normal') return q;
      if (q.type === 'image' && !/who is this|what is this|identify this|name this|which player is shown|which team is shown/i.test(q.question)) {
        q.type = 'normal';
        q.imageBinding = null;
        q.imageUrl = null;
        return q;
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
    const aliases = getAliases(binding.entityName);
    const targetNames = aliases.map(normalizeName);
    
    let bestMatchUrl: string | null = null;
    let bestMatchId: number | undefined;
    let maxScore = 0;

    let results: any[] = [];
    try {
      switch (binding.kind) {
        case 'player':
          let teamId: number | undefined;
          if (binding.teamName) {
            const teamAliases = getAliases(binding.teamName);
            for (const tAlias of teamAliases) {
              const teamRes = await footballService.searchTeams(tAlias);
              if (teamRes && teamRes.length > 0 && teamRes[0].team) {
                teamId = teamRes[0].team.id;
                break;
              }
            }
          }
          
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
          break;
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
          for (const alias of aliases) {
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
      } else if (binding.kind === 'team' && item.team) {
        name = item.team.name;
        url = item.team.logo;
        id = item.team.id;
      } else if (binding.kind === 'league' && item.league) {
        name = item.league.name;
        url = item.league.logo;
        id = item.league.id;
      } else if (binding.kind === 'venue') {
        name = item.name;
        url = item.image;
        id = item.id;
      }

      if (!name || !url) continue;

      const normalizedItemName = normalizeName(name);
      
      for (const tName of targetNames) {
        if (normalizedItemName === tName) {
          bestMatchUrl = url;
          bestMatchId = id;
          maxScore = 1.0;
          break; // Exact match found
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

    if (maxScore >= 0.85 && bestMatchUrl) {
      q.imageUrl = bestMatchUrl;
      q.imageBinding.imageUrl = bestMatchUrl;
      q.imageBinding.apiId = bestMatchId;
      logger.info(`[QuizImage] Resolved ${q.id} (${q.type}): ${binding.kind} "${binding.entityName}" -> ${bestMatchUrl} (score: ${maxScore.toFixed(2)})`);
      out.push(q);
    } else {
      logger.warn(`[QuizImage] Rejected ${q.id} (${q.type}): ${binding.kind} "${binding.entityName}". Best match score: ${maxScore.toFixed(2)}`);
      
      const isImageDependent = /who is this|what is this|identify this|name this|which player is shown|which team is shown/i.test(q.question);
      
      if (q.type === 'image' && !isImageDependent) {
        logger.info(`[QuizImage] Degraded ${q.id} to normal (Image failed but answerable text)`);
        q.type = 'normal';
        q.imageBinding = null;
        q.imageUrl = null;
        out.push(q);
      } else {
        logger.info(`[QuizImage] Discarded ${q.id} because it relies on image and resolution failed`);
        out.push(null);
      }
    }
  }

  return out;
}

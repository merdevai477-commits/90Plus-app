import type { Request } from 'express';
import prisma from '../lib/prisma';
import { logger } from '../utils/logger';
import { notifyUser } from './notify.service';
import { NotificationType } from './notification.service';
import { awardXp } from './xp.service';
import { ProfileCompletionService } from './profile-completion.service';
import { footballDataCacheService } from './football-data-cache.service';
import { resolveGeoCountry } from './geo-country.service';
import {
  CatalogCountry,
  countriesMatch,
  mapCountryInput,
  shouldSeedCountry,
} from '../data/country-catalog';
import {
  GLOBAL_ONBOARDING_CLUBS,
  LOCAL_ONBOARDING_CLUB_COUNT,
  MAX_ONBOARDING_TEAMS,
  OnboardingClub,
  resolveCountry365Competition,
} from '../data/onboarding-clubs';

export interface OnboardingTeamInput {
  competitorId: number;
  name: string;
  logo?: string | null;
  country?: string | null;
  isLocal?: boolean;
}

export function parseOnboardingTeamsBody(body: unknown): {
  skipped: boolean;
  teams: OnboardingTeamInput[];
  error?: string;
} {
  const raw = (body ?? {}) as Record<string, unknown>;
  if (raw.skipped === true) {
    return { skipped: true, teams: [] };
  }

  const list = Array.isArray(raw.teams) ? raw.teams : [];
  const teams: OnboardingTeamInput[] = [];
  const seen = new Set<number>();

  for (const item of list) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    const competitorId = Number(row.competitorId ?? row.apiTeamId);
    if (!Number.isInteger(competitorId) || competitorId <= 0) continue;
    if (seen.has(competitorId)) continue;
    seen.add(competitorId);
    const name = typeof row.name === 'string' ? row.name.trim() : '';
    teams.push({
      competitorId,
      name: name || `Team ${competitorId}`,
      logo: typeof row.logo === 'string' ? row.logo : null,
      country: typeof row.country === 'string' ? row.country : null,
      isLocal: row.isLocal === true,
    });
    if (teams.length >= MAX_ONBOARDING_TEAMS) break;
  }

  if (teams.length === 0) {
    return { skipped: false, teams: [], error: 'Select at least one team or skip' };
  }

  return { skipped: false, teams };
}

export function pickFifaClubFromOnboarding(
  teams: OnboardingTeamInput[],
  userCountry: CatalogCountry | null,
): OnboardingTeamInput | null {
  return (
    teams.find(
      (team) =>
        team.isLocal === true ||
        (userCountry != null && countriesMatch(team.country, userCountry.id)),
    ) ?? null
  );
}

function profileClubEmpty(user: { favoriteTeam: string | null; clubLogo: string | null }): boolean {
  return !(user.favoriteTeam ?? '').trim() && !(user.clubLogo ?? '').trim();
}

async function followTeamsForUser(
  userId: string,
  teams: OnboardingTeamInput[],
  language?: string,
): Promise<void> {
  for (const team of teams) {
    const existed = await prisma.favoriteTeam.findUnique({
      where: { userId_apiTeamId: { userId, apiTeamId: team.competitorId } },
      select: { id: true },
    });

    await prisma.favoriteTeam.upsert({
      where: { userId_apiTeamId: { userId, apiTeamId: team.competitorId } },
      create: {
        userId,
        apiTeamId: team.competitorId,
        teamName: team.name,
        teamLogo: team.logo ?? null,
        country: team.country ?? null,
      },
      update: {
        teamName: team.name,
        teamLogo: team.logo ?? undefined,
        country: team.country ?? undefined,
      },
    });

    if (!existed) {
      notifyUser({
        userId,
        type: NotificationType.GENERAL,
        titleKey: 'followedClubTitle',
        bodyKey: 'followedClubBody',
        vars: { name: team.name },
        language,
        data: {
          type: 'TEAM_FOLLOWED',
          teamId: String(team.competitorId),
          entityId: String(team.competitorId),
          screen: '/team-profile',
          teamName: team.name,
          isNationalTeam: false,
        },
      }).catch((err) =>
        logger.warn('[onboarding] follow push failed (non-fatal):', err?.message ?? err),
      );

      import('./followed-team-watcher.service')
        .then(({ FollowedTeamWatcherService }) =>
          FollowedTeamWatcherService.syncTeamForUser(userId, team.competitorId),
        )
        .catch((err) =>
          logger.warn('[onboarding] follow sync failed (non-fatal):', err?.message ?? err),
        );
    }
  }
}

async function localClubsForCountry(
  country: CatalogCountry,
  language?: string | null,
): Promise<OnboardingClub[]> {
  const competitionId = resolveCountry365Competition(country.id);
  if (!competitionId) return [];

  try {
    const result = await footballDataCacheService.getCached365Standings(competitionId, language);
    const rows = result.data ?? [];
    const seen = new Set<number>();
    const clubs: OnboardingClub[] = [];
    for (const row of rows) {
      const competitorId = Number(row.teamId);
      if (!Number.isInteger(competitorId) || competitorId <= 0 || seen.has(competitorId)) continue;
      seen.add(competitorId);
      clubs.push({
        competitorId,
        name: row.teamName,
        nameAr: row.teamName,
        logo: row.teamLogo || `https://imagecache.365scores.com/image/upload/f_png,w_128,h_128,c_limit,q_auto:eco,dpr_2/v1/Competitors/${competitorId}`,
        country: country.nameEn,
        isLocal: true,
      });
      if (clubs.length >= LOCAL_ONBOARDING_CLUB_COUNT) break;
    }
    return clubs;
  } catch (err) {
    logger.warn('[onboarding] local standings failed:', (err as Error)?.message);
    return [];
  }
}

export class OnboardingService {
  static async maybeSeedCountryForNewUser(opts: {
    clerkUserId: string;
    userId: string;
    country?: string | null;
    countryFlag?: string | null;
    createdAt: Date;
    req: Request;
  }): Promise<CatalogCountry | null> {
    if (!shouldSeedCountry(opts)) return null;

    const resolved = await resolveGeoCountry({ clerkUserId: opts.clerkUserId, req: opts.req });
    if (!resolved) return null;

    await prisma.user.update({
      where: { id: opts.userId },
      data: {
        country: resolved.id,
        countryFlag: resolved.flag,
        location: resolved.name,
      },
    });

    awardXp({
      userId: opts.userId,
      action: 'PROFILE_FIFA_COUNTRY',
      idempotencyKey: 'profile.fifa.country.first',
      timezone: 'UTC',
    }).catch((err) => logger.warn('[onboarding] country XP failed:', err?.message ?? err));

    ProfileCompletionService.getCompletionStatus(opts.clerkUserId).catch(() => {});
    return resolved;
  }

  static async getSuggestedClubs(opts: {
    clerkUserId: string;
    req: Request;
    language?: string | null;
  }): Promise<{
    global: OnboardingClub[];
    local: OnboardingClub[];
    country: CatalogCountry | null;
    countryPersisted: boolean;
  }> {
    const user = await prisma.user.findUnique({
      where: { clerkUserId: opts.clerkUserId },
      select: {
        id: true,
        country: true,
        countryFlag: true,
        createdAt: true,
      },
    });

    if (!user) {
      return { global: GLOBAL_ONBOARDING_CLUBS, local: [], country: null, countryPersisted: false };
    }

    let persisted = mapCountryInput(user.country);
    const seeded = await this.maybeSeedCountryForNewUser({
      clerkUserId: opts.clerkUserId,
      userId: user.id,
      country: user.country,
      countryFlag: user.countryFlag,
      createdAt: user.createdAt,
      req: opts.req,
    });
    if (seeded) persisted = seeded;

    const countryForLocal =
      persisted ?? (await resolveGeoCountry({ clerkUserId: opts.clerkUserId, req: opts.req }));
    const local = countryForLocal ? await localClubsForCountry(countryForLocal, opts.language) : [];

    return {
      global: GLOBAL_ONBOARDING_CLUBS,
      local,
      country: countryForLocal,
      countryPersisted: Boolean(persisted),
    };
  }

  static async complete(opts: {
    clerkUserId: string;
    skipped: boolean;
    teams: OnboardingTeamInput[];
    language?: string;
    timezone?: string;
  }): Promise<{ alreadyCompleted: boolean; followed: number; fifaClubSet: boolean }> {
    const user = await prisma.user.findUnique({
      where: { clerkUserId: opts.clerkUserId },
      select: {
        id: true,
        country: true,
        favoriteTeam: true,
        clubLogo: true,
        teamOnboardingCompletedAt: true,
      },
    });

    if (!user) {
      throw Object.assign(new Error('User not found'), { code: 'NOT_FOUND' });
    }

    if (user.teamOnboardingCompletedAt) {
      return { alreadyCompleted: true, followed: 0, fifaClubSet: false };
    }

    const teams = opts.skipped ? [] : opts.teams.slice(0, MAX_ONBOARDING_TEAMS);
    if (teams.length > 0) {
      await followTeamsForUser(user.id, teams, opts.language);
    }

    let fifaClubSet = false;
    const userCountry = mapCountryInput(user.country);
    const fifaClub = pickFifaClubFromOnboarding(teams, userCountry);
    if (fifaClub && profileClubEmpty(user)) {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          favoriteTeam: fifaClub.name,
          clubLogo: fifaClub.logo ?? undefined,
          teamOnboardingCompletedAt: new Date(),
        },
      });
      fifaClubSet = true;
      awardXp({
        userId: user.id,
        action: 'PROFILE_FIFA_CLUB',
        idempotencyKey: 'profile.fifa.club.first',
        timezone: opts.timezone || 'UTC',
      }).catch((err) => logger.warn('[onboarding] club XP failed:', err?.message ?? err));
      ProfileCompletionService.getCompletionStatus(opts.clerkUserId).catch(() => {});
    } else {
      await prisma.user.update({
        where: { id: user.id },
        data: { teamOnboardingCompletedAt: new Date() },
      });
    }

    return { alreadyCompleted: false, followed: teams.length, fifaClubSet };
  }
}

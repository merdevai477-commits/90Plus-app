/**
 * Shared player navigation. Career is the default player destination.
 * Match statistics are only opened from a fixture context.
 */

type RouterLike = {
  push: (href: any) => unknown;
};

export interface PlayerCareerNavParams {
  athleteId: number;
  name?: string | null;
  photo?: string | null;
  teamName?: string | null;
  teamLogo?: string | null;
  teamId?: number | string | null;
}

export interface PlayerMatchStatsNavParams extends PlayerCareerNavParams {
  fixtureId: number;
  season?: string | number | null;
  dataSource?: '365' | 'api';
}

export function pushPlayerCareer(router: RouterLike, params: PlayerCareerNavParams): void {
  if (!params.athleteId) return;
  router.push({
    pathname: '/player-career',
    params: {
      athleteId: String(params.athleteId),
      id: String(params.athleteId),
      name: params.name ?? '',
      photo: params.photo ?? '',
      teamName: params.teamName ?? '',
      teamLogo: params.teamLogo ?? '',
      teamId: params.teamId != null && params.teamId !== '' ? String(params.teamId) : '',
      dataSource: '365',
    },
  });
}

export function pushPlayerMatchStats(router: RouterLike, params: PlayerMatchStatsNavParams): void {
  if (!params.athleteId || !params.fixtureId) return;
  router.push({
    pathname: '/player-profile',
    params: {
      id: String(params.athleteId),
      athleteId: String(params.athleteId),
      name: params.name ?? '',
      photo: params.photo ?? '',
      teamName: params.teamName ?? '',
      teamLogo: params.teamLogo ?? '',
      teamId: params.teamId != null && params.teamId !== '' ? String(params.teamId) : '',
      season: params.season != null ? String(params.season) : '',
      fixtureId: String(params.fixtureId),
      dataSource: params.dataSource ?? '365',
      fresh: '1',
    },
  });
}

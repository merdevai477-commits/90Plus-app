/**
 * Placeholder data for "خماسي الهدافين" — the player pool and fixtures of the
 * leagues the backend does not serve yet (see `TSF_LIVE_LEAGUES`). Live leagues
 * come from `liveData.ts`.
 */

import type { TsfLeagueKey } from './assets';

export type TsfPlayer = {
  readonly id: string;
  readonly name: string;
  readonly position: string;
  /** Broadcast-short, the length the design's fixture rows are drawn for. */
  readonly club: string;
  /**
   * Tallies shown on the picker card: the league season so far. For a live
   * league's pick they are the current gameweek's, the ones its pitch card
   * shows with `points`.
   */
  readonly goals: number;
  readonly assists: number;
  /** Live leagues only. */
  readonly points?: number;
  readonly photo?: string | null;
  readonly clubLogo?: string | null;
  /** Both spellings, so the picker's search finds a player in either language. */
  readonly nameAr?: string;
  readonly nameEn?: string | null;
  readonly live?: boolean;
  /** 365Scores ids, for the player profile. */
  readonly athleteId?: number | null;
  readonly teamId?: number | null;
  /** A saved pick the user can no longer change this gameweek. */
  readonly locked?: boolean;
  readonly confirmed?: boolean;
};

export const TSF_MOCK_PLAYERS: Record<TsfLeagueKey, readonly TsfPlayer[]> = {
  pl: [
    { id: 'pl-haaland', name: 'Erling Haaland', position: 'CF', club: 'Man City', goals: 18, assists: 3 },
    { id: 'pl-salah', name: 'Mohamed Salah', position: 'RW', club: 'Liverpool', goals: 14, assists: 9 },
    { id: 'pl-isak', name: 'Alexander Isak', position: 'CF', club: 'Liverpool', goals: 11, assists: 2 },
    { id: 'pl-watkins', name: 'Ollie Watkins', position: 'CF', club: 'Aston Villa', goals: 9, assists: 4 },
    { id: 'pl-palmer', name: 'Cole Palmer', position: 'AM', club: 'Chelsea', goals: 10, assists: 7 },
    { id: 'pl-saka', name: 'Bukayo Saka', position: 'RW', club: 'Arsenal', goals: 8, assists: 10 },
  ],
  laliga: [
    { id: 'll-mbappe', name: 'Kylian Mbappé', position: 'CF', club: 'Real Madrid', goals: 19, assists: 4 },
    { id: 'll-lewandowski', name: 'Robert Lewandowski', position: 'CF', club: 'Barcelona', goals: 15, assists: 2 },
    { id: 'll-vinicius', name: 'Vinícius Júnior', position: 'LW', club: 'Real Madrid', goals: 12, assists: 8 },
    { id: 'll-yamal', name: 'Lamine Yamal', position: 'RW', club: 'Barcelona', goals: 9, assists: 11 },
    { id: 'll-alvarez', name: 'Julián Álvarez', position: 'CF', club: 'Atlético', goals: 10, assists: 3 },
  ],
  bundesliga: [
    { id: 'bl-kane', name: 'Harry Kane', position: 'CF', club: 'Bayern', goals: 21, assists: 5 },
    { id: 'bl-olise', name: 'Michael Olise', position: 'RW', club: 'Bayern', goals: 8, assists: 9 },
    { id: 'bl-guirassy', name: 'Serhou Guirassy', position: 'CF', club: 'Dortmund', goals: 13, assists: 2 },
    { id: 'bl-musiala', name: 'Jamal Musiala', position: 'AM', club: 'Bayern', goals: 7, assists: 6 },
    { id: 'bl-schick', name: 'Patrik Schick', position: 'CF', club: 'Leverkusen', goals: 11, assists: 1 },
  ],
  seriea: [
    { id: 'sa-lautaro', name: 'Lautaro Martínez', position: 'CF', club: 'Inter', goals: 14, assists: 4 },
    { id: 'sa-thuram', name: 'Marcus Thuram', position: 'CF', club: 'Inter', goals: 10, assists: 5 },
    { id: 'sa-vlahovic', name: 'Dušan Vlahović', position: 'CF', club: 'Juventus', goals: 9, assists: 2 },
    { id: 'sa-leao', name: 'Rafael Leão', position: 'LW', club: 'Milan', goals: 8, assists: 7 },
    { id: 'sa-kean', name: 'Moise Kean', position: 'CF', club: 'Fiorentina', goals: 12, assists: 3 },
  ],
  ligue1: [
    { id: 'l1-dembele', name: 'Ousmane Dembélé', position: 'RW', club: 'PSG', goals: 13, assists: 6 },
    { id: 'l1-kvara', name: 'Khvicha Kvaratskhelia', position: 'LW', club: 'PSG', goals: 9, assists: 8 },
    { id: 'l1-barcola', name: 'Bradley Barcola', position: 'LW', club: 'PSG', goals: 10, assists: 5 },
    { id: 'l1-greenwood', name: 'Mason Greenwood', position: 'RW', club: 'Marseille', goals: 12, assists: 3 },
    { id: 'l1-doue', name: 'Désiré Doué', position: 'RW', club: 'PSG', goals: 7, assists: 9 },
  ],
};

export type TsfFixture = {
  readonly id: string;
  readonly home: string;
  readonly away: string;
  readonly homeLogo?: string | null;
  readonly awayLogo?: string | null;
  /** Kick-off instant; the row formats it in the active locale. */
  readonly kickoffISO: string;
  /** The picked player's line once the match's stats are stored. */
  readonly result?: {
    readonly goals: number;
    readonly assists: number;
    readonly points: number;
    readonly participation: string | null;
  };
};

/** Opponents a club is paired against, so every player gets a plausible run. */
const OPPONENTS: Record<TsfLeagueKey, readonly string[]> = {
  pl: ['Fulham', 'Wolves', 'Southampton', 'Tottenham', 'Bournemouth', 'Brentford'],
  laliga: ['Getafe', 'Osasuna', 'Sevilla', 'Valencia', 'Celta Vigo', 'Mallorca'],
  bundesliga: ['Mainz', 'Augsburg', 'Bremen', 'Freiburg', 'Hoffenheim', 'Union'],
  seriea: ['Torino', 'Bologna', 'Udinese', 'Lazio', 'Empoli', 'Genoa'],
  ligue1: ['Nantes', 'Rennes', 'Lille', 'Nice', 'Strasbourg', 'Lens'],
};

/** Kick-off times the design shows, reused in order. */
const KICKOFFS: readonly { hour: number; minute: number }[] = [
  { hour: 18, minute: 30 },
  { hour: 17, minute: 0 },
  { hour: 17, minute: 0 },
  { hour: 19, minute: 30 },
  { hour: 17, minute: 0 },
  { hour: 18, minute: 30 },
];

/**
 * Six upcoming fixtures for a player's club, a week apart from the coming
 * Saturday and alternating home and away. Anchoring to the next Saturday keeps
 * the list reading as upcoming however long the placeholder stays in.
 */
export function tsfMockFixtures(league: TsfLeagueKey, player: TsfPlayer): readonly TsfFixture[] {
  const opponents = OPPONENTS[league];
  const base = new Date();
  base.setDate(base.getDate() + ((6 - base.getDay() + 7) % 7));

  return KICKOFFS.map((slot, index) => {
    const kickoff = new Date(base);
    kickoff.setDate(base.getDate() + index * 7);
    kickoff.setHours(slot.hour, slot.minute, 0, 0);

    const opponent = opponents[index % opponents.length] ?? 'TBD';
    const atHome = index % 2 === 0;
    return {
      id: `${player.id}-${index}`,
      home: atHome ? player.club : opponent,
      away: atHome ? opponent : player.club,
      homeLogo: atHome ? player.clubLogo : null,
      awayLogo: atHome ? null : player.clubLogo,
      kickoffISO: kickoff.toISOString(),
    };
  });
}

export type TsfLeaderboardRow = {
  readonly id: string;
  /** Shared by tied players; falls back to list position when absent. */
  readonly rank?: number;
  readonly name: string;
  readonly xp: number;
  /** The signed-in player's row; its label comes from the locale, not here. */
  readonly isYou?: boolean;
  readonly avatar?: string | null;
};

/** Short name shown on a filled pitch card, e.g. "Erling Haaland" → "Haaland". */
export function tsfShortName(player: TsfPlayer): string {
  const parts = player.name.trim().split(/\s+/);
  return parts[parts.length - 1] ?? player.name;
}

export function tsfInitials(player: TsfPlayer): string {
  return initials(player.name);
}

/** Stands in for a club crest until badges ship, e.g. "Manchester City" → "MC". */
export function tsfClubInitials(club: string): string {
  return initials(club);
}

function initials(value: string): string {
  const parts = value.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? '' : '';
  return `${first}${last}`.toUpperCase();
}

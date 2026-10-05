/**
 * Placeholder player pool for "خماسي الهدافين" until the real list of
 * selectable players is decided. Nothing here comes from the API.
 */

import type { TsfLeagueKey } from './assets';

export type TsfPlayer = {
  readonly id: string;
  readonly name: string;
  readonly position: string;
  readonly club: string;
  /** Season tallies shown on the picker card. Placeholder, like the rest. */
  readonly goals: number;
  readonly assists: number;
};

export const TSF_MOCK_PLAYERS: Record<TsfLeagueKey, readonly TsfPlayer[]> = {
  pl: [
    { id: 'pl-haaland', name: 'Erling Haaland', position: 'CF', club: 'Manchester City', goals: 18, assists: 3 },
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
    { id: 'll-alvarez', name: 'Julián Álvarez', position: 'CF', club: 'Atlético Madrid', goals: 10, assists: 3 },
  ],
  bundesliga: [
    { id: 'bl-kane', name: 'Harry Kane', position: 'CF', club: 'Bayern München', goals: 21, assists: 5 },
    { id: 'bl-olise', name: 'Michael Olise', position: 'RW', club: 'Bayern München', goals: 8, assists: 9 },
    { id: 'bl-guirassy', name: 'Serhou Guirassy', position: 'CF', club: 'Borussia Dortmund', goals: 13, assists: 2 },
    { id: 'bl-musiala', name: 'Jamal Musiala', position: 'AM', club: 'Bayern München', goals: 7, assists: 6 },
    { id: 'bl-schick', name: 'Patrik Schick', position: 'CF', club: 'Bayer Leverkusen', goals: 11, assists: 1 },
  ],
  seriea: [
    { id: 'sa-lautaro', name: 'Lautaro Martínez', position: 'CF', club: 'Inter', goals: 14, assists: 4 },
    { id: 'sa-thuram', name: 'Marcus Thuram', position: 'CF', club: 'Inter', goals: 10, assists: 5 },
    { id: 'sa-vlahovic', name: 'Dušan Vlahović', position: 'CF', club: 'Juventus', goals: 9, assists: 2 },
    { id: 'sa-leao', name: 'Rafael Leão', position: 'LW', club: 'AC Milan', goals: 8, assists: 7 },
    { id: 'sa-kean', name: 'Moise Kean', position: 'CF', club: 'Fiorentina', goals: 12, assists: 3 },
  ],
  ligue1: [
    { id: 'l1-dembele', name: 'Ousmane Dembélé', position: 'RW', club: 'Paris Saint-Germain', goals: 13, assists: 6 },
    { id: 'l1-kvara', name: 'Khvicha Kvaratskhelia', position: 'LW', club: 'Paris Saint-Germain', goals: 9, assists: 8 },
    { id: 'l1-barcola', name: 'Bradley Barcola', position: 'LW', club: 'Paris Saint-Germain', goals: 10, assists: 5 },
    { id: 'l1-greenwood', name: 'Mason Greenwood', position: 'RW', club: 'Marseille', goals: 12, assists: 3 },
    { id: 'l1-doue', name: 'Désiré Doué', position: 'RW', club: 'Paris Saint-Germain', goals: 7, assists: 9 },
  ],
};

/** Short name shown on a filled pitch card, e.g. "Erling Haaland" → "Haaland". */
export function tsfShortName(player: TsfPlayer): string {
  const parts = player.name.trim().split(/\s+/);
  return parts[parts.length - 1] ?? player.name;
}

export function tsfInitials(player: TsfPlayer): string {
  const parts = player.name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? '' : '';
  return `${first}${last}`.toUpperCase();
}

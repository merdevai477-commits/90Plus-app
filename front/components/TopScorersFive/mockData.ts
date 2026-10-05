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
};

export const TSF_MOCK_PLAYERS: Record<TsfLeagueKey, readonly TsfPlayer[]> = {
  pl: [
    { id: 'pl-haaland', name: 'Erling Haaland', position: 'CF', club: 'Manchester City' },
    { id: 'pl-salah', name: 'Mohamed Salah', position: 'RW', club: 'Liverpool' },
    { id: 'pl-isak', name: 'Alexander Isak', position: 'CF', club: 'Liverpool' },
    { id: 'pl-watkins', name: 'Ollie Watkins', position: 'CF', club: 'Aston Villa' },
    { id: 'pl-palmer', name: 'Cole Palmer', position: 'AM', club: 'Chelsea' },
    { id: 'pl-saka', name: 'Bukayo Saka', position: 'RW', club: 'Arsenal' },
  ],
  laliga: [
    { id: 'll-mbappe', name: 'Kylian Mbappé', position: 'CF', club: 'Real Madrid' },
    { id: 'll-lewandowski', name: 'Robert Lewandowski', position: 'CF', club: 'Barcelona' },
    { id: 'll-vinicius', name: 'Vinícius Júnior', position: 'LW', club: 'Real Madrid' },
    { id: 'll-yamal', name: 'Lamine Yamal', position: 'RW', club: 'Barcelona' },
    { id: 'll-alvarez', name: 'Julián Álvarez', position: 'CF', club: 'Atlético Madrid' },
  ],
  bundesliga: [
    { id: 'bl-kane', name: 'Harry Kane', position: 'CF', club: 'Bayern München' },
    { id: 'bl-olise', name: 'Michael Olise', position: 'RW', club: 'Bayern München' },
    { id: 'bl-guirassy', name: 'Serhou Guirassy', position: 'CF', club: 'Borussia Dortmund' },
    { id: 'bl-musiala', name: 'Jamal Musiala', position: 'AM', club: 'Bayern München' },
    { id: 'bl-schick', name: 'Patrik Schick', position: 'CF', club: 'Bayer Leverkusen' },
  ],
  seriea: [
    { id: 'sa-lautaro', name: 'Lautaro Martínez', position: 'CF', club: 'Inter' },
    { id: 'sa-thuram', name: 'Marcus Thuram', position: 'CF', club: 'Inter' },
    { id: 'sa-vlahovic', name: 'Dušan Vlahović', position: 'CF', club: 'Juventus' },
    { id: 'sa-leao', name: 'Rafael Leão', position: 'LW', club: 'AC Milan' },
    { id: 'sa-kean', name: 'Moise Kean', position: 'CF', club: 'Fiorentina' },
  ],
  ligue1: [
    { id: 'l1-dembele', name: 'Ousmane Dembélé', position: 'RW', club: 'Paris Saint-Germain' },
    { id: 'l1-kvara', name: 'Khvicha Kvaratskhelia', position: 'LW', club: 'Paris Saint-Germain' },
    { id: 'l1-barcola', name: 'Bradley Barcola', position: 'LW', club: 'Paris Saint-Germain' },
    { id: 'l1-greenwood', name: 'Mason Greenwood', position: 'RW', club: 'Marseille' },
    { id: 'l1-doue', name: 'Désiré Doué', position: 'RW', club: 'Paris Saint-Germain' },
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

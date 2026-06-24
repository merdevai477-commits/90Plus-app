/** Parse "Estadio AKRON (Guadalajara)" → name + city. */
export function parseVenueLabel(raw: string | null | undefined): {
  name: string;
  city: string | null;
} {
  const trimmed = (raw ?? '').trim();
  if (!trimmed) return { name: '', city: null };
  const paren = trimmed.match(/^(.+?)\s*\(([^)]+)\)\s*$/);
  if (paren) {
    return { name: paren[1].trim(), city: paren[2].trim() };
  }
  return { name: trimmed, city: null };
}

function normalizeStadiumKey(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\u0600-\u06FF]/g, '');
}

/** Wikimedia fallback images for venues that often lack API-Football photos. */
const STADIUM_FALLBACK_IMAGES: Record<string, string> = {
  estadioakron:
    'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4d/Estadio_Omnilife_Chivas_%28Estadio_Akron%29.jpg/1280px-Estadio_Omnilife_Chivas_%28Estadio_Akron%29.jpg',
  akron:
    'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4d/Estadio_Omnilife_Chivas_%28Estadio_Akron%29.jpg/1280px-Estadio_Omnilife_Chivas_%28Estadio_Akron%29.jpg',
  estadioazteca:
    'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4c/Estadio_Azteca_2015.jpg/1280px-Estadio_Azteca_2015.jpg',
  azteca:
    'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4c/Estadio_Azteca_2015.jpg/1280px-Estadio_Azteca_2015.jpg',
  lumenfield:
    'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7a/Lumen_Field_2019.jpg/1280px-Lumen_Field_2019.jpg',
  mercedesbenzstadium:
    'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5c/Mercedes-Benz_Stadium_%28Atlanta%29.jpg/1280px-Mercedes-Benz_Stadium_%28Atlanta%29.jpg',
  metlifestadium:
    'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6e/MetLife_Stadium_Exterior.jpg/1280px-MetLife_Stadium_Exterior.jpg',
  sofistadium:
    'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1e/SoFi_Stadium_interior_2021.jpg/1280px-SoFi_Stadium_interior_2021.jpg',
  attstadium:
    'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3e/AT%26T_Stadium_field.jpg/1280px-AT%26T_Stadium_field.jpg',
  hardrockstadium:
    'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9f/Hard_Rock_Stadium_%28August_2019%29.jpg/1280px-Hard_Rock_Stadium_%28August_2019%29.jpg',
  nrgstadium:
    'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8e/NRG_Stadium_%28Houston%29.jpg/1280px-NRG_Stadium_%28Houston%29.jpg',
  arrowheadstadium:
    'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7e/Arrowhead_Stadium_%28August_2019%29.jpg/1280px-Arrowhead_Stadium_%28August_2019%29.jpg',
  gilletteestadium:
    'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2e/Gillette_Stadium_2010.jpg/1280px-Gillette_Stadium_2010.jpg',
  levistadium:
    'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4b/Levi%27s_Stadium_exterior_2014.jpg/1280px-Levi%27s_Stadium_exterior_2014.jpg',
  bcplacestadium:
    'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1a/BC_Place_%28August_2015%29.jpg/1280px-BC_Place_%28August_2015%29.jpg',
  bmobankofmontrealstadium:
    'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1a/BC_Place_%28August_2015%29.jpg/1280px-BC_Place_%28August_2015%29.jpg',
};

export function getStadiumFallbackImage(stadiumName: string | null | undefined): string | null {
  if (!stadiumName?.trim()) return null;
  const key = normalizeStadiumKey(stadiumName);
  if (STADIUM_FALLBACK_IMAGES[key]) return STADIUM_FALLBACK_IMAGES[key];
  for (const [needle, url] of Object.entries(STADIUM_FALLBACK_IMAGES)) {
    if (key.includes(needle) || needle.includes(key)) return url;
  }
  return null;
}

export function resolveStadiumImageUrl(
  apiImage: string | null | undefined,
  stadiumName: string | null | undefined,
): string | null {
  if (apiImage?.trim()) return apiImage.trim();
  return getStadiumFallbackImage(stadiumName);
}

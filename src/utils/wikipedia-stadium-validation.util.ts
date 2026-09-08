/** Wikipedia summary checks so we never treat a person/club page as a stadium. */

const PERSON_RE =
  /\b(footballer|soccer player|politician|president|chairman|manager|head coach|coach|player|striker|midfielder|goalkeeper|defender|businessman|businesswoman|singer|actor|actress|journalist|born|died)\b/i;

const PERSON_YEARS_RE = /\(\s*\d{4}\s*[–\-]\s*(?:\d{4}|present)\s*\)|\b\d{4}\s*[–\-]\s*\d{4}\b/;

const PERSON_AR_RE = /لاعب|رئیس|رئيس|مدرب|سياسي/;

const VENUE_RE =
  /\b(stadium|stadia|stadion|stade|estadio|estádio|stadio|arena|venue|ground|grounds|sports complex|football ground|ballpark|coliseum|amphitheatre)\b/i;

const VENUE_AR_RE = /ملعب|استاد|ستاد/;

export type WikipediaStadiumCandidate = {
  type?: string | null;
  title?: string | null;
  description?: string | null;
  latitude?: number | null;
  longitude?: number | null;
};

export function hasPersonWikipediaSignal(text: string): boolean {
  const hay = text.trim();
  if (!hay) return false;
  return PERSON_RE.test(hay) || PERSON_YEARS_RE.test(hay) || PERSON_AR_RE.test(hay);
}

export function hasVenueWikipediaSignal(text: string): boolean {
  const hay = text.trim();
  if (!hay) return false;
  return VENUE_RE.test(hay) || VENUE_AR_RE.test(hay);
}

export function hasWikipediaCoordinates(
  latitude?: number | null,
  longitude?: number | null,
): boolean {
  return typeof latitude === 'number' && Number.isFinite(latitude)
    && typeof longitude === 'number' && Number.isFinite(longitude);
}

/**
 * Accept only pages that look like a stadium/venue. Never accept a person page
 * just because it has a thumbnail.
 */
export function isValidStadiumWikipediaSummary(candidate: WikipediaStadiumCandidate): boolean {
  if ((candidate.type ?? '').toLowerCase() === 'disambiguation') return false;
  const title = (candidate.title ?? '').trim();
  const description = (candidate.description ?? '').trim();
  const combined = `${title} ${description}`.trim();
  if (!combined) return false;
  if (hasPersonWikipediaSignal(combined)) return false;

  const venueInDescription = hasVenueWikipediaSignal(description);
  const venueInTitle = hasVenueWikipediaSignal(title);
  if (!venueInDescription && !venueInTitle) return false;

  const hasCoords = hasWikipediaCoordinates(candidate.latitude, candidate.longitude);
  if (!hasCoords && !venueInDescription) return false;
  return true;
}

/**
 * 365Scores athlete headshot URL.
 *
 * Prefer the generic `Athletes/{id}` path (same as coaches) — `Athletes/NationalTeam/{id}`
 * often returns only the tiny default silhouette (~2KB) even when a real headshot exists.
 */
export function buildScores365AthletePhotoUrl(
  athleteId: number,
  size: 68 | 80 | 250 = 80,
  imageVersion?: number | null,
): string {
  const versionSegment =
    imageVersion != null && imageVersion > 0 ? `v${imageVersion}/` : '';
  return (
    `https://imagecache.365scores.com/image/upload/` +
    `f_png,w_${size},h_${size},c_limit,q_auto:eco,dpr_2,` +
    `d_Athletes:default.png,r_max,c_thumb,g_face,z_0.65/` +
    `${versionSegment}Athletes/${athleteId}`
  );
}

/** Legacy NationalTeam path — keep as a secondary candidate only. */
export function buildScores365AthleteNationalTeamPhotoUrl(
  athleteId: number,
  size: 68 | 80 | 250 = 80,
): string {
  return (
    `https://imagecache.365scores.com/image/upload/` +
    `f_png,w_${size},h_${size},c_limit,q_auto:eco,dpr_2,` +
    `d_Athletes:default.png,r_max,c_thumb,g_face,z_0.65/` +
    `Athletes/NationalTeam/${athleteId}`
  );
}

/** Rewrite stale NationalTeam URLs (cached API responses / route params) to Athletes/. */
export function preferScores365AthletesPhotoUrl(
  url: string | null | undefined,
): string | undefined {
  if (!url) return undefined;
  return url.replace('/Athletes/NationalTeam/', '/Athletes/');
}

/** Route params often truncate Cloudinary URLs at commas — ignore broken copies. */
export function isComplete365AthletePhotoUrl(url: string | null | undefined): boolean {
  const trimmed = url?.trim();
  if (!trimmed || !trimmed.includes('imagecache.365scores.com')) return false;
  if (!/\/Athletes\/\d+/.test(trimmed)) return false;
  return /w_\d+,h_\d+/.test(trimmed);
}

/** Ordered CDN candidates for a 365 athlete headshot. */
export function scores365AthletePhotoCandidates(
  athleteId: number,
  preferred?: string | null,
  size: 68 | 80 | 250 = 80,
  imageVersion?: number | null,
): string[] {
  const urls: string[] = [];
  if (athleteId > 0) {
    urls.push(buildScores365AthletePhotoUrl(athleteId, size, imageVersion));
    urls.push(buildScores365AthleteNationalTeamPhotoUrl(athleteId, size));
  }
  const preferredFixed = preferScores365AthletesPhotoUrl(preferred?.trim() || null);
  if (preferredFixed && isComplete365AthletePhotoUrl(preferredFixed)) {
    urls.push(preferredFixed);
  }
  return [...new Set(urls)];
}

/** 365Scores coach headshot (Athletes path — not NationalTeam). */
export function buildScores365CoachPhotoUrl(
  coachAthleteId: number,
  size: 68 | 80 | 250 = 80,
  imageVersion?: number | null,
): string {
  const versionSegment =
    imageVersion != null && imageVersion > 0 ? `v${imageVersion}/` : '';
  return (
    `https://imagecache.365scores.com/image/upload/` +
    `f_png,w_${size},h_${size},c_limit,q_auto:eco,dpr_2,` +
    `d_Athletes:default.png,r_max,c_thumb,g_face,z_0.65/` +
    `${versionSegment}Athletes/${coachAthleteId}`
  );
}

export function isScores365ImageUrl(url?: string | null): boolean {
  return !!url && url.includes('imagecache.365scores.com');
}

/** Rewrite Cloudinary w/h on a 365 image URL so list rows don't fetch header-size assets. */
export function with365ImageSize(
  url: string | null | undefined,
  size: number,
): string | undefined {
  if (!url) return undefined;
  const fixed = preferScores365AthletesPhotoUrl(url) ?? url;
  if (!fixed.includes('imagecache.365scores.com')) return fixed;
  return fixed.replace(/w_\d+,h_\d+/, `w_${size},h_${size}`);
}

/** Larger asset for fullscreen photo viewer (365 URLs only; others pass through). */
export function toFullscreenPhotoUrl(url?: string | null, size = 512): string | undefined {
  const trimmed = url?.trim();
  if (!trimmed) return undefined;
  return with365ImageSize(trimmed, size) ?? trimmed;
}

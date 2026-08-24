/**
 * 365Scores athlete headshot URL.
 *
 * Prefer the generic `Athletes/{id}` path (same as coaches). The older
 * `Athletes/NationalTeam/{id}` path often returns only the default silhouette
 * (~2KB) even when a real headshot exists on `Athletes/{id}`.
 */
export function buildScores365AthletePhotoUrl(
  athleteId: number,
  size: number = 80,
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

/** Legacy NationalTeam path — secondary candidate only. */
export function buildScores365AthleteNationalTeamPhotoUrl(
  athleteId: number,
  size: number = 80,
): string {
  return (
    `https://imagecache.365scores.com/image/upload/` +
    `f_png,w_${size},h_${size},c_limit,q_auto:eco,dpr_2,` +
    `d_Athletes:default.png,r_max,c_thumb,g_face,z_0.65/` +
    `Athletes/NationalTeam/${athleteId}`
  );
}

/**
 * 365Scores coach headshot URL. Coaches use the generic Athletes path.
 * When `imageVersion` is present, insert `/v{n}/` as 365's CDN expects.
 */
export function buildScores365CoachPhotoUrl(
  coachId: number,
  size: 68 | 80 = 80,
  imageVersion?: number | null,
): string {
  const versionSegment =
    imageVersion != null && imageVersion > 0 ? `v${imageVersion}/` : '';
  return (
    `https://imagecache.365scores.com/image/upload/` +
    `f_png,w_${size},h_${size},c_limit,q_auto:eco,dpr_2,` +
    `d_Athletes:default.png,r_max,c_thumb,g_face,z_0.65/` +
    `${versionSegment}Athletes/${coachId}`
  );
}

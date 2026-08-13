/**
 * 365Scores athlete headshot URL (NationalTeam path — no imageVersion).
 */
export function buildScores365AthletePhotoUrl(
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

/** 365Scores coach headshot (Athletes path — not NationalTeam). */
export function buildScores365CoachPhotoUrl(
  coachAthleteId: number,
  size: 68 | 80 = 80,
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
  if (!url.includes('imagecache.365scores.com')) return url;
  return url.replace(/w_\d+,h_\d+/, `w_${size},h_${size}`);
}

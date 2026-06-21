/**
 * 365Scores athlete headshot URL (NationalTeam path — no imageVersion).
 */
export function buildScores365AthletePhotoUrl(
  athleteId: number,
  size: 68 | 80 = 80,
): string {
  return (
    `https://imagecache.365scores.com/image/upload/` +
    `f_png,w_${size},h_${size},c_limit,q_auto:eco,dpr_2,` +
    `d_Athletes:default.png,r_max,c_thumb,g_face,z_0.65/` +
    `Athletes/NationalTeam/${athleteId}`
  );
}

export function isScores365ImageUrl(url?: string | null): boolean {
  return !!url && url.includes('imagecache.365scores.com');
}

/**
 * Prisma User follow relations use inverted names on the User model:
 * - `_count.followers` = outgoing follows (user is followerId) → following count
 * - `_count.following` = incoming follows (user is followingId) → followers count
 */
export function followCountsFromPrisma(_count: { followers: number; following: number }) {
  return {
    followersCount: _count.following,
    followingCount: _count.followers,
  };
}

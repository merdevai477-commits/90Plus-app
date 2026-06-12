import { useUser } from '@clerk/clerk-expo';
import { useEffect, useState } from 'react';

import { globalState } from '@/globalState';

function readAvatarFromGlobal(clerkImageUrl?: string | null): string | null {
  return (
    globalState.localAvatar ||
    globalState.userProfile?.avatar ||
    clerkImageUrl ||
    null
  );
}

/**
 * Lightweight avatar for the tab bar — no React Query / API on the hot path.
 * Profile screen updates globalState; we refresh when Clerk image changes or tabs move.
 */
export function useProfileTabAvatar(pathname?: string | null): string | null {
  const { user: clerkUser } = useUser();
  const clerkImageUrl = clerkUser?.imageUrl ?? null;
  const [avatar, setAvatar] = useState<string | null>(() =>
    readAvatarFromGlobal(clerkImageUrl),
  );

  useEffect(() => {
    setAvatar(readAvatarFromGlobal(clerkImageUrl));
  }, [clerkImageUrl, pathname]);

  return avatar;
}

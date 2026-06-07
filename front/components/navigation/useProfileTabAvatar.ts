import { useUser } from '@clerk/clerk-expo';
import { useEffect, useState } from 'react';

import { globalState } from '@/globalState';
import { useMyProfileBasics } from '@/hooks/useMyProfileBasics';

export function useProfileTabAvatar(): string | null {
  const { user: clerkUser } = useUser();
  const { data: profileBasics } = useMyProfileBasics();
  const [localAvatar, setLocalAvatar] = useState(globalState.localAvatar);

  useEffect(() => {
    setLocalAvatar(globalState.localAvatar);
  }, [profileBasics?.avatar, clerkUser?.imageUrl]);

  return localAvatar || profileBasics?.avatar || clerkUser?.imageUrl || null;
}

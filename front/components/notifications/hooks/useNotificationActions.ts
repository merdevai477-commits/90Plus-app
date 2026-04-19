import { useCallback } from 'react';
import { useAuth } from '@clerk/clerk-expo';
import { NotificationService } from '../../../src/services/authService';

export function useNotificationActions() {
  const { getToken } = useAuth();

  const markAsRead = useCallback(
    async (notificationId: string) => {
      const token = await getToken();
      if (!token) return false;
      return NotificationService.markAsRead(token, notificationId);
    },
    [getToken]
  );

  const deleteNotification = useCallback(
    async (notificationId: string) => {
      const token = await getToken();
      if (!token) return false;
      return NotificationService.deleteNotification(token, notificationId);
    },
    [getToken]
  );

  const markAllAsRead = useCallback(async () => {
    const token = await getToken();
    if (!token) return false;
    return NotificationService.markAllAsRead(token);
  }, [getToken]);

  const clearAll = useCallback(async () => {
    const token = await getToken();
    if (!token) return false;
    return NotificationService.clearAll(token);
  }, [getToken]);

  return {
    markAsRead,
    deleteNotification,
    markAllAsRead,
    clearAll,
  };
}


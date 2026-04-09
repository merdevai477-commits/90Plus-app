import { useEffect, useMemo, useState } from 'react';
import type { SocialNotification } from '../../../src/services/authService';

type TabKey = 'all' | 'unread' | 'mentions';

type ParsedNotification = SocialNotification & {
  _parsedData: {
    actorName: string;
    titleLower: string;
    messageLower: string;
  };
};

function safeParseNotificationData(data: SocialNotification['data']): Record<string, any> {
  if (!data) return {};
  if (typeof data === 'object') return data as Record<string, any>;

  try {
    const parsed = JSON.parse(data);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function parseNotification(n: SocialNotification): ParsedNotification {
  const data = safeParseNotificationData(n.data);
  const actorName = (
    data?.actorDisplayName ||
    data?.actorUsername ||
    data?.followerUsername ||
    data?.username ||
    ''
  ).toLowerCase();

  return {
    ...n,
    _parsedData: {
      actorName,
      titleLower: (n.title || '').toLowerCase(),
      messageLower: (n.message || '').toLowerCase(),
    },
  };
}

export function useNotificationFilters(notifications: SocialNotification[]) {
  const [activeTab, setActiveTab] = useState<TabKey>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearchQuery(searchQuery), 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const parsedNotifications = useMemo(() => notifications.map(parseNotification), [notifications]);

  const filteredNotifications = useMemo(() => {
    let filtered = parsedNotifications;

    if (activeTab === 'unread') {
      filtered = filtered.filter(n => !n.isRead);
    } else if (activeTab === 'mentions') {
      filtered = filtered.filter(n => n.type === 'MENTION');
    }

    const q = debouncedSearchQuery.trim().toLowerCase();
    if (q) {
      filtered = filtered.filter(n => {
        const { actorName, titleLower, messageLower } = n._parsedData;
        return titleLower.includes(q) || messageLower.includes(q) || actorName.includes(q);
      });
    }

    return filtered;
  }, [parsedNotifications, activeTab, debouncedSearchQuery]);

  return {
    filteredNotifications,
    activeTab,
    setActiveTab,
    searchQuery,
    setSearchQuery,
    debouncedSearchQuery,
  };
}


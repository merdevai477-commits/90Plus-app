import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Dimensions,
  RefreshControl,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useAuth } from '@clerk/clerk-expo';
import { ChevronLeft } from 'lucide-react-native';

import { ReelsService, type ReelFeedItem } from '../src/services/authService';
import { useTranslation } from '../src/i18n';
import { getAppFont } from '../utils/fontSetup';
import { FIGMA_PRIMARY } from '../components/reels/constants';
import { logger } from '../utils/logger';

const BG = '#FFFFFF';
const TEXT = '#1A1040';
const MUTED = '#8B849E';
const SOFT = '#EDE6FF';
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const H_PAD = 16;
const GAP = 12;
const COLS = 2;
const TILE_W = (SCREEN_WIDTH - H_PAD * 2 - GAP) / COLS;
const TILE_H = TILE_W * (16 / 9);

export default function SavedReelsScreen() {
  const { t, language } = useTranslation();
  const insets = useSafeAreaInsets();
  const { getToken } = useAuth();
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;

  const fonts = useMemo(
    () => ({
      regular: getAppFont(400, language),
      bold: getAppFont(700, language),
    }),
    [language],
  );

  const [items, setItems] = useState<ReelFeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const loadingMoreRef = useRef(false);

  const load = useCallback(async (cursor?: string, replace = false) => {
    try {
      const token = await getTokenRef.current();
      if (!token) {
        setError('auth');
        setItems([]);
        setHasMore(false);
        setNextCursor(null);
        return;
      }
      const result = await ReelsService.getSavedReels(token, cursor);
      if (!result) {
        setError('failed');
        if (replace || !cursor) setItems([]);
        return;
      }
      setError(null);
      setItems((prev) => (replace || !cursor ? result.savedReels : [...prev, ...result.savedReels]));
      setNextCursor(result.nextCursor);
      setHasMore(Boolean(result.hasMore));
    } catch (err) {
      logger.error('[SavedReels] load failed', err);
      setError('failed');
      if (replace || !cursor) setItems([]);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    load(undefined, true).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load(undefined, true);
    setRefreshing(false);
  }, [load]);

  const onEndReached = useCallback(async () => {
    if (!hasMore || loadingMoreRef.current || !nextCursor) return;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    try {
      await load(nextCursor);
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  }, [hasMore, load, nextCursor]);

  const errorMessage =
    error === 'auth'
      ? t.reels.authFailed || t.profile.savedLoadFailed
      : error
        ? t.profile.savedLoadFailed
        : null;

  return (
    <View style={[styles.root, { paddingTop: Math.max(insets.top, 12) }]}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.back()}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <ChevronLeft size={22} color={FIGMA_PRIMARY} strokeWidth={2.6} />
        </TouchableOpacity>
        <Text style={[styles.title, { fontFamily: fonts.bold }]}>{t.reels.savedScreenTitle}</Text>
      </View>
      <View style={styles.divider} />

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={FIGMA_PRIMARY} />
        </View>
      ) : errorMessage ? (
        <View style={styles.center}>
          <Text style={[styles.emptyText, { fontFamily: fonts.regular }]}>{errorMessage}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => void onRefresh()}>
            <Text style={[styles.retryText, { fontFamily: fonts.bold }]}>{t.reels.feedErrorRetry}</Text>
          </TouchableOpacity>
        </View>
      ) : items.length === 0 ? (
        <View style={styles.center}>
          <Text style={[styles.emptyText, { fontFamily: fonts.regular }]}>
            {t.reels.savedEmpty}
          </Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          numColumns={COLS}
          columnWrapperStyle={styles.row}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={FIGMA_PRIMARY} />
          }
          onEndReached={onEndReached}
          onEndReachedThreshold={0.4}
          ListFooterComponent={
            loadingMore ? (
              <ActivityIndicator style={{ marginVertical: 16 }} color={FIGMA_PRIMARY} />
            ) : null
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.tile}
              activeOpacity={0.88}
              onPress={() =>
                router.push({
                  pathname: '/(tabs)/reels',
                  params: { reelId: item.id },
                })
              }
            >
              <Image
                source={{ uri: item.thumbnail || undefined }}
                style={styles.thumb}
                contentFit="cover"
              />
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BG,
  },
  header: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: H_PAD,
    marginBottom: 8,
  },
  title: {
    color: TEXT,
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
  },
  backBtn: {
    position: 'absolute',
    left: H_PAD,
    zIndex: 2,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: SOFT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#E8E4F0',
    marginBottom: 12,
  },
  list: {
    paddingHorizontal: H_PAD,
    paddingBottom: 32,
  },
  row: {
    gap: GAP,
    marginBottom: GAP,
  },
  tile: {
    width: TILE_W,
    height: TILE_H,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#EDE8F8',
  },
  thumb: {
    width: '100%',
    height: '100%',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 14,
  },
  emptyText: {
    color: MUTED,
    fontSize: 15,
    textAlign: 'center',
  },
  retryBtn: {
    backgroundColor: SOFT,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 14,
  },
  retryText: {
    color: FIGMA_PRIMARY,
    fontSize: 14,
    fontWeight: '700',
  },
});

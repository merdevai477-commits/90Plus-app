/**
 * GroupInviteSheet — bottom sheet to search users and invite them to the group.
 */

import { useAuth } from '@clerk/clerk-expo';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Search, UserPlus, Users, X } from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
  ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { COMPACT_TAB_BAR_HEIGHT } from '../navigation/liquidGlassTabBar.constants';
import { useToast } from '../../contexts/ToastContext';
import { useTranslation } from '../../src/i18n';
import { type SearchUserResult } from '../../src/services/authService';
import { getApiUrl } from '../../config/api.config';
import { isLiquidGlassSupported, LiquidGlassView } from '../../utils/liquidGlassSafe';
import { SheetBlurBackdrop } from './SheetBlurBackdrop';
import { PG, PG_RADII, PG_SPACING, PG_TYPE, usePGFonts } from './theme';

const API_URL = getApiUrl();

const PLACEHOLDER = require('../../assets/images/plear 90Plus.png');

const SheetGlass = isLiquidGlassSupported ? LiquidGlassView : BlurView;
const SHEET_GLASS_PROPS = isLiquidGlassSupported
  ? { effect: 'regular' as const, tintColor: 'rgba(15,5,25,0.99)' }
  : { intensity: Platform.OS === 'android' ? 40 : 30, tint: 'dark' as const };

export interface GroupInviteSheetProps {
  visible: boolean;
  onClose: () => void;
  groupName: string;
  inviteCode: string;
  isRTL?: boolean;
  onInviteUser?: (userId: string) => Promise<void>;
  excludeUserIds?: string[];
}

export function GroupInviteSheet({
  visible,
  onClose,
  groupName,
  inviteCode,
  isRTL = false,
  onInviteUser,
  excludeUserIds = [],
}: GroupInviteSheetProps) {
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const toast = useToast();
  const { t } = useTranslation();
  const inv = t.predictionGroups.inviteSheet;
  const common = t.predictionGroups.common;
  const { getToken } = useAuth();
  const { medium, bold, extra } = usePGFonts();

  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [errored, setErrored] = useState(false);
  const [results, setResults] = useState<SearchUserResult[]>([]);
  const [invitedIds, setInvitedIds] = useState<Set<string>>(() => new Set());

  const row: ViewStyle = { flexDirection: isRTL ? 'row-reverse' : 'row' };
  const textAlign = isRTL ? 'right' : 'left';

  const wasVisibleRef = useRef(visible);
  const excludeSet = useMemo(() => new Set(excludeUserIds), [excludeUserIds]);

  useEffect(() => {
    if (wasVisibleRef.current && !visible) {
      setQuery('');
      setResults([]);
      setLoading(false);
      setErrored(false);
      setInvitedIds(new Set());
    }
    wasVisibleRef.current = visible;
  }, [visible]);

  useEffect(() => {
    if (!visible) return;

    const q = query.trim();
    if (q.length < 2) {
      setResults((prev) => (prev.length > 0 ? [] : prev));
      setLoading((prev) => (prev ? false : prev));
      setErrored(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setErrored(false);

    const timer = setTimeout(() => {
      void (async () => {
        // Direct fetch (not AuthService.searchUsers, which swallows errors and
        // returns []) so we can tell "no results" apart from a real failure.
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 12000);
        try {
          const token = await getToken();
          if (cancelled) return;
          if (!token) {
            console.warn('[GroupInvite] search skipped — no auth token');
            setResults([]);
            setErrored(true);
            return;
          }

          const url = `${API_URL}/clerk/search?q=${encodeURIComponent(q)}&limit=20`;
          const res = await fetch(url, {
            method: 'GET',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            signal: controller.signal,
          });
          const data = await res.json().catch(() => null);
          if (cancelled) return;

          if (!res.ok || !data || data.status !== 'SUCCESS') {
            console.warn('[GroupInvite] search failed', res.status, data?.message ?? '');
            setResults([]);
            setErrored(true);
            return;
          }

          const users = (data.data?.users ?? []) as SearchUserResult[];
          const filtered = users.filter((u) => !excludeSet.has(u.id));
          console.log(`[GroupInvite] search "${q}" → ${users.length} users, ${filtered.length} after exclude`);
          setResults(filtered);
        } catch (err: any) {
          if (!cancelled) {
            console.warn('[GroupInvite] search error', err?.message ?? err);
            setResults([]);
            setErrored(true);
          }
        } finally {
          clearTimeout(timeout);
          if (!cancelled) setLoading(false);
        }
      })();
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // getToken from Clerk is unstable — call it inside the async handler only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, visible]);

  const handleInvite = useCallback(
    async (user: SearchUserResult) => {
      try {
        if (onInviteUser) await onInviteUser(user.id);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        setInvitedIds((prev) => new Set(prev).add(user.id));
        const label = user.displayName || user.username;
        toast.showSuccess(inv.invitedTitle, inv.invitedBody.replace('{name}', label));
      } catch (e: any) {
        toast.showError(inv.sendFailed, e?.message ?? t.predictionGroups.onboarding.tryAgain);
      }
    },
    [inv, onInviteUser, t.predictionGroups.onboarding.tryAgain, toast],
  );

  const emptyHint = useMemo(() => {
    if (query.trim().length < 2) return inv.searchHint;
    if (loading) return null;
    if (results.length > 0) return null;
    if (errored) return inv.searchError;
    return inv.noResults;
  }, [query, loading, errored, results.length, inv]);

  const sheetBottomPad = insets.bottom + COMPACT_TAB_BAR_HEIGHT + 20;
  // Numeric caps (percentage maxHeight misbehaves against an absolutely-
  // positioned parent with no explicit height, which clipped the sheet).
  const topGap = insets.top + 24;
  const maxSheetHeight = Math.max(320, windowHeight - sheetBottomPad - topGap);
  // Space taken by the handle + header + search row before the list.
  const listMaxHeight = Math.max(160, maxSheetHeight - 210);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      presentationStyle="overFullScreen"
      onRequestClose={onClose}
    >
      <View style={styles.modalRoot}>
        <SheetBlurBackdrop onPress={onClose} />

      <View style={[styles.sheet, { paddingBottom: sheetBottomPad }]}>
        <SheetGlass {...SHEET_GLASS_PROPS} style={[styles.sheetGlass, { maxHeight: maxSheetHeight }]}>
          <LinearGradient
            colors={['rgba(124,58,237,0.14)', 'transparent']}
            style={StyleSheet.absoluteFillObject}
            pointerEvents="none"
          />
          <View style={styles.sheetTint} pointerEvents="none" />

          <View style={styles.handle} />

          <View style={[styles.header, row]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.title, { fontFamily: extra, textAlign }]}>{inv.title}</Text>
              <Text style={[styles.sub, { fontFamily: medium, textAlign }]} numberOfLines={1}>
                {groupName} · {inviteCode}
              </Text>
            </View>
            <Pressable onPress={onClose} hitSlop={10} style={styles.closeBtn}>
              <X size={20} color={PG.textSecondary} />
            </Pressable>
          </View>

          <View style={[styles.searchRow, row]}>
            <Search size={18} color={PG.primaryLight} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder={inv.searchPlaceholder}
              placeholderTextColor={PG.textMuted}
              style={[styles.searchInput, { fontFamily: medium, textAlign }]}
              autoCorrect={false}
              autoCapitalize="none"
              returnKeyType="search"
            />
            {query.length > 0 && (
              <Pressable onPress={() => setQuery('')} hitSlop={8}>
                <X size={16} color={PG.textMuted} />
              </Pressable>
            )}
          </View>

          <View style={styles.body}>
            {loading ? (
              <ActivityIndicator color={PG.primaryLight} style={styles.loader} />
            ) : emptyHint ? (
              <View style={styles.emptyWrap}>
                <View style={styles.emptyIcon}>
                  <Users size={22} color={PG.primaryLight} />
                </View>
                <Text style={[styles.empty, { fontFamily: medium, textAlign }]}>{emptyHint}</Text>
              </View>
            ) : (
              <ScrollView
                style={[styles.list, { maxHeight: listMaxHeight }]}
                contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 16 }]}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
              {results.map((user) => {
                const sent = invitedIds.has(user.id);
                const name = user.displayName || user.username;
                return (
                  <View key={user.id} style={[styles.userRow, row]}>
                    <Image
                      source={user.avatar ? { uri: user.avatar } : PLACEHOLDER}
                      style={styles.avatar}
                      contentFit="cover"
                      cachePolicy="memory-disk"
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.userName, { fontFamily: bold, textAlign }]} numberOfLines={1}>
                        {name}
                      </Text>
                      <Text style={[styles.userHandle, { fontFamily: medium, textAlign }]} numberOfLines={1}>
                        @{user.username}
                      </Text>
                    </View>
                    <Pressable
                      onPress={() => !sent && handleInvite(user)}
                      disabled={sent}
                      style={({ pressed }) => [
                        styles.inviteBtn,
                        row,
                        sent && styles.inviteBtnSent,
                        pressed && !sent && { opacity: 0.85 },
                      ]}
                    >
                      <UserPlus size={15} color={sent ? PG.textMuted : PG.text} />
                      <Text style={[styles.inviteTxt, { fontFamily: bold, color: sent ? PG.textMuted : PG.text }]}>
                        {sent ? common.invited : common.invite}
                      </Text>
                    </Pressable>
                  </View>
                );
              })}
              </ScrollView>
            )}
          </View>
        </SheetGlass>
      </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    zIndex: 1000,
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 12,
    zIndex: 2,
  },
  sheetGlass: {
    borderRadius: PG_RADII.xl,
    borderWidth: 1,
    borderColor: PG.heroGlassBorder,
    overflow: 'hidden',
    paddingHorizontal: PG_SPACING.lg,
    paddingTop: PG_SPACING.sm,
    paddingBottom: PG_SPACING.lg,
    backgroundColor: Platform.OS === 'android' ? PG.card : undefined,
  },
  sheetTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(8,6,19,0.55)',
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: PG.border,
    marginBottom: PG_SPACING.md,
  },
  header: {
    alignItems: 'center',
    gap: PG_SPACING.md,
    marginBottom: PG_SPACING.md,
  },
  title: { color: PG.text, fontSize: PG_TYPE.title },
  sub: { color: PG.textMuted, fontSize: PG_TYPE.caption, marginTop: 2 },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: PG.glassStrong,
  },
  searchRow: {
    alignItems: 'center',
    gap: 10,
    backgroundColor: PG.glassStrong,
    borderRadius: PG_RADII.md,
    borderWidth: 1,
    borderColor: PG.borderSoft,
    paddingHorizontal: PG_SPACING.md,
    paddingVertical: 10,
    marginBottom: PG_SPACING.md,
  },
  searchInput: {
    flex: 1,
    color: PG.text,
    fontSize: PG_TYPE.body,
    padding: 0,
    minHeight: 22,
  },
  body: {
    minHeight: 132,
    flexShrink: 1,
  },
  loader: {
    marginTop: 36,
  },
  emptyWrap: {
    flex: 1,
    minHeight: 132,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: PG_SPACING.lg,
    paddingVertical: PG_SPACING.lg,
    gap: PG_SPACING.md,
  },
  emptyIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(139,92,246,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.28)',
  },
  empty: {
    color: PG.textSecondary,
    fontSize: PG_TYPE.body,
    lineHeight: 22,
  },
  list: { alignSelf: 'stretch' },
  listContent: { gap: 8 },
  userRow: {
    alignItems: 'center',
    gap: PG_SPACING.sm,
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: PG_RADII.md,
    backgroundColor: PG.glass,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: PG.glassStrong,
  },
  userName: { color: PG.text, fontSize: PG_TYPE.body },
  userHandle: { color: PG.textMuted, fontSize: PG_TYPE.caption, marginTop: 1 },
  inviteBtn: {
    alignItems: 'center',
    gap: 4,
    backgroundColor: PG.purple,
    borderRadius: PG_RADII.pill,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  inviteBtnSent: {
    backgroundColor: PG.glassStrong,
    borderWidth: 1,
    borderColor: PG.borderSoft,
  },
  inviteTxt: { fontSize: PG_TYPE.caption },
});

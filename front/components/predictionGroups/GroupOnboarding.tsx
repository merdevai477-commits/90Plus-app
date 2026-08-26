/**
 * Hub — create, join by code, and suggested groups (Figma 469:1389).
 * Fully RTL-aware; copy comes from i18n (ar/en).
 */

import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ImageBackground,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  ViewStyle,
} from 'react-native';

import { useToast } from '../../contexts/ToastContext';
import { useTranslation } from '../../src/i18n';
import type { RankedGroupRow } from '../../services/predictionGroups.service';
import { parseGroupCodeFromUrl } from '../../services/predictionGroups.service';
import { GroupBanBanner } from './GroupBanBanner';
import { PG, PG_GRADIENTS, usePGFonts } from './theme';

const GROUP_HERO = require('../../assets/images/prediction-groups/hero-stadium.png');
const ICON_PLUS = require('../../assets/images/prediction-groups/icon-plus.svg');
const ICON_SEARCH = require('../../assets/images/prediction-groups/icon-search.svg');
const ICON_DOOR = require('../../assets/images/prediction-groups/icon-door-enter.svg');

const CARD_BORDER = '#53198A';
const CARD_BG = ['#0C051A', '#07040D'] as const;
const ADMIN_BADGE_BG = ['rgba(54,5,100,0.53)', 'rgba(6,1,11,0.53)'] as const;
const JOIN_PLACEHOLDER = '#5D5D5D';
const OR_LINE = '#1F1F1F';
const OR_TEXT = '#787878';
const MEMBERS_MUTED = '#737373';
const ADMIN_LABEL = '#914ED2';
const SUBTITLE = '#B5B5B5';
const FIELD_BORDER = '#262626';

export function GroupOnboarding({
  isRTL,
  topInset = 0,
  onBack,
  onCreatePress,
  onJoinByCode,
  groupBan,
  suggestions,
  suggestionsLoading,
  joiningCode,
}: {
  isRTL: boolean;
  topInset?: number;
  onBack?: () => void;
  onCreatePress: () => void;
  onJoinByCode: (code: string) => Promise<void>;
  groupBan?: { until: string } | null;
  suggestions: RankedGroupRow[];
  suggestionsLoading?: boolean;
  joiningCode?: string | null;
}) {
  const { medium, bold } = usePGFonts();
  const { t, direction } = useTranslation();
  const ob = t.predictionGroups.onboarding;
  const common = t.predictionGroups.common;
  const toast = useToast();
  const row: ViewStyle = { flexDirection: isRTL ? 'row-reverse' : 'row' };
  const align = isRTL ? ('right' as const) : ('left' as const);
  const writingDirection = direction;
  const BackIcon = isRTL ? ChevronRight : ChevronLeft;
  const startEdge = isRTL ? { right: 12 } : { left: 12 };

  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [activeCode, setActiveCode] = useState<string | null>(null);
  const isBanned = Boolean(groupBan?.until && new Date(groupBan.until) > new Date());

  const ranked = useMemo(
    () => [...suggestions].sort((a, b) => (b.members ?? 0) - (a.members ?? 0)),
    [suggestions],
  );

  const submitCode = useCallback(
    async (raw: string) => {
      if (isBanned) {
        toast.showError(ob.bannedTitle, ob.bannedJoin);
        return;
      }
      const normalized = parseGroupCodeFromUrl(raw) ?? raw.trim().toUpperCase();
      if (!/^90PLUS[A-Z0-9]+$/.test(normalized)) {
        toast.showError(ob.invalidCodeTitle, ob.invalidCodeBody);
        return;
      }
      setBusy(true);
      setActiveCode(normalized);
      try {
        await onJoinByCode(normalized);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        setCode('');
      } catch (e: any) {
        toast.showError(ob.joinFailed, e?.message ?? ob.joinFailedHint);
      } finally {
        setBusy(false);
        setActiveCode(null);
      }
    },
    [isBanned, ob, onJoinByCode, toast],
  );

  const searchIcon = busy ? (
    <ActivityIndicator color={PG.primaryLight} size="small" />
  ) : (
    <Image source={ICON_SEARCH} style={styles.icon24} contentFit="contain" transition={0} />
  );

  return (
    <View style={styles.wrap}>
      {groupBan?.until ? <GroupBanBanner untilIso={groupBan.until} /> : null}

      <View style={[styles.heroShell, { height: 340 + topInset }]}>
        <ImageBackground source={GROUP_HERO} style={styles.heroBg} resizeMode="cover">
          <LinearGradient
            colors={['rgba(34,34,34,0.39)', 'rgba(3,3,3,0.72)', PG.bg]}
            locations={[0.22, 0.55, 1]}
            style={StyleSheet.absoluteFill}
          />
          {onBack ? (
            <Pressable
              onPress={onBack}
              style={[styles.backBtn, { top: topInset + 6 }, startEdge]}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={common.back}
            >
              <BackIcon size={22} color="#fff" strokeWidth={2.25} />
            </Pressable>
          ) : null}
          <View style={[styles.heroInner, { paddingBottom: 8 }]}>
            <Text
              style={[styles.title, { fontFamily: bold, writingDirection }]}
            >
              {ob.heroTitle}
            </Text>
            <Text
              style={[styles.sub, { fontFamily: medium, writingDirection }]}
            >
              {ob.heroSubtitle}
            </Text>
          </View>
        </ImageBackground>
      </View>

      <View style={styles.body}>
        <Pressable
          onPress={() => {
            if (isBanned) {
              toast.showError(ob.bannedTitle, ob.bannedCreate);
              return;
            }
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
            onCreatePress();
          }}
          style={({ pressed }) => [pressed && { opacity: 0.92 }]}
          accessibilityRole="button"
          accessibilityLabel={ob.createGroup}
        >
          <LinearGradient
            colors={[...PG_GRADIENTS.purple]}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={[styles.primaryBtn, row]}
          >
            <Text style={[styles.primaryTxt, { fontFamily: bold, writingDirection }]}>
              {ob.createGroup}
            </Text>
            <Image source={ICON_PLUS} style={styles.icon24} contentFit="contain" transition={0} />
          </LinearGradient>
        </Pressable>

        <View style={[styles.orRow, row]}>
          <View style={styles.orLine} />
          <Text style={[styles.orTxt, { fontFamily: medium, writingDirection }]}>{ob.or}</Text>
          <View style={styles.orLine} />
        </View>

        <View style={[styles.joinField, row]}>
          {searchIcon}
          <TextInput
            value={code}
            onChangeText={setCode}
            placeholder={ob.joinPlaceholder}
            placeholderTextColor={JOIN_PLACEHOLDER}
            autoCapitalize="characters"
            returnKeyType="go"
            onSubmitEditing={() => void submitCode(code)}
            editable={!busy && !isBanned}
            style={[
              styles.joinInput,
              { fontFamily: medium, textAlign: align, writingDirection },
            ]}
          />
        </View>

        <View style={[styles.sectionHead, row]}>
          <View style={styles.sectionBar} />
          <Text
            style={[
              styles.sectionTitle,
              { fontFamily: bold, textAlign: align, writingDirection },
            ]}
          >
            {ob.myGroups}
          </Text>
        </View>

        {suggestionsLoading && ranked.length === 0 ? (
          <ActivityIndicator color={PG.primaryLight} style={{ marginTop: 12 }} />
        ) : ranked.length === 0 ? (
          <Text
            style={[
              styles.empty,
              { fontFamily: medium, textAlign: align, writingDirection },
            ]}
          >
            {ob.emptyMyGroups}
          </Text>
        ) : (
          <View style={styles.list}>
            {ranked.map((g) => {
              const joining = activeCode === g.inviteCode || joiningCode === g.inviteCode;
              const owned = Boolean(g.isMine);
              return (
                <Pressable
                  key={g.id}
                  disabled={joining || isBanned}
                  onPress={() => void submitCode(g.inviteCode)}
                  style={({ pressed }) => [pressed && { opacity: 0.9 }]}
                  accessibilityRole="button"
                  accessibilityLabel={g.name}
                >
                  <LinearGradient
                    colors={[...CARD_BG]}
                    start={{ x: 0.5, y: 0 }}
                    end={{ x: 0.5, y: 1 }}
                    style={[styles.groupCard, row]}
                  >
                    <View style={[styles.groupInfo, row]}>
                      <View style={styles.avatarWrap}>
                        {g.avatarUrl ? (
                          <Image
                            source={{ uri: g.avatarUrl }}
                            style={styles.avatar}
                            contentFit="cover"
                            transition={0}
                          />
                        ) : (
                          <View style={[styles.avatar, styles.avatarFallback]} />
                        )}
                      </View>
                      <View
                        style={[
                          styles.groupMeta,
                          { alignItems: isRTL ? 'flex-end' : 'flex-start' },
                        ]}
                      >
                        <Text
                          style={[
                            styles.groupName,
                            {
                              fontFamily: medium,
                              textAlign: align,
                              writingDirection,
                            },
                          ]}
                          numberOfLines={1}
                        >
                          {g.name}
                        </Text>
                        <Text
                          style={[
                            styles.groupMembers,
                            {
                              fontFamily: medium,
                              textAlign: align,
                              writingDirection,
                            },
                          ]}
                        >
                          {common.members.replace('{count}', String(g.members))}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.cardAction}>
                      {joining ? (
                        <ActivityIndicator color={PG.primaryLight} size="small" />
                      ) : owned ? (
                        <LinearGradient
                          colors={[...ADMIN_BADGE_BG]}
                          start={{ x: 0.5, y: 0 }}
                          end={{ x: 0.5, y: 1 }}
                          style={styles.adminBadge}
                        >
                          <Text
                            style={[
                              styles.adminBadgeTxt,
                              { fontFamily: medium, writingDirection },
                            ]}
                          >
                            {ob.managedByYou}
                          </Text>
                        </LinearGradient>
                      ) : (
                        <Image
                          source={ICON_DOOR}
                          style={[
                            styles.icon24,
                            isRTL ? styles.iconFlipX : null,
                          ]}
                          contentFit="contain"
                          transition={0}
                        />
                      )}
                    </View>
                  </LinearGradient>
                </Pressable>
              );
            })}
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingBottom: 28 },
  heroShell: {
    overflow: 'hidden',
  },
  heroBg: { flex: 1, justifyContent: 'flex-end' },
  backBtn: {
    position: 'absolute',
    zIndex: 4,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroInner: {
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 32,
    color: '#FFFFFF',
    textAlign: 'center',
    lineHeight: 40,
  },
  sub: {
    fontSize: 18,
    color: SUBTITLE,
    textAlign: 'center',
  },
  body: {
    paddingHorizontal: 22,
    gap: 16,
    marginTop: 18,
  },
  primaryBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderRadius: 16,
    paddingVertical: 21,
    minHeight: 66,
  },
  primaryTxt: { color: '#fff', fontSize: 18 },
  icon24: { width: 24, height: 24 },
  iconFlipX: { transform: [{ scaleX: -1 }] },
  orRow: { alignItems: 'center', gap: 18, paddingHorizontal: 8 },
  orLine: { flex: 1, height: 1, backgroundColor: OR_LINE },
  orTxt: { color: OR_TEXT, fontSize: 20 },
  joinField: {
    alignItems: 'center',
    gap: 10,
    height: 58,
    paddingHorizontal: 24,
    borderRadius: 16,
    backgroundColor: '#030303',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: FIELD_BORDER,
  },
  joinInput: {
    flex: 1,
    color: PG.text,
    fontSize: 16,
    paddingVertical: 10,
  },
  sectionHead: {
    alignItems: 'center',
    gap: 12,
    marginTop: 8,
  },
  sectionBar: {
    width: 2,
    height: 30,
    borderRadius: 1,
    backgroundColor: PG.primary,
  },
  sectionTitle: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 20,
  },
  empty: { color: MEMBERS_MUTED, fontSize: 13, paddingVertical: 8 },
  list: { gap: 8 },
  groupCard: {
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 77,
    paddingHorizontal: 24,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: CARD_BORDER,
  },
  cardAction: {
    minWidth: 53,
    alignItems: 'center',
    justifyContent: 'center',
  },
  adminBadge: {
    minWidth: 53,
    height: 23,
    paddingHorizontal: 10,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: CARD_BORDER,
  },
  adminBadgeTxt: {
    color: ADMIN_LABEL,
    fontSize: 10,
  },
  groupInfo: {
    flexShrink: 1,
    alignItems: 'center',
    gap: 12,
    minWidth: 0,
  },
  groupMeta: {
    flexShrink: 1,
    gap: 6,
    minWidth: 0,
  },
  groupName: {
    color: '#FFFFFF',
    fontSize: 17,
  },
  groupMembers: {
    color: MEMBERS_MUTED,
    fontSize: 11,
  },
  avatarWrap: {
    width: 40,
    height: 41,
    borderRadius: 8,
    overflow: 'hidden',
  },
  avatar: {
    width: '100%',
    height: '100%',
  },
  avatarFallback: {
    backgroundColor: 'rgba(128,59,69,0.5)',
  },
});

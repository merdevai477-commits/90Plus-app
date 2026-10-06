import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  BackHandler,
  Easing,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import CachedAthletePhoto from '../common/CachedAthletePhoto';
import { shortPlayerName, type LineupPitchPlayer } from '../../utils/lineupMatchState';
import { LineupRatingBadge } from './LineupRatingBadge';

const PANEL_RATIO = 0.8;
const PANEL_MAX_W = 380;
const COLUMNS = 2;
const GAP = 8;
const PADDING = 12;
const AVATAR = 50;
const DURATION = 240;

interface LineupBenchDrawerProps {
  visible: boolean;
  onClose: () => void;
  /** Width/height of the lineup section the drawer covers. */
  width: number;
  height: number;
  blurTarget?: React.RefObject<View | null>;
  players: LineupPitchPlayer[];
  title: string;
  emptyLabel: string;
  closeLabel: string;
  teamName?: string;
  teamLogo?: string | null;
  rtl: boolean;
  resolvePhoto: (playerId: number, photo?: string | null) => string;
  onPlayerPress?: (player: LineupPitchPlayer) => void;
}

function BenchCell({
  player,
  resolvePhoto,
  onPress,
}: {
  player: LineupPitchPlayer;
  resolvePhoto: LineupBenchDrawerProps['resolvePhoto'];
  onPress?: (player: LineupPitchPlayer) => void;
}) {
  const subbedOff = player.subbedOff != null;
  const hasRating = player.rating != null && player.rating > 0;
  return (
    <TouchableOpacity
      style={[styles.cell, subbedOff && styles.cellOut]}
      onPress={onPress ? () => onPress(player) : undefined}
      disabled={!onPress || !player.id}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={player.name}
    >
      <View style={styles.avatar}>
        <CachedAthletePhoto
          uri={player.id ? resolvePhoto(player.id, player.photo) : player.photo}
          size={AVATAR}
          recyclingKey={player.id ?? player.photo}
          preSized={Boolean(player.id)}
        />
        {player.number ? (
          <View style={styles.numberBadge}>
            <Text style={styles.numberText} maxFontSizeMultiplier={1.1}>
              {player.number}
            </Text>
          </View>
        ) : null}
      </View>
      <Text
        style={styles.name}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.75}
        maxFontSizeMultiplier={1.1}
      >
        {shortPlayerName(player.name, 12)}
      </Text>
      <View style={styles.metaRow}>
        {hasRating ? <LineupRatingBadge rating={player.rating as number} /> : null}
        {subbedOff ? (
          <View style={styles.subOut}>
            <Ionicons name="arrow-down" size={11} color="#EF4444" />
            <Text style={styles.subOutText}>{Math.floor(player.subbedOff as number)}'</Text>
          </View>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

export function LineupBenchDrawer({
  visible,
  onClose,
  width,
  height,
  blurTarget,
  players,
  title,
  emptyLabel,
  closeLabel,
  teamName,
  teamLogo,
  rtl,
  resolvePhoto,
  onPlayerPress,
}: LineupBenchDrawerProps) {
  const panelW = Math.min(width * PANEL_RATIO, PANEL_MAX_W);
  const progress = useRef(new Animated.Value(0)).current;
  const [mounted, setMounted] = useState(visible);

  useEffect(() => {
    if (visible) setMounted(true);
    Animated.timing(progress, {
      toValue: visible ? 1 : 0,
      duration: DURATION,
      easing: visible ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished && !visible) setMounted(false);
    });
  }, [visible, progress]);

  useEffect(() => {
    if (!visible) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose();
      return true;
    });
    return () => sub.remove();
  }, [visible, onClose]);

  if (!mounted) return null;

  const offscreen = rtl ? -panelW : panelW;
  const translateX = progress.interpolate({ inputRange: [0, 1], outputRange: [offscreen, 0] });
  const rows: LineupPitchPlayer[][] = [];
  for (let i = 0; i < players.length; i += COLUMNS) rows.push(players.slice(i, i + COLUMNS));
  const rowDirection = rtl ? 'row-reverse' : 'row';

  return (
    <View style={[styles.root, { width, height }]} pointerEvents={visible ? 'auto' : 'none'}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, { opacity: progress }]}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={closeLabel}
        />
      </Animated.View>

      <Animated.View
        style={[
          styles.panel,
          rtl ? styles.panelLeft : styles.panelRight,
          { width: panelW, transform: [{ translateX }] },
        ]}
      >
        <BlurView
          intensity={40}
          tint="dark"
          blurMethod="dimezisBlurViewSdk31Plus"
          blurTarget={blurTarget}
          style={StyleSheet.absoluteFill}
        />
        <View style={[StyleSheet.absoluteFill, styles.glassTint]} pointerEvents="none" />

        <View style={[styles.header, { flexDirection: rowDirection }]}>
          <View style={[styles.headerTitle, { flexDirection: rowDirection }]}>
            {teamLogo ? (
              <Image source={{ uri: teamLogo }} style={styles.teamLogo} contentFit="contain" />
            ) : null}
            <View style={{ flexShrink: 1, alignItems: rtl ? 'flex-end' : 'flex-start' }}>
              <Text style={styles.title} maxFontSizeMultiplier={1.2}>
                {title}
              </Text>
              {teamName ? (
                <Text style={styles.subtitle} numberOfLines={1} maxFontSizeMultiplier={1.2}>
                  {teamName}
                </Text>
              ) : null}
            </View>
          </View>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel={closeLabel}
            hitSlop={8}
          >
            <Ionicons name="close" size={18} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {players.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="people-outline" size={36} color="#A78BFA" />
            <Text style={styles.emptyText}>{emptyLabel}</Text>
          </View>
        ) : (
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
            nestedScrollEnabled
          >
            {rows.map((row, rowIndex) => (
              <View key={`drawer-row-${rowIndex}`} style={[styles.row, { flexDirection: rowDirection }]}>
                {row.map((player, i) => (
                  <BenchCell
                    key={`drawer-bench-${player.id ?? player.name}-${i}`}
                    player={player}
                    resolvePhoto={resolvePhoto}
                    onPress={onPlayerPress}
                  />
                ))}
                {row.length < COLUMNS ? <View style={styles.cellSpacer} /> : null}
              </View>
            ))}
          </ScrollView>
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    top: 0,
    left: 0,
    overflow: 'hidden',
  },
  backdrop: {
    backgroundColor: 'rgba(3,3,3,0.35)',
  },
  panel: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    paddingTop: PADDING,
  },
  panelRight: {
    right: 0,
    borderTopLeftRadius: 20,
    borderBottomLeftRadius: 20,
    borderRightWidth: 0,
  },
  panelLeft: {
    left: 0,
    borderTopRightRadius: 20,
    borderBottomRightRadius: 20,
    borderLeftWidth: 0,
  },
  glassTint: {
    backgroundColor: 'rgba(22,10,48,0.45)',
  },
  header: {
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: PADDING,
    paddingBottom: 10,
    gap: 10,
  },
  headerTitle: {
    flex: 1,
    alignItems: 'center',
    gap: 8,
  },
  teamLogo: {
    width: 28,
    height: 28,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  subtitle: {
    color: '#C4B5FD',
    fontSize: 12,
    fontWeight: '500',
    marginTop: 1,
  },
  closeButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  scroll: {
    flex: 1,
  },
  list: {
    gap: GAP,
    paddingHorizontal: PADDING,
    paddingBottom: PADDING,
  },
  row: {
    gap: GAP,
  },
  cell: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  cellSpacer: {
    flex: 1,
  },
  cellOut: {
    opacity: 0.55,
  },
  avatar: {
    width: AVATAR,
    height: AVATAR,
  },
  numberBadge: {
    position: 'absolute',
    bottom: -4,
    right: -6,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 4,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#00081B',
    borderWidth: 1,
    borderColor: 'rgba(168,85,247,0.5)',
  },
  numberText: {
    color: '#D8B3FC',
    fontSize: 10,
    fontWeight: '700',
    includeFontPadding: false,
  },
  name: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    alignSelf: 'stretch',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 14,
  },
  subOut: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 1,
  },
  subOutText: {
    color: '#EF4444',
    fontSize: 10,
    fontWeight: '700',
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: PADDING,
  },
  emptyText: {
    color: '#D1D5DB',
    fontSize: 13,
    textAlign: 'center',
  },
});

export default LineupBenchDrawer;

import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import CachedAthletePhoto from '../common/CachedAthletePhoto';
import { shortPlayerName, type LineupPitchPlayer } from '../../utils/lineupMatchState';
import { LineupRatingBadge } from './LineupRatingBadge';

const PANEL_MAX_W = 360;
const COLUMNS = 2;
const GAP = 10;
const PADDING = 16;
const AVATAR = 58;
const DURATION = 240;

interface LineupBenchDrawerProps {
  visible: boolean;
  onClose: () => void;
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
  width,
  resolvePhoto,
  onPress,
}: {
  player: LineupPitchPlayer;
  width: number;
  resolvePhoto: LineupBenchDrawerProps['resolvePhoto'];
  onPress?: (player: LineupPitchPlayer) => void;
}) {
  const subbedOff = player.subbedOff != null;
  const hasRating = player.rating != null && player.rating > 0;
  return (
    <TouchableOpacity
      style={[styles.cell, { width }, subbedOff && styles.cellOut]}
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
  const { width: windowW } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const panelW = Math.min(windowW * 0.82, PANEL_MAX_W);
  const cellW = (panelW - PADDING * 2 - GAP * (COLUMNS - 1)) / COLUMNS;
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

  if (!mounted) return null;

  const offscreen = rtl ? -panelW : panelW;
  const translateX = progress.interpolate({ inputRange: [0, 1], outputRange: [offscreen, 0] });

  return (
    <Modal visible transparent animationType="none" statusBarTranslucent onRequestClose={onClose}>
      <Animated.View style={[styles.backdrop, { opacity: progress }]}>
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
          rtl ? styles.panelEdgeLeft : styles.panelEdgeRight,
          {
            width: panelW,
            paddingTop: insets.top + 12,
            paddingBottom: insets.bottom,
            transform: [{ translateX }],
          },
        ]}
      >
        <View style={[styles.header, { flexDirection: rtl ? 'row-reverse' : 'row' }]}>
          <View style={[styles.headerTitle, { flexDirection: rtl ? 'row-reverse' : 'row' }]}>
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
            <Ionicons name="close" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {players.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="people-outline" size={40} color="#4B3A75" />
            <Text style={styles.emptyText}>{emptyLabel}</Text>
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={[
              styles.grid,
              { flexDirection: rtl ? 'row-reverse' : 'row' },
            ]}
            showsVerticalScrollIndicator={false}
          >
            {players.map((player, i) => (
              <BenchCell
                key={`drawer-bench-${player.id ?? player.name}-${i}`}
                player={player}
                width={cellW}
                resolvePhoto={resolvePhoto}
                onPress={onPlayerPress}
              />
            ))}
          </ScrollView>
        )}
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  panel: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    backgroundColor: '#0B0518',
    borderColor: 'rgba(106,46,242,0.34)',
  },
  panelRight: {
    right: 0,
    borderTopLeftRadius: 20,
    borderBottomLeftRadius: 20,
  },
  panelLeft: {
    left: 0,
    borderTopRightRadius: 20,
    borderBottomRightRadius: 20,
  },
  panelEdgeRight: {
    borderLeftWidth: 1,
  },
  panelEdgeLeft: {
    borderRightWidth: 1,
  },
  header: {
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: PADDING,
    paddingBottom: 14,
    gap: 12,
  },
  headerTitle: {
    flex: 1,
    alignItems: 'center',
    gap: 10,
  },
  teamLogo: {
    width: 32,
    height: 32,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
  },
  subtitle: {
    color: '#A78BFA',
    fontSize: 13,
    fontWeight: '500',
    marginTop: 2,
  },
  closeButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(168,85,247,0.14)',
  },
  grid: {
    flexWrap: 'wrap',
    gap: GAP,
    paddingHorizontal: PADDING,
    paddingBottom: 24,
  },
  cell: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderRadius: 16,
    backgroundColor: 'rgba(20,14,33,0.6)',
    borderWidth: 2,
    borderColor: 'rgba(168,85,247,0.1)',
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
    minWidth: 22,
    height: 22,
    paddingHorizontal: 4,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#00081B',
    borderWidth: 1,
    borderColor: 'rgba(168,85,247,0.4)',
  },
  numberText: {
    color: '#D8B3FC',
    fontSize: 11,
    fontWeight: '700',
    includeFontPadding: false,
  },
  name: {
    color: '#FFFFFF',
    fontSize: 13,
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
    gap: 10,
    paddingHorizontal: PADDING,
  },
  emptyText: {
    color: '#9CA3AF',
    fontSize: 14,
    textAlign: 'center',
  },
});

export default LineupBenchDrawer;

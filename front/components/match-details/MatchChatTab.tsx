import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  Platform,
  Alert,
  ActionSheetIOS,
  Image,
  ActivityIndicator,
  Modal,
  StatusBar,
} from 'react-native';
import { FlashList, type FlashListRef } from '@shopify/flash-list';
import { Ionicons } from '@expo/vector-icons';
import { Image as ExpoImage } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useUser } from '@clerk/clerk-expo';
import Svg, { Defs, LinearGradient as SvgLinearGradient, Path, Rect, Stop } from 'react-native-svg';
import {
  isLiveStoppage,
  resolveLiveMinuteLabel,
  resolveLiveSecondsLabel,
} from '../Matches/leagueApiUtils';
import { useSecondTick } from '../../hooks/useSecondTick';
import { useAnchoredPeriodStart } from '../../hooks/useAnchoredPeriodStart';
import { useTranslation } from '../../src/i18n';
import { useMatchLiveChat } from '../../hooks/useMatchLiveChat';
import type { MatchChatUiMessage } from '../../hooks/matchLiveChat.reducer';
import type { MatchChatReportReason } from '../../types/matchChat';
import { safeFlashListScrollToEnd } from '../chat/safeFlashListScroll';
import { useChatKeyboard } from '../../hooks/useChatKeyboard';

export type MatchChatScorer = { name: string; minute: string };

export type MatchChatSummary = {
  homeTeam: string;
  awayTeam: string;
  homeLogo?: string | null;
  awayLogo?: string | null;
  homeScore?: string | number | null;
  awayScore?: string | number | null;
  league?: string | null;
  /** Localized finished / special status (FT, postponed…). */
  statusLabel?: string | null;
  statusShort?: string | null;
  elapsed?: number | null;
  stoppage?: number | null;
  startTimestamp?: number;
  clockAnchorKey?: string | number;
  fixtureDate?: string | null;
  kickoffStatusLabel?: string | null;
  liveLabel?: string | null;
  halftimeLabel?: string | null;
  finishedLabel?: string | null;
  scorers?: {
    home: MatchChatScorer[];
    away: MatchChatScorer[];
  };
};

type MatchChatTabProps = {
  fixtureId: number;
  kickoffAt?: string | null;
  matchSummary?: MatchChatSummary | null;
};

const LIVE_STATUSES = ['1H', '2H', 'ET', 'BT', 'P', 'LIVE', 'INT'];
const FINISHED_STATUSES = ['FT', 'AET', 'PEN'];
const NOT_PLAYED_STATUSES = ['CANC', 'PST', 'ABD', 'AWD', 'WO', 'TBD'];
const PAUSED_STATUSES = ['SUSP'];

const REPORT_REASONS: MatchChatReportReason[] = [
  'PROFANITY',
  'ABUSE',
  'HARASSMENT',
  'SPAM',
  'ADVERTISEMENT',
  'SUSPICIOUS_LINK',
  'OTHER',
];

const COMPACT_VISIBLE = 8;
const AVATAR_DOUBLE_TAP_MS = 300;

function formatClock(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

/** Match-clock label like `63'` when the kickoff time is known. */
export function formatMatchMinute(createdAt: string, kickoffAt?: string | null): string {
  if (!kickoffAt) return formatClock(createdAt);
  const created = Date.parse(createdAt);
  const kickoff = Date.parse(kickoffAt);
  if (!Number.isFinite(created) || !Number.isFinite(kickoff) || created < kickoff) {
    return formatClock(createdAt);
  }
  const minutes = Math.floor((created - kickoff) / 60_000);
  return `${Math.min(minutes, 135)}'`;
}

function formatLikes(count: number): string {
  if (count >= 1_000_000) {
    return `${(count / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  }
  if (count >= 1_000) {
    return `${(count / 1_000).toFixed(1).replace(/\.0$/, '')}K`;
  }
  return `${count}`;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  return parts.slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('');
}

function HeartOutlineIcon({ size = 18 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 18 18" fill="none">
      <Path
        d="M9.075 13.9125L9 13.9875L8.9175 13.9125C5.355 10.68 3 8.5425 3 6.375C3 4.875 4.125 3.75 5.625 3.75C6.78 3.75 7.905 4.5 8.3025 5.52H9.6975C10.095 4.5 11.22 3.75 12.375 3.75C13.875 3.75 15 4.875 15 6.375C15 8.5425 12.645 10.68 9.075 13.9125ZM12.375 2.25C11.07 2.25 9.8175 2.8575 9 3.81C8.1825 2.8575 6.93 2.25 5.625 2.25C3.315 2.25 1.5 4.0575 1.5 6.375C1.5 9.2025 4.05 11.52 7.9125 15.0225L9 16.0125L10.0875 15.0225C13.95 11.52 16.5 9.2025 16.5 6.375C16.5 4.0575 14.685 2.25 12.375 2.25Z"
        fill="#A852FA"
      />
    </Svg>
  );
}

function HeartFilledIcon({ size = 18 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 18 18" fill="none">
      <Path
        d="M9 15.75L7.9125 14.76C4.05 11.2575 1.5 8.94 1.5 6.1125C1.5 3.795 3.315 1.9875 5.625 1.9875C6.93 1.9875 8.1825 2.595 9 3.5475C9.8175 2.595 11.07 1.9875 12.375 1.9875C14.685 1.9875 16.5 3.795 16.5 6.1125C16.5 8.94 13.95 11.2575 10.0875 14.76L9 15.75Z"
        fill="#A852FA"
      />
    </Svg>
  );
}

function FireIcon({ size = 12 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 12 12" fill="none">
      <Path
        d="M8.83 5.6C8.715 5.45 8.575 5.32 8.445 5.19C8.11 4.89 7.73 4.675 7.41 4.36C6.665 3.63 6.5 2.425 6.975 1.5C6.5 1.615 6.085 1.875 5.73 2.16C4.435 3.2 3.925 5.035 4.535 6.61C4.555 6.66 4.575 6.71 4.575 6.775C4.575 6.885 4.5 6.985 4.4 7.025C4.285 7.075 4.165 7.045 4.07 6.965C4.04162 6.94123 4.01789 6.91241 4 6.88C3.435 6.165 3.345 5.14 3.725 4.32C2.89 5 2.435 6.15 2.5 7.235C2.53 7.485 2.56 7.735 2.645 7.985C2.715 8.285 2.85 8.585 3 8.85C3.54 9.715 4.475 10.335 5.48 10.46C6.55 10.595 7.695 10.4 8.515 9.66C9.43 8.83 9.75 7.5 9.28 6.36L9.215 6.23C9.11 6 8.83 5.6 8.83 5.6ZM7.25 8.75C7.11 8.87 6.88 9 6.7 9.05C6.14 9.25 5.58 8.97 5.25 8.64C5.845 8.5 6.2 8.06 6.305 7.615C6.39 7.215 6.23 6.885 6.165 6.5C6.105 6.13 6.115 5.815 6.25 5.47C6.345 5.66 6.445 5.85 6.565 6C6.95 6.5 7.555 6.72 7.685 7.4C7.705 7.47 7.715 7.54 7.715 7.615C7.73 8.025 7.55 8.475 7.25 8.75Z"
        fill="#A34FF4"
      />
    </Svg>
  );
}

function FaceSmileIcon({ size = 24 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M4.5 12C4.5 10.0109 5.29018 8.10322 6.6967 6.6967C8.10322 5.29018 10.0109 4.5 12 4.5C13.9891 4.5 15.8968 5.29018 17.3033 6.6967C18.7098 8.10322 19.5 10.0109 19.5 12C19.5 13.9891 18.7098 15.8968 17.3033 17.3033C15.8968 18.7098 13.9891 19.5 12 19.5C10.0109 19.5 8.10322 18.7098 6.6967 17.3033C5.29018 15.8968 4.5 13.9891 4.5 12ZM12 3C10.8181 3 9.64778 3.23279 8.55585 3.68508C7.46392 4.13738 6.47177 4.80031 5.63604 5.63604C4.80031 6.47177 4.13738 7.46392 3.68508 8.55585C3.23279 9.64778 3 10.8181 3 12C3 13.1819 3.23279 14.3522 3.68508 15.4442C4.13738 16.5361 4.80031 17.5282 5.63604 18.364C6.47177 19.1997 7.46392 19.8626 8.55585 20.3149C9.64778 20.7672 10.8181 21 12 21C14.3869 21 16.6761 20.0518 18.364 18.364C20.0518 16.6761 21 14.3869 21 12C21 9.61305 20.0518 7.32387 18.364 5.63604C16.6761 3.94821 14.3869 3 12 3ZM9.25 10.5C9.58152 10.5 9.89946 10.3683 10.1339 10.1339C10.3683 9.89946 10.5 9.58152 10.5 9.25C10.5 8.91848 10.3683 8.60054 10.1339 8.36612C9.89946 8.1317 9.58152 8 9.25 8C8.91848 8 8.60054 8.1317 8.36612 8.36612C8.1317 8.60054 8 8.91848 8 9.25C8 9.58152 8.1317 9.89946 8.36612 10.1339C8.60054 10.3683 8.91848 10.5 9.25 10.5ZM16 9.25C16 9.58152 15.8683 9.89946 15.6339 10.1339C15.3995 10.3683 15.0815 10.5 14.75 10.5C14.4185 10.5 14.1005 10.3683 13.8661 10.1339C13.6317 9.89946 13.5 9.58152 13.5 9.25C13.5 8.91848 13.6317 8.60054 13.8661 8.36612C14.1005 8.1317 14.4185 8 14.75 8C15.0815 8 15.3995 8.1317 15.6339 8.36612C15.8683 8.60054 16 8.91848 16 9.25ZM8.7 13.726L8.696 13.718C8.61829 13.5386 8.47357 13.3966 8.29269 13.3223C8.11181 13.248 7.90907 13.2473 7.72768 13.3203C7.54629 13.3934 7.40059 13.5343 7.32164 13.7132C7.24268 13.8921 7.23671 14.0948 7.305 14.278L8 14C7.304 14.278 7.304 14.279 7.304 14.28L7.305 14.282L7.307 14.286L7.311 14.297C7.33025 14.3438 7.35126 14.3898 7.374 14.435C7.62476 14.9315 7.9521 15.3853 8.344 15.78C9.084 16.519 10.266 17.25 12 17.25C13.734 17.25 14.917 16.519 15.655 15.78C15.9568 15.4791 16.2204 15.1422 16.44 14.777C16.5316 14.6216 16.6147 14.4614 16.689 14.297L16.693 14.286L16.695 14.282V14.28C16.695 14.279 16.696 14.278 16 14L16.696 14.278C16.7603 14.0958 16.7518 13.8958 16.6722 13.7197C16.5927 13.5436 16.4483 13.405 16.269 13.3327C16.0898 13.2605 15.8896 13.2603 15.7102 13.3321C15.5308 13.4038 15.386 13.5421 15.306 13.718L15.302 13.726L15.277 13.78C15.0992 14.1264 14.8692 14.4435 14.595 14.72C14.083 15.231 13.265 15.75 12 15.75C10.735 15.75 9.917 15.231 9.405 14.72C9.1312 14.4434 8.90152 14.1264 8.724 13.78L8.7 13.726Z"
        fill="#484050"
      />
    </Svg>
  );
}

function SendButtonIcon({ size = 53, disabled }: { size?: number; disabled?: boolean }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 53 53" fill="none">
      <Defs>
        <SvgLinearGradient id="chatSendGrad" x1="26.5" y1="0" x2="26.5" y2="53" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor={disabled ? '#2A1A5C' : '#4A0FD2'} />
          <Stop offset="1" stopColor={disabled ? '#1A0F3A' : '#26076C'} />
        </SvgLinearGradient>
      </Defs>
      <Rect width="53" height="53" rx="26.5" fill="url(#chatSendGrad)" opacity={disabled ? 0.55 : 1} />
      <Path
        d="M13.8542 23.5363L24.7099 28.2849L29.4557 39.147C29.6831 39.673 30.1946 40 30.7629 40H30.834C31.1213 39.9853 31.3975 39.8836 31.6258 39.7084C31.8542 39.5333 32.024 39.2928 32.1128 39.019L39.9278 14.8494C40.0104 14.6019 40.0224 14.3362 39.9625 14.0822C39.9026 13.8282 39.7732 13.596 39.5888 13.4114C39.4044 13.2269 39.1722 13.0974 38.9184 13.0375C38.6645 12.9776 38.399 12.9896 38.1516 13.0723L13.9821 20.8776C13.4137 21.0624 13.0301 21.5743 13.0016 22.1572C12.9732 22.7401 13.3142 23.2946 13.8542 23.5363Z"
        fill="white"
      />
    </Svg>
  );
}

const PlayerBadge = memo(function PlayerBadge({ label }: { label: string }) {
  return (
    <LinearGradient colors={['#17032B', '#4A0B86']} style={styles.playerBadge}>
      <Text style={styles.playerBadgeText}>{label}</Text>
      <FireIcon size={12} />
    </LinearGradient>
  );
});

const Avatar = memo(function Avatar({
  uri,
  name,
  onDoublePress,
}: {
  uri?: string | null;
  name: string;
  onDoublePress?: () => void;
}) {
  const lastTapRef = useRef(0);

  const handlePress = useCallback(() => {
    if (!onDoublePress) return;
    const now = Date.now();
    if (now - lastTapRef.current < AVATAR_DOUBLE_TAP_MS) {
      lastTapRef.current = 0;
      onDoublePress();
      return;
    }
    lastTapRef.current = now;
  }, [onDoublePress]);

  const content = uri ? (
    <Image source={{ uri }} style={styles.avatar} />
  ) : (
    <Text style={styles.avatarInitials}>{initials(name)}</Text>
  );

  if (onDoublePress) {
    return (
      <Pressable
        onPress={handlePress}
        style={[styles.avatarWrapper, !uri && styles.avatarFallback]}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityLabel={name}
      >
        {content}
      </Pressable>
    );
  }

  if (uri) {
    return (
      <View style={styles.avatarWrapper}>
        <Image source={{ uri }} style={styles.avatar} />
      </View>
    );
  }
  return (
    <View style={[styles.avatarWrapper, styles.avatarFallback]}>
      <Text style={styles.avatarInitials}>{initials(name)}</Text>
    </View>
  );
});

const LikeButton = memo(function LikeButton({
  likes,
  likedByMe,
  label,
  onPress,
}: {
  likes: number;
  likedByMe: boolean;
  label: string;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      disabled={!onPress}
      style={({ pressed }) => [styles.likeCounter, pressed && onPress ? styles.likeCounterPressed : null]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      {likedByMe ? <HeartFilledIcon size={18} /> : <HeartOutlineIcon size={18} />}
      <Text style={styles.likeText}>{formatLikes(likes)}</Text>
    </Pressable>
  );
});

const ChatMessageItem = memo(function ChatMessageItem({
  item,
  minute,
  likes,
  likedByMe,
  verified,
  proBadgeLabel,
  likeLabel,
  onLike,
  onReport,
  onAvatarDoublePress,
}: {
  item: MatchChatUiMessage;
  minute: string;
  likes: number;
  likedByMe: boolean;
  verified: boolean;
  proBadgeLabel: string;
  likeLabel: string;
  onLike: (id: string) => void;
  onReport: (message: MatchChatUiMessage) => void;
  onAvatarDoublePress?: (username: string) => void;
}) {
  const name = item.user.displayName || item.user.username || '';
  const handleLike = useCallback(() => onLike(item.id), [onLike, item.id]);
  const handleAvatarPress = useCallback(() => {
    const username = item.user.username?.trim();
    if (username) onAvatarDoublePress?.(username);
  }, [item.user.username, onAvatarDoublePress]);

  return (
    <Pressable
      onLongPress={item.pending ? undefined : () => onReport(item)}
      style={[styles.messageRow, item.failed && styles.messageFailed]}
    >
      <View style={styles.statsColumn}>
        <Text style={styles.minute}>{item.pending ? '…' : minute}</Text>
        <LikeButton likes={likes} likedByMe={likedByMe} label={likeLabel} onPress={handleLike} />
      </View>

      <View style={styles.messageContent}>
        <View style={styles.userInfoRow}>
          <View style={styles.userTextColumn}>
            {verified ? (
              <View style={styles.nameWithBadge}>
                <PlayerBadge label={proBadgeLabel} />
                <Text style={styles.username} numberOfLines={1}>
                  {name}
                </Text>
              </View>
            ) : (
              <Text style={styles.username} numberOfLines={1}>
                {name}
              </Text>
            )}
            <Text style={styles.messageText}>{item.text}</Text>
          </View>
          <Avatar
            uri={item.user.avatar}
            name={name}
            onDoublePress={item.user.username ? handleAvatarPress : undefined}
          />
        </View>
      </View>
    </Pressable>
  );
});

const ChatScoreHeader = memo(function ChatScoreHeader({
  summary,
  onClose,
  closeLabel,
}: {
  summary: MatchChatSummary;
  onClose: () => void;
  closeLabel: string;
}) {
  const homeScore = summary.homeScore != null && summary.homeScore !== '' ? String(summary.homeScore) : '0';
  const awayScore = summary.awayScore != null && summary.awayScore !== '' ? String(summary.awayScore) : '0';
  const short = summary.statusShort || '';
  const isHalftime = short === 'HT';
  const isNotPlayed = NOT_PLAYED_STATUSES.includes(short);
  const isPaused = PAUSED_STATUSES.includes(short);
  const isLive =
    !isNotPlayed && !isPaused && (LIVE_STATUSES.includes(short) || short === 'LIVE');
  const isFinished = !isNotPlayed && FINISHED_STATUSES.includes(short);
  const isStoppage = isLive && isLiveStoppage(short, summary.elapsed, summary.stoppage);

  const clockActive = isLive && !isStoppage && !isHalftime;
  useSecondTick(clockActive);
  const anchoredStart = useAnchoredPeriodStart(
    summary.clockAnchorKey,
    short,
    summary.elapsed,
    summary.startTimestamp,
  );
  const secondsLabel = clockActive
    ? resolveLiveSecondsLabel(short, summary.elapsed, {
        startTimestamp: anchoredStart,
        extra: summary.stoppage,
      })
    : undefined;
  const minuteLabel =
    secondsLabel ??
    resolveLiveMinuteLabel(short, summary.elapsed, {
      startTimestamp: anchoredStart,
      extra: summary.stoppage,
    }) ??
    (isLive ? short || summary.liveLabel || 'LIVE' : '');

  const statusLine = isLive
    ? minuteLabel
    : isFinished
      ? summary.statusLabel || summary.finishedLabel || short
      : isHalftime
        ? summary.halftimeLabel || 'HT'
        : isNotPlayed || isPaused
          ? summary.statusLabel || short
          : summary.kickoffStatusLabel || summary.statusLabel || '';

  const homeScorers = summary.scorers?.home?.filter((s) => s.name) ?? [];
  const awayScorers = summary.scorers?.away?.filter((s) => s.name) ?? [];
  const showScorers = homeScorers.length > 0 || awayScorers.length > 0;

  return (
    <View style={styles.scoreCardWrap}>
      <Pressable
        style={styles.closeFullBtn}
        onPress={onClose}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel={closeLabel}
      >
        <Ionicons name="chevron-down" size={22} color="#C1C1C1" />
      </Pressable>
      <View style={styles.scoreCard}>
        <LinearGradient colors={['#1D074A', '#090117']} style={StyleSheet.absoluteFill} />
        <View style={styles.scoreCardInner}>
          <View style={styles.scoreTeamCol}>
            {summary.homeLogo ? (
              <ExpoImage source={{ uri: summary.homeLogo }} style={styles.scoreTeamLogo} contentFit="contain" />
            ) : (
              <View style={[styles.scoreTeamLogo, styles.scoreTeamLogoFallback]}>
                <Text style={styles.scoreTeamLogoInitials}>{initials(summary.homeTeam)}</Text>
              </View>
            )}
            <Text style={styles.scoreTeamName} numberOfLines={2}>
              {summary.homeTeam}
            </Text>
          </View>

          <View style={styles.scoreCenterCol}>
            {summary.league ? (
              <LinearGradient colors={['rgba(42,6,75,0.55)', 'rgba(95,13,173,0.55)']} style={styles.leagueBadge}>
                <Text style={styles.leagueBadgeText} numberOfLines={1}>
                  {summary.league}
                </Text>
              </LinearGradient>
            ) : (
              <View style={styles.leagueBadgeSpacer} />
            )}
            <Text style={styles.scoreValue}>
              {homeScore} - {awayScore}
            </Text>
            <View style={styles.scoreStatusRow}>
              {isLive ? <View style={[styles.liveDot, isStoppage && styles.liveDotStoppage]} /> : null}
              <Text
                style={[styles.scoreStatus, isLive && styles.scoreStatusLive, isStoppage && styles.scoreStatusStoppage]}
                numberOfLines={1}
              >
                {statusLine}
              </Text>
            </View>
          </View>

          <View style={styles.scoreTeamCol}>
            {summary.awayLogo ? (
              <ExpoImage source={{ uri: summary.awayLogo }} style={styles.scoreTeamLogo} contentFit="contain" />
            ) : (
              <View style={[styles.scoreTeamLogo, styles.scoreTeamLogoFallback]}>
                <Text style={styles.scoreTeamLogoInitials}>{initials(summary.awayTeam)}</Text>
              </View>
            )}
            <Text style={styles.scoreTeamName} numberOfLines={2}>
              {summary.awayTeam}
            </Text>
          </View>
        </View>

        {showScorers ? (
          <View style={styles.scorersRow}>
            <View style={styles.scorersCol}>
              {homeScorers.map((s, i) => (
                <View key={`h-${s.name}-${s.minute}-${i}`} style={styles.scorerLine}>
                  <Text style={styles.scorerName} numberOfLines={1}>
                    {s.name}
                  </Text>
                  <Ionicons name="football" size={12} color="#c3c3c3" />
                  <Text style={styles.scorerMinute}>{s.minute}</Text>
                </View>
              ))}
            </View>
            <View style={styles.scorersDivider} />
            <View style={styles.scorersCol}>
              {awayScorers.map((s, i) => (
                <View key={`a-${s.name}-${s.minute}-${i}`} style={styles.scorerLine}>
                  <Text style={styles.scorerName} numberOfLines={1}>
                    {s.name}
                  </Text>
                  <Ionicons name="football" size={12} color="#c3c3c3" />
                  <Text style={styles.scorerMinute}>{s.minute}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}
      </View>
    </View>
  );
});

export function MatchChatTab({
  fixtureId,
  kickoffAt,
  matchSummary,
}: MatchChatTabProps): React.ReactElement {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user: clerkUser } = useUser();
  const { t } = useTranslation();
  const md = t.matchDetails;
  const listRef = useRef<FlashListRef<MatchChatUiMessage> | null>(null);
  const fullListRef = useRef<FlashListRef<MatchChatUiMessage> | null>(null);
  const [draft, setDraft] = useState('');
  const [now, setNow] = useState(Date.now());
  const [expanded, setExpanded] = useState(false);
  const [likedIds, setLikedIds] = useState<Record<string, true>>({});
  const nearBottomLatest = useRef(true);

  const {
    messages,
    signedIn,
    connection,
    warning,
    frozenUntil,
    unseenCount,
    nearBottom,
    lastError,
    send,
    loadOlder,
    setNearBottom,
    clearUnseen,
    clearWarning,
    clearLastError,
    report,
    maxLength,
  } = useMatchLiveChat({
    matchId: fixtureId,
    enabled: fixtureId > 0,
  });

  const activeListRef = expanded ? fullListRef : listRef;
  const keyboard = useChatKeyboard({
    listRef: activeListRef,
    hasMessages: messages.length > 0,
    messageCount: messages.length,
  });

  useEffect(() => {
    if (!lastError || lastError === 'AUTH' || connection === 'disconnected') return;
    const id = setTimeout(() => clearLastError(), 4500);
    return () => clearTimeout(id);
  }, [lastError, connection, clearLastError]);

  const rejectBannerText =
    lastError === 'RATE_LIMITED'
      ? md.chatRateLimited
      : lastError === 'MODERATION_BLOCKED'
        ? md.chatModerationBlocked
        : null;

  useEffect(() => {
    nearBottomLatest.current = nearBottom;
  }, [nearBottom]);

  useEffect(() => {
    if (!frozenUntil) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [frozenUntil]);

  const onAvatarDoublePress = useCallback(
    (username: string) => {
      const trimmed = username.trim();
      if (!trimmed) return;
      const selfUsername = clerkUser?.username?.trim();
      if (selfUsername && selfUsername.toLowerCase() === trimmed.toLowerCase()) return;
      router.push({ pathname: '/user/[username]' as any, params: { username: trimmed } } as any);
    },
    [router, clerkUser?.username],
  );

  useEffect(() => {
    if (!nearBottomLatest.current || messages.length === 0) return;
    const id = requestAnimationFrame(() => {
      safeFlashListScrollToEnd(listRef.current, false);
      if (expanded) safeFlashListScrollToEnd(fullListRef.current, false);
    });
    return () => cancelAnimationFrame(id);
  }, [messages.length, expanded]);

  const frozenMs = frozenUntil ? Math.max(0, frozenUntil - now) : 0;
  const frozen = frozenMs > 0;
  const online = connection === 'connected';
  const hasDraft = draft.trim().length > 0 && draft.trim().length <= maxLength;
  const canCompose = signedIn && !frozen;
  const canSend = canCompose && hasDraft && online;
  const isLoading = signedIn && connection === 'connecting' && messages.length === 0;

  const compactMessages = useMemo(() => {
    if (messages.length <= COMPACT_VISIBLE) return messages;
    return messages.slice(-COMPACT_VISIBLE);
  }, [messages]);

  const showAllCta = messages.length > 0 && !expanded;

  const reasonLabels = useMemo(
    () => ({
      PROFANITY: md.chatReportProfanity,
      ABUSE: md.chatReportAbuse,
      HARASSMENT: md.chatReportHarassment,
      SPAM: md.chatReportSpam,
      ADVERTISEMENT: md.chatReportAd,
      SUSPICIOUS_LINK: md.chatReportLink,
      OTHER: md.chatReportOther,
    }),
    [md],
  );

  const onReport = useCallback(
    (message: MatchChatUiMessage) => {
      const apply = (reason: MatchChatReportReason) => {
        void report(message.id, reason).then(
          () => Alert.alert(md.chatReportSent),
          () => Alert.alert(md.chatReportFailed),
        );
      };
      if (Platform.OS === 'ios') {
        ActionSheetIOS.showActionSheetWithOptions(
          {
            options: [md.chatReportCancel, ...REPORT_REASONS.map((r) => reasonLabels[r])],
            cancelButtonIndex: 0,
          },
          (index) => {
            if (!index) return;
            const reason = REPORT_REASONS[index - 1];
            if (reason) apply(reason);
          },
        );
        return;
      }
      Alert.alert(md.chatReportTitle, undefined, [
        { text: md.chatReportCancel, style: 'cancel' },
        ...REPORT_REASONS.map((reason) => ({
          text: reasonLabels[reason],
          onPress: () => apply(reason),
        })),
      ]);
    },
    [report, md, reasonLabels],
  );

  const onLike = useCallback((messageId: string) => {
    setLikedIds((prev) => {
      if (prev[messageId]) {
        const next = { ...prev };
        delete next[messageId];
        return next;
      }
      return { ...prev, [messageId]: true };
    });
  }, []);

  const onSend = useCallback(() => {
    if (!signedIn) {
      router.push('/auth');
      return;
    }
    if (frozen) return;
    if (!hasDraft) return;
    if (!online) {
      Alert.alert(md.chatSendBlockedTitle, md.chatSendBlockedOffline);
      return;
    }
    const ok = send(draft);
    if (ok) setDraft('');
  }, [signedIn, frozen, hasDraft, online, send, draft, router, md]);

  const onShowAllChats = useCallback(() => {
    setExpanded(true);
    void loadOlder();
  }, [loadOlder]);

  const onCloseFull = useCallback(() => {
    setExpanded(false);
  }, []);

  const onScroll = useCallback(
    (e: {
      nativeEvent: {
        contentOffset: { y: number };
        layoutMeasurement: { height: number };
        contentSize: { height: number };
      };
    }) => {
      const { contentOffset, layoutMeasurement, contentSize } = e.nativeEvent;
      const gap = contentSize.height - (contentOffset.y + layoutMeasurement.height);
      setNearBottom(gap < 80);
      if (contentOffset.y < 48) {
        void loadOlder();
      }
    },
    [loadOlder, setNearBottom],
  );

  const renderItem = useCallback(
    ({ item }: { item: MatchChatUiMessage }) => {
      const likedByMe = Boolean(likedIds[item.id]);
      return (
        <ChatMessageItem
          item={item}
          minute={formatMatchMinute(item.createdAt, kickoffAt)}
          likes={likedByMe ? 1 : 0}
          likedByMe={likedByMe}
          verified={false}
          proBadgeLabel={md.chatProBadge}
          likeLabel={md.chatLikeLabel}
          onLike={onLike}
          onReport={onReport}
          onAvatarDoublePress={onAvatarDoublePress}
        />
      );
    },
    [likedIds, kickoffAt, md.chatProBadge, md.chatLikeLabel, onLike, onReport, onAvatarDoublePress],
  );

  const empty = (
    <View style={styles.emptyState}>
      <Ionicons name="chatbubble-ellipses-outline" size={32} color="#3B0769" />
      <Text style={styles.emptyTitle}>{signedIn ? md.chatEmptyFirst : md.chatLoginTitle}</Text>
      {!signedIn ? <Text style={styles.emptyHint}>{md.chatLoginHint}</Text> : null}
      {!signedIn ? (
        <Pressable style={styles.loginBtn} onPress={() => router.push('/auth')} accessibilityRole="button">
          <Text style={styles.loginBtnText}>{md.chatLoginCta}</Text>
        </Pressable>
      ) : null}
    </View>
  );

  const banners = (
    <>
      {warning ? (
        <Pressable style={styles.warnBanner} onPress={clearWarning}>
          <Text style={styles.warnText}>{md.chatWarning}</Text>
        </Pressable>
      ) : null}
      {rejectBannerText && connection === 'connected' ? (
        <Pressable style={styles.warnBanner} onPress={clearLastError}>
          <Text style={styles.warnText}>{rejectBannerText}</Text>
        </Pressable>
      ) : null}
      {signedIn && connection === 'connecting' && messages.length > 0 ? (
        <View style={styles.statusBanner}>
          <Text style={styles.statusText}>{md.chatConnecting}</Text>
        </View>
      ) : null}
      {signedIn && connection === 'disconnected' ? (
        <View style={styles.statusBannerOffline}>
          <Text style={styles.statusTextOffline}>{md.chatDisconnected}</Text>
          {lastError ? <Text style={styles.statusError}>{lastError}</Text> : null}
        </View>
      ) : null}
      {frozen ? (
        <View style={styles.freezeBanner}>
          <Text style={styles.freezeText}>
            {md.chatFrozen.replace('{seconds}', String(Math.ceil(frozenMs / 1000)))}
          </Text>
        </View>
      ) : null}
    </>
  );

  const composer = (safeBottom: number) => {
    const keyboardOpen = keyboard.composerKeyboardLift > 0;
    return (
      <LinearGradient
        colors={['#07040D', '#0C051A']}
        style={[
          styles.composerBar,
          {
            paddingBottom: keyboardOpen
              ? keyboard.composerDockPadding
              : Math.max(safeBottom, 12),
            marginBottom: keyboardOpen
              ? Math.max(0, keyboard.composerKeyboardLift - insets.bottom)
              : 0,
          },
        ]}
      >
        <Pressable
          style={({ pressed }) => [styles.sendHit, pressed && canSend && styles.sendHitPressed]}
          onPress={onSend}
          disabled={!canSend && signedIn}
          accessibilityRole="button"
          accessibilityLabel={md.chatSend}
          accessibilityState={{ disabled: !canSend && signedIn }}
        >
          <SendButtonIcon size={53} disabled={!canSend && signedIn} />
        </Pressable>

        <View style={[styles.inputContainer, (frozen || !signedIn) && styles.inputContainerDisabled]}>
          <FaceSmileIcon size={24} />
          <TextInput
            style={styles.input}
            placeholder={
              frozen ? md.chatFrozenPlaceholder : !signedIn ? md.chatLoginHint : md.chatPlaceholder
            }
            placeholderTextColor="#484050"
            textAlign="right"
            textAlignVertical="center"
            editable={signedIn && !frozen}
            value={draft}
            onChangeText={setDraft}
            maxLength={maxLength}
            returnKeyType="send"
            onSubmitEditing={onSend}
            blurOnSubmit={false}
            onFocus={keyboard.onInputFocus}
          />
          {draft.length > maxLength - 40 ? (
            <Text style={styles.counter}>{maxLength - draft.length}</Text>
          ) : null}
        </View>
      </LinearGradient>
    );
  };

  const feedBody = (
    list: 'compact' | 'full',
    data: MatchChatUiMessage[],
  ) => (
    <View style={styles.feed}>
      {isLoading ? (
        <View style={styles.loadingState}>
          <ActivityIndicator color="#8C5CF6" />
        </View>
      ) : messages.length === 0 ? (
        empty
      ) : (
        <FlashList
          ref={list === 'full' ? fullListRef : listRef}
          data={data}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          onScroll={onScroll}
          scrollEventThrottle={16}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={
            list === 'compact' ? styles.listContentCompact : styles.listContentFull
          }
          showsVerticalScrollIndicator={false}
        />
      )}
      {unseenCount > 0 ? (
        <Pressable
          style={styles.newChip}
          onPress={() => {
            clearUnseen();
            safeFlashListScrollToEnd(list === 'full' ? fullListRef.current : listRef.current, true);
          }}
        >
          <Text style={styles.newChipText}>{md.chatNewMessages}</Text>
        </Pressable>
      ) : null}
    </View>
  );

  return (
    <View style={styles.wrap}>
      {banners}

      <View style={styles.compactBody}>
        {feedBody('compact', compactMessages)}

        {showAllCta ? (
          <LinearGradient
            colors={['rgba(10,5,21,0)', 'rgba(10,5,21,0.54)', '#0A0515']}
            locations={[0, 0.35, 1]}
            style={styles.showAllOverlay}
            pointerEvents="box-none"
          >
            <Pressable
              style={({ pressed }) => [styles.allChatsButton, pressed && styles.allChatsButtonPressed]}
              onPress={onShowAllChats}
              accessibilityRole="button"
            >
              <Text style={styles.allChatsText}>{md.chatShowAll}</Text>
            </Pressable>
          </LinearGradient>
        ) : null}
      </View>

      {!expanded ? composer(Math.max(insets.bottom, 8)) : null}

      <Modal
        visible={expanded}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={onCloseFull}
      >
        <View style={styles.fullWrap}>
          <StatusBar barStyle="light-content" backgroundColor="#07040D" />
          <View style={[styles.fullInner, { paddingTop: Math.max(insets.top, 12) }]}>
            {matchSummary ? (
              <ChatScoreHeader
                summary={matchSummary}
                onClose={onCloseFull}
                closeLabel={md.chatCloseFull}
              />
            ) : (
              <View style={styles.fullTopBar}>
                <Pressable onPress={onCloseFull} hitSlop={12} accessibilityRole="button">
                  <Ionicons name="chevron-down" size={24} color="#C1C1C1" />
                </Pressable>
                <Text style={styles.fullTopTitle}>{md.chats}</Text>
                <View style={{ width: 24 }} />
              </View>
            )}
            {banners}
            {feedBody('full', messages)}
            {composer(Math.max(insets.bottom, 12))}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: '#08050D',
  },
  fullWrap: {
    flex: 1,
    backgroundColor: '#07040D',
  },
  fullInner: {
    flex: 1,
    backgroundColor: '#07040D',
  },
  compactBody: {
    flex: 1,
    position: 'relative',
  },
  feed: {
    flex: 1,
  },
  listContentCompact: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 72,
  },
  listContentFull: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 20,
  },
  loadingState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingVertical: 60,
    gap: 10,
  },
  emptyTitle: {
    fontSize: 14,
    color: '#6B5B7A',
    fontWeight: '500',
    textAlign: 'center',
  },
  emptyHint: {
    color: '#6B5B7A',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
  },
  loginBtn: {
    marginTop: 8,
    backgroundColor: '#4A0FD1',
    borderRadius: 18,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  loginBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  warnBanner: {
    backgroundColor: 'rgba(245, 166, 35, 0.18)',
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  warnText: {
    color: '#ffd27a',
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '600',
  },
  statusBanner: {
    backgroundColor: 'rgba(129,10,242,0.18)',
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  statusBannerOffline: {
    backgroundColor: 'rgba(239, 68, 68, 0.16)',
    paddingVertical: 8,
    paddingHorizontal: 14,
    gap: 4,
  },
  statusText: {
    color: '#d4b3ff',
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '600',
  },
  statusTextOffline: {
    color: '#fecaca',
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '600',
  },
  statusError: {
    color: 'rgba(254,202,202,0.75)',
    textAlign: 'center',
    fontSize: 10,
  },
  freezeBanner: {
    backgroundColor: 'rgba(220, 38, 38, 0.2)',
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  freezeText: {
    color: '#fecaca',
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '600',
  },
  newChip: {
    position: 'absolute',
    alignSelf: 'center',
    bottom: 12,
    backgroundColor: '#8B5CF6',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  newChipText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 12,
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 20,
    gap: 11,
  },
  messageFailed: {
    opacity: 0.65,
  },
  statsColumn: {
    width: 60,
    alignItems: 'flex-end',
    gap: 8,
  },
  minute: {
    fontSize: 14,
    color: '#C1C1C1',
    fontWeight: '400',
    lineHeight: 17,
  },
  likeCounter: {
    minWidth: 60,
    height: 25,
    borderRadius: 35,
    paddingHorizontal: 8,
    backgroundColor: '#1A052D',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  likeCounterPressed: {
    opacity: 0.7,
  },
  likeText: {
    fontSize: 13,
    color: '#A852FA',
    fontWeight: '400',
  },
  messageContent: {
    flex: 1,
    minWidth: 0,
  },
  userInfoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'flex-end',
    gap: 10,
  },
  userTextColumn: {
    flex: 1,
    alignItems: 'flex-end',
    gap: 8,
    minWidth: 0,
  },
  username: {
    fontSize: 12,
    color: '#C1C1C1',
    fontWeight: '400',
    lineHeight: 15,
  },
  nameWithBadge: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'flex-end',
    gap: 8,
  },
  playerBadge: {
    height: 17,
    minWidth: 63,
    paddingHorizontal: 5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    borderRadius: 29,
    borderWidth: 0.5,
    borderColor: '#3A0869',
  },
  playerBadgeText: {
    fontSize: 7,
    color: '#A34FF4',
    fontWeight: '500',
  },
  messageText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '500',
    lineHeight: 21,
    textAlign: 'right',
  },
  avatarWrapper: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: 'rgba(128, 59, 69, 0.5)',
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  avatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3a1d5c',
  },
  avatarInitials: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  showAllOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 100,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 14,
  },
  allChatsButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  allChatsButtonPressed: {
    opacity: 0.6,
  },
  allChatsText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#8B5CF6',
  },
  composerBar: {
    width: '100%',
    borderTopWidth: 2,
    borderTopColor: '#24193B',
    minHeight: 125,
    paddingHorizontal: 18,
    paddingTop: 17,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  sendHit: {
    width: 53,
    height: 53,
  },
  sendHitPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.96 }],
  },
  inputContainer: {
    flex: 1,
    height: 53,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#07030D',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#2E2933',
    gap: 10,
  },
  inputContainerDisabled: {
    opacity: 0.5,
  },
  input: {
    flex: 1,
    height: 53,
    fontSize: 13,
    fontWeight: '500',
    color: '#FFFFFF',
    paddingVertical: 0,
  },
  counter: {
    color: '#9a9a9a',
    fontSize: 11,
  },
  scoreCardWrap: {
    paddingHorizontal: 14,
    marginBottom: 8,
  },
  closeFullBtn: {
    alignSelf: 'center',
    marginBottom: 6,
    padding: 4,
  },
  scoreCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#1B0F39',
    overflow: 'hidden',
    minHeight: 140,
    justifyContent: 'center',
  },
  scoreCardInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 28,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  scoreTeamCol: {
    width: 95,
    alignItems: 'center',
    gap: 8,
  },
  scoreTeamLogo: {
    width: 68,
    height: 68,
  },
  scoreTeamLogoFallback: {
    borderRadius: 34,
    backgroundColor: 'rgba(128, 59, 69, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreTeamLogoInitials: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  scoreTeamName: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
  },
  scoreCenterCol: {
    width: 110,
    alignItems: 'center',
    gap: 8,
  },
  leagueBadge: {
    minWidth: 78,
    maxWidth: 120,
    height: 23,
    paddingHorizontal: 10,
    borderRadius: 41,
    borderWidth: 1,
    borderColor: '#370565',
    alignItems: 'center',
    justifyContent: 'center',
  },
  leagueBadgeSpacer: {
    height: 23,
  },
  leagueBadgeText: {
    color: '#B363FF',
    fontSize: 7,
    fontWeight: '600',
    textAlign: 'center',
  },
  scoreValue: {
    color: '#FFFFFF',
    fontSize: 36,
    fontWeight: '600',
    textAlign: 'center',
  },
  scoreStatus: {
    color: '#B7B7B7',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  scoreStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  scoreStatusLive: {
    color: '#ef4444',
    fontVariant: ['tabular-nums'],
  },
  scoreStatusStoppage: {
    color: '#fca5a5',
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#ef4444',
  },
  liveDotStoppage: {
    backgroundColor: '#f87171',
  },
  scorersRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 14,
    paddingBottom: 12,
    gap: 8,
  },
  scorersCol: {
    flex: 1,
    gap: 4,
  },
  scorersDivider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
    backgroundColor: 'rgba(83, 25, 138, 0.55)',
  },
  scorerLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  scorerName: {
    color: '#c3c3c3',
    fontSize: 11,
    fontWeight: '500',
    maxWidth: 90,
  },
  scorerMinute: {
    color: '#9ca3af',
    fontSize: 11,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  fullTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  fullTopTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

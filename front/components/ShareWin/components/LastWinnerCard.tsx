/**
 * "آخر فائز" — Figma node 196:111.
 *
 * The winner is the rank-1 standing of the most recently CLOSED cycle, read
 * from the backend. Nothing is hardcoded: before the first week ends there is
 * no winner, and the card shows its empty state instead.
 */

import React, { memo } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';

import { useTranslation } from '../../../src/i18n';
import type { ShareWinLastWinner } from '../../../services/shareWin.service';
import { SW_ASSET } from '../assets';
import { displayNameOf, formatWinnerAge } from '../data';
import { SW_COLOR, SW_GRADIENT, useShareWinStyles } from '../styles';

interface LastWinnerCardProps {
  winner: ShareWinLastWinner | null;
  onViewStory: (winner: ShareWinLastWinner) => void;
}

const LastWinnerCard = memo(function LastWinnerCard({
  winner,
  onViewStory,
}: LastWinnerCardProps) {
  const { sw, metrics } = useShareWinStyles();
  const { t } = useTranslation();
  const copy = t.shareWin;
  const { s } = metrics;

  return (
    <View style={sw.winnerSection}>
      <View style={sw.winnerTitleRow}>
        <Text style={sw.winnerTitle} accessibilityRole="header">
          {copy.lastWinnerTitle}
        </Text>
        <Image
          source={SW_ASSET.star}
          style={{ width: s(29), height: s(29) }}
          contentFit="contain"
          transition={0}
        />
      </View>

      <View style={[sw.winnerCard, { backgroundColor: SW_COLOR.cardBg }]}>
        {winner ? (
          <>
            {/* Figma backs this card with the winner's photo. When the real
                winner has no avatar we show only the scrim — never the stock
                face from the mock, which would read as a fabricated winner. */}
            {winner.avatar ? (
              <Image
                source={{ uri: winner.avatar }}
                style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}
                contentFit="cover"
                contentPosition="top"
                transition={200}
                cachePolicy="memory-disk"
              />
            ) : null}
            <LinearGradient
              colors={SW_GRADIENT.winnerScrim}
              locations={SW_GRADIENT.winnerScrimLocations}
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 1 }}
              style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}
            />

            <View style={sw.winnerTopRow}>
              <View style={sw.winnerIdentity}>
                <View style={sw.winnerNameCol}>
                  <Text style={sw.winnerName} numberOfLines={1}>
                    {displayNameOf(winner)}
                  </Text>
                  <Text style={sw.winnerMeta}>
                    {formatWinnerAge(winner, {
                      hours: copy.timeAgoHours,
                      days: copy.timeAgoDays,
                      now: copy.timeAgoNow,
                    })}
                  </Text>
                </View>
                <Image
                  source={winner.avatar ? { uri: winner.avatar } : SW_ASSET.usersDuo}
                  style={sw.winnerAvatar}
                  contentFit="cover"
                  transition={150}
                  cachePolicy="memory-disk"
                />
              </View>
            </View>

            <Pressable
              style={sw.winnerStoryRow}
              onPress={() => onViewStory(winner)}
              accessibilityRole="button"
              accessibilityLabel={copy.lastWinnerViewStory}
              hitSlop={8}
            >
              <Image
                source={SW_ASSET.arrowRight}
                style={{
                  width: s(13),
                  height: s(13),
                  transform: [{ rotate: '180deg' }, { scaleY: -1 }],
                }}
                contentFit="contain"
                transition={0}
              />
              <Text style={sw.winnerStoryText}>{copy.lastWinnerViewStory}</Text>
            </Pressable>
          </>
        ) : (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={sw.winnerEmpty}>{copy.lastWinnerNone}</Text>
          </View>
        )}
      </View>
    </View>
  );
});

export default LastWinnerCard;

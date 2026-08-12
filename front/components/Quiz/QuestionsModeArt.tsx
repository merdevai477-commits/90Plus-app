import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  ArrowLeftRight,
  CircleHelp,
  ClipboardList,
  GitBranch,
  Grid3X3,
  Shield,
  Table,
  Trophy,
  User,
} from 'lucide-react-native';
import type { QuestionModeId } from '../../services/questionsModes';

const PURPLE = '#8351F5';
const PURPLE_SOFT = 'rgba(131,81,245,0.35)';
const PURPLE_GLOW = 'rgba(131,81,245,0.18)';

function GlowBackdrop({ size }: { size: number }) {
  return (
    <LinearGradient
      colors={['rgba(131,81,245,0.28)', 'rgba(131,81,245,0.06)', 'transparent']}
      style={[styles.glow, { width: size * 0.92, height: size * 0.92, borderRadius: size * 0.12 }]}
    />
  );
}

function GuessPlayerArt({ size }: { size: number }) {
  const body = size * 0.52;
  return (
    <View style={[styles.artRoot, { width: size, height: size }]}>
      <GlowBackdrop size={size} />
      <View style={[styles.silhouette, { width: body, height: body * 1.15, borderRadius: body * 0.12 }]}>
        <User size={body * 0.55} color={PURPLE} strokeWidth={1.6} />
      </View>
      <View style={[styles.qBadge, { width: size * 0.28, height: size * 0.28, borderRadius: size * 0.06 }]}>
        <CircleHelp size={size * 0.16} color="#FFF" strokeWidth={2.2} />
      </View>
    </View>
  );
}

function BingoArt({ size }: { size: number }) {
  const cell = size * 0.17;
  return (
    <View style={[styles.artRoot, { width: size, height: size }]}>
      <GlowBackdrop size={size} />
      <View style={styles.bingoGrid}>
        {Array.from({ length: 9 }).map((_, i) => (
          <View
            key={i}
            style={[
              styles.bingoCell,
              {
                width: cell,
                height: cell,
                borderRadius: cell * 0.22,
                backgroundColor: i === 4 ? PURPLE_GLOW : 'rgba(255,255,255,0.04)',
                borderColor: i === 4 ? PURPLE : 'rgba(131,81,245,0.25)',
              },
            ]}
          />
        ))}
      </View>
      <Grid3X3 size={size * 0.18} color={PURPLE} strokeWidth={2} style={styles.bingoIcon} />
    </View>
  );
}

function GridArt({ size }: { size: number }) {
  const cell = size * 0.21;
  return (
    <View style={[styles.artRoot, { width: size, height: size }]}>
      <GlowBackdrop size={size} />
      <View style={styles.gridWrap}>
        {Array.from({ length: 6 }).map((_, i) => (
          <View
            key={i}
            style={[
              styles.gridCell,
              { width: cell, height: cell * 0.72, borderRadius: cell * 0.12 },
            ]}
          />
        ))}
      </View>
    </View>
  );
}

function ConnectionsArt({ size }: { size: number }) {
  const dot = size * 0.22;
  return (
    <View style={[styles.artRoot, { width: size, height: size }]}>
      <GlowBackdrop size={size} />
      <View style={[styles.connLine, { width: size * 0.55, transform: [{ rotate: '25deg' }] }]} />
      <View style={[styles.connLine, { width: size * 0.55, transform: [{ rotate: '-25deg' }] }]} />
      <View style={[styles.connLine, { width: size * 0.42, transform: [{ rotate: '90deg' }] }]} />
      {[0, 1, 2].map((i) => (
        <View
          key={i}
          style={[
            styles.connDot,
            {
              width: dot,
              height: dot,
              borderRadius: dot * 0.2,
              top: i === 0 ? size * 0.12 : i === 1 ? size * 0.58 : size * 0.58,
              left: i === 0 ? size * 0.39 : i === 1 ? size * 0.1 : size * 0.68,
            },
          ]}
        />
      ))}
      <GitBranch size={size * 0.16} color={PURPLE} strokeWidth={2} style={{ position: 'absolute', bottom: 4, right: 4 }} />
    </View>
  );
}

function ClubArt({ size }: { size: number }) {
  const badge = size * 0.24;
  return (
    <View style={[styles.artRoot, { width: size, height: size }]}>
      <GlowBackdrop size={size} />
      <View style={styles.clubRow}>
        {[0, 1, 2].map((i) => (
          <View
            key={i}
            style={[
              styles.clubBadge,
              {
                width: badge,
                height: badge,
                borderRadius: badge * 0.2,
                marginTop: i === 1 ? -8 : 0,
              },
            ]}
          >
            <Shield size={badge * 0.5} color={PURPLE} strokeWidth={1.8} />
          </View>
        ))}
      </View>
    </View>
  );
}

function TransferArt({ size }: { size: number }) {
  const avatar = size * 0.26;
  return (
    <View style={[styles.artRoot, { width: size, height: size }]}>
      <GlowBackdrop size={size} />
      <View style={[styles.transferAvatar, { width: avatar, height: avatar, borderRadius: avatar * 0.2, left: size * 0.1 }]}>
        <User size={avatar * 0.45} color={PURPLE} strokeWidth={1.8} />
      </View>
      <View style={[styles.transferAvatar, { width: avatar, height: avatar, borderRadius: avatar * 0.2, right: size * 0.1 }]}>
        <User size={avatar * 0.45} color={PURPLE} strokeWidth={1.8} />
      </View>
      <ArrowLeftRight size={size * 0.22} color={PURPLE} strokeWidth={2.2} />
    </View>
  );
}

function Top10Art({ size }: { size: number }) {
  return (
    <View style={[styles.artRoot, { width: size, height: size }]}>
      <GlowBackdrop size={size} />
      <LinearGradient
        colors={['#8351F5', '#5B21B6']}
        style={[styles.top10Podium, { width: size * 0.55, height: size * 0.38, borderRadius: size * 0.08 }]}
      >
        <Trophy size={size * 0.16} color="#FFF" strokeWidth={2} style={{ marginBottom: 2 }} />
      </LinearGradient>
      <View style={[styles.top10NumWrap, { width: size * 0.36, height: size * 0.36, borderRadius: size * 0.1, top: size * 0.08 }]}>
        <Text style={[styles.top10Text, { fontSize: size * 0.22, lineHeight: size * 0.24 }]}>10</Text>
      </View>
    </View>
  );
}

function QuizArt({ size }: { size: number }) {
  const boardW = size * 0.52;
  const boardH = size * 0.62;
  return (
    <View style={[styles.artRoot, { width: size, height: size }]}>
      <GlowBackdrop size={size} />
      <View style={[styles.clipboard, { width: boardW, height: boardH, borderRadius: size * 0.06 }]}>
        {[0, 1, 2].map((i) => (
          <View key={i} style={[styles.checkRow, { marginTop: i === 0 ? 0 : size * 0.05 }]}>
            <View style={[styles.checkBox, { width: size * 0.08, height: size * 0.08, borderRadius: 3 }]} />
            <View style={[styles.checkLine, { width: boardW * 0.55, height: size * 0.04 }]} />
          </View>
        ))}
      </View>
      <ClipboardList size={size * 0.14} color={PURPLE} strokeWidth={2} style={{ position: 'absolute', bottom: 6, right: 8 }} />
    </View>
  );
}

const ART_BY_MODE: Record<QuestionModeId, React.ComponentType<{ size: number }>> = {
  'guess-player': GuessPlayerArt,
  'football-bingo': BingoArt,
  'football-grid': GridArt,
  'player-connections': ConnectionsArt,
  'guess-club': ClubArt,
  'transfer-puzzle': TransferArt,
  'top10-challenge': Top10Art,
  'football-quiz': QuizArt,
};

export function QuestionsModeArt({ modeId, size }: { modeId: QuestionModeId; size: number }) {
  const Art = ART_BY_MODE[modeId] ?? GuessPlayerArt;
  return <Art size={size} />;
}

const styles = StyleSheet.create({
  artRoot: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  glow: {
    position: 'absolute',
  },
  silhouette: {
    backgroundColor: PURPLE_GLOW,
    borderWidth: 1,
    borderColor: PURPLE_SOFT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qBadge: {
    position: 'absolute',
    top: '8%',
    right: '18%',
    backgroundColor: PURPLE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bingoGrid: {
    width: '72%',
    aspectRatio: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    justifyContent: 'center',
  },
  bingoCell: {
    borderWidth: 1,
  },
  bingoIcon: {
    position: 'absolute',
    bottom: 6,
    right: 8,
  },
  gridWrap: {
    width: '78%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
    justifyContent: 'center',
  },
  gridCell: {
    backgroundColor: 'rgba(131,81,245,0.12)',
    borderWidth: 1,
    borderColor: PURPLE_SOFT,
  },
  connLine: {
    position: 'absolute',
    height: 2,
    backgroundColor: PURPLE,
    opacity: 0.65,
  },
  connDot: {
    position: 'absolute',
    backgroundColor: PURPLE_GLOW,
    borderWidth: 1.5,
    borderColor: PURPLE,
  },
  clubRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
  },
  clubBadge: {
    backgroundColor: PURPLE_GLOW,
    borderWidth: 1,
    borderColor: PURPLE_SOFT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  transferAvatar: {
    position: 'absolute',
    backgroundColor: PURPLE_GLOW,
    borderWidth: 1,
    borderColor: PURPLE_SOFT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  top10Podium: {
    position: 'absolute',
    bottom: '12%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  top10NumWrap: {
    position: 'absolute',
    backgroundColor: '#1A0A30',
    borderWidth: 2,
    borderColor: PURPLE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  top10Text: {
    color: PURPLE,
    fontWeight: '900',
  },
  clipboard: {
    backgroundColor: 'rgba(131,81,245,0.1)',
    borderWidth: 1.5,
    borderColor: PURPLE_SOFT,
    padding: 8,
    justifyContent: 'center',
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  checkBox: {
    backgroundColor: PURPLE,
  },
  checkLine: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 2,
  },
});

/**
 * MessageBubble.tsx — Native
 * AI bubble: left-aligned; user bubble: right-aligned.
 */

import React, {
  useEffect, useRef, useState, useMemo, useCallback, useSyncExternalStore,
} from 'react';
import {
  View, Text, Pressable, StyleSheet, Platform, TextStyle, useWindowDimensions,
} from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import Animated, {
  FadeIn,
  useSharedValue,
  withSpring,
  withRepeat,
  withTiming,
  withDelay,
  useAnimatedStyle,
  Easing,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useTranslation } from '../../src/i18n';

import { MessageContextMenu } from '../chat/MessageContextMenu';
import { Message } from '../../hooks/useAIChatNative';
import { useChatTheme } from '../../hooks/useChatTheme';
import { getTextDirectionStyles, useBubbleMaxWidth } from './chatTextUtils';
import { ChatNavLinks } from './ChatNavLinks';
import type { ChatColors } from './chatTheme';
import { decodeChatNavMarker } from '../../utils/chatNavLinks';
import { peekChatStream, subscribeChatStream } from './chatStreamText';

const AI_BUBBLE_RADIUS = 22;

// ─── Types ────────────────────────────────────────────────────────────────────

interface MessageBubbleProps {
  message: Message;
  index?: number;
  isHistory?: boolean;
  bubbleMaxWidth?: number;
  bubbleMinWidth?: number;
  onResend?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onCopy?: () => void;
  onNavChoice?: (text: string) => void;
}

// ─── Themed styles ────────────────────────────────────────────────────────────

export type MessageBubbleStyles = ReturnType<typeof createMessageBubbleStyles>;

function tableFadeStops(tableFade: string, side: 'left' | 'right'): [string, string] {
  const clear = tableFade.replace(/,\s*[\d.]+\)\s*$/, ',0)');
  return side === 'left' ? [tableFade, clear] : [clear, tableFade];
}

function createMessageBubbleStyles(colors: ChatColors) {
  return StyleSheet.create({
    aiRow: {
      width: '100%',
      alignSelf: 'stretch',
      flexDirection: 'row',
      justifyContent: 'flex-start',
      marginVertical: 6,
      paddingHorizontal: 0,
    },
    aiBubbleWrap: {},
    aiBubbleShell: {
      borderRadius: AI_BUBBLE_RADIUS,
      ...Platform.select({
        ios: {
          shadowColor: colors.accentDeep,
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.18,
          shadowRadius: 6,
        },
        default: {},
      }),
    },
    aiBubble: {
      borderRadius: AI_BUBBLE_RADIUS,
      overflow: 'hidden',
      backgroundColor: colors.aiBubbleBg,
      borderWidth: 1,
      borderColor: colors.aiBubbleBorder,
    },
    ctaFooter: {
      paddingHorizontal: 10,
      paddingTop: 2,
      paddingBottom: 10,
    },
    aiBubbleInner: {
      width: '100%',
      alignSelf: 'stretch',
      paddingHorizontal: 16,
      paddingVertical: 14,
      gap: 2,
      zIndex: 1,
    },
    aiTs: {
      fontSize: 10,
      color: colors.textFaint,
      marginTop: 4,
      textAlign: 'left',
      paddingLeft: 4,
    },
    userRow: {
      width: '100%',
      alignSelf: 'stretch',
      flexDirection: 'row',
      justifyContent: 'flex-end',
      marginVertical: 6,
      paddingHorizontal: 0,
    },
    userBubbleWrap: {},
    userBubble: {
      borderRadius: 18,
      borderTopRightRadius: 4,
      borderBottomRightRadius: 4,
      overflow: 'hidden',
      borderWidth: 0.5,
      borderColor: colors.aiBubbleBorder,
      ...Platform.select({
        ios: {
          shadowColor: colors.accentDeep,
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.22,
          shadowRadius: 5,
        },
        android: { elevation: 0 },
      }),
    },
    userBubbleInnerBorder: {
      ...StyleSheet.absoluteFillObject,
      borderRadius: 18,
      borderTopRightRadius: 4,
      borderBottomRightRadius: 4,
      borderWidth: 0.5,
      borderColor: colors.aiBubbleBorder,
      zIndex: 2,
    },
    userText: {
      fontSize: 15,
      color: colors.textInverse,
      lineHeight: 22,
      flexShrink: 1,
      paddingHorizontal: 14,
      paddingVertical: 10,
      zIndex: 3,
    },
    userTs: {
      fontSize: 10,
      color: colors.textFaint,
      marginTop: 4,
      textAlign: 'right',
      paddingRight: 4,
    },
    typingDots: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 16,
      paddingVertical: 14,
    },
    waveDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.accentSoft,
    },
    cursor: {
      color: colors.accentSoft,
      fontSize: 14,
    },
    paragraph: {
      fontSize: 14,
      color: colors.textPrimary,
      lineHeight: 21,
      alignSelf: 'stretch',
      width: '100%',
    },
    boldTitle: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.textPrimary,
      marginTop: 6,
      marginBottom: 2,
    },
    bold: { fontWeight: '700', color: colors.textPrimary },
    italic: { fontStyle: 'italic', color: colors.textSecondary },
    listRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, width: '100%' },
    bullet: { color: colors.accentSoft, fontSize: 15, marginTop: 2, flexShrink: 0 },
    listText: {
      flex: 1,
      flexShrink: 1,
      fontSize: 14,
      color: colors.textSecondary,
      lineHeight: 21,
    },
    numBadge: {
      width: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: colors.tableHeadBg,
      borderWidth: 0.5,
      borderColor: colors.tableBorder,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
      marginTop: 2,
    },
    numText: { fontSize: 10, fontWeight: '700', color: colors.accentSoft },
    spacer: { height: 4 },
    divider: { height: 0.5, backgroundColor: colors.divider, marginVertical: 10 },
    h1: {
      fontSize: 20,
      fontWeight: '800',
      color: colors.textPrimary,
      marginTop: 10,
      marginBottom: 6,
      borderBottomWidth: 0.5,
      borderBottomColor: colors.divider,
      paddingBottom: 4,
    },
    h2: {
      fontSize: 17,
      fontWeight: '700',
      color: colors.textPrimary,
      marginTop: 8,
      marginBottom: 4,
    },
    h3: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.accentSoft,
      marginTop: 6,
      marginBottom: 4,
    },
    codeBlock: {
      backgroundColor: colors.codeBlockBg,
      borderRadius: 10,
      borderWidth: 0.5,
      borderColor: colors.codeBlockBorder,
      borderLeftWidth: 3,
      borderLeftColor: colors.accentDeep,
      padding: 12,
      marginVertical: 6,
      alignSelf: 'stretch',
    },
    codeText: {
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
      fontSize: 12,
      color: colors.accentSoft,
      lineHeight: 19,
      flexShrink: 1,
    },
    tableBlock: {
      alignSelf: 'stretch',
      width: '100%',
      maxWidth: '100%',
      marginVertical: 8,
    },
    tableHintRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      marginBottom: 8,
      paddingHorizontal: 4,
    },
    tableHint: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.accentSoft,
      textAlign: 'center',
      flexShrink: 1,
    },
    tableScrollShell: {
      position: 'relative',
      alignSelf: 'stretch',
      minHeight: 52,
    },
    tableFadeLeft: {
      position: 'absolute',
      left: 0,
      top: 0,
      bottom: 0,
      width: 28,
      zIndex: 3,
      borderTopLeftRadius: 10,
      borderBottomLeftRadius: 10,
    },
    tableFadeRight: {
      position: 'absolute',
      right: 0,
      top: 0,
      bottom: 0,
      width: 28,
      zIndex: 3,
      borderTopRightRadius: 10,
      borderBottomRightRadius: 10,
    },
    tableArrowLeft: {
      position: 'absolute',
      left: 2,
      top: 0,
      bottom: 0,
      justifyContent: 'center',
      zIndex: 4,
    },
    tableArrowRight: {
      position: 'absolute',
      right: 2,
      top: 0,
      bottom: 0,
      justifyContent: 'center',
      zIndex: 4,
    },
    tableArrowBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.accentDeep,
      borderWidth: 1,
      borderColor: colors.divider,
      alignItems: 'center',
      justifyContent: 'center',
      ...Platform.select({
        ios: {
          shadowColor: colors.accentDeep,
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.45,
          shadowRadius: 6,
        },
        android: { elevation: 6 },
      }),
    },
    tableArrowBtnDisabled: {
      opacity: 0.38,
    },
    tableScroll: {
      flexGrow: 0,
      borderRadius: 10,
      borderWidth: 0.5,
      borderColor: colors.tableBorder,
    },
    tableScrollContent: {
      flexGrow: 0,
    },
    table: {
      borderRadius: 12,
      overflow: 'hidden',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.tableBorder,
      backgroundColor: colors.tableBg,
    },
    tableHead: {
      flexDirection: 'row',
      backgroundColor: colors.tableHeadBg,
    },
    tableRow: {
      flexDirection: 'row',
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.tableBorder,
    },
    tableRowAlt: {
      backgroundColor: colors.tableRowAlt,
    },
    tableRowLast: {
      borderBottomLeftRadius: 12,
      borderBottomRightRadius: 12,
    },
    tableCell: {
      paddingHorizontal: 12,
      paddingVertical: 11,
      borderLeftWidth: StyleSheet.hairlineWidth,
      borderLeftColor: colors.divider,
      justifyContent: 'center',
      flexShrink: 0,
    },
    tableCellFirst: {
      borderLeftWidth: 0,
    },
    tableCellLast: {},
    tableHeadText: {
      fontSize: 12,
      fontWeight: '800',
      color: colors.textPrimary,
      letterSpacing: 0.2,
      flexShrink: 0,
    },
    tableCellText: {
      fontSize: 12,
      color: colors.textSecondary,
      lineHeight: 18,
      flexShrink: 0,
    },
  });
}

// ─── Markdown helpers ─────────────────────────────────────────────────────────

function isTableLine(line: string) {
  const trimmed = line.trim();
  return trimmed.includes('|') && (trimmed.match(/\|/g)?.length ?? 0) >= 2;
}
function isSeparator(line: string) {
  const t = line.trim().replace(/\|/g, '').trim();
  return /^:?-{3,}:?(\s+:?-{3,}:?)*$/.test(t);
}
function parseRow(line: string) {
  return line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => c.trim());
}
function extractTable(lines: string[], start: number) {
  if (start + 1 >= lines.length) return null;
  if (!isTableLine(lines[start]) || !isTableLine(lines[start + 1]) || !isSeparator(lines[start + 1])) return null;
  const headers = parseRow(lines[start]);
  const rows: string[][] = [];
  let i = start + 2;
  while (i < lines.length && isTableLine(lines[i])) { rows.push(parseRow(lines[i])); i++; }
  return { headers, rows, end: i - 1 };
}

function lineTextStyle(line: string, base: TextStyle): TextStyle {
  return { ...base, flexShrink: 1, ...getTextDirectionStyles(line) };
}

function renderInline(text: string, s: MessageBubbleStyles): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g);
  if (parts.length === 1) return text;
  return parts.map((p, i) => {
    if (p.startsWith('**') && p.endsWith('**'))
      return <Text key={i} style={s.bold}>{p.slice(2, -2)}</Text>;
    if (p.startsWith('*') && p.endsWith('*'))
      return <Text key={i} style={s.italic}>{p.slice(1, -1)}</Text>;
    return p;
  });
}

const TABLE_MIN_COL_WIDTH = 72;

function colMinWidth(text: string, isHeader: boolean): number {
  const stripped = text.replace(/\*\*/g, '').trim();
  const len = stripped.length;
  const base = isHeader ? 78 : 68;
  return Math.max(base, Math.min(len * 7.2 + 28, 220));
}

function TableCellText({
  text,
  style,
  bubbleStyles: s,
}: {
  text: string;
  style: TextStyle | TextStyle[];
  bubbleStyles: MessageBubbleStyles;
}) {
  return (
    <Text style={[style, getTextDirectionStyles(text)]}>
      {renderInline(text, s)}
    </Text>
  );
}

function MarkdownTable({
  headers,
  rows,
  scrollHint,
  bubbleMaxWidth,
}: {
  headers: string[];
  rows: string[][];
  scrollHint?: string;
  bubbleMaxWidth: number;
}) {
  const { t } = useTranslation();
  const { colors } = useChatTheme();
  const s = useMemo(() => createMessageBubbleStyles(colors), [colors]);
  const scrollRef = useRef<ScrollView>(null);
  const offsetX = useRef(0);
  const [offset, setOffset] = useState(0);
  const [contentW, setContentW] = useState(0);
  const [layoutW, setLayoutW] = useState(0);
  const colCount = headers.length;
  const scrollViewportWidth = Math.max(180, Math.round(bubbleMaxWidth - 24));

  const colWidths = useMemo(() => {
    const raw = headers.map((h, i) => {
      let max = colMinWidth(h, true);
      for (const row of rows) {
        max = Math.max(max, colMinWidth(row[i] ?? '', false));
      }
      return Math.max(max, TABLE_MIN_COL_WIDTH);
    });
    const total = raw.reduce((a, b) => a + b, 0);
    if (colCount <= 3 && total <= scrollViewportWidth * 1.2) {
      if (total < scrollViewportWidth) {
        const extra = (scrollViewportWidth - total) / colCount;
        return raw.map((w) => w + extra);
      }
      const scale = scrollViewportWidth / total;
      return raw.map((w) => Math.max(64, w * scale));
    }
    return raw;
  }, [headers, rows, colCount, scrollViewportWidth]);

  const tableIntrinsicWidth = colWidths.reduce((a, b) => a + b, 0);
  const isOverflowEstimate = tableIntrinsicWidth > scrollViewportWidth + 6;
  const maxX = Math.max(0, contentW - layoutW);
  const measured = contentW > 0 && layoutW > 0;
  const needsPager = measured ? maxX > 8 : isOverflowEstimate;
  const canLeft = measured && offset > 4;
  const canRight = needsPager && (!measured || offset < maxX - 4);

  const scrollBy = useCallback((dir: -1 | 1) => {
    const step = Math.max(96, Math.round((layoutW || scrollViewportWidth) * 0.72));
    const next = Math.max(0, Math.min(maxX, offsetX.current + dir * step));
    scrollRef.current?.scrollTo({ x: next, animated: true });
  }, [layoutW, maxX, scrollViewportWidth]);

  const tableGrid = (
    <View style={[s.table, { width: needsPager ? tableIntrinsicWidth : scrollViewportWidth }]}>
      <View style={s.tableHead}>
        {headers.map((h, hi) => (
          <View
            key={hi}
            style={[
              s.tableCell,
              { width: colWidths[hi], minWidth: colWidths[hi] },
              hi === 0 && s.tableCellFirst,
              hi === colCount - 1 && s.tableCellLast,
            ]}
          >
            <TableCellText text={h} style={s.tableHeadText} bubbleStyles={s} />
          </View>
        ))}
      </View>
      {rows.map((row, ri) => (
        <View
          key={ri}
          style={[
            s.tableRow,
            ri % 2 === 1 && s.tableRowAlt,
            ri === rows.length - 1 && s.tableRowLast,
          ]}
        >
          {headers.map((_, ci) => {
            const cell = row[ci] ?? '—';
            return (
              <View
                key={ci}
                style={[
                  s.tableCell,
                  { width: colWidths[ci], minWidth: colWidths[ci] },
                  ci === 0 && s.tableCellFirst,
                  ci === colCount - 1 && s.tableCellLast,
                ]}
              >
                <TableCellText text={cell} style={s.tableCellText} bubbleStyles={s} />
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );

  return (
    <View style={s.tableBlock}>
      {needsPager && scrollHint ? (
        <View style={s.tableHintRow}>
          <Text style={s.tableHint}>{scrollHint}</Text>
        </View>
      ) : null}
      <View
        style={[s.tableScrollShell, { width: scrollViewportWidth }]}
        onLayout={(e) => setLayoutW(e.nativeEvent.layout.width)}
      >
        <ScrollView
          ref={scrollRef}
          horizontal
          nestedScrollEnabled={false}
          directionalLockEnabled
          decelerationRate="fast"
          showsHorizontalScrollIndicator={false}
          overScrollMode="never"
          bounces={false}
          scrollEnabled={needsPager}
          scrollEventThrottle={16}
          onScroll={(e) => {
            const x = e.nativeEvent.contentOffset.x;
            offsetX.current = x;
            setOffset(x);
          }}
          onContentSizeChange={(w) => setContentW(w)}
          style={s.tableScroll}
          contentContainerStyle={s.tableScrollContent}
        >
          {tableGrid}
        </ScrollView>
        {needsPager ? (
          <>
            {canLeft ? (
              <LinearGradient
                pointerEvents="none"
                colors={tableFadeStops(colors.tableFade, 'left')}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={s.tableFadeLeft}
              />
            ) : null}
            {canRight ? (
              <LinearGradient
                pointerEvents="none"
                colors={tableFadeStops(colors.tableFade, 'right')}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={s.tableFadeRight}
              />
            ) : null}
            <View style={s.tableArrowLeft} pointerEvents="box-none">
              <Pressable
                onPress={() => scrollBy(-1)}
                disabled={!canLeft}
                hitSlop={6}
                style={[s.tableArrowBtn, !canLeft && s.tableArrowBtnDisabled]}
                accessibilityRole="button"
                accessibilityLabel={t.chat.tableScrollLeft}
                accessibilityState={{ disabled: !canLeft }}
              >
                <ChevronLeft size={20} color={colors.icon} strokeWidth={2.6} />
              </Pressable>
            </View>
            <View style={s.tableArrowRight} pointerEvents="box-none">
              <Pressable
                onPress={() => scrollBy(1)}
                disabled={!canRight}
                hitSlop={6}
                style={[s.tableArrowBtn, !canRight && s.tableArrowBtnDisabled]}
                accessibilityRole="button"
                accessibilityLabel={t.chat.tableScrollRight}
                accessibilityState={{ disabled: !canRight }}
              >
                <ChevronRight size={20} color={colors.icon} strokeWidth={2.6} />
              </Pressable>
            </View>
          </>
        ) : null}
      </View>
    </View>
  );
}

function renderMarkdown(
  text: string,
  tableScrollHint: string | undefined,
  bubbleMaxWidth: number,
  s: MessageBubbleStyles,
  lite = false,
): React.ReactNode[] {
  const lines = text.split('\n');
  const out: React.ReactNode[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // While tokens are still arriving, skip table measurement and horizontal
    // scroll views. The finished message renders the real table once.
    if (lite && (isTableLine(line) || isSeparator(line))) {
      const cells = parseRow(line).filter((cell) => cell && !isSeparator(cell));
      if (cells.length) {
        out.push(
          <Text key={`row-${i}`} style={lineTextStyle(cells.join(' · '), s.paragraph)}>
            {renderInline(cells.join(' · '), s)}
          </Text>,
        );
      }
      continue;
    }

    const tbl = extractTable(lines, i);
    if (tbl) {
      out.push(
        <MarkdownTable
          key={`tbl-${i}`}
          headers={tbl.headers}
          rows={tbl.rows}
          scrollHint={tableScrollHint}
          bubbleMaxWidth={bubbleMaxWidth}
        />,
      );
      i = tbl.end;
      continue;
    }

    if (line.trim().startsWith('```')) {
      const codeLines: string[] = [];
      let j = i + 1;
      while (j < lines.length && !lines[j].trim().startsWith('```')) { codeLines.push(lines[j]); j++; }
      out.push(
        <View key={`code-${i}`} style={s.codeBlock}>
          <Text style={s.codeText}>{codeLines.join('\n')}</Text>
        </View>,
      );
      i = j;
      continue;
    }

    if (/^-{3,}$/.test(line.trim())) { out.push(<View key={`hr-${i}`} style={s.divider} />); continue; }
    if (line.startsWith('# ')) {
      out.push(<Text key={`h1-${i}`} style={lineTextStyle(line.slice(2), s.h1)}>{line.slice(2)}</Text>);
      continue;
    }
    if (line.startsWith('## ')) {
      out.push(<Text key={`h2-${i}`} style={lineTextStyle(line.slice(3), s.h2)}>{line.slice(3)}</Text>);
      continue;
    }
    if (line.startsWith('### ')) {
      out.push(<Text key={`h3-${i}`} style={lineTextStyle(line.slice(4), s.h3)}>{line.slice(4)}</Text>);
      continue;
    }

    if (line.startsWith('**') && line.endsWith('**') && line.length > 4) {
      out.push(
        <Text key={`bt-${i}`} style={lineTextStyle(line.slice(2, -2), s.boldTitle)}>
          {line.slice(2, -2)}
        </Text>,
      );
      continue;
    }

    const numMatch = line.match(/^(\d+)\.\s(.+)/);
    if (numMatch) {
      out.push(
        <View key={`num-${i}`} style={s.listRow}>
          <View style={s.numBadge}><Text style={s.numText}>{numMatch[1]}</Text></View>
          <Text style={lineTextStyle(numMatch[2], s.listText)}>{renderInline(numMatch[2], s)}</Text>
        </View>,
      );
      continue;
    }

    if (line.startsWith('• ') || line.startsWith('- ')) {
      const body = line.slice(2);
      out.push(
        <View key={`bul-${i}`} style={s.listRow}>
          <Text style={s.bullet}>•</Text>
          <Text style={lineTextStyle(body, s.listText)}>{renderInline(body, s)}</Text>
        </View>,
      );
      continue;
    }

    if (!line.trim()) { out.push(<View key={`sp-${i}`} style={s.spacer} />); continue; }

    out.push(
      <Text key={`p-${i}`} style={lineTextStyle(line, s.paragraph)}>
        {renderInline(line, s)}
      </Text>,
    );
  }
  return out;
}

// ─── Streaming cursor ─────────────────────────────────────────────────────────

const StreamCursor = React.memo(({ bubbleStyles: s }: { bubbleStyles: MessageBubbleStyles }) => {
  const op = useSharedValue(1);
  useEffect(() => {
    op.value = withRepeat(withTiming(0.2, { duration: 600, easing: Easing.inOut(Easing.ease) }), -1, true);
  }, []);
  const style = useAnimatedStyle(() => ({ opacity: op.value }));
  return <Animated.Text style={[s.cursor, style]}>▋</Animated.Text>;
});

// ─── Wave dot ─────────────────────────────────────────────────────────────────

const WaveDot = React.memo(({ delay, bubbleStyles: s }: { delay: number; bubbleStyles: MessageBubbleStyles }) => {
  const ty = useSharedValue(0);
  useEffect(() => {
    let iv: ReturnType<typeof setInterval>;
    const wave = () => {
      ty.value = withSpring(-7, { stiffness: 200, damping: 8 }, () => {
        ty.value = withSpring(0, { stiffness: 200, damping: 8 });
      });
    };
    const to = setTimeout(() => { wave(); iv = setInterval(wave, 1400); }, delay);
    return () => { clearTimeout(to); clearInterval(iv); };
  }, [delay]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: ty.value }] }));
  return <Animated.View style={[s.waveDot, style]} />;
});

// ─── Typing indicator ─────────────────────────────────────────────────────────

export const TypingIndicator = React.memo(() => {
  const { width } = useWindowDimensions();
  const { maxWidth } = useBubbleMaxWidth(width);
  const { colors } = useChatTheme();
  const s = useMemo(() => createMessageBubbleStyles(colors), [colors]);

  return (
    <Animated.View entering={FadeIn.duration(300)} style={s.aiRow}>
      <View style={[s.aiBubbleWrap, { width: maxWidth, maxWidth, alignSelf: 'flex-start' }]}>
        <View style={s.aiBubble}>
          <View style={s.typingDots}>
            {[0, 150, 300].map((d, i) => <WaveDot key={i} delay={d} bubbleStyles={s} />)}
          </View>
        </View>
      </View>
    </Animated.View>
  );
});

function StreamingMessageBody({
  messageId,
  tableScrollHint,
  maxWidth,
  bubbleStyles: s,
}: {
  messageId: string;
  tableScrollHint: string | undefined;
  maxWidth: number;
  bubbleStyles: MessageBubbleStyles;
}) {
  const text = useSyncExternalStore(
    subscribeChatStream,
    () => peekChatStream(messageId),
    () => '',
  );
  const parsed = useMemo(() => decodeChatNavMarker(text), [text]);
  const content = useMemo(
    () => renderMarkdown(parsed.text, tableScrollHint, maxWidth, s, true),
    [parsed.text, tableScrollHint, maxWidth, s],
  );
  return (
    <View collapsable={false}>
      {content}
      <StreamCursor bubbleStyles={s} />
    </View>
  );
}

// ─── AI Bubble ────────────────────────────────────────────────────────────────

export const AIMessageBubble = React.memo(function AIMessageBubble({ message, isHistory = false, onNavChoice, bubbleMaxWidth }: MessageBubbleProps) {
  const { t } = useTranslation();
  const { colors } = useChatTheme();
  const s = useMemo(() => createMessageBubbleStyles(colors), [colors]);
  const maxWidth = bubbleMaxWidth ?? 320;

  const tsOp = useSharedValue(0);
  const tsStyle = useAnimatedStyle(() => ({ opacity: tsOp.value }));
  const onPress = useCallback(() => {
    tsOp.value = withTiming(1, { duration: 200 });
    tsOp.value = withDelay(2500, withTiming(0, { duration: 300 }));
  }, []);

  const streaming = !isHistory && !!message.isStreaming;
  const parsed = useMemo(
    () => decodeChatNavMarker(streaming ? '' : (message.text ?? '')),
    [streaming, message.text],
  );
  const sourceText = parsed.text;
  const navLinks = message.navLinks?.length ? message.navLinks : parsed.navLinks;
  const content = useMemo(
    () => (streaming ? null : renderMarkdown(sourceText, t.chat.tableScrollHint, maxWidth, s)),
    [streaming, sourceText, t.chat.tableScrollHint, maxWidth, s],
  );

  return (
    <View style={s.aiRow}>
      <View style={[s.aiBubbleWrap, { maxWidth, width: '100%', alignSelf: 'flex-start' }]}>
        <View style={s.aiBubbleShell}>
          <View style={s.aiBubble} collapsable={false}>
            <LinearGradient
              colors={[colors.aiGlow, 'transparent']}
              start={{ x: 0, y: 0 }} end={{ x: 0, y: 0.35 }}
              style={StyleSheet.absoluteFill}
              pointerEvents="none"
            />
            <Pressable onPress={onPress} accessibilityRole="text">
              <View style={s.aiBubbleInner}>
                {streaming ? (
                  <StreamingMessageBody
                    messageId={message.id}
                    tableScrollHint={t.chat.tableScrollHint}
                    maxWidth={maxWidth}
                    bubbleStyles={s}
                  />
                ) : (
                  content
                )}
              </View>
            </Pressable>
            {navLinks.length ? (
              <View style={s.ctaFooter}>
                <ChatNavLinks links={navLinks} onChoose={onNavChoice} />
              </View>
            ) : null}
          </View>
        </View>
        <Animated.Text style={[s.aiTs, tsStyle]}>{message.time}</Animated.Text>
      </View>
    </View>
  );
});

// ─── User Bubble ──────────────────────────────────────────────────────────────

const AnimPressable = Animated.createAnimatedComponent(Pressable);

export const UserMessageBubble = React.memo(function UserMessageBubble({
  message, onResend, onEdit, onDelete, onCopy, bubbleMaxWidth, bubbleMinWidth,
}: MessageBubbleProps) {
  const { colors } = useChatTheme();
  const s = useMemo(() => createMessageBubbleStyles(colors), [colors]);
  const maxWidth = bubbleMaxWidth ?? 320;
  const minWidth = bubbleMinWidth ?? 72;
  const userTextStyle = useMemo(
    () => [s.userText, getTextDirectionStyles(message.text ?? '')],
    [message.text, s],
  );
  const [menuOpen, setMenuOpen] = useState(false);
  const scale = useSharedValue(1);
  const tsOp = useSharedValue(0);

  const scaleStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const tsStyle = useAnimatedStyle(() => ({ opacity: tsOp.value }));

  const onPressIn  = useCallback(() => { scale.value = withSpring(0.97, { stiffness: 300, damping: 20 }); }, []);
  const onPressOut = useCallback(() => { scale.value = withSpring(1,    { stiffness: 300, damping: 20 }); }, []);
  const onPress    = useCallback(() => {
    tsOp.value = withTiming(1, { duration: 200 });
    tsOp.value = withDelay(2500, withTiming(0, { duration: 300 }));
  }, []);
  const onLongPress = useCallback(() => setMenuOpen(true), []);

  const close  = useCallback(() => setMenuOpen(false), []);
  const resend = useCallback(() => { onResend?.(); setMenuOpen(false); }, [onResend]);
  const edit   = useCallback(() => { onEdit?.();   setMenuOpen(false); }, [onEdit]);
  const del    = useCallback(() => { onDelete?.(); setMenuOpen(false); }, [onDelete]);
  const copy   = useCallback(() => { onCopy?.();   setMenuOpen(false); }, [onCopy]);

  return (
    <>
      <View style={s.userRow}>
        <View style={[s.userBubbleWrap, { maxWidth, minWidth, alignSelf: 'flex-end' }]}>
          <AnimPressable
            style={scaleStyle}
            onPressIn={onPressIn}
            onPressOut={onPressOut}
            onPress={onPress}
            onLongPress={onLongPress}
            delayLongPress={400}
            accessibilityRole="text"
          >
            <View style={s.userBubble}>
              <LinearGradient
                colors={[...colors.userBubble]}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
              <View style={s.userBubbleInnerBorder} />
              <Text style={userTextStyle}>{message.text}</Text>
            </View>
          </AnimPressable>
          <Animated.Text style={[s.userTs, tsStyle]}>{message.time}</Animated.Text>
        </View>
      </View>

      {menuOpen && (
        <MessageContextMenu
          messageText={message.text}
          onResend={resend} onEdit={edit}
          onDelete={del}   onCopy={copy}
          onClose={close}
        />
      )}
    </>
  );
});

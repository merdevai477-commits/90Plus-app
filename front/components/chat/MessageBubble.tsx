/**
 * MessageBubble.tsx — Native
 * AI bubble: left-aligned; user bubble: right-aligned.
 */

import React, {
  useEffect, useRef, useState, useMemo, useCallback,
} from 'react';
import {
  View, Text, Pressable, ScrollView, StyleSheet, Platform, TextStyle, useWindowDimensions,
} from 'react-native';
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
import { BlurView } from 'expo-blur';
import { useTranslation } from '../../src/i18n';

import { Colors } from '../../constants/theme';
import { MessageContextMenu } from '../chat/MessageContextMenu';
import { Message } from '../../hooks/useAIChatNative';
import { getTextDirectionStyles, useBubbleMaxWidth } from './chatTextUtils';

// ─── Types ────────────────────────────────────────────────────────────────────

interface MessageBubbleProps {
  message: Message;
  index?: number;
  isHistory?: boolean;
  onResend?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onCopy?: () => void;
}

// ─── Markdown helpers ─────────────────────────────────────────────────────────

function isTableLine(line: string) { return line.includes('|'); }
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

function renderInline(text: string): React.ReactNode {
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

function colMinWidth(text: string, isHeader: boolean, maxColWidth: number): number {
  const len = text.length;
  const base = isHeader ? 108 : 120;
  const computed = Math.max(base, len * 8 + 24);
  return Math.min(computed, maxColWidth);
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
  const colCount = headers.length;
  const maxColWidth = Math.max(100, Math.floor((bubbleMaxWidth - 28) / Math.max(colCount, 1)));

  const colWidths = useMemo(() => {
    const widths = headers.map((h, i) => {
      let max = colMinWidth(h, true, maxColWidth);
      for (const row of rows) {
        const cell = row[i] ?? '';
        max = Math.max(max, colMinWidth(cell, false, maxColWidth));
      }
      return max;
    });
    return widths;
  }, [headers, rows, maxColWidth]);

  const tableIntrinsicWidth = colWidths.reduce((a, b) => a + b, 0);
  const showHint = tableIntrinsicWidth > bubbleMaxWidth - 32;

  return (
    <View style={s.tableBlock}>
      {showHint && scrollHint ? (
        <Text style={s.tableHint}>{scrollHint}</Text>
      ) : null}
      <ScrollView
        horizontal
        nestedScrollEnabled
        showsHorizontalScrollIndicator
        bounces={false}
        style={s.tableScroll}
        contentContainerStyle={s.tableScrollContent}
      >
        <View style={s.table}>
          <LinearGradient
            colors={['rgba(124,58,237,0.55)', 'rgba(76,29,149,0.45)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={s.tableHead}
          >
            {headers.map((h, hi) => (
              <View
                key={hi}
                style={[
                  s.tableCell,
                  { minWidth: colWidths[hi] },
                  hi === 0 && s.tableCellFirst,
                  hi === colCount - 1 && s.tableCellLast,
                ]}
              >
                    <Text
                      style={[s.tableHeadText, getTextDirectionStyles(h)]}
                    >
                      {h}
                    </Text>
              </View>
            ))}
          </LinearGradient>
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
                      { minWidth: colWidths[ci] },
                      ci === 0 && s.tableCellFirst,
                      ci === colCount - 1 && s.tableCellLast,
                    ]}
                  >
                    <Text
                      style={[s.tableCellText, getTextDirectionStyles(cell)]}
                    >
                      {cell}
                    </Text>
                  </View>
                );
              })}
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

function renderMarkdown(
  text: string,
  tableScrollHint: string | undefined,
  bubbleMaxWidth: number,
): React.ReactNode[] {
  const lines = text.split('\n');
  const out: React.ReactNode[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

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
          <Text style={lineTextStyle(numMatch[2], s.listText)}>{renderInline(numMatch[2])}</Text>
        </View>,
      );
      continue;
    }

    if (line.startsWith('• ') || line.startsWith('- ')) {
      const body = line.slice(2);
      out.push(
        <View key={`bul-${i}`} style={s.listRow}>
          <Text style={s.bullet}>•</Text>
          <Text style={lineTextStyle(body, s.listText)}>{renderInline(body)}</Text>
        </View>,
      );
      continue;
    }

    if (!line.trim()) { out.push(<View key={`sp-${i}`} style={s.spacer} />); continue; }

    out.push(
      <Text key={`p-${i}`} style={lineTextStyle(line, s.paragraph)}>
        {renderInline(line)}
      </Text>,
    );
  }
  return out;
}

// ─── Streaming cursor ─────────────────────────────────────────────────────────

const StreamCursor = React.memo(() => {
  const op = useSharedValue(1);
  useEffect(() => {
    op.value = withRepeat(withTiming(0.2, { duration: 600, easing: Easing.inOut(Easing.ease) }), -1, true);
  }, []);
  const style = useAnimatedStyle(() => ({ opacity: op.value }));
  return <Animated.Text style={[s.cursor, style]}>▋</Animated.Text>;
});

// ─── Wave dot ─────────────────────────────────────────────────────────────────

const WaveDot = React.memo(({ delay }: { delay: number }) => {
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
  const { maxWidth, minWidth } = useBubbleMaxWidth(width);

  return (
    <Animated.View entering={FadeIn.duration(300)} style={s.aiRow}>
      <View style={[s.aiBubbleWrap, { maxWidth, minWidth, alignSelf: 'flex-start' }]}>
        <View style={s.aiBubble}>
          <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
          <View style={s.typingDots}>
            {[0, 150, 300].map((d, i) => <WaveDot key={i} delay={d} />)}
          </View>
        </View>
      </View>
    </Animated.View>
  );
});

// ─── AI Bubble ────────────────────────────────────────────────────────────────

export const AIMessageBubble = React.memo(function AIMessageBubble({ message, index = 0, isHistory = false }: MessageBubbleProps) {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const { maxWidth, minWidth } = useBubbleMaxWidth(width);
  const prevId = useRef<string | null>(null);
  const initialText = useRef<string | null>(null);
  const [visible, setVisible] = useState('');
  const [done, setDone] = useState(false);

  const tsOp = useSharedValue(0);
  const tsStyle = useAnimatedStyle(() => ({ opacity: tsOp.value }));
  const onPress = useCallback(() => {
    tsOp.value = withTiming(1, { duration: 200 });
    tsOp.value = withDelay(2500, withTiming(0, { duration: 300 }));
  }, []);

  useEffect(() => {
    let mounted = true;
    const full = message.text ?? '';
    if (prevId.current !== message.id) { prevId.current = message.id; initialText.current = null; }
    if (initialText.current === null) initialText.current = full;

    if (isHistory) {
      setVisible(full);
      setDone(true);
      return () => { mounted = false; };
    }

    if (initialText.current === '') {
      setVisible(full);
      setDone(true);
      return () => { mounted = false; };
    }

    setVisible(''); setDone(false);
    if (!full) { setDone(true); return () => { mounted = false; }; }

    let idx = 0;
    const len = full.length;
    const step = len > 2000 ? 12 : len > 1000 ? 8 : len > 500 ? 5 : 3;
    const iv = len > 1000 ? 6 : 10;
    const timer = setInterval(() => {
      if (!mounted) return;
      idx = Math.min(len, idx + step);
      setVisible(full.slice(0, idx));
      if (idx >= len) { clearInterval(timer); setDone(true); }
    }, iv);
    return () => { mounted = false; clearInterval(timer); };
  }, [message.id, isHistory, message.text]);

  const display = done ? (message.text ?? '') : visible;
  const isStreaming = initialText.current === '' && message.text !== '' && !done;
  const showCursor = !isHistory && (isStreaming || (!done && initialText.current !== ''));
  const content = useMemo(
    () => renderMarkdown(display, t.chat.tableScrollHint, maxWidth),
    [display, t.chat.tableScrollHint, maxWidth],
  );

  return (
    <Animated.View
      entering={FadeIn.withInitialValues({ transform: [{ translateX: -20 }], opacity: 0 })
        .springify().stiffness(180).damping(14).delay(index * 40)}
      style={s.aiRow}
    >
      <View style={[s.aiBubbleWrap, { maxWidth, minWidth, alignSelf: 'flex-start' }]}>
        <Pressable onPress={onPress} accessibilityRole="text">
          <View style={s.aiBubble}>
            <BlurView intensity={24} tint="dark" style={StyleSheet.absoluteFill} />
            <LinearGradient
              colors={['rgba(124,58,237,0.12)', 'rgba(76,29,149,0.06)']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
              pointerEvents="none"
            />
            <View style={s.aiBubbleTopHighlight} pointerEvents="none" />
            <View style={s.aiBubbleInner}>
              {content}
              {showCursor && <StreamCursor />}
            </View>
          </View>
        </Pressable>
        <Animated.Text style={[s.aiTs, tsStyle]}>{message.time}</Animated.Text>
      </View>
    </Animated.View>
  );
});

// ─── User Bubble ──────────────────────────────────────────────────────────────

const AnimPressable = Animated.createAnimatedComponent(Pressable);

export const UserMessageBubble = React.memo(function UserMessageBubble({
  message, index = 0, onResend, onEdit, onDelete, onCopy,
}: MessageBubbleProps) {
  const { width } = useWindowDimensions();
  const { maxWidth, minWidth } = useBubbleMaxWidth(width);
  const userTextStyle = useMemo(
    () => [s.userText, getTextDirectionStyles(message.text ?? '')],
    [message.text],
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
      <Animated.View
        entering={FadeIn.withInitialValues({ transform: [{ translateX: 20 }], opacity: 0 })
          .springify().stiffness(180).damping(14).delay(index * 40)}
        style={s.userRow}
      >
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
                colors={['#7C3AED', '#5B21B6']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
              <View style={s.userBubbleInnerBorder} />
              <Text style={userTextStyle}>{message.text}</Text>
            </View>
          </AnimPressable>
          <Animated.Text style={[s.userTs, tsStyle]}>{message.time}</Animated.Text>
        </View>
      </Animated.View>

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

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  aiRow: {
    width: '100%',
    alignSelf: 'stretch',
    flexDirection: 'row',
    justifyContent: 'flex-start',
    marginVertical: 6,
    paddingHorizontal: 12,
  },
  aiBubbleWrap: {},
  aiBubble: {
    borderRadius: 18,
    borderTopLeftRadius: 4,
    borderBottomLeftRadius: 4,
    borderWidth: 0.5,
    borderColor: 'rgba(167,139,250,0.35)',
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#7C3AED',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.18,
        shadowRadius: 10,
      },
      android: { elevation: 3 },
    }),
  },
  aiBubbleTopHighlight: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    zIndex: 2,
  },
  aiBubbleInner: {
    width: '100%',
    alignSelf: 'stretch',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 2,
    zIndex: 1,
  },
  aiTs: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.35)',
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
    paddingHorizontal: 12,
  },
  userBubbleWrap: {},
  userBubble: {
    borderRadius: 18,
    borderTopRightRadius: 4,
    borderBottomRightRadius: 4,
    overflow: 'hidden',
    borderWidth: 0.5,
    borderColor: 'rgba(167,139,250,0.4)',
    ...Platform.select({
      ios: {
        shadowColor: '#7C3AED',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.4,
        shadowRadius: 14,
      },
      android: { elevation: 6 },
    }),
  },
  userBubbleInnerBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 18,
    borderTopRightRadius: 4,
    borderBottomRightRadius: 4,
    borderWidth: 0.5,
    borderColor: 'rgba(196,181,253,0.15)',
    zIndex: 2,
  },
  userText: {
    fontSize: 15,
    color: '#FFFFFF',
    lineHeight: 22,
    flexShrink: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    zIndex: 3,
  },
  userTs: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.35)',
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
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: 'rgba(167,139,250,0.8)',
  },

  cursor: {
    color: 'rgba(196,181,253,0.75)',
    fontSize: 14,
  },

  paragraph: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.88)',
    lineHeight: 21,
  },
  boldTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 6,
    marginBottom: 2,
  },
  bold:   { fontWeight: '700', color: '#FFFFFF' },
  italic: { fontStyle: 'italic', color: 'rgba(255,255,255,0.8)' },

  listRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, width: '100%' },
  bullet:  { color: '#A78BFA', fontSize: 15, marginTop: 2, flexShrink: 0 },
  listText: {
    flex: 1,
    flexShrink: 1,
    fontSize: 14,
    color: 'rgba(255,255,255,0.85)',
    lineHeight: 21,
  },
  numBadge: {
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: 'rgba(124,58,237,0.35)',
    borderWidth: 0.5, borderColor: 'rgba(167,139,250,0.4)',
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0, marginTop: 2,
  },
  numText: { fontSize: 10, fontWeight: '700', color: '#A78BFA' },

  spacer:  { height: 4 },
  divider: { height: 0.5, backgroundColor: 'rgba(255,255,255,0.1)', marginVertical: 10 },

  h1: {
    fontSize: 20, fontWeight: '800', color: '#FFFFFF',
    marginTop: 10, marginBottom: 6,
    borderBottomWidth: 0.5, borderBottomColor: 'rgba(255,255,255,0.1)',
    paddingBottom: 4,
  },
  h2: {
    fontSize: 17, fontWeight: '700', color: 'rgba(255,255,255,0.95)',
    marginTop: 8, marginBottom: 4,
  },
  h3: {
    fontSize: 15, fontWeight: '600', color: '#A78BFA',
    marginTop: 6, marginBottom: 4,
  },

  codeBlock: {
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 10,
    borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.08)',
    borderLeftWidth: 3, borderLeftColor: '#7C3AED',
    padding: 12, marginVertical: 6,
    alignSelf: 'stretch',
  },
  codeText: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 12,
    color: '#a78bfa',
    lineHeight: 19,
    flexShrink: 1,
  },

  tableBlock: {
    alignSelf: 'stretch',
    width: '100%',
    maxWidth: '100%',
  },
  tableHint: {
    fontSize: 11,
    color: 'rgba(167,139,250,0.75)',
    marginBottom: 4,
    paddingHorizontal: 2,
    flexShrink: 1,
  },
  tableScroll: {
    marginVertical: 8,
    maxWidth: '100%',
  },
  tableScrollContent: {
    flexGrow: 1,
  },
  table: {
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.35)',
    backgroundColor: 'rgba(0,0,0,0.35)',
    ...Platform.select({
      ios: {
        shadowColor: '#7C3AED',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
      },
      android: { elevation: 4 },
    }),
  },
  tableHead: {
    flexDirection: 'row',
  },
  tableRow: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  tableRowAlt: {
    backgroundColor: 'rgba(124,58,237,0.08)',
  },
  tableRowLast: {
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
  },
  tableCell: {
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: 'rgba(255,255,255,0.08)',
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
    color: '#FFFFFF',
    letterSpacing: 0.2,
    flexShrink: 1,
  },
  tableCellText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.88)',
    lineHeight: 18,
    flexShrink: 1,
  },
});

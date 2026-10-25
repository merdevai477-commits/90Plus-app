import React, { memo, useMemo, useState } from 'react';
import { Linking, Text, type StyleProp, type TextStyle } from 'react-native';

import { C } from './theme';
import { isArabicText, parseRichText } from './richTextParse';

interface Props {
  text: string;
  style?: StyleProp<TextStyle>;
  onHashtag: (tag: string) => void;
  onMention: (username: string) => void;
  /** Collapse long text behind a "See more" toggle. */
  collapseAfterLines?: number;
  seeMoreLabel?: string;
  seeLessLabel?: string;
  onLongPress?: () => void;
}

export const RichText = memo(function RichText({
  text,
  style,
  onHashtag,
  onMention,
  collapseAfterLines,
  seeMoreLabel,
  seeLessLabel,
  onLongPress,
}: Props) {
  const segments = useMemo(() => parseRichText(text), [text]);
  const rtl = useMemo(() => isArabicText(text), [text]);
  const [expanded, setExpanded] = useState(false);
  const [overflowing, setOverflowing] = useState(false);
  const collapsible = !!collapseAfterLines;

  return (
    <>
      <Text
        style={[style, { textAlign: rtl ? 'right' : 'left', writingDirection: rtl ? 'rtl' : 'ltr' }]}
        numberOfLines={collapsible && !expanded ? collapseAfterLines : undefined}
        onTextLayout={
          collapsible && !expanded && !overflowing
            ? (e) => {
                if (e.nativeEvent.lines.length >= (collapseAfterLines ?? 0)) {
                  const full = e.nativeEvent.lines.map((l) => l.text).join('');
                  if (full.length < text.length - 1) setOverflowing(true);
                }
              }
            : undefined
        }
        onLongPress={onLongPress}
        suppressHighlighting
      >
        {segments.map((seg, i) => {
          switch (seg.kind) {
            case 'hashtag':
              return (
                <Text key={i} style={{ color: C.accentSoft, fontWeight: '600' }} onPress={() => onHashtag(seg.tag)} suppressHighlighting>
                  {seg.text}
                </Text>
              );
            case 'mention':
              return (
                <Text key={i} style={{ color: C.accentSoft, fontWeight: '600' }} onPress={() => onMention(seg.username)} suppressHighlighting>
                  {seg.text}
                </Text>
              );
            case 'link':
              return (
                <Text
                  key={i}
                  style={{ color: '#7DB7FF', textDecorationLine: 'underline' }}
                  onPress={() => void Linking.openURL(seg.url).catch(() => undefined)}
                  suppressHighlighting
                >
                  {seg.text}
                </Text>
              );
            default:
              return seg.text;
          }
        })}
      </Text>
      {collapsible && overflowing && (
        <Text
          onPress={() => setExpanded((v) => !v)}
          style={{ color: C.muted, fontSize: 14, marginTop: 4, textAlign: rtl ? 'right' : 'left' }}
          suppressHighlighting
        >
          {expanded ? seeLessLabel : seeMoreLabel}
        </Text>
      )}
    </>
  );
});

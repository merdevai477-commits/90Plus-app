import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Image } from 'expo-image';
import Animated, { FadeIn, FadeOut, ZoomIn } from 'react-native-reanimated';
import { SendHorizontal, X } from 'lucide-react-native';

import type { CommunityAuthor, CommunityComment } from '../../services/community.api';
import { CommunityApiError } from '../../services/community.api';
import { useMentionSearch } from '../../hooks/community/useMentionSearch';
import { MentionSuggestions } from './MentionSuggestions';
import { PageSuggestions } from './PageSuggestions';
import { filterPages, type AppPage } from './pageLinks';
import { activeMentionQuery, activeSlashQuery, everyoneSuggestionMatches } from './richTextParse';
import { C, CI } from './theme';
import { fillTemplate } from './format';

const QUICK_EMOJI = ['⚽', '🔥', '😂', '❤️', '👏', '😮', '💪', '🏆'];
const MAX_LEN = 1000;

export interface CommentComposerHandle {
  focus: () => void;
  replyTo: (c: CommunityComment) => void;
  startEdit: (c: CommunityComment) => void;
}

interface Props {
  isAr: boolean;
  fonts: { regular: string; semibold: string };
  labels: {
    placeholder: string;
    replyingTo: string;
    noUsers: string;
    cooldown: string;
    everyone: string;
    everyoneHint: string;
    noPages: string;
    editing?: string;
  };
  /** Resolves when saved; rejects with CommunityApiError to keep the text. */
  onSubmit: (text: string, replyTo: CommunityComment | null) => Promise<unknown>;
  onEdit?: (comment: CommunityComment, text: string) => Promise<unknown>;
  onError: (err: unknown) => void;
  bottomInset?: number;
}

export const CommentComposer = forwardRef<CommentComposerHandle, Props>(function CommentComposer(
  { isAr, fonts, labels, onSubmit, onEdit, onError, bottomInset = 0 },
  ref,
) {
  const inputRef = useRef<TextInput>(null);
  const [text, setText] = useState('');
  const [caret, setCaret] = useState(0);
  const [replyTarget, setReplyTarget] = useState<CommunityComment | null>(null);
  const [editTarget, setEditTarget] = useState<CommunityComment | null>(null);
  const [showEmoji, setShowEmoji] = useState(false);
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [now, setNow] = useState(Date.now());

  const mention = activeMentionQuery(text, caret);
  const slash = mention ? null : activeSlashQuery(text, caret);
  const pages = slash ? filterPages(slash.query) : [];
  const { results, loading } = useMentionSearch(mention ? mention.query : null);
  const showEveryone = !!mention && everyoneSuggestionMatches(mention.query);

  useImperativeHandle(ref, () => ({
    focus: () => inputRef.current?.focus(),
    replyTo: (c) => {
      setEditTarget(null);
      setReplyTarget(c);
      const handle = `@${c.author.username} `;
      setText((t) => (t.startsWith(handle) ? t : handle + t.replace(/^@\S+\s/, '')));
      requestAnimationFrame(() => inputRef.current?.focus());
    },
    startEdit: (c) => {
      setReplyTarget(null);
      setEditTarget(c);
      setText(c.content);
      requestAnimationFrame(() => inputRef.current?.focus());
    },
  }));

  useEffect(() => {
    if (cooldownUntil <= Date.now()) return;
    const id = setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (t >= cooldownUntil) clearInterval(id);
    }, 500);
    return () => clearInterval(id);
  }, [cooldownUntil]);

  const secondsLeft = Math.max(0, Math.ceil((cooldownUntil - now) / 1000));
  const trimmed = text.trim();
  const canSend = trimmed.length > 0 && secondsLeft === 0;

  const insertToken = useCallback(
    (start: number, token: string) => {
      const next = `${text.slice(0, start)}${token} ${text.slice(caret)}`;
      setText(next.slice(0, MAX_LEN));
      const pos = start + token.length + 1;
      setCaret(pos);
      requestAnimationFrame(() => inputRef.current?.setNativeProps({ selection: { start: pos, end: pos } }));
    },
    [caret, text],
  );

  const pickMention = useCallback(
    (u: CommunityAuthor) => {
      if (!mention) return;
      insertToken(mention.start, `@${u.username}`);
    },
    [insertToken, mention],
  );

  const pickPage = useCallback(
    (page: AppPage) => {
      if (!slash) return;
      insertToken(slash.start, page.insert ?? `/${page.token}`);
    },
    [insertToken, slash],
  );

  const send = useCallback(() => {
    if (!canSend) return;
    const content = trimmed;
    const target = replyTarget;
    const editing = editTarget;
    setText('');
    setReplyTarget(null);
    setEditTarget(null);
    setShowEmoji(false);
    const save = editing && onEdit ? onEdit(editing, content) : onSubmit(content, target);
    save.catch((err) => {
      setText((t) => (t ? t : content));
      if (editing) setEditTarget((current) => current ?? editing);
      else setReplyTarget((r) => r ?? target);
      if (err instanceof CommunityApiError && err.retryAfterSec) {
        setCooldownUntil(Date.now() + err.retryAfterSec * 1000);
        setNow(Date.now());
      }
      onError(err);
    });
  }, [canSend, editTarget, onEdit, onError, onSubmit, replyTarget, trimmed]);

  const row = isAr ? 'row-reverse' : 'row';
  const replyName = replyTarget ? replyTarget.author.displayName || replyTarget.author.username : '';

  return (
    <View style={[styles.wrap, { paddingBottom: 10 + bottomInset }]}>
      {slash && (
        <PageSuggestions pages={pages} isAr={isAr} emptyLabel={labels.noPages} fontFamily={fonts.regular} onPick={pickPage} />
      )}
      {mention && (
        <MentionSuggestions
          users={results}
          loading={loading}
          emptyLabel={labels.noUsers}
          fontFamily={fonts.regular}
          onPick={pickMention}
          everyone={
            showEveryone
              ? { label: labels.everyone, hint: labels.everyoneHint, onPress: () => insertToken(mention.start, '@all') }
              : null
          }
        />
      )}

      {(replyTarget || editTarget) && (
        <Animated.View entering={FadeIn.duration(140)} exiting={FadeOut.duration(120)} style={[styles.chip, { flexDirection: row }]}>
          <Text style={[styles.chipText, { fontFamily: fonts.regular }]} numberOfLines={1}>
            {editTarget ? (labels.editing || 'Edit') : fillTemplate(labels.replyingTo, { name: replyName })}
          </Text>
          <Pressable
            onPress={() => {
              setReplyTarget(null);
              setEditTarget(null);
              setText((t) => (editTarget ? '' : t.replace(/^@\S+\s/, '')));
            }}
            hitSlop={10}
          >
            <X size={16} color={C.muted} />
          </Pressable>
        </Animated.View>
      )}

      {showEmoji && (
        <Animated.View entering={FadeIn.duration(140)} style={[styles.emojiRow, { flexDirection: row }]}>
          {QUICK_EMOJI.map((e) => (
            <Pressable key={e} onPress={() => setText((t) => (t + e).slice(0, MAX_LEN))} style={styles.emojiBtn}>
              <Text style={styles.emoji}>{e}</Text>
            </Pressable>
          ))}
        </Animated.View>
      )}

      {secondsLeft > 0 && (
        <Text style={[styles.cooldown, { fontFamily: fonts.regular, textAlign: isAr ? 'right' : 'left' }]}>
          {fillTemplate(labels.cooldown, { seconds: secondsLeft })}
        </Text>
      )}

      <View style={styles.row}>
        <View style={styles.inputBox}>
          <TextInput
            ref={inputRef}
            value={text}
            onChangeText={(v) => setText(v.slice(0, MAX_LEN))}
            onSelectionChange={(e) => setCaret(e.nativeEvent.selection.end)}
            placeholder={labels.placeholder}
            placeholderTextColor={C.placeholder}
            style={[styles.input, { fontFamily: fonts.regular, textAlign: isAr ? 'right' : 'left' }]}
            multiline
            maxLength={MAX_LEN}
            selectionColor={C.accent}
            onFocus={() => setShowEmoji(false)}
          />
        </View>
        <Pressable
          onPress={canSend ? send : () => setShowEmoji((v) => !v)}
          style={[styles.square, canSend && styles.squareActive]}
          accessibilityRole="button"
          accessibilityLabel={canSend ? 'Send' : 'Emoji'}
        >
          {canSend ? (
            <Animated.View entering={ZoomIn.duration(160)}>
              <SendHorizontal size={22} color="#FFF" />
            </Animated.View>
          ) : (
            <Image source={CI.smile} style={{ width: 24, height: 24 }} contentFit="contain" />
          )}
        </Pressable>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 16,
    paddingTop: 10,
    backgroundColor: 'rgba(3,3,3,0.96)',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: C.inputBorder,
  },
  chip: {
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(139,92,246,0.12)',
  },
  chipText: {
    color: C.accentSoft,
    fontSize: 13,
    flex: 1,
  },
  emojiRow: {
    justifyContent: 'space-between',
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  emojiBtn: {
    padding: 4,
  },
  emoji: {
    fontSize: 26,
  },
  cooldown: {
    color: '#FCA5A5',
    fontSize: 12,
    marginBottom: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 7,
  },
  inputBox: {
    flex: 1,
    minHeight: 46,
    maxHeight: 120,
    justifyContent: 'center',
    borderRadius: 15,
    backgroundColor: C.input,
    borderWidth: 1,
    borderColor: C.inputBorder,
    paddingHorizontal: 20,
  },
  input: {
    color: C.textStrong,
    fontSize: 14,
    paddingVertical: 12,
    maxHeight: 118,
  },
  square: {
    width: 46,
    height: 46,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.input,
    borderWidth: 1,
    borderColor: C.inputBorder,
  },
  squareActive: {
    backgroundColor: C.accent,
    borderColor: C.accent,
  },
});

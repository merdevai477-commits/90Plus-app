/**
 * King of Coaches picker: the Top Scorers Five card grid for one line (or the
 * coaches). A tap only proposes the pick; the sheet asks to confirm, and a
 * confirmed pick locks in its slot until the gameweek ends.
 */

import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
  type ListRenderItem,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  CkApiError,
  coachKingService,
  type CkCoach,
  type CkPlayer,
  type CkPoolKind,
} from '../../services/coachKing.service';
import { useTranslation } from '../../src/i18n';
import { useAppFont } from '../../utils/fontSetup';
import { TSF_CARD_ART, TSF_CARD_ART_BOX, TSF_DESIGN_WIDTH } from '../TopScorersFive/assets';
import { CoachKingMoney } from './CoachKingCoin';

export type CkPick = (CkPlayer | CkCoach) & { kind: CkPoolKind };

const BG = '#030303';
const ACTIVE = '#8C5CF5';
const COLUMNS = 3;
const CARD = { width: 112.48, height: 176.7 };
const GRID = { columnGap: 21, rowGap: 22, top: 12 };
const GRID_WIDTH = CARD.width * COLUMNS + GRID.columnGap * (COLUMNS - 1);
const PHOTO_WINDOW = { left: 5.876, top: 8.394, width: 100.099, height: 130 };
const PHOTO = { left: -6, top: 8, size: 112 };
const CONFIRM_CARD_SCALE = 1.35;

type Box = { left: number; top: number; width: number; height: number };

type Props = {
  kind: CkPoolKind | null;
  resolveToken: () => Promise<string | null>;
  remainingMilli: number;
  /** What the slot being replaced cost; it comes back to the budget on a swap. */
  refundMilli: number;
  takenIds: ReadonlySet<string>;
  confirming: boolean;
  error: string | null;
  onClose: () => void;
  onConfirm: (pick: CkPick) => void;
  onClearError: () => void;
  onViewProfile: (player: CkPlayer) => void;
};

export function CoachKingCardGrid({
  kind,
  resolveToken,
  remainingMilli,
  refundMilli,
  takenIds,
  confirming,
  error,
  onClose,
  onConfirm,
  onClearError,
  onViewProfile,
}: Props) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { t, language } = useTranslation();
  const copy = t.coachKingGame;
  const isAr = language === 'ar';
  const fontBold = useAppFont(700);
  const fontSemi = useAppFont(600);
  const fontRegular = useAppFont(400);
  const scale = width / TSF_DESIGN_WIDTH;
  const s = useCallback((value: number) => value * scale, [scale]);

  const [query, setQuery] = useState('');
  const [rows, setRows] = useState<Array<CkPlayer | CkCoach>>([]);
  const [loading, setLoading] = useState(false);
  const [shown, setShown] = useState(false);
  const [pending, setPending] = useState<CkPick | null>(null);

  useEffect(() => {
    setQuery('');
    setPending(null);
    setRows([]);
    if (!kind) {
      setShown(false);
      return;
    }
    let alive = true;
    // Android can fire Modal onShow late; never hold the list back past the slide-in.
    const reveal = setTimeout(() => {
      if (alive) setShown(true);
    }, 280);
    setLoading(true);
    resolveToken()
      .then((token) => {
        if (!token) throw new CkApiError('E003', null, 'Unauthorized - Invalid token');
        return coachKingService.getPool(token, kind, language);
      })
      .then((list) => {
        if (alive) setRows(list);
      })
      .catch((err) => {
        const detail = err instanceof CkApiError ? `${err.code} ${err.reason ?? ''} ${err.message}` : String(err);
        console.warn('[CoachKing] list failed', detail);
        if (alive) setRows([]);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
      clearTimeout(reveal);
    };
  }, [kind, language, resolveToken]);

  const index = useMemo(
    () => rows.map((row) => ({ row, haystack: searchKey(`${row.name} ${row.club} ${(row as CkPlayer).nameEn ?? ''} ${(row as CkPlayer).nameAr ?? ''}`) })),
    [rows],
  );
  const matches = useMemo(() => {
    const tokens = searchKey(query).split(' ').filter(Boolean);
    if (!tokens.length) return rows;
    return index.filter(({ haystack }) => tokens.every((token) => haystack.includes(token))).map(({ row }) => row);
  }, [rows, index, query]);

  const budget = remainingMilli + refundMilli;

  const onSelect = useCallback((row: CkPlayer | CkCoach) => {
    if (!kind) return;
    onClearError();
    setPending({ ...row, kind });
  }, [kind, onClearError]);

  const renderItem = useCallback<ListRenderItem<CkPlayer | CkCoach>>(({ item }) => (
    <PickCard
      row={item}
      coach={kind === 'COACH'}
      taken={takenIds.has(item.id)}
      affordable={item.priceMilli <= budget}
      scale={scale}
      lang={language}
      fontBold={fontBold}
      fontSemi={fontSemi}
      coachLabel={copy.coach}
      onSelect={onSelect}
    />
  ), [kind, takenIds, budget, scale, language, fontBold, fontSemi, copy.coach, onSelect]);

  const closePending = () => {
    if (confirming) return;
    onClearError();
    setPending(null);
  };

  return (
    <Modal
      visible={kind != null}
      animationType="slide"
      onRequestClose={pending ? closePending : onClose}
      onShow={() => setShown(true)}
      statusBarTranslucent
    >
      <View style={styles.root} testID="ck-grid">
        <View
          style={[
            styles.header,
            {
              paddingTop: insets.top + s(10),
              paddingBottom: s(10),
              paddingHorizontal: s(24),
              flexDirection: isAr ? 'row-reverse' : 'row',
            },
          ]}
        >
          <TouchableOpacity onPress={onClose} hitSlop={12} accessibilityRole="button" testID="ck-grid-close">
            <Ionicons name={isAr ? 'arrow-forward' : 'arrow-back'} size={s(28)} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { fontFamily: fontSemi, fontSize: s(20) }]} numberOfLines={1}>
            {kind === 'COACH' ? copy.pickCoach : copy.pickPlayer}
          </Text>
          <CoachKingMoney milli={budget} lang={language} size="sm" />
        </View>

        <View
          style={[
            styles.search,
            {
              width: s(GRID_WIDTH),
              height: s(44),
              borderRadius: s(12),
              paddingHorizontal: s(14),
              columnGap: s(8),
              flexDirection: isAr ? 'row-reverse' : 'row',
            },
          ]}
        >
          <Ionicons name="search" size={s(18)} color="#8C8C8C" />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={copy.search}
            placeholderTextColor="#6E6E6E"
            selectionColor={ACTIVE}
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
            testID="ck-grid-search"
            style={[styles.searchInput, { fontFamily: fontRegular, fontSize: s(15), textAlign: isAr ? 'right' : 'left' }]}
          />
          {query ? (
            <TouchableOpacity onPress={() => setQuery('')} hitSlop={10} accessibilityRole="button">
              <Ionicons name="close-circle" size={s(18)} color="#8C8C8C" />
            </TouchableOpacity>
          ) : null}
        </View>

        {(loading || !shown) && rows.length === 0 ? <ActivityIndicator color={ACTIVE} style={{ marginTop: s(32) }} /> : null}

        <FlatList
          key={kind ?? 'none'}
          data={shown ? matches : EMPTY}
          keyExtractor={keyOf}
          renderItem={renderItem}
          numColumns={COLUMNS}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          initialNumToRender={9}
          maxToRenderPerBatch={9}
          windowSize={7}
          removeClippedSubviews
          columnWrapperStyle={[styles.row, { width: s(GRID_WIDTH), columnGap: s(GRID.columnGap), marginBottom: s(GRID.rowGap) }]}
          contentContainerStyle={{ paddingTop: s(GRID.top + 7), paddingBottom: Math.max(insets.bottom, 12) + s(12) }}
          ListEmptyComponent={loading || !shown ? null : (
            <Text style={[styles.empty, { fontFamily: fontRegular, fontSize: s(15), marginTop: s(32) }]}>
              {query ? copy.searchEmpty : copy.poolEmpty}
            </Text>
          )}
        />

        {pending ? (
          <ConfirmSheet
            pick={pending}
            scale={scale}
            budget={budget}
            confirming={confirming}
            error={error}
            onConfirm={() => onConfirm(pending)}
            onCancel={closePending}
            onViewProfile={pending.kind !== 'COACH' ? () => onViewProfile(pending as CkPlayer) : undefined}
          />
        ) : null}
      </View>
    </Modal>
  );
}

type SheetProps = {
  pick: CkPick;
  scale: number;
  budget: number;
  confirming: boolean;
  error: string | null;
  onConfirm: () => void;
  onCancel: () => void;
  onViewProfile?: () => void;
};

function ConfirmSheet({ pick, scale, budget, confirming, error, onConfirm, onCancel, onViewProfile }: SheetProps) {
  const { t, language } = useTranslation();
  const copy = t.coachKingGame;
  const isAr = language === 'ar';
  const fontBold = useAppFont(700);
  const fontSemi = useAppFont(600);
  const fontRegular = useAppFont(400);
  const s = (value: number) => value * scale;
  const after = budget - pick.priceMilli;
  const coach = pick.kind === 'COACH';
  const row = isAr ? 'row-reverse' : 'row';

  return (
    <View style={styles.sheetBackdrop}>
      <View accessibilityViewIsModal testID="ck-confirm-sheet" style={[styles.sheet, { width: s(392), borderRadius: s(22), padding: s(20), rowGap: s(14) }]}>
        <Text style={[styles.sheetTitle, { fontFamily: fontSemi, fontSize: s(19) }]} maxFontSizeMultiplier={1.15}>
          {coach ? copy.confirmCoachTitle : copy.confirmTitle}
        </Text>

        <View pointerEvents="none" style={{ alignItems: 'center' }}>
          <PickCard
            row={pick}
            coach={coach}
            taken={false}
            affordable
            scale={scale * CONFIRM_CARD_SCALE}
            lang={language}
            fontBold={fontBold}
            fontSemi={fontSemi}
            coachLabel={copy.coach}
            onSelect={noop}
          />
        </View>

        <View style={{ rowGap: s(2), alignItems: 'center' }}>
          <Text style={[styles.sheetName, { fontFamily: fontBold, fontSize: s(18) }]} numberOfLines={1}>{pick.name}</Text>
          <Text style={[styles.sheetMeta, { fontFamily: fontRegular, fontSize: s(13) }]} numberOfLines={1}>{pick.club}</Text>
        </View>

        <View style={[styles.ledger, { flexDirection: row, borderRadius: s(14), paddingVertical: s(10), paddingHorizontal: s(14) }]}>
          <View style={styles.ledgerCell}>
            <Text style={[styles.ledgerLabel, { fontFamily: fontRegular, fontSize: s(11) }]}>{copy.price}</Text>
            <CoachKingMoney milli={pick.priceMilli} lang={language} size="md" />
          </View>
          <View style={styles.ledgerRule} />
          <View style={styles.ledgerCell}>
            <Text style={[styles.ledgerLabel, { fontFamily: fontRegular, fontSize: s(11) }]}>{copy.remainingAfter}</Text>
            <CoachKingMoney milli={after} lang={language} size="md" color={after < 0 ? '#F87171' : '#FFFFFF'} />
          </View>
        </View>

        <Text style={[styles.sheetBody, { fontFamily: fontRegular, fontSize: s(13), lineHeight: s(19) }]} maxFontSizeMultiplier={1.15}>
          {copy.confirmBody}
        </Text>

        {error ? (
          <Text style={[styles.sheetError, { fontFamily: fontSemi, fontSize: s(13) }]} testID="ck-confirm-error">{error}</Text>
        ) : null}

        {onViewProfile ? (
          <TouchableOpacity
            onPress={onViewProfile}
            disabled={confirming}
            activeOpacity={0.8}
            accessibilityRole="button"
            style={{ flexDirection: row, alignItems: 'center', columnGap: s(6) }}
          >
            <Ionicons name="person-circle-outline" size={s(18)} color={ACTIVE} />
            <Text style={[styles.sheetLink, { fontFamily: fontSemi, fontSize: s(14) }]}>{copy.viewProfile}</Text>
          </TouchableOpacity>
        ) : null}

        <View style={{ flexDirection: row, columnGap: s(10), alignSelf: 'stretch' }}>
          <TouchableOpacity
            onPress={onConfirm}
            disabled={confirming || after < 0}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityState={{ busy: confirming, disabled: after < 0 }}
            testID="ck-confirm-yes"
            style={[styles.sheetButton, { height: s(50), borderRadius: s(15), opacity: after < 0 ? 0.45 : 1 }]}
          >
            <LinearGradient
              colors={['#9D74F7', ACTIVE, '#6D3FE0']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[StyleSheet.absoluteFill, { borderRadius: s(15) }]}
            />
            {confirming ? <ActivityIndicator color="#FFFFFF" /> : (
              <View style={{ flexDirection: row, alignItems: 'center', columnGap: s(6) }}>
                <Ionicons name="lock-closed" size={s(15)} color="#FFFFFF" />
                <Text style={[styles.primaryText, { fontFamily: fontSemi, fontSize: s(15) }]}>{copy.confirmYes}</Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            onPress={onCancel}
            disabled={confirming}
            activeOpacity={0.85}
            accessibilityRole="button"
            testID="ck-confirm-no"
            style={[styles.sheetButton, styles.secondary, { height: s(50), borderRadius: s(15) }]}
          >
            <Text style={[styles.primaryText, { fontFamily: fontSemi, fontSize: s(15) }]}>{copy.confirmNo}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

type CardProps = {
  row: CkPlayer | CkCoach;
  coach: boolean;
  taken: boolean;
  affordable: boolean;
  scale: number;
  lang: string;
  fontBold: string;
  fontSemi: string;
  coachLabel: string;
  onSelect: (row: CkPlayer | CkCoach) => void;
};

export const PickCard = memo(function PickCard({
  row,
  coach,
  taken,
  affordable,
  scale,
  lang,
  fontBold,
  fontSemi,
  coachLabel,
  onSelect,
}: CardProps) {
  const s = (value: number) => value * scale;
  const box = (b: Box) => ({ position: 'absolute' as const, left: s(b.left), top: s(b.top), width: s(b.width), height: s(b.height) });
  const position = coach ? coachLabel : (row as CkPlayer).position ?? (row as CkPlayer).line ?? '';
  const logo = row.teamLogo ?? null;

  return (
    <TouchableOpacity
      onPress={() => onSelect(row)}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={`${row.name}. ${row.club}. ${row.priceLabel}`}
      testID={`ck-card-${row.id}`}
      style={{ width: s(CARD.width), height: s(CARD.height), opacity: affordable ? 1 : 0.5 }}
    >
      <Image source={TSF_CARD_ART.under} style={box(TSF_CARD_ART_BOX)} contentFit="fill" />
      <View style={[box(PHOTO_WINDOW), styles.clip]} pointerEvents="none">
        {row.photo ? (
          <Image
            source={{ uri: row.photo }}
            style={box({ left: PHOTO.left, top: PHOTO.top, width: PHOTO.size, height: PHOTO.size })}
            contentFit="contain"
            contentPosition="top"
            cachePolicy="memory-disk"
            recyclingKey={row.id}
            transition={120}
          />
        ) : (
          <View style={[box({ left: 0, top: 22, width: PHOTO_WINDOW.width, height: 70 }), styles.center]}>
            <Text style={[styles.initials, { fontFamily: fontBold, fontSize: s(34) }]} allowFontScaling={false}>
              {initials(row.name)}
            </Text>
          </View>
        )}
      </View>
      <Image source={TSF_CARD_ART.over} style={box(TSF_CARD_ART_BOX)} contentFit="fill" />

      <View style={[styles.pos, { left: s(10), top: s(22), height: s(15), paddingHorizontal: s(6), borderRadius: s(8) }]} pointerEvents="none">
        <Text style={[styles.posText, { fontFamily: fontSemi, fontSize: s(9) }]} allowFontScaling={false} numberOfLines={1}>
          {position}
        </Text>
      </View>
      {logo ? (
        <Image
          source={{ uri: logo }}
          style={{ position: 'absolute', right: s(11), top: s(20), width: s(20), height: s(20) }}
          contentFit="contain"
          cachePolicy="memory-disk"
        />
      ) : null}

      <View style={[styles.info, { top: s(111), left: s(8), right: s(8), rowGap: s(4) }]} pointerEvents="none">
        <Text
          style={[styles.name, { fontFamily: fontBold, fontSize: s(14) }]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.75}
          maxFontSizeMultiplier={1.1}
        >
          {shortName(row.name)}
        </Text>
        <CoachKingMoney milli={row.priceMilli} lang={lang} size="sm" />
      </View>

      {taken ? (
        <View style={[styles.check, { width: s(20), height: s(20), borderRadius: s(10), top: s(158), left: s(CARD.width / 2 - 10) }]} pointerEvents="none">
          <Ionicons name="checkmark" size={s(13)} color="#FFFFFF" />
        </View>
      ) : null}
    </TouchableOpacity>
  );
});

const noop = () => undefined;
const keyOf = (row: CkPlayer | CkCoach) => row.id;
const EMPTY: ReadonlyArray<CkPlayer | CkCoach> = [];

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
}

function shortName(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts.length > 1 && name.length > 14 ? parts[parts.length - 1]! : name;
}

function searchKey(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[\u064B-\u0652\u0670\u0640]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/[-'’.]/g, ' ')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  header: { alignItems: 'center', justifyContent: 'space-between', columnGap: 12 },
  headerTitle: { flex: 1, color: '#FFFFFF', textAlign: 'center' },
  search: {
    alignSelf: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  searchInput: { flex: 1, color: '#FFFFFF', paddingVertical: 0 },
  empty: { color: '#8C8C8C', textAlign: 'center', paddingHorizontal: 24 },
  row: { flexDirection: 'row', alignSelf: 'center' },
  clip: { overflow: 'hidden' },
  center: { alignItems: 'center', justifyContent: 'center' },
  initials: { color: 'rgba(255,255,255,0.32)' },
  pos: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#020214',
    borderWidth: 0.5,
    borderColor: '#352164',
  },
  posText: { color: '#FFFFFF' },
  info: { position: 'absolute', alignItems: 'center' },
  name: { color: '#FFFFFF', textAlign: 'center', alignSelf: 'stretch' },
  check: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: ACTIVE,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  sheetBackdrop: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(3,3,3,0.8)',
  },
  sheet: {
    alignItems: 'center',
    backgroundColor: '#0D081A',
    borderWidth: 0.5,
    borderColor: '#B896FC',
    boxShadow: '0px 2px 24px rgba(163,77,245,0.45)',
  },
  sheetTitle: { color: '#FFFFFF', textAlign: 'center' },
  sheetName: { color: '#FFFFFF', textAlign: 'center' },
  sheetMeta: { color: '#B896FC', textAlign: 'center' },
  ledger: {
    alignSelf: 'stretch',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  ledgerCell: { flex: 1, alignItems: 'center', rowGap: 6 },
  ledgerLabel: { color: '#9E9E9E' },
  ledgerRule: { width: StyleSheet.hairlineWidth, alignSelf: 'stretch', backgroundColor: 'rgba(255,255,255,0.16)' },
  sheetBody: { color: '#9E9E9E', textAlign: 'center' },
  sheetError: { color: '#F87171', textAlign: 'center' },
  sheetLink: { color: ACTIVE },
  sheetButton: { flex: 1, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  secondary: { borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)' },
  primaryText: { color: '#FFFFFF' },
});

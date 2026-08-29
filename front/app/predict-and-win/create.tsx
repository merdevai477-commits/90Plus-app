/**
 * "أضف جائزتك" — sponsor wizard.
 *
 * Figma screens: category `658:5475`, step 1 `666:5768`, step 2 `690:1394`,
 * step 3 `695:1782`, step 4 `696:2115`. Competitions are always created as
 * DRAFT and become visible once an admin publishes them.
 *
 * Vertical rhythm (raw Figma units below the 128 header block):
 *   category  title y160 · grid y250 · tip y837
 *   steps     stepper y163 · content y270/280/282 · CTA at the foot
 */

import { useAuth } from '@clerk/clerk-expo';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  InteractionManager,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ImageUploadModal } from '../../components/common/ImageUploadModal';
import { MatchPicker, SelectedMatchHero } from '../../components/predictAndWin/MatchPicker';
import { PWHeader } from '../../components/predictAndWin/PWHeader';
import { PredictionStepper } from '../../components/predictAndWin/PredictionStepper';
import {
  CategoryMedallion,
  PrizeCategoryGrid,
  categoryArtSource,
  usePWGridMetrics,
} from '../../components/predictAndWin/PrizeCategoryGrid';
import { CompetitionDetailCard } from '../../components/predictAndWin/CompetitionDetailCard';
import { CompetitionCard } from '../../components/predictAndWin/CompetitionCard';
import {
  PWBox,
  PWDateField,
  PWFieldLabel,
  PWNumberStepper,
  PWOutlineButton,
  PWPrimaryButton,
  PWSegmentedPair,
  PWSubLabel,
  PWTextArea,
  PWTextField,
} from '../../components/predictAndWin/fields';
import {
  buildDeadline,
  isDeadlineWithinBounds,
  parseCalendarDay,
  startOfDay,
  startOfToday,
} from '../../components/predictAndWin/deadline';
import { usePWLocalize } from '../../components/predictAndWin/localize';
import {
  IconCamera,
  IconFacebook,
  IconIdea,
  IconInstagram,
  IconShoe,
  IconStoreField,
  IconWhatsapp,
} from '../../components/predictAndWin/icons';
import {
  PW,
  PW_GRADIENTS,
  PW_RADII,
  usePWContentWidth,
  usePWDirection,
  usePWFonts,
  usePWScale,
} from '../../components/predictAndWin/theme';
import { useToast } from '../../contexts/ToastContext';
import { useMatchPool } from '../../hooks/useMatchPool';
import {
  CompetitionsService,
  MatchPoolEntry,
  PrizeCategoryInfo,
} from '../../services/competitions.service';
import { useTranslation } from '../../src/i18n';
import { useScreenFont } from '../../utils/fontSetup';

type Phase = 'category' | 1 | 2 | 3 | 4;

const CASH_MIN_EGP = 100;
const CASH_STEP_EGP = 50;
const CASH_MAX_EGP = 500_000;

/**
 * TEMP while the sponsor is still testing the wizard.
 * Flip to `true` when they say «طبق القوانين» — Next then requires
 * `now < deadline ≤ kickoff` again.
 */
const ENFORCE_DEADLINE_RULES = false;

export default function CreateCompetitionScreen() {
  useScreenFont();
  const { s, f } = usePWScale();
  const { bold, regular, semibold } = usePWFonts();
  const dir = usePWDirection();
  const { contentWidth } = usePWContentWidth();
  const { categoryName, errorMessage, formatDate } = usePWLocalize();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const { getToken } = useAuth();
  const { t } = useTranslation();
  const wizard = t.predictAndWin.wizard;
  const { gridWidth } = usePWGridMetrics();

  const [phase, setPhase] = useState<Phase>('category');
  const [categories, setCategories] = useState<PrizeCategoryInfo[]>([]);
  const [category, setCategory] = useState<PrizeCategoryInfo | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [pickerTarget, setPickerTarget] = useState<'prize' | 'store' | null>(null);
  const publishInFlight = useRef(false);

  const isCashCategory = category?.key === 'cash';

  // Step 1
  const [prizeImageUrl, setPrizeImageUrl] = useState<string | null>(null);
  const [prizeName, setPrizeName] = useState('');
  const [prizeDescription, setPrizeDescription] = useState('');
  const [cashAmount, setCashAmount] = useState(CASH_MIN_EGP);
  const [winnersCount, setWinnersCount] = useState(2);
  const [rules, setRules] = useState('');

  // Step 2
  const [selectedMatch, setSelectedMatch] = useState<MatchPoolEntry | null>(null);
  /** Calendar day only; the clock below supplies the time. */
  const [deadlineDate, setDeadlineDate] = useState<Date | null>(null);
  const [hour, setHour] = useState(8);
  const [meridiem, setMeridiem] = useState<'am' | 'pm'>('pm');

  // Step 3
  const [storeImageUrl, setStoreImageUrl] = useState<string | null>(null);
  const [storeName, setStoreName] = useState('');
  const [storeDescription, setStoreDescription] = useState('');
  const [storeAddress, setStoreAddress] = useState('');
  const [hasDelivery, setHasDelivery] = useState<boolean | null>(null);
  const [facebook, setFacebook] = useState('');
  const [instagram, setInstagram] = useState('');
  const [whatsapp, setWhatsapp] = useState('');

  /**
   * Prize categories drive both the opening grid and step 1's "type" dropdown.
   * A failed load used to fall back to `[]`, which rendered as "there are no
   * prize types" with nothing to retry — indistinguishable from an empty
   * catalogue. It is now a reportable, retryable state.
   */
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [categoriesError, setCategoriesError] = useState(false);
  const [categoriesNonce, setCategoriesNonce] = useState(0);
  const reloadCategories = useCallback(() => setCategoriesNonce((n) => n + 1), []);

  useEffect(() => {
    let cancelled = false;
    setCategoriesLoading(true);
    setCategoriesError(false);
    CompetitionsService.getPrizeCategories()
      .then((cats) => {
        if (cancelled) return;
        setCategories(cats);
        setCategoriesLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setCategories([]);
        setCategoriesError(true);
        setCategoriesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [categoriesNonce]);

  /**
   * The pool loads only while step 2 is on screen. See `useMatchPool` for why
   * it must not depend on Clerk's `getToken` — that dependency is what made
   * "Choose Match" call the endpoint continuously.
   */
  const {
    matches,
    loading: matchesLoading,
    error: matchesError,
    reload: reloadMatchPool,
  } = useMatchPool(phase === 2);

  const canAdvance = (): boolean => {
    if (phase === 'category') return !!category;
    if (phase === 1) {
      if (isCashCategory) return cashAmount >= CASH_MIN_EGP && winnersCount >= 1;
      return !!prizeName.trim() && winnersCount >= 1;
    }
    if (phase === 2) {
      if (!ENFORCE_DEADLINE_RULES) return !!selectedMatch;
      return step2Problem === null;
    }
    if (phase === 3) return !!storeName.trim() && hasDelivery !== null;
    return true;
  };

  const goNext = () => {
    if (!canAdvance()) return;
    setPhase((p) => (p === 'category' ? 1 : ((p as number) + 1) as Phase));
  };

  const goBack = () => {
    if (phase === 'category') router.back();
    else if (phase === 1) setPhase('category');
    else setPhase(((phase as number) - 1) as Phase);
  };

  /** Hour-only close time — minutes are always :00. */
  const deadlineAt = (): Date | null =>
    buildDeadline({ date: deadlineDate, hour: String(hour), minute: '00', meridiem });

  /**
   * Kickoff caps the date picker — predictions must close by kickoff.
   * Memoised because it is passed to `PWDateField` as `maximumDate`: a fresh
   * `Date` every render invalidated that component's memoised open handler on
   * every render, for no reason.
   */
  const kickoffAt = React.useMemo(
    () => (selectedMatch ? new Date(selectedMatch.kickoffIso) : null),
    [selectedMatch],
  );

  const deadlineIso = (): string | null => {
    const chosen = deadlineAt();
    if (ENFORCE_DEADLINE_RULES) return chosen?.toISOString() ?? null;
    if (!kickoffAt) return chosen?.toISOString() ?? null;
    const now = Date.now();
    const kick = kickoffAt.getTime();
    if (kick <= now) return chosen?.toISOString() ?? null;
    const soon = now + 60_000;
    const target = chosen?.getTime() ?? kick;
    const clamped = Math.min(kick, Math.max(soon, target));
    return new Date(clamped).toISOString();
  };

  /**
   * Why step 2 cannot advance, or `null` when it can.
   *
   * The gate used to be a bare boolean, so a sponsor faced with a permanently
   * dead Next button had nothing to go on — and the button really could be
   * unsatisfiable, because the match pool served fixtures that had already
   * kicked off and the deadline must land in `(now, kickoff]`. The pool no
   * longer offers those, and whatever is still missing now says so.
   */
  const step2Problem: string | null = (() => {
    if (!selectedMatch) return wizard.needMatch;
    if (!deadlineDate) return wizard.needDate;
    const at = deadlineAt();
    if (!at) return wizard.needValidTime;
    if (!isDeadlineWithinBounds(at, kickoffAt)) {
      return at.getTime() <= Date.now()
        ? wizard.deadlineInPast
        : wizard.deadlineAfterKickoff.replace(
            '{time}',
            kickoffAt ? `${formatDate(kickoffAt)} ${selectedMatch.time}` : '',
          );
    }
    return null;
  })();

  /**
   * Switching matches can invalidate a deadline that was legal for the old
   * one (a later kickoff). Keeping it would leave the Next button disabled
   * with no visible reason, so a now-impossible date is dropped.
   */
  const onSelectMatch = useCallback((match: MatchPoolEntry) => {
    setSelectedMatch(match);
    const kickoff = new Date(match.kickoffIso);
    const matchDay = parseCalendarDay(match.day) ?? startOfDay(kickoff);
    setDeadlineDate(matchDay);
  }, []);

  const minDeadlineDate = React.useMemo(() => {
    if (selectedMatch) {
      return parseCalendarDay(selectedMatch.day) ?? startOfDay(new Date(selectedMatch.kickoffIso));
    }
    return startOfToday();
  }, [selectedMatch]);

  const resolvedPrizeName = isCashCategory
    ? wizard.cashPrizeName.replace('{amount}', String(cashAmount))
    : prizeName.trim();

  const handlePublish = async () => {
    const iso = deadlineIso();
    if (!category || !selectedMatch || !iso) return;
    // `submitting` state alone cannot stop a double-tap: both presses can fire
    // before React re-renders with the disabled button. The ref closes that gap.
    if (publishInFlight.current) return;
    publishInFlight.current = true;
    setSubmitting(true);
    try {
      const token = await getToken();
      if (!token) throw new Error('NOT_AUTHENTICATED');
      await CompetitionsService.create(token, {
        sponsor: {
          name: storeName,
          description: storeDescription || null,
          logoUrl: storeImageUrl,
          address: storeAddress || null,
          hasDelivery: !!hasDelivery,
          socialLinks: {
            facebook: facebook || undefined,
            instagram: instagram || undefined,
            whatsapp: whatsapp || undefined,
          },
        },
        categoryId: category.id,
        prizeName: resolvedPrizeName,
        prizeImageUrl: isCashCategory ? null : prizeImageUrl,
        prizeType: category.key,
        prizeDescription: prizeDescription || null,
        prizeCashAmount: isCashCategory ? cashAmount : null,
        rules: rules || null,
        winnersCount,
        apiMatchId: selectedMatch.apiMatchId,
        poolDate: selectedMatch.day,
        predictionDeadline: iso,
      });
      // Leave `submitting` true so this screen does not remount CTA children
      // while Fabric is tearing it down. Toast after the hub has mounted —
      // showing BlurView in the same tick as `replace` crashed Android with
      // `addViewAt: failed to insert view`.
      router.replace('/(tabs)/predict-and-win');
      InteractionManager.runAfterInteractions(() => {
        toast.showSuccess(wizard.submittedTitle, wizard.submittedSubtitle);
      });
    } catch (err: any) {
      publishInFlight.current = false;
      setSubmitting(false);
      toast.showError(wizard.publish, errorMessage(err));
    }
  };

  /** Preview object so step 4 can render the real cards. */
  const preview = {
    id: 'preview',
    sponsor: {
      id: 'preview',
      name: storeName,
      description: storeDescription || null,
      logoUrl: storeImageUrl,
      address: storeAddress || null,
      hasDelivery: !!hasDelivery,
      socialLinks: null,
      isVerified: false,
    },
    category: category!,
    prizeName: resolvedPrizeName,
    prizeImageUrl: isCashCategory ? null : prizeImageUrl,
    prizeType: category?.key ?? '',
    prizeDescription: prizeDescription || null,
    rules: rules || null,
    winnersCount,
    apiMatchId: selectedMatch?.apiMatchId ?? 0,
    homeTeam: selectedMatch?.home.name ?? '',
    awayTeam: selectedMatch?.away.name ?? '',
    homeTeamLogo: selectedMatch?.home.logo ?? null,
    awayTeamLogo: selectedMatch?.away.logo ?? null,
    // `kickoffIso` is the absolute instant. Re-assembling `day` + `time` into a
    // naive string made the preview card parse an app-timezone wall clock as
    // device-local, so step 4 showed a kickoff the published card would not.
    matchDate: selectedMatch?.kickoffIso ?? new Date().toISOString(),
    leagueName: selectedMatch?.leagueName ?? null,
    predictionDeadline: deadlineIso() ?? new Date().toISOString(),
    predictionMode: 'EXACT_SCORE' as const,
    status: 'DRAFT' as const,
    isFree: true,
    participantsCount: 0,
    myEntry: null,
  };

  const gutter = { paddingHorizontal: s(22) };

  return (
    <View style={{ flex: 1, backgroundColor: PW.screen }}>
      <PWHeader title={t.predictAndWin.addPrize} onBack={goBack} />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: insets.bottom + s(40) }}
        >
          {phase !== 'category' ? (
            <View style={{ paddingTop: s(35) }}>
              <PredictionStepper step={phase} />
            </View>
          ) : null}

          {/* ─── Category ─────────────────────────────────────────────── */}
          {phase === 'category' ? (
            <>
              <View style={{ paddingTop: s(32), alignItems: 'center', gap: s(8) }}>
                <Text style={{ fontFamily: bold, fontSize: f(28), color: PW.text, textAlign: 'center' }}>
                  {wizard.chooseCategoryTitle}
                </Text>
                <Text
                  style={{ fontFamily: regular, fontSize: f(16), color: PW.textSubtitle, textAlign: 'center' }}
                >
                  {wizard.chooseCategorySubtitle}
                </Text>
              </View>

              <View style={{ height: s(29) }} />
              {/* Figma's category screen has no CTA — choosing a card advances. */}
              {categoriesLoading ? (
                <ActivityIndicator color={PW.ctaTop} size="large" style={{ marginTop: s(40) }} />
              ) : categoriesError || categories.length === 0 ? (
                <CategoriesPlaceholder failed={categoriesError} onRetry={reloadCategories} />
              ) : (
                <PrizeCategoryGrid
                  categories={categories}
                  selectedId={category?.id ?? null}
                  onSelect={(c) => {
                    setCategory(c);
                    setPhase(1);
                  }}
                />
              )}

              <View style={{ height: s(28) }} />
              <LinearGradient
                colors={[...PW_GRADIENTS.cell]}
                style={{
                  width: gridWidth,
                  minHeight: s(88),
                  alignSelf: 'center',
                  borderRadius: s(17),
                  borderWidth: 1,
                  borderColor: PW.cellBorder,
                  paddingHorizontal: s(15),
                  paddingVertical: s(12),
                  flexDirection: dir.rowReverse,
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                  gap: s(9),
                }}
              >
                <View style={{ flex: 1, gap: s(6), alignItems: dir.alignStart }}>
                  <Text style={{ fontFamily: semibold, fontSize: f(18), color: PW.text, textAlign: dir.textAlign }}>
                    {wizard.tipTitle}
                  </Text>
                  <Text
                    style={{
                      fontFamily: regular,
                      fontSize: f(13),
                      lineHeight: f(13) * 1.268,
                      color: PW.textTipBody,
                      textAlign: dir.textAlign,
                    }}
                  >
                    {wizard.tipBody}
                  </Text>
                </View>
                <LinearGradient
                  colors={[...PW_GRADIENTS.medallion]}
                  style={{
                    width: s(64),
                    height: s(64),
                    borderRadius: s(PW_RADII.medallion),
                    borderWidth: 1,
                    borderColor: PW.medallionBorder,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <IconIdea width={s(42)} height={s(43)} />
                </LinearGradient>
              </LinearGradient>
            </>
          ) : null}

          {/* ─── Step 1 · prize info ──────────────────────────────────── */}
          {phase === 1 ? (
            <>
              {!isCashCategory ? (
                <>
                  <View style={[gutter, { marginTop: s(37), alignItems: dir.alignStart }]}>
                    <PWFieldLabel label={wizard.prizeImage} optional={wizard.optional} />
                  </View>
                  <Pressable
                    onPress={() => setPickerTarget('prize')}
                    style={{
                      width: contentWidth,
                      height: s(207),
                      alignSelf: 'center',
                      marginTop: s(27),
                      borderRadius: s(PW_RADII.card),
                      overflow: 'hidden',
                      backgroundColor: PW.inputBottom,
                      borderWidth: 1,
                      borderColor: PW.inputBorder,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {prizeImageUrl ? (
                      <Image
                        source={{ uri: prizeImageUrl }}
                        style={{ width: '100%', height: '100%' }}
                        contentFit="cover"
                      />
                    ) : category ? (
                      <Image
                        source={categoryArtSource(category)}
                        style={{ width: '72%', height: '72%' }}
                        contentFit="contain"
                      />
                    ) : (
                      <IconCamera width={s(55)} height={s(49)} />
                    )}
                    {!prizeImageUrl ? (
                      <View
                        pointerEvents="none"
                        style={{
                          position: 'absolute',
                          right: s(12),
                          bottom: s(12),
                          width: s(44),
                          height: s(44),
                          borderRadius: s(22),
                          backgroundColor: 'rgba(0,0,0,0.45)',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <IconCamera width={s(22)} height={s(20)} />
                      </View>
                    ) : null}
                  </Pressable>
                  <Text
                    style={{
                      marginTop: s(10),
                      paddingHorizontal: s(22),
                      fontFamily: regular,
                      fontSize: f(12),
                      color: PW.textTileSub,
                      textAlign: dir.textAlign,
                    }}
                  >
                    {wizard.prizeImageDefaultHint}
                  </Text>
                </>
              ) : (
                <View style={{ marginTop: s(37), alignItems: 'center', gap: s(12) }}>
                  {category ? (
                    <CategoryMedallion category={category} size={126} artSize={96} />
                  ) : null}
                </View>
              )}

              <View style={[gutter, { marginTop: s(20), gap: s(34) }]}>
                {isCashCategory ? (
                  <View style={{ gap: s(16), alignItems: dir.alignStart }}>
                    <PWFieldLabel label={wizard.cashAmount} />
                    <View style={{ width: '100%', gap: s(8) }}>
                      <PWNumberStepper
                        value={cashAmount}
                        onChange={setCashAmount}
                        min={CASH_MIN_EGP}
                        max={CASH_MAX_EGP}
                        step={CASH_STEP_EGP}
                      />
                      <Text
                        style={{
                          fontFamily: regular,
                          fontSize: f(12),
                          color: PW.textTileSub,
                          textAlign: dir.textAlign,
                        }}
                      >
                        {wizard.cashAmountHint}
                      </Text>
                    </View>
                  </View>
                ) : (
                  <View style={{ gap: s(16), alignItems: dir.alignStart }}>
                    <PWFieldLabel label={wizard.prizeName} />
                    <View style={{ width: '100%' }}>
                      <PWTextField
                        value={prizeName}
                        onChangeText={setPrizeName}
                        placeholder={wizard.prizeName}
                        icon={<IconShoe width={s(35)} height={s(35)} />}
                      />
                    </View>
                  </View>
                )}

                <View style={{ gap: s(16), alignItems: dir.alignStart }}>
                  <PWFieldLabel label={wizard.prizeType} />
                  <View style={{ width: '100%' }}>
                    <PWBox height={64}>
                      <View
                        style={{
                          flexDirection: dir.rowReverse,
                          alignItems: 'center',
                          justifyContent: 'flex-end',
                          gap: s(12),
                        }}
                      >
                        <View style={{ flex: 1, gap: s(4) }}>
                          <Text
                            style={{
                              fontFamily: semibold,
                              fontSize: f(17),
                              color: PW.text,
                              textAlign: dir.textAlign,
                            }}
                            numberOfLines={2}
                          >
                            {category ? categoryName(category) : ''}
                          </Text>
                          <Text
                            style={{
                              fontFamily: regular,
                              fontSize: f(12),
                              color: PW.textTileSub,
                              textAlign: dir.textAlign,
                            }}
                          >
                            {wizard.prizeTypeLockedHint}
                          </Text>
                        </View>
                        {category ? <CategoryMedallion category={category} size={40} artSize={30} /> : null}
                      </View>
                    </PWBox>
                  </View>
                </View>

                <View style={{ gap: s(16), alignItems: dir.alignStart }}>
                  <PWFieldLabel label={wizard.prizeDescription} optional={wizard.optional} />
                  <View style={{ width: '100%' }}>
                    <PWTextArea
                      value={prizeDescription}
                      onChangeText={setPrizeDescription}
                      placeholder={wizard.prizeDescription}
                    />
                  </View>
                </View>

                <View style={{ gap: s(16), alignItems: dir.alignStart }}>
                  <PWFieldLabel label={wizard.winnersCount} />
                  <View style={{ width: '100%' }}>
                    <PWNumberStepper value={winnersCount} onChange={setWinnersCount} />
                  </View>
                </View>

                {/* Entry conditions. Not drawn in Figma's step 1, but the brief
                    requires sponsors to define competition rules — built from the
                    same label + textarea primitives as the fields above. */}
                <View style={{ gap: s(16), alignItems: dir.alignStart }}>
                  <PWFieldLabel label={wizard.rulesLabel} optional={wizard.optional} />
                  <View style={{ width: '100%' }}>
                    <PWTextArea
                      value={rules}
                      onChangeText={setRules}
                      placeholder={wizard.rulesLabel}
                      maxLength={300}
                    />
                  </View>
                </View>

                <View style={{ marginTop: s(54) }}>
                  <PWPrimaryButton label={wizard.next} onPress={goNext} disabled={!canAdvance()} />
                </View>
              </View>
            </>
          ) : null}

          {/* ─── Step 2 · challenge ───────────────────────────────────── */}
          {phase === 2 ? (
            <>
              {selectedMatch ? (
                <View style={{ marginTop: s(47) }}>
                  <SelectedMatchHero match={selectedMatch} />
                </View>
              ) : (
                <View style={{ height: s(47) }} />
              )}

              <View style={[gutter, { marginTop: s(46), gap: s(42) }]}>
                <View style={{ gap: s(16), alignItems: dir.alignStart }}>
                  <PWFieldLabel label={wizard.chooseMatch} />
                  <View style={{ width: '100%' }}>
                    <MatchPicker
                      matches={matches}
                      loading={matchesLoading}
                      error={matchesError}
                      selected={selectedMatch}
                      onSelect={onSelectMatch}
                      onRetry={reloadMatchPool}
                    />
                  </View>
                </View>

                <View style={{ gap: s(14), alignItems: dir.alignStart }}>
                  <PWFieldLabel label={wizard.deadlineTitle} />

                  <View style={{ width: '100%', gap: s(16) }}>
                    <View style={{ gap: s(8) }}>
                      <PWSubLabel label={wizard.deadlineDate} />
                      <PWDateField
                        value={deadlineDate}
                        onChange={setDeadlineDate}
                        // Business rule, enforced again on the server: the
                        // close time must be in the future and no later than
                        // kickoff. Bounding the picker means the sponsor cannot
                        // pick a day that publish would reject.
                        minimumDate={minDeadlineDate}
                        maximumDate={kickoffAt ?? undefined}
                      />
                      {kickoffAt ? (
                        <Text
                          style={{
                            fontFamily: regular,
                            fontSize: f(12),
                            color: PW.textTileSub,
                            textAlign: dir.textAlign,
                          }}
                        >
                          {wizard.deadlineHint.replace('{date}', formatDate(kickoffAt))}
                        </Text>
                      ) : null}
                    </View>

                    <View style={{ gap: s(8) }}>
                      <PWSubLabel label={wizard.deadlineTime} />
                      <Text
                        style={{
                          fontFamily: regular,
                          fontSize: f(12),
                          color: PW.textTileSub,
                          textAlign: dir.textAlign,
                        }}
                      >
                        {wizard.deadlineHourHint}
                      </Text>
                      <PWNumberStepper value={hour} onChange={setHour} min={1} max={12} />
                      <PWSegmentedPair
                        left={{ key: 'pm', label: wizard.pm }}
                        right={{ key: 'am', label: wizard.am }}
                        selected={meridiem}
                        onSelect={(k) => setMeridiem(k as 'am' | 'pm')}
                        gap={12}
                        idleColor={PW.textTimeIdle}
                      />
                    </View>
                  </View>
                </View>

                <View style={{ marginTop: s(66), gap: s(10) }}>
                  {/* A disabled CTA with no reason is indistinguishable from a
                      broken one — which is exactly how this read while the pool
                      still served matches that had already kicked off. */}
                  {ENFORCE_DEADLINE_RULES && step2Problem ? (
                    <Text
                      style={{
                        fontFamily: regular,
                        fontSize: f(12),
                        color: PW.textTileSub,
                        textAlign: 'center',
                      }}
                    >
                      {step2Problem}
                    </Text>
                  ) : null}
                  <PWPrimaryButton label={wizard.next} onPress={goNext} disabled={!canAdvance()} />
                </View>
              </View>
            </>
          ) : null}

          {/* ─── Step 3 · store info ──────────────────────────────────── */}
          {phase === 3 ? (
            <>
              <View style={[gutter, { marginTop: s(49), alignItems: dir.alignStart }]}>
                <PWFieldLabel label={wizard.storeImage} />
              </View>

              <Pressable
                onPress={() => setPickerTarget('store')}
                style={{ alignSelf: 'center', marginTop: s(39) }}
              >
                <LinearGradient
                  colors={['#4a078a', '#130224']}
                  style={{
                    width: s(126),
                    height: s(126),
                    borderRadius: s(118),
                    borderWidth: 1,
                    borderColor: '#8a38d8',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                    shadowColor: 'rgba(99,50,145,0.89)',
                    shadowOffset: { width: 0, height: -1 },
                    shadowOpacity: 1,
                    shadowRadius: 18,
                    elevation: 10,
                  }}
                >
                  {storeImageUrl ? (
                    <Image source={{ uri: storeImageUrl }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
                  ) : (
                    <IconCamera width={s(49.5)} height={s(44)} />
                  )}
                </LinearGradient>
              </Pressable>

              <View style={[gutter, { marginTop: s(24), gap: s(26) }]}>
                <View style={{ gap: s(16), alignItems: dir.alignStart }}>
                  <PWFieldLabel label={wizard.storeName} />
                  <View style={{ width: '100%' }}>
                    <PWTextField
                      value={storeName}
                      onChangeText={setStoreName}
                      placeholder={wizard.storeName}
                      icon={<IconStoreField width={s(35)} height={s(35)} />}
                    />
                  </View>
                </View>

                <View style={{ gap: s(16), alignItems: dir.alignStart }}>
                  <PWFieldLabel label={wizard.storeDescription} optional={wizard.optional} />
                  <View style={{ width: '100%' }}>
                    <PWTextField
                      value={storeDescription}
                      onChangeText={setStoreDescription}
                      placeholder={wizard.storeDescription}
                      icon={<IconStoreField width={s(35)} height={s(35)} />}
                    />
                  </View>
                </View>

                <View style={{ gap: s(16), alignItems: dir.alignStart }}>
                  <PWFieldLabel label={wizard.storeAddress} />
                  <View style={{ width: '100%' }}>
                    <PWTextField
                      value={storeAddress}
                      onChangeText={setStoreAddress}
                      placeholder={wizard.storeAddress}
                      icon={<IconStoreField width={s(35)} height={s(35)} />}
                    />
                  </View>
                </View>

                <View style={{ gap: s(16), alignItems: dir.alignStart }}>
                  <PWFieldLabel label={wizard.deliveryLabel} />
                  <View style={{ width: '100%' }}>
                    <PWSegmentedPair
                      left={{ key: 'no', label: wizard.deliveryUnavailable }}
                      right={{ key: 'yes', label: wizard.deliveryAvailable }}
                      selected={hasDelivery === null ? null : hasDelivery ? 'yes' : 'no'}
                      onSelect={(k) => setHasDelivery(k === 'yes')}
                    />
                  </View>
                </View>

                <View style={{ gap: s(16), alignItems: dir.alignStart }}>
                  <PWFieldLabel label={wizard.socialLinks} optional={wizard.optional} />
                  <View style={{ width: '100%', gap: s(12) }}>
                    <PWBox height={81}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: s(58) }}>
                        <IconFacebook width={s(45)} height={s(45)} />
                        <IconInstagram width={s(45)} height={s(45)} />
                        <IconWhatsapp width={s(44)} height={s(45)} />
                      </View>
                    </PWBox>
                    <PWTextField value={facebook} onChangeText={setFacebook} placeholder="Facebook" height={56} />
                    <PWTextField value={instagram} onChangeText={setInstagram} placeholder="Instagram" height={56} />
                    <PWTextField value={whatsapp} onChangeText={setWhatsapp} placeholder="WhatsApp" height={56} />
                  </View>
                </View>

                <View style={{ marginTop: s(82) }}>
                  <PWPrimaryButton label={wizard.next} onPress={goNext} disabled={!canAdvance()} />
                </View>
              </View>
            </>
          ) : null}

          {/* ─── Step 4 · review ──────────────────────────────────────── */}
          {phase === 4 ? (
            <View style={{ marginTop: s(45), gap: s(24) }}>
              <CompetitionCard competition={preview as never} onPress={() => undefined} />
              <CompetitionDetailCard
                competition={preview as never}
                remaining="—"
                ctaLabel={t.predictAndWin.detail.sharePrediction}
                onCtaPress={() => undefined}
              />

              <View style={[gutter, { gap: s(16), marginTop: s(40) }]}>
                <PWPrimaryButton
                  label={wizard.publish}
                  onPress={handlePublish}
                  disabled={submitting}
                  loading={submitting ? <ActivityIndicator color={PW.text} /> : undefined}
                />
                <PWOutlineButton label={wizard.edit} onPress={() => setPhase(1)} />
              </View>
            </View>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>

      {pickerTarget !== null ? (
        <ImageUploadModal
          visible
          onClose={() => setPickerTarget(null)}
          onSuccess={(url) => {
            if (pickerTarget === 'prize') setPrizeImageUrl(url);
            else if (pickerTarget === 'store') setStoreImageUrl(url);
            setPickerTarget(null);
          }}
          /**
           * `/api/upload` is the app's one mounted upload surface — the same one
           * `/upload/avatar`, `/upload/cover` and `/upload/group-avatar` use.
           * This pointed at `/storage/competition-asset`, on a router `main.ts`
           * never mounts, so every prize and store image upload answered
           * `404 Route not found`.
           */
          uploadOptions={{
            endpoint: '/upload/competition-asset',
            fieldName: 'file',
            additionalData: { kind: pickerTarget === 'store' ? 'sponsor' : 'prize' },
          }}
        />
      ) : null}
    </View>
  );
}

/**
 * Shown when the prize-category catalogue is unavailable.
 *
 * A failed `/prize-categories` request and a genuinely empty catalogue used to
 * render identically — as nothing at all — so "the gift types disappeared"
 * looked like a data problem when it could equally be a dead network. The two
 * are now distinguishable and the failure is retryable.
 */
function CategoriesPlaceholder({ failed, onRetry }: { failed: boolean; onRetry: () => void }) {
  const { s, f } = usePWScale();
  const { regular, semibold } = usePWFonts();
  const { t } = useTranslation();
  const wizard = t.predictAndWin.wizard;

  return (
    <View style={{ alignItems: 'center', gap: s(8), paddingHorizontal: s(30), paddingVertical: s(20) }}>
      <Text
        style={{ fontFamily: semibold, fontSize: f(15), color: PW.text, textAlign: 'center' }}
      >
        {failed ? wizard.categoriesError : wizard.categoriesEmpty}
      </Text>
      <Text
        style={{ fontFamily: regular, fontSize: f(12), color: PW.textTileSub, textAlign: 'center' }}
      >
        {failed ? t.predictAndWin.errorState.subtitle : wizard.categoriesEmptyHint}
      </Text>
      {failed ? (
        <Pressable onPress={onRetry} hitSlop={8} accessibilityRole="button">
          <Text style={{ fontFamily: semibold, fontSize: f(13), color: PW.vsTop }}>
            {t.predictAndWin.errorState.retry}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

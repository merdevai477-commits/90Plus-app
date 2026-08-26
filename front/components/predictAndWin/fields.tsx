/**
 * Wizard form primitives for "أضف جائزتك".
 *
 * Figma sources: step 1 `666:5768`, step 2 `690:1394`, step 3 `695:1782`.
 * Shared box: gradient #0c051a → #07040d, 1px #2b2539, radius 16, px 24.
 * Labels are Changa SemiBold 18 in Figma → app `useAppFont(600)`.
 */

import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { useTranslation } from '../../src/i18n';
import { toDateInputValue } from './deadline';
import { PWGradientText } from './GradientText';
import { IconCalendar, IconPlusBtn, IconRoundMinus } from './icons';
import { usePWLocalize } from './localize';
import { PW, PW_GRADIENTS, PW_RADII, usePWDirection, usePWFonts, usePWScale } from './theme';

/** Shared gradient box used by every input, select and segment. */
export function PWBox({
  height,
  style,
  children,
  selected,
}: {
  height?: number;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
  selected?: boolean;
}) {
  const { s } = usePWScale();
  return (
    <LinearGradient
      colors={selected ? [...PW_GRADIENTS.control] : [...PW_GRADIENTS.input]}
      style={[
        {
          height: height != null ? s(height) : undefined,
          borderRadius: s(PW_RADII.input),
          borderWidth: selected ? 0 : 1,
          borderColor: PW.inputBorder,
          paddingHorizontal: s(24),
          justifyContent: 'center',
        },
        style,
      ]}
    >
      {children}
    </LinearGradient>
  );
}

/** `اسم الجائزة` etc. — text (+ optional grey suffix) and a 4×20 accent bar. */
export function PWFieldLabel({
  label,
  optional,
  style,
}: {
  label: string;
  optional?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const { s, f } = usePWScale();
  const { semibold, regular } = usePWFonts();
  const dir = usePWDirection();
  return (
    <View
      style={[
        styles.labelRow,
        // Figma puts the accent bar on the *trailing* edge of an Arabic label,
        // which is the leading edge once the screen reads left-to-right.
        { gap: s(8), flexDirection: dir.rowReverse, alignSelf: dir.alignStart },
        style,
      ]}
    >
      <LinearGradient
        colors={[...PW_GRADIENTS.accent]}
        style={{ width: s(4), height: s(20), borderRadius: s(2) }}
      />
      <Text
        style={[
          styles.labelText,
          { fontFamily: semibold, fontSize: f(18), textAlign: dir.textAlign, flexShrink: 1 },
        ]}
      >
        {label}
        {optional ? (
          <Text style={{ fontFamily: regular, fontSize: f(14), color: PW.textOptional }}>
            {` ${optional}`}
          </Text>
        ) : null}
      </Text>
    </View>
  );
}

/** Secondary label above date/time inputs — Changa Regular 18 #868686. */
export function PWSubLabel({ label }: { label: string }) {
  const { f } = usePWScale();
  const { regular } = usePWFonts();
  const dir = usePWDirection();
  return (
    <Text
      style={[styles.subLabel, { fontFamily: regular, fontSize: f(18), textAlign: dir.textAlign }]}
    >
      {label}
    </Text>
  );
}

/** Text input with a trailing 35px icon (Figma `676:6004`, h 64). */
export function PWTextField({
  value,
  onChangeText,
  placeholder,
  icon,
  height = 64,
  multilineRows,
}: {
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  icon?: React.ReactNode;
  height?: number;
  multilineRows?: boolean;
}) {
  const { s, f } = usePWScale();
  const { regular } = usePWFonts();
  const dir = usePWDirection();
  return (
    <PWBox height={height}>
      <View style={[styles.inputRow, { gap: s(12), flexDirection: dir.rowReverse }]}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={PW.textPlaceholder}
          multiline={multilineRows}
          style={[
            styles.inputText,
            { fontFamily: regular, fontSize: f(17), flex: 1, textAlign: dir.textAlign },
          ]}
        />
        {icon ? <View style={{ width: s(35), height: s(35) }}>{icon}</View> : null}
      </View>
    </PWBox>
  );
}

/**
 * `تاريخ الانتهاء` — the Figma date field (`695:1744`, h73, `12/09/2026` +
 * calendar glyph).
 *
 * It shipped as a bare `PWTextField` with a `YYYY-MM-DD` placeholder and a
 * decorative calendar icon, so "choose date" opened the keyboard at best and
 * nothing at all when the user tapped the glyph. The whole box is the touch
 * target now, and it opens the platform picker:
 *
 *  - **Android** — the native dialog. It is imperative: it dismisses itself, so
 *    the `visible` flag must be cleared on both `set` and `dismissed`, and
 *    re-rendering `<DateTimePicker/>` while it is already up spawns a second
 *    dialog.
 *  - **iOS** — inline spinner inside a sheet, because the iOS picker is a view,
 *    not a dialog, and has no buttons of its own. Cancel restores the value it
 *    opened with; only Confirm commits.
 *  - **Web** — a real `<input type="date">`; the community picker has no web
 *    implementation and rendering it there throws.
 */
export function PWDateField({
  value,
  onChange,
  minimumDate,
  maximumDate,
  height = 73,
}: {
  value: Date | null;
  onChange: (next: Date | null) => void;
  minimumDate?: Date;
  maximumDate?: Date;
  height?: number;
}) {
  const { s, f } = usePWScale();
  const { regular, semibold } = usePWFonts();
  const dir = usePWDirection();
  const { formatDate } = usePWLocalize();
  const { t } = useTranslation();
  const wizard = t.predictAndWin.wizard;

  const [open, setOpen] = React.useState(false);
  /** iOS only: the in-progress value, committed on Confirm. */
  const [draft, setDraft] = React.useState<Date | null>(null);

  /**
   * What the picker should open on. Never `new Date()` when a `minimumDate` is
   * in the future — Android clamps silently but iOS renders an out-of-range
   * spinner whose first scroll snaps somewhere the user did not choose.
   */
  const initial = React.useCallback((): Date => {
    const base = value ?? new Date();
    if (minimumDate && base < minimumDate) return minimumDate;
    if (maximumDate && base > maximumDate) return maximumDate;
    return base;
  }, [value, minimumDate, maximumDate]);

  const openPicker = React.useCallback(() => {
    if (open) return;
    setDraft(initial());
    setOpen(true);
  }, [open, initial]);

  const onAndroidChange = React.useCallback(
    (event: DateTimePickerEvent, selected?: Date) => {
      // The dialog is already gone by the time this fires — leaving `open` true
      // would make the next tap a no-op.
      setOpen(false);
      if (event.type === 'set' && selected) onChange(selected);
    },
    [onChange],
  );

  const label = value ? formatDate(value) : wizard.datePlaceholder;

  return (
    <>
      <Pressable
        onPress={openPicker}
        accessibilityRole="button"
        accessibilityLabel={wizard.deadlineDate}
        accessibilityValue={{ text: value ? formatDate(value) : '' }}
      >
        <PWBox height={height}>
          <View style={[styles.inputRow, { gap: s(12), flexDirection: dir.rowReverse }]}>
            <Text
              style={[
                styles.inputText,
                {
                  fontFamily: regular,
                  fontSize: f(17),
                  flex: 1,
                  textAlign: dir.textAlign,
                  color: value ? PW.text : PW.textPlaceholder,
                },
              ]}
              numberOfLines={1}
            >
              {label}
            </Text>
            <View style={{ width: s(35), height: s(35) }} pointerEvents="none">
              <IconCalendar width={s(35)} height={s(35)} />
            </View>
          </View>
        </PWBox>
      </Pressable>

      {open && Platform.OS === 'android' ? (
        <DateTimePicker
          value={draft ?? initial()}
          mode="date"
          display="default"
          onChange={onAndroidChange}
          minimumDate={minimumDate}
          maximumDate={maximumDate}
        />
      ) : null}

      {Platform.OS === 'ios' ? (
        <Modal
          visible={open}
          transparent
          animationType="slide"
          statusBarTranslucent
          navigationBarTranslucent
          onRequestClose={() => setOpen(false)}
        >
          <Pressable style={styles.pickerBackdrop} onPress={() => setOpen(false)}>
            <Pressable style={styles.pickerSheetWrap} onPress={(e) => e.stopPropagation()}>
              <View
                style={{
                  backgroundColor: PW.surface,
                  borderTopLeftRadius: s(PW_RADII.detail),
                  borderTopRightRadius: s(PW_RADII.detail),
                  paddingTop: s(12),
                  paddingBottom: s(24),
                  paddingHorizontal: s(22),
                  gap: s(8),
                }}
              >
                <View style={{ flexDirection: dir.row, justifyContent: 'space-between' }}>
                  <Pressable onPress={() => setOpen(false)} hitSlop={10} accessibilityRole="button">
                    <Text style={{ fontFamily: regular, fontSize: f(15), color: PW.textSelect }}>
                      {wizard.dateCancel}
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      setOpen(false);
                      onChange(draft ?? initial());
                    }}
                    hitSlop={10}
                    accessibilityRole="button"
                  >
                    <Text style={{ fontFamily: semibold, fontSize: f(15), color: PW.vsTop }}>
                      {wizard.dateConfirm}
                    </Text>
                  </Pressable>
                </View>

                <DateTimePicker
                  value={draft ?? initial()}
                  mode="date"
                  display="spinner"
                  themeVariant="dark"
                  textColor={PW.text}
                  onChange={(_e: DateTimePickerEvent, selected?: Date) => {
                    if (selected) setDraft(selected);
                  }}
                  minimumDate={minimumDate}
                  maximumDate={maximumDate}
                />

                {value ? (
                  <Pressable
                    onPress={() => {
                      setOpen(false);
                      onChange(null);
                    }}
                    hitSlop={10}
                    accessibilityRole="button"
                    style={{ alignSelf: 'center' }}
                  >
                    <Text style={{ fontFamily: regular, fontSize: f(13), color: PW.textTileSub }}>
                      {wizard.dateClear}
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            </Pressable>
          </Pressable>
        </Modal>
      ) : null}

      {open && Platform.OS === 'web' ? (
        <WebDateInput
          value={value}
          minimumDate={minimumDate}
          maximumDate={maximumDate}
          onPick={(next) => {
            setOpen(false);
            onChange(next);
          }}
          onDismiss={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}

/**
 * `<input type="date">` under react-native-web. `@react-native-community/
 * datetimepicker` ships no web implementation, so the field was inert there.
 */
function WebDateInput({
  value,
  minimumDate,
  maximumDate,
  onPick,
  onDismiss,
}: {
  value: Date | null;
  minimumDate?: Date;
  maximumDate?: Date;
  onPick: (next: Date | null) => void;
  onDismiss: () => void;
}) {
  const ref = React.useRef<any>(null);

  React.useEffect(() => {
    const node = ref.current;
    if (!node) return;
    // `showPicker()` is Chromium-only; focus is the portable fallback.
    if (typeof node.showPicker === 'function') {
      try {
        node.showPicker();
        return;
      } catch {
        /* fall through to focus */
      }
    }
    node.focus?.();
  }, []);

  return React.createElement('input', {
    ref,
    type: 'date',
    value: value ? toDateInputValue(value) : '',
    min: minimumDate ? toDateInputValue(minimumDate) : undefined,
    max: maximumDate ? toDateInputValue(maximumDate) : undefined,
    style: { position: 'absolute', opacity: 0, pointerEvents: 'none', width: 1, height: 1 },
    onChange: (e: any) => {
      const raw = e?.target?.value;
      if (!raw) {
        onPick(null);
        return;
      }
      const [y, m, d] = raw.split('-').map(Number);
      onPick(new Date(y, m - 1, d));
    },
    onBlur: onDismiss,
  });
}

/** Dropdown row — chevron on the trailing edge, value leading (Figma `686:6182`). */
export function PWSelectField({
  value,
  placeholder,
  onPress,
  height = 64,
  leading,
  expanded,
}: {
  value?: string | null;
  placeholder: string;
  onPress: () => void;
  height?: number;
  leading?: React.ReactNode;
  /** Drives the chevron flip and the a11y expanded state. */
  expanded?: boolean;
}) {
  const { s, f } = usePWScale();
  const { medium } = usePWFonts();
  const dir = usePWDirection();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={expanded == null ? undefined : { expanded }}
    >
      <PWBox height={height}>
        <View style={[styles.selectRow, { flexDirection: dir.rowReverse }]}>
          {leading ?? <PWChevronDown size={s(32)} up={expanded} />}
          <Text
            style={[
              styles.selectText,
              {
                fontFamily: medium,
                fontSize: f(18),
                color: value ? PW.text : PW.textSelect,
                textAlign: dir.textAlign,
              },
            ]}
            numberOfLines={1}
          >
            {value || placeholder}
          </Text>
        </View>
      </PWBox>
    </Pressable>
  );
}

/** Textarea with a counter on the trailing edge (Figma `690:1335`, h 124). */
export function PWTextArea({
  value,
  onChangeText,
  placeholder,
  maxLength = 200,
}: {
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  maxLength?: number;
}) {
  const { s, f } = usePWScale();
  const { regular } = usePWFonts();
  const dir = usePWDirection();
  return (
    <PWBox height={124} style={{ paddingVertical: s(24), justifyContent: 'space-between' }}>
      <TextInput
        value={value}
        onChangeText={(t) => onChangeText(t.slice(0, maxLength))}
        placeholder={placeholder}
        placeholderTextColor={PW.textPlaceholder}
        multiline
        style={[
          styles.inputText,
          { fontFamily: regular, fontSize: f(17), textAlign: dir.textAlign, flex: 1 },
        ]}
      />
      <Text
        style={[
          styles.counter,
          { fontFamily: regular, fontSize: f(17), textAlign: dir.textAlignEnd },
        ]}
      >
        {`${value.length}/${maxLength}`}
      </Text>
    </PWBox>
  );
}

/** `عدد الفائزين` — minus / value / plus (Figma `690:1349`, h 74). */
export function PWNumberStepper({
  value,
  onChange,
  min = 1,
  max = 999,
}: {
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
}) {
  const { s, f } = usePWScale();
  const { semibold } = usePWFonts();
  // Figma `690:1349`: the minus sits on a 46×46 r12 gradient plate with a 28px
  // glyph; the plus is a single 46×46 exported asset that carries its own plate.
  const btn = (kind: 'minus' | 'plus') => {
    const next = kind === 'minus' ? Math.max(min, value - 1) : Math.min(max, value + 1);
    const disabled = next === value;
    return (
      <Pressable
        onPress={() => onChange(next)}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={kind === 'minus' ? 'decrease' : 'increase'}
        accessibilityState={{ disabled }}
        style={{ opacity: disabled ? 0.45 : 1 }}
      >
        {kind === 'plus' ? (
          <IconPlusBtn width={s(46)} height={s(46)} />
        ) : (
          <LinearGradient
            colors={[...PW_GRADIENTS.control]}
            style={{
              width: s(46),
              height: s(46),
              borderRadius: s(12),
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <IconRoundMinus width={s(28)} height={s(28)} />
          </LinearGradient>
        )}
      </Pressable>
    );
  };

  return (
    <PWBox height={74}>
      <View style={styles.stepperRow}>
        {btn('minus')}
        <Text style={[styles.stepperValue, { fontFamily: semibold, fontSize: f(35) }]}>
          {value}
        </Text>
        {btn('plus')}
      </View>
    </PWBox>
  );
}

/**
 * Two-up segmented control — delivery (`696:1972`) and AM/PM (`699:2482`).
 * Selected: gradient #6703c5 → #32025f, Bold 24 white. Idle: Medium 24 #5a5a5a.
 *
 * `left`/`right` are Figma's visual positions. Arabic reads right-to-left, so
 * the pair is mirrored in the English build to keep the same reading order.
 */
export function PWSegmentedPair({
  left,
  right,
  selected,
  onSelect,
  gap = 10,
  idleColor = PW.textSegmentIdle,
}: {
  left: { key: string; label: string };
  right: { key: string; label: string };
  selected: string | null;
  onSelect: (key: string) => void;
  gap?: number;
  idleColor?: string;
}) {
  const { s, f } = usePWScale();
  const { bold, medium } = usePWFonts();
  const dir = usePWDirection();

  const seg = (item: { key: string; label: string }) => {
    const isOn = selected === item.key;
    return (
      <Pressable
        key={item.key}
        style={{ flex: 1 }}
        onPress={() => onSelect(item.key)}
        accessibilityRole="button"
        accessibilityState={{ selected: isOn }}
      >
        <PWBox height={73} selected={isOn} style={{ alignItems: 'center' }}>
          <Text
            style={{
              fontFamily: isOn ? bold : medium,
              fontSize: f(24),
              color: isOn ? PW.text : idleColor,
              textAlign: 'center',
            }}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.7}
          >
            {item.label}
          </Text>
        </PWBox>
      </Pressable>
    );
  };

  return (
    <View style={{ flexDirection: dir.isRTL ? 'row' : 'row-reverse', gap: s(gap) }}>
      {[seg(left), seg(right)]}
    </View>
  );
}

/** Primary CTA — gradient #3d0ab3 → #190448, radius 16, py 21, text 18. */
export function PWPrimaryButton({
  label,
  onPress,
  disabled,
  loading,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: React.ReactNode;
}) {
  const { s, f } = usePWScale();
  const { semibold } = usePWFonts();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
    >
      <LinearGradient
        colors={[...PW_GRADIENTS.cta]}
        style={{
          borderRadius: s(PW_RADII.input),
          paddingVertical: s(21),
          paddingHorizontal: s(16),
          alignItems: 'center',
          justifyContent: 'center',
          opacity: disabled ? 0.55 : 1,
        }}
      >
        {loading ?? (
          <Text
            style={{ fontFamily: semibold, fontSize: f(18), color: PW.text, textAlign: 'center' }}
            numberOfLines={2}
          >
            {label}
          </Text>
        )}
      </LinearGradient>
    </Pressable>
  );
}

/** Outline CTA — 2px #3d0ab3 border, gradient text (Figma `696:2397`). */
export function PWOutlineButton({ label, onPress }: { label: string; onPress: () => void }) {
  const { s, f } = usePWScale();
  const { semibold } = usePWFonts();
  return (
    <Pressable onPress={onPress} accessibilityRole="button">
      <View
        style={{
          borderRadius: s(PW_RADII.input),
          borderWidth: 2,
          borderColor: PW.ctaTop,
          paddingVertical: s(21),
          paddingHorizontal: s(16),
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <PWGradientText
          colors={[PW.outlineTextTop, PW.outlineTextBottom]}
          style={{ fontFamily: semibold, fontSize: f(18) }}
        >
          {label}
        </PWGradientText>
      </View>
    </Pressable>
  );
}

/**
 * `iconamoon:arrow-down-2` — chevron used by the select rows. Figma's open
 * dropdown (`692:1524`) flips the same glyph vertically rather than swapping
 * in a second asset, so `up` mirrors it.
 */
export function PWChevronDown({
  size,
  color = PW.textSelect,
  up,
}: {
  size: number;
  color?: string;
  up?: boolean;
}) {
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <View
        style={{
          width: size * 0.42,
          height: size * 0.42,
          borderRightWidth: 2.5,
          borderBottomWidth: 2.5,
          borderColor: color,
          transform: [
            { rotate: up ? '225deg' : '45deg' },
            { translateY: up ? size * 0.07 : -size * 0.07 },
          ],
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  labelRow: { alignItems: 'center' },
  labelText: { color: PW.text },
  subLabel: { color: PW.textSubLabel, width: '100%' },
  // Figma `676:6006`: [value][icon] with `justify-end` — the icon sits on the
  // trailing edge of the reading order, so the row direction is mirrored.
  inputRow: { alignItems: 'center', justifyContent: 'flex-end' },
  pickerBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  pickerSheetWrap: { width: '100%' },
  inputText: { color: PW.text, padding: 0 },
  selectRow: { alignItems: 'center', justifyContent: 'space-between' },
  selectText: { flexShrink: 1 },
  counter: { color: PW.textPlaceholder },
  stepperRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  stepperValue: { color: PW.text, textAlign: 'center' },
});

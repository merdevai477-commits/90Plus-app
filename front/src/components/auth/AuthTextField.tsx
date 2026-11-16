import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  TextInputProps,
  ViewStyle,
  Platform,
  type ImageSourcePropType,
} from 'react-native';
import { Image } from 'expo-image';
import type { LucideIcon } from 'lucide-react-native';
import { AUTH_V2_ASSETS } from './authV2Assets';
import { useAuthScale } from './authLayoutMetrics';
import { useAuthTheme } from './useAuthTheme';

/** Figma field height on Login (1613:5714) — 52pt. */
const FIELD_HEIGHT = 52;
const FIELD_RADIUS = 14;
const FIELD_PADDING_H = 16;
const FIELD_PADDING_V = 10;
const ICON_GAP = 12;
const ICON_SIZE = 21;
const MIN_FIELD_HEIGHT = 48;

type Props = TextInputProps & {
  label?: string;
  icon?: LucideIcon;
  iconSource?: ImageSourcePropType;
  secureToggle?: boolean;
  containerStyle?: ViewStyle;
  isRTL?: boolean;
  filled?: boolean;
};

export function AuthTextField({
  label,
  icon: Icon,
  iconSource,
  secureToggle,
  containerStyle,
  secureTextEntry,
  isRTL,
  filled: _filled,
  style,
  ...rest
}: Props) {
  const styles = useFieldStyles();
  const { s } = useAuthScale();
  const { colors } = useAuthTheme();
  const [hide, setHide] = useState(true);
  const isSecure = !!(secureToggle && (secureTextEntry ?? true));
  const trailingIcon = iconSource;

  return (
    <View style={[styles.wrap, containerStyle]}>
      {label ? (
        <Text
          style={[
            styles.label,
            { color: colors.textPrimary },
            isRTL ? styles.labelRtl : styles.labelLtr,
          ]}
        >
          {label}
        </Text>
      ) : null}

      <View
        style={[
          styles.shell,
          {
            borderColor: colors.inputBorder,
            backgroundColor: colors.inputBg,
          },
        ]}
      >
        <View style={[styles.row, isRTL && styles.rowRtl]}>
          {secureToggle ? (
            <Pressable
              hitSlop={10}
              onPress={() => setHide((h) => !h)}
              style={styles.iconSlot}
              accessibilityRole="button"
              accessibilityLabel={hide ? 'Show password' : 'Hide password'}
            >
              <Image
                source={AUTH_V2_ASSETS.iconEye}
                style={styles.iconImage}
                contentFit="contain"
              />
            </Pressable>
          ) : null}

          <TextInput
            {...rest}
            placeholderTextColor={colors.inputPlaceholder}
            cursorColor={colors.primary}
            style={[
              styles.input,
              { color: colors.textPrimary },
              isRTL ? styles.inputRtl : styles.inputLtr,
              style,
            ]}
            secureTextEntry={isSecure ? hide : secureTextEntry}
          />

          <View style={styles.iconSlot}>
            {trailingIcon ? (
              <Image
                source={trailingIcon}
                style={styles.iconImage}
                contentFit="contain"
              />
            ) : Icon ? (
              <Icon color={colors.inputIcon} size={s(22)} strokeWidth={1.75} />
            ) : null}
          </View>
        </View>
      </View>
    </View>
  );
}

function useFieldStyles() {
  const { s, f, scale, fontScale } = useAuthScale();

  return useMemo(
    () => createFieldStyles(s, f),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [scale, fontScale],
  );
}

function createFieldStyles(s: (v: number) => number, f: (v: number) => number) {
  const fieldHeight = Math.max(s(FIELD_HEIGHT), MIN_FIELD_HEIGHT);
  const iconSize = s(ICON_SIZE);

  return StyleSheet.create({
    wrap: {
      width: '100%',
      gap: s(4),
    },
    label: {
      fontSize: f(13),
      fontWeight: '600',
      lineHeight: f(18),
      width: '100%',
    },
    labelRtl: {
      textAlign: 'right',
      writingDirection: 'rtl',
    },
    labelLtr: {
      textAlign: 'left',
      writingDirection: 'ltr',
    },
    shell: {
      height: fieldHeight,
      borderRadius: s(FIELD_RADIUS),
      borderWidth: 1,
      overflow: 'hidden',
      width: '100%',
    },
    row: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: s(FIELD_PADDING_H),
      paddingVertical: s(FIELD_PADDING_V),
      gap: s(ICON_GAP),
      minHeight: fieldHeight - 2,
    },
    rowRtl: {
      flexDirection: 'row-reverse',
    },
    iconSlot: {
      width: iconSize,
      height: iconSize,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    iconImage: {
      width: iconSize,
      height: iconSize,
    },
    input: {
      flex: 1,
      minWidth: 0,
      fontSize: f(13),
      fontWeight: '400',
      paddingVertical: 0,
      margin: 0,
      ...Platform.select({
        android: { includeFontPadding: false, textAlignVertical: 'center' },
        default: {},
      }),
    },
    inputRtl: {
      textAlign: 'right',
      writingDirection: 'rtl',
    },
    inputLtr: {
      textAlign: 'left',
      writingDirection: 'ltr',
    },
  });
}

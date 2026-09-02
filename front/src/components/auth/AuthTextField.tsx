import React, { useMemo, useState } from 'react';
import {
  View,
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
import {
  AUTH_INPUT_BG,
  AUTH_INPUT_BG_FILLED,
  AUTH_INPUT_BORDER,
  AUTH_INPUT_BORDER_ALT,
  AUTH_INPUT_PLACEHOLDER,
} from './AuthTokens';
import { TEXT_PRIMARY } from '../../../constants/tokens';
import { AUTH_V2_ASSETS } from './authV2Assets';
import { useAuthScale } from './authLayoutMetrics';

/**
 * Figma DESIGN units — converted at render time by the shell's scale, like
 * every other measurement on these screens. A field fixed at 62pt on a 320pt
 * iPhone SE takes the same room it does on a 440pt Pro Max, which is what left
 * three of them plus the terms row filling the panel and pushing Sign Up off
 * the fold on small phones.
 */
const FIELD_HEIGHT = 62;
const FIELD_RADIUS = 16;
const FIELD_PADDING_H = 24;
const FIELD_PADDING_V = 10;
const ICON_GAP = 10;
const ICON_SIZE = 24;
/** Never let a field fall below the accessibility touch minimum. */
const MIN_FIELD_HEIGHT = 48;

type Props = TextInputProps & {
  icon?: LucideIcon;
  iconSource?: ImageSourcePropType;
  secureToggle?: boolean;
  containerStyle?: ViewStyle;
  isRTL?: boolean;
  filled?: boolean;
};

export function AuthTextField({
  icon: Icon,
  iconSource,
  secureToggle,
  containerStyle,
  secureTextEntry,
  isRTL,
  filled,
  style,
  ...rest
}: Props) {
  const styles = useFieldStyles();
  const { s } = useAuthScale();
  const [hide, setHide] = useState(true);
  const isSecure = !!(secureToggle && (secureTextEntry ?? true));
  const trailingIcon = iconSource;
  const borderColor = filled ? AUTH_INPUT_BORDER : AUTH_INPUT_BORDER_ALT;

  return (
    <View
      style={[
        styles.shell,
        { borderColor },
        filled ? styles.shellFilled : styles.shellDefault,
        containerStyle,
      ]}
    >
      <View style={[styles.row, isRTL && styles.rowRtl]}>
        {secureToggle ? (
          <Pressable
            hitSlop={10}
            onPress={() => setHide((h) => !h)}
            style={styles.iconSlot}
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
          placeholderTextColor={AUTH_INPUT_PLACEHOLDER}
          cursorColor={TEXT_PRIMARY}
          style={[
            styles.input,
            isRTL ? styles.inputRtl : styles.inputLtr,
            style,
          ]}
          secureTextEntry={isSecure ? hide : secureTextEntry}
        />

        <View style={styles.iconSlot}>
          {trailingIcon ? (
            <Image source={trailingIcon} style={styles.iconImage} contentFit="contain" />
          ) : Icon ? (
            <Icon color={AUTH_INPUT_PLACEHOLDER} size={s(22)} strokeWidth={1.75} />
          ) : null}
        </View>
      </View>
    </View>
  );
}

function useFieldStyles() {
  const { s, f, scale, fontScale } = useAuthScale();

  return useMemo(
    () => createFieldStyles(s, f),
    // `s`/`f` are new closures each render; the multipliers are what change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [scale, fontScale],
  );
}

function createFieldStyles(s: (v: number) => number, f: (v: number) => number) {
  const fieldHeight = Math.max(s(FIELD_HEIGHT), MIN_FIELD_HEIGHT);
  const iconSize = s(ICON_SIZE);

  return StyleSheet.create({
  shell: {
    height: fieldHeight,
    borderRadius: s(FIELD_RADIUS),
    borderWidth: Platform.OS === 'ios' ? 0.5 : StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  shellFilled: {
    backgroundColor: AUTH_INPUT_BG_FILLED,
  },
  shellDefault: {
    backgroundColor: AUTH_INPUT_BG,
  },
  row: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: s(FIELD_PADDING_H),
    paddingVertical: s(FIELD_PADDING_V),
    gap: s(ICON_GAP),
    minHeight: fieldHeight - 1,
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
    color: TEXT_PRIMARY,
    fontSize: f(17),
    fontWeight: '500',
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

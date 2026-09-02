import React, { useState } from 'react';
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

const FIELD_HEIGHT = 62;
const FIELD_RADIUS = 16;
const FIELD_PADDING_H = 24;
const FIELD_PADDING_V = 10;
const ICON_GAP = 10;

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
            <Icon color={AUTH_INPUT_PLACEHOLDER} size={22} strokeWidth={1.75} />
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    height: FIELD_HEIGHT,
    borderRadius: FIELD_RADIUS,
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
    paddingHorizontal: FIELD_PADDING_H,
    paddingVertical: FIELD_PADDING_V,
    gap: ICON_GAP,
    minHeight: FIELD_HEIGHT - 1,
  },
  rowRtl: {
    flexDirection: 'row-reverse',
  },
  iconSlot: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  iconImage: {
    width: 24,
    height: 24,
  },
  input: {
    flex: 1,
    minWidth: 0,
    color: TEXT_PRIMARY,
    fontSize: 17,
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

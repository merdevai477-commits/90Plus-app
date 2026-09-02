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
  AUTH_INPUT_PLACEHOLDER,
} from './AuthTokens';
import { TEXT_PRIMARY } from '../../../constants/tokens';
import { AUTH_V2_ASSETS } from './authV2Assets';

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

  return (
    <View
      style={[
        styles.wrap,
        filled && styles.wrapFilled,
        isRTL && styles.wrapRtl,
        containerStyle,
      ]}
    >
      {secureToggle ? (
        <Pressable hitSlop={10} onPress={() => setHide((h) => !h)} style={styles.iconSlot}>
          <Image source={AUTH_V2_ASSETS.iconEye} style={styles.iconImage} contentFit="contain" />
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
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    backgroundColor: AUTH_INPUT_BG,
    borderWidth: 0.5,
    borderColor: AUTH_INPUT_BORDER,
    paddingHorizontal: 24,
    minHeight: 62,
    gap: 10,
  },
  wrapFilled: {
    backgroundColor: AUTH_INPUT_BG_FILLED,
  },
  wrapRtl: {
    flexDirection: 'row-reverse',
  },
  iconSlot: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconImage: {
    width: 24,
    height: 24,
  },
  input: {
    flex: 1,
    color: TEXT_PRIMARY,
    fontSize: 17,
    fontWeight: '500',
    paddingVertical: Platform.OS === 'ios' ? 10 : 8,
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

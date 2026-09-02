import React, { useState } from 'react';
import {
  View,
  TextInput,
  Pressable,
  StyleSheet,
  TextInputProps,
  ViewStyle,
  Platform,
} from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { Eye, EyeOff } from 'lucide-react-native';
import {
  AUTH_INPUT_BG,
  AUTH_INPUT_BORDER,
  AUTH_INPUT_PLACEHOLDER,
} from './AuthTokens';
import { TEXT_PRIMARY } from '../../../constants/tokens';

type Props = TextInputProps & {
  icon: LucideIcon;
  secureToggle?: boolean;
  containerStyle?: ViewStyle;
  isRTL?: boolean;
  filled?: boolean;
};

export function AuthTextField({
  icon: Icon,
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
          {hide ? (
            <Eye color={AUTH_INPUT_PLACEHOLDER} size={22} strokeWidth={1.75} />
          ) : (
            <EyeOff color={AUTH_INPUT_PLACEHOLDER} size={22} strokeWidth={1.75} />
          )}
        </Pressable>
      ) : (
        <View style={styles.iconSlot} />
      )}

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
        <Icon color={AUTH_INPUT_PLACEHOLDER} size={22} strokeWidth={1.75} />
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
    backgroundColor: '#04020c',
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

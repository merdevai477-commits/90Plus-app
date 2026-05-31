import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Platform,
  type ViewStyle,
} from 'react-native';
import { TEXT_PRIMARY } from '../../../constants/tokens';

const DEFAULT_LENGTH = 6;

type Props = {
  length?: number;
  value: string;
  onChange: (value: string) => void;
  autoFocus?: boolean;
  containerStyle?: ViewStyle;
};

/**
 * OTP field with reliable paste + SMS autofill on iOS and Android.
 * A single hidden input receives the full code; cells are display-only.
 */
export function OtpInput({
  length = DEFAULT_LENGTH,
  value,
  onChange,
  autoFocus = false,
  containerStyle,
}: Props) {
  const inputRef = useRef<TextInput>(null);
  const digits = value.padEnd(length, ' ').slice(0, length).split('');

  useEffect(() => {
    if (autoFocus) {
      const t = setTimeout(() => inputRef.current?.focus(), 200);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [autoFocus]);

  const applyValue = (raw: string) => {
    const cleaned = raw.replace(/\D/g, '').slice(0, length);
    onChange(cleaned);
  };

  const focusInput = () => inputRef.current?.focus();

  return (
    <Pressable style={[styles.row, containerStyle]} onPress={focusInput}>
      {digits.map((digit, i) => {
        const filled = Boolean(digit.trim());
        return (
        <View
          key={i}
          style={[
            styles.cell,
            filled ? styles.cellFilled : styles.cellEmpty,
          ]}
          pointerEvents="none"
        >
          <Text style={styles.cellText} allowFontScaling={false}>
            {digit.trim()}
          </Text>
        </View>
      );
      })}

      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={applyValue}
        keyboardType="number-pad"
        maxLength={length}
        textContentType="oneTimeCode"
        autoComplete={Platform.OS === 'android' ? 'sms-otp' : 'one-time-code'}
        importantForAutofill="yes"
        autoFocus={autoFocus}
        caretHidden
        style={styles.hiddenInput}
        accessibilityLabel="Verification code"
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 8,
    position: 'relative',
  },
  cell: {
    width: 46,
    height: 54,
    borderRadius: 14,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellEmpty: {
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  cellFilled: {
    borderColor: 'rgba(124,58,237,0.5)',
    backgroundColor: 'rgba(124,58,237,0.08)',
  },
  cellText: {
    color: TEXT_PRIMARY,
    fontSize: 22,
    lineHeight: 26,
    fontWeight: '800',
    textAlign: 'center',
    padding: 0,
    includeFontPadding: false,
    textAlignVertical: 'center',
    width: '100%',
  },
  hiddenInput: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 1,
    height: 1,
    opacity: 0,
    color: 'transparent',
    fontSize: 1,
  },
});

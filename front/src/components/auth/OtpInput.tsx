import React, { useRef, useEffect, useImperativeHandle, forwardRef } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Platform,
  type ViewStyle,
} from 'react-native';
import { TEXT_PRIMARY } from '../../../constants/tokens';

const DEFAULT_LENGTH = 6;

export type OtpInputHandle = {
  focus: () => void;
};

type Props = {
  length?: number;
  value: string;
  onChange: (value: string) => void;
  /** One delayed focus on mount (inline screens e.g. forgot-password). */
  autoFocus?: boolean;
  containerStyle?: ViewStyle;
};

/**
 * OTP field — transparent input overlays cells; stable layout (no size change on fill).
 */
const OtpInputBase = forwardRef<OtpInputHandle, Props>(function OtpInput(
  { length = DEFAULT_LENGTH, value, onChange, autoFocus = false, containerStyle },
  ref,
) {
  const inputRef = useRef<TextInput>(null);

  const focusInput = () => {
    inputRef.current?.focus();
  };

  useImperativeHandle(ref, () => ({ focus: focusInput }), []);

  useEffect(() => {
    if (!autoFocus) return undefined;
    const delay = Platform.OS === 'android' ? 350 : 150;
    const t = setTimeout(focusInput, delay);
    return () => clearTimeout(t);
  }, [autoFocus]);

  const applyValue = (raw: string) => {
    const cleaned = raw.replace(/\D/g, '').slice(0, length);
    onChange(cleaned);
  };

  const digits = value.padEnd(length, ' ').slice(0, length).split('');

  return (
    <View style={[styles.row, containerStyle]}>
      <View style={styles.cellsRow} pointerEvents="box-none">
        {digits.map((digit, i) => {
          const filled = Boolean(digit.trim());
          return (
            <View
              key={i}
              style={[styles.cell, filled ? styles.cellFilled : styles.cellEmpty]}
            >
              <Text style={styles.cellText} allowFontScaling={false}>
                {digit.trim()}
              </Text>
            </View>
          );
        })}
      </View>

      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={applyValue}
        keyboardType={Platform.OS === 'ios' ? 'number-pad' : 'numeric'}
        inputMode="numeric"
        maxLength={length}
        textContentType="oneTimeCode"
        autoComplete={Platform.OS === 'android' ? 'sms-otp' : 'one-time-code'}
        importantForAutofill="yes"
        showSoftInputOnFocus
        caretHidden
        style={styles.overlayInput}
        accessibilityLabel="Verification code"
      />
    </View>
  );
});

OtpInputBase.displayName = 'OtpInput';

export const OtpInput = OtpInputBase;

const styles = StyleSheet.create({
  row: {
    width: '100%',
    height: 54,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cellsRow: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
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
    width: '100%',
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  overlayInput: {
    ...StyleSheet.absoluteFillObject,
    opacity: Platform.OS === 'android' ? 0.02 : 0,
    color: 'transparent',
    fontSize: 24,
    textAlign: 'center',
  },
});

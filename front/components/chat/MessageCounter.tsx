/**
 * MessageCounter.tsx — Native
 * Pill showing remaining messages with dynamic color:
 *   ≥ 80% → green | ≥ 50% → yellow | < 50% → red
 * (نسبة مئوية بدل hardcoded 5/3)
 */

import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Colors,
  Radius,
  FontSize,
  Spacing,
  Gradients,
} from '../../../constants/theme';

// ─── Types ────────────────────────────────────────────────────────────────────

interface MessageCounterProps {
  messagesRemaining: number;
  total?: number;
}

interface CounterColors {
  gradientColors: readonly [string, string];
  borderColor: string;
  shadowColor: string;
  textColor: string;
}

// ─── Color Logic ──────────────────────────────────────────────────────────────

/**
 * ✅ يعتمد على النسبة المئوية بدل الأرقام الثابتة
 * حتى لو تغيّر total يظل المنطق صحيح
 */
function getColors(remaining: number, total: number): CounterColors {
  const ratio = total > 0 ? remaining / total : 0;

  if (ratio >= 0.8) {
    return {
      gradientColors: Gradients.success,
      borderColor: Colors.successBorder,
      shadowColor: Colors.success,
      textColor: '#6EE7B7',
    };
  }
  if (ratio >= 0.5) {
    return {
      gradientColors: Gradients.warning,
      borderColor: Colors.warningBorder,
      shadowColor: Colors.warning,
      textColor: '#FDE68A',
    };
  }
  return {
    gradientColors: Gradients.error,
    borderColor: Colors.errorBorder,
    shadowColor: Colors.error,
    textColor: '#FCA5A5',
  };
}

// ─── Component ────────────────────────────────────────────────────────────────

export function MessageCounter({
  messagesRemaining,
  total = 5,
}: MessageCounterProps) {
  // ✅ useMemo — لا نعيد الحساب إلا عند تغيّر القيم
  const colors = useMemo(
    () => getColors(messagesRemaining, total),
    [messagesRemaining, total],
  );

  // ✅ نص وصفي للـ accessibility
  const accessibilityLabel = `${messagesRemaining} of ${total} messages remaining`;

  return (
    /**
     * ✅ Shadow على wrapper خارجي بدون overflow:hidden
     *    حتى لا يُقطع الظل على iOS
     */
    <View
      style={[
        styles.shadowWrapper,
        {
          shadowColor: colors.shadowColor,
        },
      ]}
    >
      <View
        style={[
          styles.container,
          { borderColor: colors.borderColor },
        ]}
        accessible
        accessibilityRole="text"
        accessibilityLabel={accessibilityLabel}
      >
        <LinearGradient
          colors={colors.gradientColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradient}
        >
          {/* ✅ Glow blob — محسوب الحجم والموضع */}
          <View
            style={[
              styles.glowBlob,
              { backgroundColor: colors.shadowColor },
            ]}
          />

          <Text style={[styles.text, { color: colors.textColor }]}>
            {messagesRemaining}/{total}
          </Text>
        </LinearGradient>
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // ✅ Shadow wrapper منفصل — لا overflow هنا
  shadowWrapper: {
    borderRadius: Radius.full,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 6,
  },

  // ✅ overflow:hidden هنا فقط لقطع الـ gradient والـ glowBlob
  container: {
    borderRadius: Radius.full,
    overflow: 'hidden',
    borderWidth: 1,
  },

  gradient: {
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.xs,   // ✅ أصغر من sm — pill مناسب الحجم
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',          // ✅ تجهيز لو أضفت أيقونة لاحقاً
  },

  glowBlob: {
    position: 'absolute',
    top: -10,
    left: -10,
    width: 50,
    height: 50,
    borderRadius: 25,
    opacity: 0.25,                 // ✅ خفف أكثر — كان 0.3 مبالغ
  },

  text: {
    fontSize: FontSize.sm,         // ✅ أصغر — مناسب للـ pill
    fontWeight: '700',
    letterSpacing: 0.5,            // ✅ يحسن قراءة الأرقام
  },
});
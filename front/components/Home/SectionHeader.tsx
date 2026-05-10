import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  PURPLE_SOFT,
  BLUE_PRIMARY,
  TEXT_PRIMARY,
  TEXT_MUTED,
  SCREEN_PADDING_H,
  SECTION_HEADER_TO_CONTENT,
} from '../../constants/tokens';

interface SectionHeaderProps {
  title: string;
  /** Tiny label above title (muted caps). */
  subtitle?: string;
  action?: string;
  badge?: string;
  onAction?: () => void;
  /** Vertical accent bar beside title. */
  showAccent?: boolean;
}

export function SectionHeader({
  title,
  subtitle,
  action,
  badge,
  onAction,
  showAccent = true,
}: SectionHeaderProps) {
  return (
    <View style={styles.row}>
      <View style={styles.left}>
        {showAccent && (
          <LinearGradient
            colors={[PURPLE_SOFT, BLUE_PRIMARY]}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={styles.accentBar}
          />
        )}
        <View style={styles.titleBlock}>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
          <Text style={styles.title}>{title}</Text>
        </View>
      </View>

      <View style={styles.trailing}>
        {badge ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{badge}</Text>
          </View>
        ) : null}
        {action ? (
          onAction ? (
            <TouchableOpacity activeOpacity={0.7} onPress={onAction} hitSlop={10}>
              <Text style={styles.action}>{action}</Text>
            </TouchableOpacity>
          ) : (
            <Text style={[styles.action, styles.actionStatic]}>{action}</Text>
          )
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: SCREEN_PADDING_H,
    marginBottom: SECTION_HEADER_TO_CONTENT,
    gap: 12,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    flex: 1,
    minWidth: 0,
  },
  accentBar: {
    width: 4,
    height: 44,
    borderRadius: 2,
    marginTop: 1,
    opacity: 0.92,
  },
  titleBlock: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
    paddingVertical: 1,
    gap: 3,
  },
  subtitle: {
    color: TEXT_MUTED,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.9,
    textTransform: 'uppercase',
  },
  title: {
    color: TEXT_PRIMARY,
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.25,
    lineHeight: 22,
  },
  trailing: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexShrink: 0,
    marginTop: 2,
  },
  action: {
    color: PURPLE_SOFT,
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.1,
  },
  actionStatic: {
    opacity: 0.42,
  },
  badge: {
    backgroundColor: 'rgba(124,58,237,0.12)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(167,139,250,0.35)',
    borderRadius: 8,
    paddingVertical: 5,
    paddingHorizontal: 10,
  },
  badgeText: {
    color: 'rgba(237,233,254,0.92)',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.4,
    fontVariant: ['tabular-nums'],
  },
});

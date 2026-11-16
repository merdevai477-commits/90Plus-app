import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Text } from './MatchText';
import { LinearGradient } from 'expo-linear-gradient';
import TeamBadge from '../common/TeamBadge';
import {
  PURPLE_PRIMARY,
  PURPLE_GLOW,
  RADIUS_MD,
} from '../../constants/tokens';
import { useMatchDetailsTheme } from '../../hooks/useMatchDetailsTheme';

interface TeamToggleTeam {
  name: string;
  logo?: string;
}

interface TeamToggleProps {
  home: TeamToggleTeam;
  away: TeamToggleTeam;
  value: 'home' | 'away';
  onChange: (side: 'home' | 'away') => void;
  /** `pill` is the compact lineup switch; it fills its parent's size. */
  variant?: 'cards' | 'pill';
  /** Pill only: multiplier for the 37pt Figma height (font + crest sizes). */
  scale?: number;
}

const PILL_ACTIVE = ['#8B5CF6', '#513690'] as const;

export const TeamToggle: React.FC<TeamToggleProps> = ({
  home,
  away,
  value,
  onChange,
  variant = 'cards',
  scale = 1,
}) => {
  const { colors, isDark } = useMatchDetailsTheme();
  const idleLabel = isDark ? colors.textInverse : colors.textPrimary;
  const activeLabel = colors.textInverse;

  if (variant === 'pill') {
    const renderSegment = (side: 'home' | 'away', team: TeamToggleTeam) => {
      const isActive = value === side;
      const content = (
        <View style={[pill.content, { gap: 6 * scale, paddingHorizontal: 8 * scale }]}>
          <Text
            style={[
              pill.label,
              { fontSize: 15 * scale, color: isActive ? activeLabel : idleLabel },
              isActive && pill.labelActive,
            ]}
            numberOfLines={1}
            maxFontSizeMultiplier={1.1}
          >
            {team.name}
          </Text>
          <TeamBadge name={team.name} logo={team.logo} size={23 * scale} color="transparent" />
        </View>
      );
      return (
        <TouchableOpacity
          key={side}
          style={pill.segment}
          onPress={() => onChange(side)}
          activeOpacity={0.85}
          accessibilityRole="tab"
          accessibilityLabel={team.name}
          accessibilityState={{ selected: isActive }}
        >
          {isActive ? (
            <LinearGradient colors={PILL_ACTIVE} style={pill.active}>
              {content}
            </LinearGradient>
          ) : (
            content
          )}
        </TouchableOpacity>
      );
    };

    return (
      <View
        style={[
          pill.container,
          {
            backgroundColor: isDark ? '#0D0D25' : colors.cardBg,
            borderColor: isDark ? 'rgba(139,92,246,0.24)' : colors.cardBorder,
          },
        ]}
      >
        {renderSegment('home', home)}
        {renderSegment('away', away)}
      </View>
    );
  }

  const renderButton = (side: 'home' | 'away', team: TeamToggleTeam) => {
    const isActive = value === side;
    return (
      <TouchableOpacity
        style={[
          styles.button,
          {
            backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : colors.cardBg,
            borderColor: isDark ? 'rgba(255,255,255,0.12)' : colors.cardBorder,
          },
          isActive && styles.buttonActive,
        ]}
        onPress={() => onChange(side)}
        activeOpacity={0.85}
        accessibilityRole="tab"
        accessibilityLabel={team.name}
        accessibilityState={{ selected: isActive }}
      >
        <TeamBadge name={team.name} logo={team.logo} size={44} color="transparent" />
        <Text
          style={[
            styles.label,
            { color: colors.textMuted },
            isActive && { color: colors.textPrimary, fontWeight: '700' },
          ]}
          numberOfLines={1}
        >
          {team.name}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {renderButton('home', home)}
      {renderButton('away', away)}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  button: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: RADIUS_MD,
    borderWidth: 1,
  },
  buttonActive: {
    borderColor: PURPLE_PRIMARY,
    borderWidth: 1.5,
    shadowColor: PURPLE_GLOW,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 10,
    elevation: 4,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
});

const pill = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 48,
    overflow: 'hidden',
  },
  segment: {
    flex: 1,
    minWidth: 0,
  },
  active: {
    flex: 1,
    borderRadius: 49,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 0,
  },
  label: {
    flexShrink: 1,
    fontWeight: '500',
    textAlign: 'center',
    includeFontPadding: false,
  },
  labelActive: {
    fontWeight: '600',
  },
});

export default TeamToggle;

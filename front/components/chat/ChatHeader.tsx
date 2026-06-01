import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import { LiquidGlassView, isLiquidGlassSupported } from '@/utils/liquidGlassSafe';
import { Sparkles } from 'lucide-react-native';
import { BlurIntensity } from '../../constants/theme';
import { useTranslation } from '../../src/i18n';
import { chatColors } from './chatTheme';
import { chatScreenStyles as styles } from './chatScreen.styles';
import { FeatureInfoModal } from '../common/FeatureInfoModal';

export type ChatHeaderProps = {
  onBack: () => void;
  onMenu: () => void;
  backLabel: string;
  menuLabel: string;
};

export function ChatHeader({ onBack, onMenu, backLabel, menuLabel }: ChatHeaderProps) {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const [showChatInfo, setShowChatInfo] = React.useState(false);

  return (
    <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
      {isLiquidGlassSupported ? (
        <LiquidGlassView
          {...({
            style: StyleSheet.absoluteFill,
            effect: 'clear',
            interactive: true,
            tint: chatColors.headerBackdrop,
          } as object)}
        />
      ) : (
        <>
          <BlurView intensity={BlurIntensity.header} tint="dark" style={StyleSheet.absoluteFill} />
          <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.headerBackdrop]} />
        </>
      )}
      <LinearGradient
        colors={['rgba(168,85,247,0.06)', 'transparent']}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={[StyleSheet.absoluteFill, { height: 1 }]}
        pointerEvents="none"
      />
      <View style={styles.headerRow}>
        <Pressable
          onPress={onBack}
          style={({ pressed }) => [
            styles.iconButton,
            styles.iconButtonGhost,
            pressed && styles.iconButtonPressed,
          ]}
          hitSlop={8}
          accessibilityLabel={backLabel}
          accessibilityRole="button"
        >
          <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2}>
            <Path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </Pressable>

        <View style={styles.headerCenter}>
          <Pressable
            style={styles.logoPillLarge}
            onPress={() => setShowChatInfo(true)}
            accessibilityRole="button"
            accessibilityLabel={t.chatInfo.title}
          >
            <Text style={styles.logo90Large}>90</Text>
            <View style={styles.plusChipLarge}>
              <Text style={styles.logoPlusLarge}>PLUS</Text>
            </View>
            <Text style={styles.captainText}>{t.chat.headerCaptainAi}</Text>
          </Pressable>
        </View>

        <Pressable
          onPress={onMenu}
          style={({ pressed }) => [styles.iconButton, pressed && styles.iconButtonPressed]}
          hitSlop={8}
          accessibilityLabel={menuLabel}
          accessibilityRole="button"
        >
          <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2}>
            <Path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
          </Svg>
        </Pressable>
      </View>

      <FeatureInfoModal
        visible={showChatInfo}
        onClose={() => setShowChatInfo(false)}
        icon={<Sparkles size={30} color="#d8b4fe" />}
        title={t.chatInfo.title}
        bullets={[t.chatInfo.rule1, t.chatInfo.rule2, t.chatInfo.rule3]}
        hype={t.chatInfo.hype}
        gotItLabel={t.chatInfo.gotIt}
      />
    </View>
  );
}

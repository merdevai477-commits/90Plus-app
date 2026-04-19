import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, spacing, radius, shadow } from './theme';

type Props = {
  name?: string;
  onRegister?: () => void;
  onCreateCard?: () => void;
};

const WelcomeCard: React.FC<Props> = ({ name = 'Guest', onRegister, onCreateCard }) => {
  const shimmer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, { toValue: 1, duration: 2500, useNativeDriver: false }),
        Animated.timing(shimmer, { toValue: 0, duration: 2500, useNativeDriver: false }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [shimmer]);

  const overlayOpacity = shimmer.interpolate({ inputRange: [0, 1], outputRange: [0.08, 0.18] }) as any;

  return (
    <View style={[styles.container, shadow.cardShadow]}>
      <LinearGradient
        colors={[colors.green, colors.greenDark]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      >
        <Animated.View style={[styles.shimmer, { opacity: overlayOpacity }]} />
        <Text style={styles.greet}>Hello, {name}</Text>
        <Text style={styles.title}>Welcome to Football Hub</Text>
        <View style={styles.row}>
          <Pressable accessibilityLabel="Register" onPress={onRegister} style={({ pressed }) => [styles.btn, pressed && styles.pressed]}>
            <Text style={styles.btnTextDark}>Register</Text>
          </Pressable>
          <Pressable accessibilityLabel="Create Card" onPress={onCreateCard} style={({ pressed }) => [styles.btnOutline, pressed && styles.pressed]}>
            <Text style={styles.btnTextLight}>Create Card</Text>
          </Pressable>
        </View>
      </LinearGradient>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { margin: spacing.large, borderRadius: radius.lg, overflow: 'hidden' },
  gradient: { padding: spacing.large, borderRadius: radius.lg },
  shimmer: { ...StyleSheet.absoluteFillObject, backgroundColor: '#fff' },
  greet: { color: colors.text, opacity: 0.9, fontSize: 14, marginBottom: spacing.small },
  title: { color: colors.text, fontSize: 24, fontWeight: 'bold', marginBottom: spacing.large },
  row: { flexDirection: 'row', gap: spacing.small },
  btn: { backgroundColor: colors.text, paddingHorizontal: spacing.large, paddingVertical: spacing.small + 2, borderRadius: radius.md },
  btnOutline: { borderWidth: 1, borderColor: colors.text, paddingHorizontal: spacing.large, paddingVertical: spacing.small + 2, borderRadius: radius.md, backgroundColor: 'transparent' },
  btnTextDark: { color: colors.green, fontWeight: '600' },
  btnTextLight: { color: colors.text, fontWeight: '600' },
  pressed: { transform: [{ scale: 0.98 }], opacity: 0.95 },
});

export default WelcomeCard;



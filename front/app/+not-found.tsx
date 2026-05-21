// في ملف app/+not-found.tsx أو app/index.tsx
import { useEffect, useRef } from 'react';
import { useRouter } from 'expo-router';
import { StyleSheet, View, Animated, Text, Easing } from 'react-native';

export default function SplashScreen() {
  const router = useRouter();
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const ballRotate = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Fade in animation
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 800,
      useNativeDriver: true,
    }).start();

    // Circle rotation
    Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 3000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();

    // Ball rotation (reverse)
    Animated.loop(
      Animated.timing(ballRotate, {
        toValue: 1,
        duration: 2000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();

    // Navigate after 3 seconds
    const timer = setTimeout(() => {
      router.replace('/(tabs)/Home');
    }, 3000);

    return () => clearTimeout(timer);
  }, []);

  const circleRotate = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const ballRotateValue = ballRotate.interpolate({
    inputRange: [0, 1],
    outputRange: ['360deg', '0deg'],
  });

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.splashContainer, { opacity: fadeAnim }]}>
        {/* Logo Container */}
        <View style={styles.logoContainer}>
          <Animated.View style={[styles.outerCircle, { transform: [{ rotate: circleRotate }] }]}>
            <Animated.View style={[styles.football, { transform: [{ rotate: ballRotateValue }] }]}>
              <View style={[styles.pentagon, styles.pentagonCenter]} />
              <View style={[styles.pentagon, styles.pentagon1]} />
              <View style={[styles.pentagon, styles.pentagon2]} />
              <View style={[styles.pentagon, styles.pentagon3]} />
              <View style={[styles.pentagon, styles.pentagon4]} />
              <View style={[styles.pentagon, styles.pentagon5]} />
            </Animated.View>
          </Animated.View>
        </View>

        {/* Loading Section */}
        <View style={styles.loadingSection}>
          <Text style={styles.loadingText}>Loading 90Plus...</Text>
          <View style={styles.loadingBarContainer}>
            <Animated.View style={styles.loadingBar} />
          </View>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  splashContainer: {
    alignItems: 'center',
  },
  logoContainer: {
    marginBottom: 60,
  },
  outerCircle: {
    width: 180,
    height: 180,
    borderRadius: 90,
    borderWidth: 2.5,
    borderColor: '#8B7355',
    justifyContent: 'center',
    alignItems: 'center',
  },
  football: {
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: '#D4A574',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pentagon: {
    position: 'absolute',
    backgroundColor: '#1a1a1a',
    borderRadius: 2,
  },
  pentagonCenter: {
    width: 28,
    height: 28,
  },
  pentagon1: {
    width: 24,
    height: 24,
    top: 18,
  },
  pentagon2: {
    width: 22,
    height: 22,
    top: 52,
    left: 18,
  },
  pentagon3: {
    width: 22,
    height: 22,
    top: 52,
    right: 18,
  },
  pentagon4: {
    width: 20,
    height: 20,
    bottom: 22,
    left: 32,
  },
  pentagon5: {
    width: 20,
    height: 20,
    bottom: 22,
    right: 32,
  },
  loadingSection: {
    alignItems: 'center',
  },
  loadingText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 20,
    textAlign: 'center',
  },
  loadingBarContainer: {
    width: 220,
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 10,
    overflow: 'hidden',
  },
  loadingBar: {
    height: '100%',
    width: '70%',
    backgroundColor: '#D4A574',
    borderRadius: 10,
  },
});
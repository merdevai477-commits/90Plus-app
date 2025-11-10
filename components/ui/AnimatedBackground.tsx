import React, { useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  Animated,
  Dimensions,
} from 'react-native';

interface AnimatedBackgroundProps {
  children: React.ReactNode;
}

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

const AnimatedBackground: React.FC<AnimatedBackgroundProps> = ({ children }) => {
  const gradientAnim1 = useRef(new Animated.Value(0)).current;
  const gradientAnim2 = useRef(new Animated.Value(0)).current;
  const gradientAnim3 = useRef(new Animated.Value(0)).current;
  const floatingShape1 = useRef(new Animated.Value(0)).current;
  const floatingShape2 = useRef(new Animated.Value(0)).current;
  const floatingShape3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Slow gradient animations
    Animated.loop(
      Animated.sequence([
        Animated.timing(gradientAnim1, {
          toValue: 1,
          duration: 8000,
          useNativeDriver: false,
        }),
        Animated.timing(gradientAnim1, {
          toValue: 0,
          duration: 8000,
          useNativeDriver: false,
        }),
      ])
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(gradientAnim2, {
          toValue: 1,
          duration: 12000,
          useNativeDriver: false,
        }),
        Animated.timing(gradientAnim2, {
          toValue: 0,
          duration: 12000,
          useNativeDriver: false,
        }),
      ])
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(gradientAnim3, {
          toValue: 1,
          duration: 15000,
          useNativeDriver: false,
        }),
        Animated.timing(gradientAnim3, {
          toValue: 0,
          duration: 15000,
          useNativeDriver: false,
        }),
      ])
    ).start();

    // Floating shapes animations
    Animated.loop(
      Animated.sequence([
        Animated.timing(floatingShape1, {
          toValue: 1,
          duration: 20000,
          useNativeDriver: true,
        }),
        Animated.timing(floatingShape1, {
          toValue: 0,
          duration: 20000,
          useNativeDriver: true,
        }),
      ])
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(floatingShape2, {
          toValue: 1,
          duration: 25000,
          useNativeDriver: true,
        }),
        Animated.timing(floatingShape2, {
          toValue: 0,
          duration: 25000,
          useNativeDriver: true,
        }),
      ])
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(floatingShape3, {
          toValue: 1,
          duration: 30000,
          useNativeDriver: true,
        }),
        Animated.timing(floatingShape3, {
          toValue: 0,
          duration: 30000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  const gradient1Opacity = gradientAnim1.interpolate({
    inputRange: [0, 1],
    outputRange: [0.1, 0.3],
  });

  const gradient2Opacity = gradientAnim2.interpolate({
    inputRange: [0, 1],
    outputRange: [0.05, 0.2],
  });

  const gradient3Opacity = gradientAnim3.interpolate({
    inputRange: [0, 1],
    outputRange: [0.08, 0.25],
  });

  const floatingShape1TranslateY = floatingShape1.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -50],
  });

  const floatingShape2TranslateX = floatingShape2.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 30],
  });

  const floatingShape3TranslateY = floatingShape3.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 40],
  });

  return (
    <View style={styles.container}>
      {/* Base background */}
      <View style={styles.baseBackground} />
      
      {/* Animated gradient layers */}
      <Animated.View
        style={[
          styles.gradientLayer1,
          { opacity: gradient1Opacity },
        ]}
      />
      
      <Animated.View
        style={[
          styles.gradientLayer2,
          { opacity: gradient2Opacity },
        ]}
      />
      
      <Animated.View
        style={[
          styles.gradientLayer3,
          { opacity: gradient3Opacity },
        ]}
      />
      
      {/* Floating shapes */}
      <Animated.View
        style={[
          styles.floatingShape1,
          {
            transform: [{ translateY: floatingShape1TranslateY }],
          },
        ]}
      />
      
      <Animated.View
        style={[
          styles.floatingShape2,
          {
            transform: [{ translateX: floatingShape2TranslateX }],
          },
        ]}
      />
      
      <Animated.View
        style={[
          styles.floatingShape3,
          {
            transform: [{ translateY: floatingShape3TranslateY }],
          },
        ]}
      />
      
      {/* Content */}
      <View style={styles.content}>
        {children}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative',
  },
  baseBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#000000',
  },
  gradientLayer1: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '50%',
    backgroundColor: '#34C759',
  },
  gradientLayer2: {
    position: 'absolute',
    top: '30%',
    left: 0,
    right: 0,
    height: '40%',
    backgroundColor: '#1C1C1E',
  },
  gradientLayer3: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '30%',
    backgroundColor: '#2C2C2E',
  },
  floatingShape1: {
    position: 'absolute',
    top: '20%',
    right: '10%',
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(52, 199, 89, 0.1)',
  },
  floatingShape2: {
    position: 'absolute',
    top: '60%',
    left: '5%',
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(52, 199, 89, 0.08)',
  },
  floatingShape3: {
    position: 'absolute',
    bottom: '20%',
    right: '20%',
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(52, 199, 89, 0.05)',
  },
  content: {
    flex: 1,
    zIndex: 10,
  },
});

export default AnimatedBackground;

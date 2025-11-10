import React, { useRef, useEffect } from 'react';
import { Animated, Dimensions } from 'react-native';

const { width, height } = Dimensions.get('window');

// Fade In Animation
export const useFadeIn = (duration: number = 500, delay: number = 0) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration,
      delay,
      useNativeDriver: true,
    }).start();
  }, [duration, delay]);

  return fadeAnim;
};

// Slide In Animation
export const useSlideIn = (direction: 'up' | 'down' | 'left' | 'right' = 'up', duration: number = 500, delay: number = 0) => {
  const slideAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const toValue = direction === 'up' ? 0 : direction === 'down' ? 0 : direction === 'left' ? 0 : 0;
    const fromValue = direction === 'up' ? 50 : direction === 'down' ? -50 : direction === 'left' ? 50 : -50;

    slideAnim.setValue(fromValue);

    Animated.timing(slideAnim, {
      toValue,
      duration,
      delay,
      useNativeDriver: true,
    }).start();
  }, [direction, duration, delay]);

  return slideAnim;
};

// Scale Animation
export const useScale = (initialScale: number = 1, finalScale: number = 1.05, duration: number = 200) => {
  const scaleAnim = useRef(new Animated.Value(initialScale)).current;

  const animate = () => {
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: finalScale,
        duration,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: initialScale,
        duration,
        useNativeDriver: true,
      })
    ]).start();
  };

  return { scaleAnim, animate };
};

// Pulse Animation
export const usePulse = (minScale: number = 1, maxScale: number = 1.1, duration: number = 1000) => {
  const pulseAnim = useRef(new Animated.Value(minScale)).current;

  useEffect(() => {
    const pulse = () => {
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: maxScale,
          duration,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: minScale,
          duration,
          useNativeDriver: true,
        })
      ]).start(() => pulse());
    };

    pulse();
  }, [minScale, maxScale, duration]);

  return pulseAnim;
};

// Bounce Animation
export const useBounce = (bounceHeight: number = 20, duration: number = 600) => {
  const bounceAnim = useRef(new Animated.Value(0)).current;

  const bounce = () => {
    Animated.sequence([
      Animated.timing(bounceAnim, {
        toValue: -bounceHeight,
        duration: duration / 2,
        useNativeDriver: true,
      }),
      Animated.timing(bounceAnim, {
        toValue: 0,
        duration: duration / 2,
        useNativeDriver: true,
      })
    ]).start();
  };

  return { bounceAnim, bounce };
};

// Shake Animation
export const useShake = (shakeDistance: number = 10, duration: number = 100) => {
  const shakeAnim = useRef(new Animated.Value(0)).current;

  const shake = () => {
    Animated.sequence([
      Animated.timing(shakeAnim, {
        toValue: shakeDistance,
        duration: duration / 4,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnim, {
        toValue: -shakeDistance,
        duration: duration / 4,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnim, {
        toValue: shakeDistance,
        duration: duration / 4,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnim, {
        toValue: 0,
        duration: duration / 4,
        useNativeDriver: true,
      })
    ]).start();
  };

  return { shakeAnim, shake };
};

// Rotate Animation
export const useRotate = (rotationAngle: number = 360, duration: number = 1000) => {
  const rotateAnim = useRef(new Animated.Value(0)).current;

  const rotate = () => {
    Animated.timing(rotateAnim, {
      toValue: rotationAngle,
      duration,
      useNativeDriver: true,
    }).start();
  };

  return { rotateAnim, rotate };
};

// Stagger Animation for Lists
export const useStagger = (itemCount: number, staggerDelay: number = 100) => {
  const staggerAnimations = Array.from({ length: itemCount }, (_, index) => 
    useRef(new Animated.Value(0)).current
  );

  useEffect(() => {
    const animations = staggerAnimations.map((anim, index) =>
      Animated.timing(anim, {
        toValue: 1,
        duration: 400,
        delay: index * staggerDelay,
        useNativeDriver: true,
      })
    );

    Animated.parallel(animations).start();
  }, [itemCount, staggerDelay]);

  return staggerAnimations;
};

// Loading Skeleton Animation
export const useSkeleton = () => {
  const skeletonAnim = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const animate = () => {
      Animated.sequence([
        Animated.timing(skeletonAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(skeletonAnim, {
          toValue: 0.3,
          duration: 1000,
          useNativeDriver: true,
        })
      ]).start(() => animate());
    };

    animate();
  }, []);

  return skeletonAnim;
};

// Success Animation
export const useSuccessAnimation = () => {
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;

  const animate = () => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 100,
        friction: 8,
      }),
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      })
    ]).start();
  };

  return { scaleAnim, rotateAnim, animate };
};

// Error Animation
export const useErrorAnimation = () => {
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const colorAnim = useRef(new Animated.Value(0)).current;

  const animate = () => {
    Animated.parallel([
      Animated.sequence([
        Animated.timing(shakeAnim, {
          toValue: 10,
          duration: 50,
          useNativeDriver: true,
        }),
        Animated.timing(shakeAnim, {
          toValue: -10,
          duration: 50,
          useNativeDriver: true,
        }),
        Animated.timing(shakeAnim, {
          toValue: 10,
          duration: 50,
          useNativeDriver: true,
        }),
        Animated.timing(shakeAnim, {
          toValue: 0,
          duration: 50,
          useNativeDriver: true,
        })
      ]),
      Animated.timing(colorAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: false,
      })
    ]).start();
  };

  return { shakeAnim, colorAnim, animate };
};

// Floating Animation
export const useFloating = (floatDistance: number = 10, duration: number = 2000) => {
  const floatAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const float = () => {
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: -floatDistance,
          duration: duration / 2,
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim, {
          toValue: 0,
          duration: duration / 2,
          useNativeDriver: true,
        })
      ]).start(() => float());
    };

    float();
  }, [floatDistance, duration]);

  return floatAnim;
};

// Progress Animation
export const useProgress = (targetValue: number, duration: number = 1000) => {
  const progressAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: targetValue,
      duration,
      useNativeDriver: false,
    }).start();
  }, [targetValue, duration]);

  return progressAnim;
};

// Morphing Animation
export const useMorph = (fromValue: number, toValue: number, duration: number = 500) => {
  const morphAnim = useRef(new Animated.Value(fromValue)).current;

  const morph = () => {
    Animated.timing(morphAnim, {
      toValue,
      duration,
      useNativeDriver: true,
    }).start();
  };

  const reset = () => {
    Animated.timing(morphAnim, {
      toValue: fromValue,
      duration,
      useNativeDriver: true,
    }).start();
  };

  return { morphAnim, morph, reset };
};

// Parallax Animation
export const useParallax = (scrollY: Animated.Value, speed: number = 0.5) => {
  const parallaxAnim = scrollY.interpolate({
    inputRange: [0, height],
    outputRange: [0, -height * speed],
    extrapolate: 'clamp',
  });

  return parallaxAnim;
};

// Magnetic Animation
export const useMagnetic = (magneticStrength: number = 0.3) => {
  const magneticAnim = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;

  const attract = (x: number, y: number) => {
    Animated.spring(magneticAnim, {
      toValue: { x: x * magneticStrength, y: y * magneticStrength },
      useNativeDriver: true,
      tension: 100,
      friction: 8,
    }).start();
  };

  const release = () => {
    Animated.spring(magneticAnim, {
      toValue: { x: 0, y: 0 },
      useNativeDriver: true,
      tension: 100,
      friction: 8,
    }).start();
  };

  return { magneticAnim, attract, release };
};

// Wave Animation
export const useWave = (waveCount: number = 3, duration: number = 1000) => {
  const waveAnimations = Array.from({ length: waveCount }, (_, index) => 
    useRef(new Animated.Value(0)).current
  );

  useEffect(() => {
    const animations = waveAnimations.map((anim, index) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(anim, {
            toValue: 1,
            duration: duration,
            delay: index * (duration / waveCount),
            useNativeDriver: true,
          }),
          Animated.timing(anim, {
            toValue: 0,
            duration: 0,
            useNativeDriver: true,
          })
        ])
      )
    );

    animations.forEach(anim => anim.start());
  }, [waveCount, duration]);

  return waveAnimations;
};

// Glow Animation
export const useGlow = (glowIntensity: number = 0.8, duration: number = 1500) => {
  const glowAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const glow = () => {
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: glowIntensity,
          duration: duration / 2,
          useNativeDriver: false,
        }),
        Animated.timing(glowAnim, {
          toValue: 0,
          duration: duration / 2,
          useNativeDriver: false,
        })
      ]).start(() => glow());
    };

    glow();
  }, [glowIntensity, duration]);

  return glowAnim;
};

export default {
  useFadeIn,
  useSlideIn,
  useScale,
  usePulse,
  useBounce,
  useShake,
  useRotate,
  useStagger,
  useSkeleton,
  useSuccessAnimation,
  useErrorAnimation,
  useFloating,
  useProgress,
  useMorph,
  useParallax,
  useMagnetic,
  useWave,
  useGlow,
};

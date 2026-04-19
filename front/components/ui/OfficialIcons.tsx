import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface IconProps {
  size?: number;
  color?: string;
}

export const AppleIcon: React.FC<IconProps> = ({ size = 20, color = '#FFFFFF' }) => (
  <View style={[styles.iconContainer, { width: size, height: size }]}>
    <Text style={[styles.appleIcon, { fontSize: size, color }]}>🍎</Text>
  </View>
);

export const GoogleIcon: React.FC<IconProps> = ({ size = 20, color = '#FFFFFF' }) => (
  <View style={[styles.iconContainer, { width: size, height: size }]}>
    <Text style={[styles.googleIcon, { fontSize: size, color }]}>G</Text>
  </View>
);

export const EmailIcon: React.FC<IconProps> = ({ size = 20, color = '#8E8E93' }) => (
  <View style={[styles.iconContainer, { width: size, height: size }]}>
    <Text style={[styles.emailIcon, { fontSize: size, color }]}>✉</Text>
  </View>
);

export const LockIcon: React.FC<IconProps> = ({ size = 20, color = '#8E8E93' }) => (
  <View style={[styles.iconContainer, { width: size, height: size }]}>
    <Text style={[styles.lockIcon, { fontSize: size, color }]}>🔒</Text>
  </View>
);

export const EyeIcon: React.FC<IconProps> = ({ size = 20, color = '#8E8E93' }) => (
  <View style={[styles.iconContainer, { width: size, height: size }]}>
    <Text style={[styles.eyeIcon, { fontSize: size, color }]}>👁</Text>
  </View>
);

export const EyeOffIcon: React.FC<IconProps> = ({ size = 20, color = '#8E8E93' }) => (
  <View style={[styles.iconContainer, { width: size, height: size }]}>
    <Text style={[styles.eyeOffIcon, { fontSize: size, color }]}>🙈</Text>
  </View>
);

export const FootballIcon: React.FC<IconProps> = ({ size = 20, color = '#FFFFFF' }) => (
  <View style={[styles.iconContainer, { width: size, height: size }]}>
    <Text style={[styles.footballIcon, { fontSize: size, color }]}>⚽</Text>
  </View>
);

const styles = StyleSheet.create({
  iconContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  appleIcon: {
    fontWeight: 'bold',
  },
  googleIcon: {
    fontWeight: 'bold',
    fontFamily: 'Arial',
  },
  emailIcon: {
    fontWeight: 'normal',
  },
  lockIcon: {
    fontWeight: 'normal',
  },
  eyeIcon: {
    fontWeight: 'normal',
  },
  eyeOffIcon: {
    fontWeight: 'normal',
  },
  footballIcon: {
    fontWeight: 'normal',
  },
});

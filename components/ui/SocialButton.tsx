import React from 'react';
import { TouchableOpacity, Text, StyleSheet, View, Animated } from 'react-native';
import { GoogleIconSVG, AppleIconSVG } from './SVGIcons';
import InteractiveIcon from './InteractiveIcon';

interface SocialButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'google' | 'apple';
}

const SocialButton: React.FC<SocialButtonProps> = ({
  title,
  onPress,
  variant = 'google',
}) => {
  const getIcon = () => {
    if (variant === 'apple') {
      return <AppleIconSVG size={20} color="#FFFFFF" />;
    }
    return <GoogleIconSVG size={20} color="#FFFFFF" />;
  };

  return (
    <TouchableOpacity
      style={[styles.button, styles[variant]]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.iconContainer}>
        {getIcon()}
      </View>
      <Text style={[styles.text, styles[`${variant}Text`]]}>{title}</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    minHeight: 50,
  },
  google: {
    backgroundColor: '#2C2C2E',
    borderColor: '#3A3A3C',
    marginRight: 8,
  },
  apple: {
    backgroundColor: '#2C2C2E',
    borderColor: '#3A3A3C',
    marginLeft: 8,
  },
  iconContainer: {
    marginRight: 8,
  },
  icon: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  text: {
    fontSize: 16,
    fontWeight: '500',
  },
  googleText: {
    color: '#FFFFFF',
  },
  appleText: {
    color: '#FFFFFF',
  },
});

export default SocialButton;

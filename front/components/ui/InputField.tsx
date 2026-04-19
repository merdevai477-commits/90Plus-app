import React, { useState } from 'react';
import {
  View,
  TextInput,
  Text,
  TouchableOpacity,
  StyleSheet,
  TextInputProps,
  Animated,
} from 'react-native';
import { EmailIconSVG, LockIconSVG, EyeIconSVG, EyeOffIconSVG } from './SVGIcons';
import InteractiveIcon from './InteractiveIcon';

interface InputFieldProps extends TextInputProps {
  label?: string;
  icon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  error?: string;
  containerStyle?: any;
}

const InputField: React.FC<InputFieldProps> = ({
  label,
  icon,
  rightIcon,
  error,
  containerStyle,
  secureTextEntry,
  ...props
}) => {
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  const togglePasswordVisibility = () => {
    setIsPasswordVisible(!isPasswordVisible);
  };

  const getIcon = () => {
    if (icon != null) return icon;
    if (secureTextEntry) return <LockIconSVG size={20} color="#8E8E93" />;
    return <EmailIconSVG size={20} color="#8E8E93" />;
  };

  const hasLeftIcon = Boolean(icon);

  return (
    <View style={[styles.container, containerStyle]}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View style={[
        styles.inputContainer, 
        error && styles.inputError,
        isFocused && styles.inputFocused
      ]}>
        <View style={styles.iconContainer}>
          {getIcon()}
        </View>
        <TextInput
          style={[styles.input, hasLeftIcon ? styles.inputWithIcon : undefined]}
          secureTextEntry={secureTextEntry && !isPasswordVisible}
          placeholderTextColor="#8E8E93"
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          {...props}
        />
        {secureTextEntry && (
          <InteractiveIcon
            onPress={togglePasswordVisibility}
            size={24}
          >
            {isPasswordVisible ? (
              <EyeOffIconSVG size={20} color="#8E8E93" />
            ) : (
              <EyeIconSVG size={20} color="#8E8E93" />
            )}
          </InteractiveIcon>
        )}
        {rightIcon && !secureTextEntry && (
          <View style={styles.rightIconContainer}>{rightIcon}</View>
        )}
      </View>
      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2C2C2E',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#3A3A3C',
    minHeight: 50,
  },
  inputError: {
    borderColor: '#FF3B30',
  },
  inputFocused: {
    borderColor: '#34C759',
    shadowColor: '#34C759',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 2,
  },
  iconContainer: {
    paddingLeft: 16,
    paddingRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#FFFFFF',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  inputWithIcon: {
    paddingLeft: 0,
  },
  rightIconContainer: {
    paddingRight: 16,
    paddingLeft: 12,
  },
  eyeIcon: {
    fontSize: 18,
  },
  errorText: {
    fontSize: 12,
    color: '#FF3B30',
    marginTop: 4,
  },
});

export default InputField;

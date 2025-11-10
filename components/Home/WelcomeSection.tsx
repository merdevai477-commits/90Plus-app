import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { styles } from './homeStyles';

interface WelcomeSectionProps {
  isGuest: boolean;
  username: string;
  onRegisterPress: () => void;
  onCreateCardPress: () => void;
}

export const WelcomeSection: React.FC<WelcomeSectionProps> = ({
  isGuest,
  username,
  onRegisterPress,
  onCreateCardPress,
}) => {
  return (
    <View style={styles.welcomeSection}>
      {isGuest ? (
        <>
          <Text style={styles.greeting}>Hello, Guest</Text>
          <Text style={styles.welcomeTitle}>Welcome to Football Hub</Text>
          <View style={styles.welcomeButtons}>
            <TouchableOpacity style={styles.registerButton} onPress={onRegisterPress}>
              <Text style={styles.registerButtonText}>Register</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.createCardButton} onPress={onCreateCardPress}>
              <Text style={styles.createCardButtonText}>Create Card</Text>
            </TouchableOpacity>
          </View>
        </>
      ) : (
        <Text style={[styles.greeting, { fontSize: 24 }]}>Hi {username}</Text>
      )}
    </View>
  );
};
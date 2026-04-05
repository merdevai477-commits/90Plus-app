/**
 * Age Gate Component
 * Apple Compliance: Verify user age before allowing access
 * Minimum age: 13 years old (COPPA compliance)
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Alert,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface AgeGateProps {
  onAgeVerified: (birthDate: Date, age: number) => void;
  onAgeRejected: () => void;
}

const AGE_GATE_KEY = '@90plus_age_verified';
const MIN_AGE = 13;

export default function AgeGate({ onAgeVerified, onAgeRejected }: AgeGateProps) {
  const [birthDate, setBirthDate] = useState(new Date(2005, 0, 1)); // Default: 18 years ago
  const [showPicker, setShowPicker] = useState(false);

  const calculateAge = (date: Date): number => {
    const today = new Date();
    let age = today.getFullYear() - date.getFullYear();
    const monthDiff = today.getMonth() - date.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < date.getDate())) {
      age--;
    }
    
    return age;
  };

  const handleVerify = async () => {
    const age = calculateAge(birthDate);

    if (age < MIN_AGE) {
      Alert.alert(
        'Age Requirement',
        `You must be at least ${MIN_AGE} years old to use 90Plus.`,
        [
          {
            text: 'OK',
            onPress: onAgeRejected,
          },
        ]
      );
      return;
    }

    // Store age verification
    await AsyncStorage.setItem(AGE_GATE_KEY, JSON.stringify({
      verified: true,
      birthDate: birthDate.toISOString(),
      age,
      verifiedAt: new Date().toISOString(),
    }));

    onAgeVerified(birthDate, age);
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        {/* Logo */}
        <Text style={styles.logo}>90+</Text>

        {/* Title */}
        <Text style={styles.title}>
          Age Verification
        </Text>

        {/* Description */}
        <Text style={styles.description}>
          To comply with privacy regulations, we need to verify your age. You must be at least {MIN_AGE} years old to use 90Plus.
        </Text>

        {/* Birth Date Selector */}
        <View style={styles.dateContainer}>
          <Text style={styles.label}>
            Select your birth date:
          </Text>

          <TouchableOpacity
            style={styles.dateButton}
            onPress={() => setShowPicker(true)}
          >
            <Text style={styles.dateText}>
              {birthDate.toLocaleDateString()}
            </Text>
          </TouchableOpacity>

          {showPicker && (
            <DateTimePicker
              value={birthDate}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={(event, selectedDate) => {
                setShowPicker(Platform.OS === 'ios');
                if (selectedDate) {
                  setBirthDate(selectedDate);
                }
              }}
              maximumDate={new Date()} // Can't select future dates
              minimumDate={new Date(1900, 0, 1)} // Reasonable minimum
            />
          )}
        </View>

        {/* Verify Button */}
        <TouchableOpacity
          style={styles.verifyButton}
          onPress={handleVerify}
        >
          <Text style={styles.verifyButtonText}>
            Verify Age
          </Text>
        </TouchableOpacity>

        {/* Privacy Notice */}
        <Text style={styles.privacyNotice}>
          Your birth date is used only for age verification and will be stored securely in accordance with our Privacy Policy.
        </Text>
      </View>
    </View>
  );
}

// Helper function to check if age gate is needed
export async function isAgeVerified(): Promise<boolean> {
  try {
    const data = await AsyncStorage.getItem(AGE_GATE_KEY);
    if (!data) return false;

    const parsed = JSON.parse(data);
    return parsed.verified === true;
  } catch (error) {
    console.error('Error checking age verification:', error);
    return false;
  }
}

// Helper function to get stored age data
export async function getAgeData(): Promise<{ birthDate: string; age: number } | null> {
  try {
    const data = await AsyncStorage.getItem(AGE_GATE_KEY);
    if (!data) return null;

    const parsed = JSON.parse(data);
    return {
      birthDate: parsed.birthDate,
      age: parsed.age,
    };
  } catch (error) {
    console.error('Error getting age data:', error);
    return null;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#4A148C',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  content: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 30,
    alignItems: 'center',
  },
  logo: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#4A148C',
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
    textAlign: 'center',
  },
  description: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 30,
    lineHeight: 20,
  },
  dateContainer: {
    width: '100%',
    marginBottom: 30,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 10,
  },
  dateButton: {
    backgroundColor: '#f5f5f5',
    borderRadius: 10,
    padding: 15,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  dateText: {
    fontSize: 18,
    color: '#333',
    fontWeight: '500',
  },
  verifyButton: {
    backgroundColor: '#4A148C',
    borderRadius: 10,
    padding: 15,
    width: '100%',
    alignItems: 'center',
    marginBottom: 20,
  },
  verifyButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  privacyNotice: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
    lineHeight: 16,
  },
});

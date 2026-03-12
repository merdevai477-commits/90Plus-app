/**
 * Breadcrumb Tracking Example Component
 * 
 * This component demonstrates how to use all three types of breadcrumb tracking:
 * 1. Navigation tracking (automatic via useNavigationTracking in _layout.tsx)
 * 2. API call tracking (using trackedFetch)
 * 3. User action tracking (using useUserActionTracker)
 * 
 * This is an example/reference component - not used in production
 */

import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useUserActionTracker } from '../../utils/userActionTracker';
import { trackedFetch } from '../../utils/apiClient';
import { getApiUrl } from '../../config/api.config';

export function BreadcrumbExample() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  
  // Get the user action tracker
  const tracker = useUserActionTracker();

  // Example 1: Track form input changes
  const handleEmailChange = (value: string) => {
    setEmail(value);
    
    // Track that user is interacting with email field
    tracker.formInput('Email Field', {
      hasValue: value.length > 0,
      length: value.length,
    });
  };

  const handlePasswordChange = (value: string) => {
    setPassword(value);
    
    // Track that user is interacting with password field
    tracker.formInput('Password Field', {
      hasValue: value.length > 0,
      length: value.length,
    });
  };

  // Example 2: Track form submission with API call
  const handleSubmit = async () => {
    // Track form submission attempt
    tracker.formSubmit('Example Login Form', {
      emailProvided: !!email,
      passwordProvided: !!password,
      emailLength: email.length,
    });

    setLoading(true);

    try {
      // Example 3: API call with automatic breadcrumb tracking
      // This will create breadcrumbs for:
      // - Request: "API POST /auth/login"
      // - Response: "API POST /auth/login - 200" (or error status)
      const response = await trackedFetch(`${getApiUrl()}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          password,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        
        // Track successful login
        tracker.custom('Login Success', {
          userId: data.userId,
          email,
        });

        Alert.alert('Success', 'Login successful!');
      } else {
        // Track failed login
        tracker.custom('Login Failed', {
          status: response.status,
          statusText: response.statusText,
          email,
        });

        Alert.alert('Error', 'Login failed. Please check your credentials.');
      }
    } catch (error) {
      // Track error
      tracker.custom('Login Error', {
        error: error instanceof Error ? error.message : String(error),
        email,
      });

      Alert.alert('Error', 'An error occurred. Please try again.');
      
      // If an error is thrown here, Sentry will capture it along with all breadcrumbs:
      // 1. Navigation breadcrumbs (how user got to this screen)
      // 2. Form input breadcrumbs (email field, password field)
      // 3. Form submit breadcrumb
      // 4. API request breadcrumb
      // 5. Login error breadcrumb
    } finally {
      setLoading(false);
    }
  };

  // Example 4: Track button clicks
  const handleForgotPassword = () => {
    tracker.buttonClick('Forgot Password Button', {
      screen: 'login',
      hasEmail: !!email,
    });

    Alert.alert('Info', 'Password reset functionality would go here');
  };

  const handleSignUp = () => {
    tracker.buttonClick('Sign Up Button', {
      screen: 'login',
    });

    Alert.alert('Info', 'Sign up functionality would go here');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Breadcrumb Tracking Example</Text>
      <Text style={styles.subtitle}>
        This form demonstrates breadcrumb tracking for user actions and API calls
      </Text>

      <TextInput
        style={styles.input}
        placeholder="Email"
        value={email}
        onChangeText={handleEmailChange}
        keyboardType="email-address"
        autoCapitalize="none"
        // Track when user focuses on field
        onFocus={() => tracker.formInput('Email Field', { action: 'focus' })}
        // Track when user leaves field
        onBlur={() => tracker.formInput('Email Field', { action: 'blur', value: email })}
      />

      <TextInput
        style={styles.input}
        placeholder="Password"
        value={password}
        onChangeText={handlePasswordChange}
        secureTextEntry
        // Track when user focuses on field
        onFocus={() => tracker.formInput('Password Field', { action: 'focus' })}
        // Track when user leaves field
        onBlur={() => tracker.formInput('Password Field', { action: 'blur' })}
      />

      <TouchableOpacity
        style={[styles.button, loading && styles.buttonDisabled]}
        onPress={handleSubmit}
        disabled={loading}
      >
        <Text style={styles.buttonText}>
          {loading ? 'Logging in...' : 'Login'}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.linkButton}
        onPress={handleForgotPassword}
      >
        <Text style={styles.linkText}>Forgot Password?</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.linkButton}
        onPress={handleSignUp}
      >
        <Text style={styles.linkText}>Don't have an account? Sign Up</Text>
      </TouchableOpacity>

      <View style={styles.infoBox}>
        <Text style={styles.infoTitle}>Breadcrumbs Captured:</Text>
        <Text style={styles.infoText}>
          • Navigation: How you got to this screen{'\n'}
          • Form Input: Email and password field interactions{'\n'}
          • Form Submit: Login attempt with context{'\n'}
          • API Call: POST /auth/login with status{'\n'}
          • Button Clicks: Forgot password, sign up{'\n'}
          • Custom Events: Login success/failure
        </Text>
        <Text style={styles.infoNote}>
          Note: Breadcrumbs are only sent to Sentry when an error occurs.
          They provide context about what the user was doing before the error.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#000',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 14,
    color: '#888',
    marginBottom: 30,
  },
  input: {
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    padding: 15,
    marginBottom: 15,
    color: '#fff',
    fontSize: 16,
  },
  button: {
    backgroundColor: '#22c55e',
    borderRadius: 8,
    padding: 15,
    alignItems: 'center',
    marginBottom: 15,
  },
  buttonDisabled: {
    backgroundColor: '#666',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  linkButton: {
    padding: 10,
    alignItems: 'center',
  },
  linkText: {
    color: '#22c55e',
    fontSize: 14,
  },
  infoBox: {
    marginTop: 30,
    padding: 15,
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#22c55e',
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#22c55e',
    marginBottom: 10,
  },
  infoText: {
    fontSize: 14,
    color: '#ccc',
    lineHeight: 22,
    marginBottom: 10,
  },
  infoNote: {
    fontSize: 12,
    color: '#888',
    fontStyle: 'italic',
    lineHeight: 18,
  },
});

export default BreadcrumbExample;

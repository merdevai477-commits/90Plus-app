/**
 * 🔧 Debug Screen - Clerk Token Extractor
 *
 * This screen helps developers extract their Clerk token for API testing.
 * To access: Navigate to /debug-token in your app (dev builds only).
 */

import { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  StyleSheet,
  Alert,
  Clipboard,
  ActivityIndicator,
} from 'react-native';
import { useAuth } from '@clerk/clerk-expo';
import { Stack } from 'expo-router';

function ClerkTokenExtractor() {
  const { getToken, isSignedIn, userId } = useAuth();
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchToken = async () => {
    setLoading(true);
    try {
      const t = await getToken();
      setToken(t);
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to get token');
    } finally {
      setLoading(false);
    }
  };

  const copyToken = () => {
    if (!token) return;
    Clipboard.setString(token);
    Alert.alert('✅ Copied', 'Token copied to clipboard');
  };

  return (
    <View style={s.card}>
      <Text style={s.label}>Signed in: {isSignedIn ? '✅ Yes' : '❌ No'}</Text>
      {userId && <Text style={s.label}>User ID: {userId}</Text>}

      <TouchableOpacity style={s.btn} onPress={fetchToken} disabled={loading}>
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={s.btnText}>Get Token</Text>
        )}
      </TouchableOpacity>

      {token && (
        <>
          <TouchableOpacity style={[s.btn, s.copyBtn]} onPress={copyToken}>
            <Text style={s.btnText}>📋 Copy Token</Text>
          </TouchableOpacity>
          <Text style={s.tokenText} selectable numberOfLines={8}>
            {token}
          </Text>
        </>
      )}
    </View>
  );
}

export default function DebugTokenScreen() {
  return (
    <SafeAreaView style={s.container}>
      <Stack.Screen
        options={{
          title: '🔑 Token Extractor',
          headerStyle: { backgroundColor: '#007AFF' },
          headerTintColor: '#fff',
        }}
      />
      <ScrollView contentContainerStyle={s.scrollContent}>
        <ClerkTokenExtractor />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  scrollContent: { padding: 20 },
  card: {
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  label: { fontSize: 14, color: '#333' },
  btn: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  copyBtn: { backgroundColor: '#34C759' },
  btnText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  tokenText: {
    fontSize: 11,
    color: '#555',
    fontFamily: 'monospace',
    backgroundColor: '#e8e8e8',
    padding: 10,
    borderRadius: 8,
  },
});

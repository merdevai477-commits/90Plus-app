import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Alert } from 'react-native';
import { useAuth } from '@clerk/clerk-expo';
import { SearchDiagnostics, SearchDiagnosticResult } from '../../utils/searchDiagnostics';
import { COLORS } from '../reels/constants';

export const SearchDebugger: React.FC = () => {
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<SearchDiagnosticResult[]>([]);
  const [report, setReport] = useState<string>('');
  const { getToken } = useAuth();

  const runDiagnostics = async () => {
    setIsRunning(true);
    setResults([]);
    setReport('');

    try {
      const token = await getToken();
      if (!token) {
        Alert.alert('Error', 'No authentication token available');
        return;
      }

      // Test API connectivity first
      const connectivityResult = await SearchDiagnostics.testApiConnectivity();
      const diagnosticResults = [connectivityResult];

      // If API is reachable, run full diagnostics
      if (connectivityResult.status === 'success') {
        const searchResults = await SearchDiagnostics.runFullDiagnostics(token);
        diagnosticResults.push(...searchResults);
      }

      setResults(diagnosticResults);
      const reportText = SearchDiagnostics.generateReport(diagnosticResults);
      setReport(reportText);

      // Show summary alert
      const successCount = diagnosticResults.filter(r => r.status === 'success').length;
      const totalCount = diagnosticResults.length;
      
      Alert.alert(
        'Diagnostics Complete',
        `${successCount}/${totalCount} tests passed. Check results below.`,
        [{ text: 'OK' }]
      );

    } catch (error: any) {
      Alert.alert('Error', `Failed to run diagnostics: ${error.message}`);
    } finally {
      setIsRunning(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success': return COLORS.neonGreen;
      case 'error': return '#FF4757';
      case 'timeout': return '#FFA726';
      default: return '#666';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success': return '✅';
      case 'error': return '❌';
      case 'timeout': return '⏰';
      default: return '❓';
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>🔍 Search Diagnostics</Text>
      
      <TouchableOpacity
        style={[styles.button, isRunning && styles.buttonDisabled]}
        onPress={runDiagnostics}
        disabled={isRunning}
      >
        <Text style={styles.buttonText}>
          {isRunning ? 'Running Tests...' : 'Run Search Tests'}
        </Text>
      </TouchableOpacity>

      {results.length > 0 && (
        <ScrollView style={styles.resultsContainer}>
          <Text style={styles.sectionTitle}>Test Results:</Text>
          
          {results.map((result, index) => (
            <View key={index} style={styles.resultItem}>
              <View style={styles.resultHeader}>
                <Text style={styles.resultIcon}>
                  {getStatusIcon(result.status)}
                </Text>
                <Text style={styles.resultEndpoint} numberOfLines={1}>
                  {result.endpoint}
                </Text>
                <Text style={[styles.resultStatus, { color: getStatusColor(result.status) }]}>
                  {result.status.toUpperCase()}
                </Text>
              </View>
              
              <Text style={styles.resultTime}>
                Response Time: {result.responseTime}ms
              </Text>
              
              {result.error && (
                <Text style={styles.resultError}>
                  Error: {result.error}
                </Text>
              )}
              
              {result.data && (
                <Text style={styles.resultData}>
                  Data: {JSON.stringify(result.data, null, 2)}
                </Text>
              )}
            </View>
          ))}

          {report && (
            <View style={styles.reportContainer}>
              <Text style={styles.sectionTitle}>Summary Report:</Text>
              <Text style={styles.reportText}>{report}</Text>
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: COLORS.deepBlack,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.white,
    textAlign: 'center',
    marginBottom: 20,
  },
  button: {
    backgroundColor: COLORS.neonGreen,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 20,
  },
  buttonDisabled: {
    backgroundColor: '#666',
  },
  buttonText: {
    color: COLORS.deepBlack,
    fontSize: 16,
    fontWeight: 'bold',
  },
  resultsContainer: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.neonGreen,
    marginBottom: 12,
  },
  resultItem: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  resultIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  resultEndpoint: {
    flex: 1,
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '600',
  },
  resultStatus: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  resultTime: {
    color: '#888',
    fontSize: 12,
    marginBottom: 4,
  },
  resultError: {
    color: '#FF4757',
    fontSize: 12,
    marginBottom: 4,
  },
  resultData: {
    color: '#4CAF50',
    fontSize: 10,
    fontFamily: 'monospace',
  },
  reportContainer: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    padding: 16,
    borderRadius: 12,
    marginTop: 20,
  },
  reportText: {
    color: COLORS.white,
    fontSize: 12,
    fontFamily: 'monospace',
    lineHeight: 16,
  },
});
import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Transfer } from '../../services/apiFootball';

interface TransfersChartsProps {
  transfers: Transfer[];
}

export const TransfersCharts: React.FC<TransfersChartsProps> = ({ transfers }) => {
  // Calculate chart data
  const chartData = useMemo(() => {
    // Transfers by league
    const byLeague = new Map<string, number>();
    transfers.forEach(t => {
      const leagueName = t.league?.name || 'Unknown';
      byLeague.set(leagueName, (byLeague.get(leagueName) || 0) + 1);
    });

    // Transfers by type
    const byType = new Map<string, number>();
    transfers.forEach(t => {
      t.transfers.forEach(tr => {
        const type = tr.type || 'Unknown';
        byType.set(type, (byType.get(type) || 0) + 1);
      });
    });

    // Transfers by month (trends)
    const byMonth = new Map<string, number>();
    transfers.forEach(t => {
      t.transfers.forEach(tr => {
        if (tr.date) {
          const month = tr.date.substring(0, 7); // YYYY-MM
          byMonth.set(month, (byMonth.get(month) || 0) + 1);
        }
      });
    });

    return {
      byLeague: Array.from(byLeague.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10),
      byType: Array.from(byType.entries())
        .sort((a, b) => b[1] - a[1]),
      byMonth: Array.from(byMonth.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .slice(-12), // Last 12 months
    };
  }, [transfers]);

  const maxLeagueValue = Math.max(...chartData.byLeague.map(([, count]) => count), 1);
  const maxTypeValue = Math.max(...chartData.byType.map(([, count]) => count), 1);
  const maxMonthValue = Math.max(...chartData.byMonth.map(([, count]) => count), 1);

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.container}>
      {/* Transfers by League Bar Chart */}
      <View style={styles.chartCard}>
        <Text style={styles.chartTitle}>Transfers by League</Text>
        <View style={styles.barChart}>
          {chartData.byLeague.map(([league, count], index) => (
            <View key={index} style={styles.barItem}>
              <View style={styles.barContainer}>
                <LinearGradient
                  colors={['#8B5CF6', '#7C3AED']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[styles.bar, { height: `${(count / maxLeagueValue) * 100}%` }]}
                />
              </View>
              <Text style={styles.barLabel} numberOfLines={1}>
                {league.length > 10 ? league.substring(0, 10) + '...' : league}
              </Text>
              <Text style={styles.barValue}>{count}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Transfers by Type Pie Chart (Bar representation) */}
      <View style={styles.chartCard}>
        <Text style={styles.chartTitle}>Transfers by Type</Text>
        <View style={styles.typeChart}>
          {chartData.byType.map(([type, count], index) => (
            <View key={index} style={styles.typeItem}>
              <View style={styles.typeBarContainer}>
                <LinearGradient
                  colors={['#8B5CF6', '#7C3AED']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[styles.typeBar, { width: `${(count / maxTypeValue) * 100}%` }]}
                />
              </View>
              <Text style={styles.typeLabel}>{type}</Text>
              <Text style={styles.typeValue}>{count}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Transfers Trends Line Chart (Bar representation) */}
      <View style={styles.chartCard}>
        <Text style={styles.chartTitle}>Transfer Trends</Text>
        <View style={styles.trendChart}>
          {chartData.byMonth.map(([month, count], index) => (
            <View key={index} style={styles.trendItem}>
              <View style={styles.trendBarContainer}>
                <LinearGradient
                  colors={['#8B5CF6', '#7C3AED']}
                  start={{ x: 0, y: 1 }}
                  end={{ x: 0, y: 0 }}
                  style={[styles.trendBar, { height: `${(count / maxMonthValue) * 100}%` }]}
                />
              </View>
              <Text style={styles.trendLabel}>{month.substring(5)}</Text>
              <Text style={styles.trendValue}>{count}</Text>
            </View>
          ))}
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 16,
  },
  chartCard: {
    width: 320,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    padding: 16,
    marginRight: 16,
  },
  chartTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 16,
  },
  barChart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 200,
    gap: 8,
  },
  barItem: {
    flex: 1,
    alignItems: 'center',
  },
  barContainer: {
    width: '100%',
    height: 150,
    justifyContent: 'flex-end',
  },
  bar: {
    width: '100%',
    minHeight: 4,
    borderRadius: 4,
  },
  barLabel: {
    color: '#888',
    fontSize: 10,
    marginTop: 4,
    textAlign: 'center',
  },
  barValue: {
    color: '#8B5CF6',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  typeChart: {
    gap: 12,
  },
  typeItem: {
    marginBottom: 8,
  },
  typeBarContainer: {
    height: 24,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 4,
  },
  typeBar: {
    height: '100%',
    borderRadius: 12,
  },
  typeLabel: {
    color: '#888',
    fontSize: 12,
    marginBottom: 2,
  },
  typeValue: {
    color: '#8B5CF6',
    fontSize: 14,
    fontWeight: '600',
  },
  trendChart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 200,
    gap: 4,
  },
  trendItem: {
    flex: 1,
    alignItems: 'center',
  },
  trendBarContainer: {
    width: '100%',
    height: 150,
    justifyContent: 'flex-end',
  },
  trendBar: {
    width: '100%',
    minHeight: 4,
    borderRadius: 4,
  },
  trendLabel: {
    color: '#888',
    fontSize: 10,
    marginTop: 4,
  },
  trendValue: {
    color: '#8B5CF6',
    fontSize: 10,
    fontWeight: '600',
    marginTop: 2,
  },
});


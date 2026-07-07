/**
 * Countdown banner when user is temporarily banned from group activity.
 */

import { LinearGradient } from 'expo-linear-gradient';
import { Clock } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { PG, PG_RADII, usePGFonts } from './theme';

function formatRemaining(until: Date) {
  const diff = Math.max(0, until.getTime() - Date.now());
  const totalHours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  return { days, hours, minutes };
}

export function GroupBanBanner({ untilIso }: { untilIso: string }) {
  const { medium, bold } = usePGFonts();
  const until = new Date(untilIso);
  const [remaining, setRemaining] = useState(() => formatRemaining(until));

  useEffect(() => {
    const timer = setInterval(() => {
      setRemaining(formatRemaining(until));
    }, 30_000);
    return () => clearInterval(timer);
  }, [until]);

  return (
    <View style={styles.wrap}>
      <LinearGradient
        colors={['rgba(248,113,113,0.16)', 'rgba(124,58,237,0.08)']}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.row}>
        <Clock size={20} color="#F87171" />
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { fontFamily: bold }]}>نشاط المجموعات موقوف مؤقتاً</Text>
          <Text style={[styles.sub, { fontFamily: medium }]}>
            يُرفع الحظر بعد أكثر من 3 خروج/حذف للمجموعات. يتفك الحظر خلال:
          </Text>
          <Text style={[styles.timer, { fontFamily: bold }]}>
            {remaining.days} يوم · {remaining.hours} ساعة · {remaining.minutes} دقيقة
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginHorizontal: 24,
    marginBottom: 12,
    borderRadius: PG_RADII.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(248,113,113,0.35)',
    padding: 14,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  title: {
    color: '#FCA5A5',
    fontSize: 15,
    marginBottom: 4,
  },
  sub: {
    color: PG.textSecondary,
    fontSize: 12,
    lineHeight: 18,
  },
  timer: {
    color: PG.text,
    fontSize: 14,
    marginTop: 8,
  },
});

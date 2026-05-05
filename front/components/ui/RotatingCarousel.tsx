import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import type { FlashListProps } from '@shopify/flash-list';

type Props<T> = {
  data: T[];
  renderItem: (item: T, index: number) => React.ReactElement;
  itemWidth: number;
  visibleCount?: number; // default 5
  autoMs?: number; // default 1000
};

function RotatingCarousel<T>({ data, renderItem, itemWidth, visibleCount = 5, autoMs = 1000 }: Props<T>) {
  const listRef = useRef<any>(null);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (paused) return;
    timerRef.current && clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      const next = (index + visibleCount) % Math.max(data.length, 1);
      setIndex(next);
      listRef.current?.scrollToOffset({ offset: next * itemWidth, animated: true });
    }, autoMs);
    return () => {
      timerRef.current && clearInterval(timerRef.current);
    };
  }, [index, data.length, paused, visibleCount, autoMs, itemWidth]);

  const onTouchStart = () => {
    setPaused(true);
  };

  const onTouchEnd = () => {
    setTimeout(() => setPaused(false), 3000);
  };

  return (
    <FlashList
      ref={listRef}
      horizontal
      data={data}
      renderItem={({ item, index: i }) => (
        <View style={{ width: itemWidth }}>{renderItem(item, i)}</View>
      )}
      keyExtractor={(_, i) => String(i)}
      showsHorizontalScrollIndicator={false}
      onTouchStart={onTouchStart}
      onScrollBeginDrag={onTouchStart}
      onMomentumScrollEnd={onTouchEnd}
      contentContainerStyle={styles.row}
    />
  );
}

const styles = StyleSheet.create({
  row: {
    gap: 12,
    paddingHorizontal: 12,
  },
});

export default RotatingCarousel;



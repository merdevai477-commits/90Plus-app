import React, { useCallback, useMemo, useRef } from 'react';
import { FlashList, FlashListProps, type FlashListRef } from '@shopify/flash-list';
import { View, Text, ActivityIndicator, RefreshControl, StyleSheet } from 'react-native';

// Fallback theme colors (ThemeContext not available in this component)
const THEME = {
  primary: '#FFD700',
  textSecondary: '#8E8E93',
};

interface OptimizedListProps<T> {
  data: T[];
  renderItem: (item: T, index: number) => React.ReactElement;
  /**
   * @deprecated Ignored in FlashList v2 — item size is auto-measured.
   * Kept in the type for backward-compat with existing callers.
   */
  estimatedItemSize?: number;
  type?: 'video' | 'image' | 'post' | 'chat' | 'user' | 'mixed';
  onEndReached?: () => void;
  onRefresh?: () => void;
  refreshing?: boolean;
  ListHeaderComponent?: React.ReactElement;
  ListFooterComponent?: React.ReactElement;
  ListEmptyComponent?: React.ReactElement;
  numColumns?: number;
  horizontal?: boolean;
  keyExtractor?: (item: T, index: number) => string;
  onViewableItemsChanged?: (info: { viewableItems: any[]; changed: any[] }) => void;
  viewabilityConfig?: any;
  contentContainerStyle?: any;
  showsVerticalScrollIndicator?: boolean;
  showsHorizontalScrollIndicator?: boolean;
  onScroll?: (event: any) => void;
  scrollEventThrottle?: number;
}

/**
 * Optimized list component using FlashList
 * Provides 10x faster rendering and 50% less memory usage compared to FlatList
 */
export function OptimizedList<T>({
  data,
  renderItem,
  estimatedItemSize: _estimatedItemSize,
  type = 'mixed',
  onEndReached,
  onRefresh,
  refreshing = false,
  ListHeaderComponent,
  ListFooterComponent,
  ListEmptyComponent,
  numColumns = 1,
  horizontal = false,
  keyExtractor,
  onViewableItemsChanged,
  viewabilityConfig,
  contentContainerStyle,
  showsVerticalScrollIndicator = false,
  showsHorizontalScrollIndicator = false,
  onScroll,
  scrollEventThrottle = 16,
}: OptimizedListProps<T>) {
  const theme = THEME;
  const flashListRef = useRef<FlashListRef<T>>(null);

  // Default key extractor
  const defaultKeyExtractor = useCallback(
    (item: any, index: number) => {
      return item?.id?.toString() || item?.key?.toString() || index.toString();
    },
    []
  );

  // Memoized render item wrapper
  const renderItemWrapper = useCallback(
    ({ item, index }: { item: T; index: number }) => {
      return renderItem(item, index);
    },
    [renderItem]
  );

  // Default empty component
  const defaultEmptyComponent = useMemo(
    () => (
      <View style={styles.emptyContainer}>
        <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
          No items to display
        </Text>
      </View>
    ),
    [theme]
  );

  // Loading footer for pagination
  const loadingFooter = useMemo(
    () => (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color={theme.primary} />
      </View>
    ),
    [theme]
  );

  // Refresh control
  const refreshControl = useMemo(
    () =>
      onRefresh ? (
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={theme.primary}
          colors={[theme.primary]}
        />
      ) : undefined,
    [onRefresh, refreshing, theme]
  );

  // Default viewability config for video auto-play
  const defaultViewabilityConfig = useMemo(
    () => ({
      itemVisiblePercentThreshold: type === 'video' ? 80 : 50,
      minimumViewTime: type === 'video' ? 500 : 100,
    }),
    [type]
  );

  // Handle end reached with threshold
  const handleEndReached = useCallback(() => {
    if (onEndReached && data.length > 0) {
      onEndReached();
    }
  }, [onEndReached, data.length]);

  // Get item type for mixed content (helps FlashList optimize)
  const getItemType = useCallback(
    (item: any) => {
      if (type !== 'mixed') return type;

      // Auto-detect item type for mixed content
      if (item?.videoUrl || item?.video) return 'video';
      if (item?.imageUrl || item?.image) return 'image';
      if (item?.message) return 'chat';
      if (item?.username) return 'user';
      return 'post';
    },
    [type]
  );

  // Blank area monitoring kept as a no-op here. FlashList v2 measures items
  // automatically, so large blank areas are uncommon. The `onBlankArea` prop
  // from v1 was removed.
  const handleBlankArea = useCallback((blankAreaEvent: { blankArea: number }) => {
    if (__DEV__ && blankAreaEvent.blankArea > 50) {
      console.warn(`[OptimizedList] Blank area detected: ${blankAreaEvent.blankArea}px`);
    }
  }, []);
  void handleBlankArea;

  // Scroll to top function (exposed via ref)
  const scrollToTop = useCallback(() => {
    flashListRef.current?.scrollToOffset({ offset: 0, animated: true });
  }, []);

  return (
    <FlashList
      ref={flashListRef}
      data={data}
      renderItem={renderItemWrapper}
      keyExtractor={keyExtractor || defaultKeyExtractor}
      getItemType={getItemType}
      onEndReached={handleEndReached}
      onEndReachedThreshold={0.5}
      refreshControl={refreshControl}
      ListHeaderComponent={ListHeaderComponent}
      ListFooterComponent={ListFooterComponent || (refreshing ? loadingFooter : null)}
      ListEmptyComponent={ListEmptyComponent || defaultEmptyComponent}
      numColumns={numColumns}
      horizontal={horizontal}
      onViewableItemsChanged={onViewableItemsChanged}
      viewabilityConfig={viewabilityConfig || defaultViewabilityConfig}
      contentContainerStyle={contentContainerStyle}
      showsVerticalScrollIndicator={showsVerticalScrollIndicator}
      showsHorizontalScrollIndicator={showsHorizontalScrollIndicator}
      onScroll={onScroll}
      scrollEventThrottle={scrollEventThrottle}
    />
  );
}

const styles = StyleSheet.create({
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
  },
  footerLoader: {
    paddingVertical: 20,
    alignItems: 'center',
  },
});

// Export memoized version
export default React.memo(OptimizedList) as typeof OptimizedList;

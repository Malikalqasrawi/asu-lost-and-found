import type { ReactElement, ReactNode } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { errorMessage } from '@/api/errors';
import { FormMessage } from '@/components/form-message';
import { ThemedText } from '@/components/themed-text';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export interface ListQuery {
  isPending: boolean;
  isError: boolean;
  isRefetching: boolean;
  error: unknown;
  refetch: () => unknown;
}

export interface ItemListProps<T> {
  items: T[];
  query: ListQuery;
  header: ReactNode;
  emptyText: string;
  keyOf: (item: T) => string;
  renderItem: (info: { item: T }) => ReactElement;
  onEndReached?: () => void;
}

/** A full-screen list loaded by a query: pull to refresh, the error on top, a note when empty. */
export function ItemList<T>({
  items,
  query,
  header,
  emptyText,
  keyOf,
  renderItem,
  onEndReached,
}: ItemListProps<T>) {
  const theme = useTheme();

  return (
    <SafeAreaView edges={['top']} style={[styles.flex, { backgroundColor: theme.background }]}>
      <FlatList
        data={items}
        keyExtractor={keyOf}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        onEndReached={onEndReached}
        refreshControl={
          <RefreshControl refreshing={query.isRefetching} onRefresh={() => void query.refetch()} />
        }
        ListHeaderComponent={
          <View style={styles.header}>
            {header}
            {query.isError ? <FormMessage message={errorMessage(query.error)} /> : null}
          </View>
        }
        ListEmptyComponent={
          query.isPending || query.isError ? undefined : (
            <ThemedText themeColor="textSecondary" style={styles.empty}>
              {emptyText}
            </ThemedText>
          )
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  list: {
    padding: Spacing.four,
    gap: Spacing.three,
    maxWidth: MaxContentWidth,
    width: '100%',
    alignSelf: 'center',
  },
  header: { gap: Spacing.three, marginBottom: Spacing.one },
  empty: { textAlign: 'center', marginTop: Spacing.five },
});

/**
 * Search Screen
 * Based on Stitch's new design
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, fontSizes, spacing } from '../../lib/design';
import { searchItems } from '../../lib/api';
import { Item } from '../../types';
import { useAuth } from '../../context/AuthContext';
import FeedItem from '../../components/FeedItem';

export default function SearchScreen() {
  const { colors, isDark } = useTheme();
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  // Redirect to login if not authenticated
  React.useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login');
    }
  }, [authLoading, user]);

  const handleSearch = useCallback(async () => {
    if (!query.trim()) return;
    setLoading(true);
    setSearched(true);
    try {
      const res = await searchItems(query.trim());
      setResults(res.items);
    } catch (e) {
      console.error('Search failed:', e);
    } finally {
      setLoading(false);
    }
  }, [query]);

  const handleClear = () => {
    setQuery('');
    setResults([]);
    setSearched(false);
  };

  const renderItem = ({ item }: { item: Item }) => (
    <FeedItem
      item={item}
      hasImage={!!item.thumbnail_url}
      imageUrl={item.thumbnail_url}
      onPress={() => {}}
    />
  );

  const renderEmpty = () => {
    if (loading) {
      return (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.emptySubtitle, { color: colors.onSurfaceVariant }]}>
            Searching...
          </Text>
        </View>
      );
    }

    if (searched && results.length === 0) {
      return (
        <View style={styles.centered}>
          <MaterialIcons name="search-off" size={48} color={colors.outlineVariant} />
          <Text style={[styles.emptyTitle, { color: colors.onSurface }]}>
            No results found
          </Text>
          <Text style={[styles.emptySubtitle, { color: colors.onSurfaceVariant }]}>
            Try different keywords
          </Text>
        </View>
      );
    }

    // Default empty state
    return (
      <View style={styles.centered}>
        <MaterialIcons name="search" size={48} color={colors.outlineVariant} />
        <Text style={[styles.emptyTitle, { color: colors.onSurface }]}>
          Search your library
        </Text>
        <Text style={[styles.emptySubtitle, { color: colors.onSurfaceVariant }]}>
          Find articles by title, summary, or tags
        </Text>
      </View>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header */}
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + spacing.md,
            backgroundColor: isDark ? 'rgba(28,27,31,0.85)' : 'rgba(252,249,242,0.85)',
            borderBottomColor: colors.surfaceContainerLow,
          },
        ]}
      >
        <Text style={[styles.title, { color: colors.onSurface }]}>Search</Text>
      </View>

      {/* Search Input */}
      <View style={styles.searchContainer}>
        <View
          style={[
            styles.inputWrapper,
            { backgroundColor: colors.surfaceContainerLow },
          ]}
        >
          <MaterialIcons
            name="search"
            size={20}
            color={colors.onSurfaceVariant}
          />
          <TextInput
            style={[styles.input, { color: colors.onSurface }]}
            placeholder="Search your library..."
            placeholderTextColor={colors.onSurfaceVariant}
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={handleSearch}
            returnKeyType="search"
            autoCapitalize="none"
            autoCorrect={false}
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={handleClear}>
              <MaterialIcons
                name="close"
                size={20}
                color={colors.onSurfaceVariant}
              />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity
          style={[styles.searchBtn, { backgroundColor: colors.primary }]}
          onPress={handleSearch}
          disabled={loading || !query.trim()}
        >
          <Text style={[styles.searchBtnText, { color: colors.onPrimary }]}>Search</Text>
        </TouchableOpacity>
      </View>

      {/* Results */}
      <FlatList
        data={results}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        ListEmptyComponent={renderEmpty}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: fontSizes['2xl'],
    fontWeight: '700',
    letterSpacing: 2,
  },
  searchContainer: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
    marginTop: spacing.md,
    marginBottom: spacing.lg,
  },
  inputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: 16,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  input: {
    flex: 1,
    fontSize: fontSizes.md,
  },
  searchBtn: {
    paddingHorizontal: spacing.lg,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchBtnText: {
    fontWeight: '700',
    fontSize: fontSizes.md,
  },
  list: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing['3xl'],
    flexGrow: 1,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: spacing['3xl'],
    gap: spacing.md,
  },
  emptyTitle: {
    fontSize: fontSizes.lg,
    fontWeight: '600',
  },
  emptySubtitle: {
    fontSize: fontSizes.md,
    textAlign: 'center',
  },
});
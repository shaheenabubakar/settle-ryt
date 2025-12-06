import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';

const COLORS = {
  background: '#121212',
  card: '#1E1E1E',
  primary: '#00A86B',
  textPrimary: '#FFFFFF',
  textSecondary: '#B3B3B3',
};

export default function ActivityScreen(): React.ReactElement {
  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>📋</Text>
          <Text style={styles.emptyText}>No activity yet</Text>
          <Text style={styles.emptySubtext}>
            Your expense and settlement history will appear here
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    flex: 1,
    padding: 16,
    justifyContent: 'center',
  },
  emptyState: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 48,
    alignItems: 'center',
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
});

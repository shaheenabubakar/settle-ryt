import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { PlusCircle, Users, CreditCard } from 'lucide-react-native';

const COLORS = {
  background: '#121212',
  card: '#1E1E1E',
  primary: '#00A86B',
  success: '#00A86B',
  error: '#FF4D4D',
  textPrimary: '#FFFFFF',
  textSecondary: '#B3B3B3',
};

export default function HomeScreen(): React.ReactElement {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Balance Card */}
      <View style={styles.balanceCard}>
        <Text style={styles.balanceLabel}>Net Balance</Text>
        <Text style={styles.balanceAmount}>RM 0.00</Text>
        <View style={styles.balanceRow}>
          <View style={styles.balanceItem}>
            <Text style={styles.balanceItemLabel}>You are owed</Text>
            <Text style={styles.balancePositive}>RM 0.00</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.balanceItem}>
            <Text style={styles.balanceItemLabel}>You owe</Text>
            <Text style={styles.balanceNegative}>RM 0.00</Text>
          </View>
        </View>
      </View>

      {/* Quick Actions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.actionsRow}>
          <TouchableOpacity style={styles.actionButton} activeOpacity={0.7}>
            <View style={styles.actionIconContainer}>
              <PlusCircle color={COLORS.primary} size={28} />
            </View>
            <Text style={styles.actionLabel}>Add Expense</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton} activeOpacity={0.7}>
            <View style={styles.actionIconContainer}>
              <Users color={COLORS.primary} size={28} />
            </View>
            <Text style={styles.actionLabel}>New Group</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton} activeOpacity={0.7}>
            <View style={styles.actionIconContainer}>
              <CreditCard color={COLORS.primary} size={28} />
            </View>
            <Text style={styles.actionLabel}>Settle Up</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Recent Activity */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Recent Activity</Text>
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No recent activity</Text>
          <Text style={styles.emptySubtext}>Add an expense to get started</Text>
        </View>
      </View>

      {/* Groups */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Your Groups</Text>
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No groups yet</Text>
          <Text style={styles.emptySubtext}>Create a group to split expenses</Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  balanceCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 24,
    marginBottom: 24,
  },
  balanceLabel: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 8,
  },
  balanceAmount: {
    fontSize: 36,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    marginBottom: 20,
  },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  balanceItem: {
    flex: 1,
  },
  balanceItemLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  balancePositive: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.success,
  },
  balanceNegative: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.error,
  },
  divider: {
    width: 1,
    height: 40,
    backgroundColor: '#333333',
    marginHorizontal: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    marginBottom: 16,
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  actionButton: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  actionIconContainer: {
    marginBottom: 8,
  },
  actionLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  emptyState: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 32,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  emptySubtext: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
});

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Modal,
  Alert,
  ActivityIndicator,
} from 'react-native';
import {
  Receipt,
  ArrowRightLeft,
  ChevronRight,
  X,
  Trash2,
  Edit3,
  User,
  Calendar,
} from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { Id } from '../../convex/_generated/dataModel';
import { EditExpenseModal } from '../../components/EditExpenseModal';

const COLORS = {
  background: '#121212',
  card: '#1E1E1E',
  cardElevated: '#2A2A2A',
  primary: '#00A86B',
  error: '#FF4D4D',
  warning: '#FFB800',
  textPrimary: '#FFFFFF',
  textSecondary: '#B3B3B3',
  textMuted: '#666666',
  border: '#333333',
};

interface ActivityItem {
  id: string;
  type: 'expense' | 'settlement';
  description: string;
  amount: number;
  timestamp: number;
  groupName?: string;
}

interface ExpenseDetail {
  _id: Id<'expenses'>;
  payerId: Id<'users'>;
  groupId: Id<'groups'>;
  description: string;
  groupName?: string;
  payerUsername?: string;
  payerName?: string;
  items: Array<{
    name: string;
    amount: number;
    splits: Array<{
      userId: Id<'users'>;
      share: number;
      username?: string;
      name?: string;
    }>;
  }>;
  totalAmount: number;
  createdAt: number;
}

const formatMoney = (amount: number): string => {
  return amount.toFixed(2);
};

const formatDate = (timestamp: number): string => {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  
  if (days === 0) {
    return 'Today';
  } else if (days === 1) {
    return 'Yesterday';
  } else if (days < 7) {
    return `${days} days ago`;
  } else {
    return date.toLocaleDateString('en-MY', {
      day: 'numeric',
      month: 'short',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    });
  }
};

const formatFullDate = (timestamp: number): string => {
  return new Date(timestamp).toLocaleDateString('en-MY', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export default function ActivityScreen(): React.ReactElement {
  const { userId } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const [selectedExpenseId, setSelectedExpenseId] = useState<string | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Fetch activity data
  const activity = useQuery(
    api.queries.getActivity,
    userId ? { userId: userId as Id<'users'> } : 'skip'
  );

  // Fetch expense details when selected
  const expenseDetail = useQuery(
    api.queries.getExpense,
    selectedExpenseId ? { expenseId: selectedExpenseId as Id<'expenses'> } : 'skip'
  );

  // Delete mutation
  const deleteExpense = useMutation(api.mutations.deleteExpense);

  const onRefresh = (): void => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  };

  const openExpenseDetail = (item: ActivityItem): void => {
    if (item.type === 'expense') {
      setSelectedExpenseId(item.id);
      setShowDetailModal(true);
    }
  };

  const closeDetailModal = (): void => {
    setShowDetailModal(false);
    setSelectedExpenseId(null);
  };

  const handleDelete = (): void => {
    if (!selectedExpenseId || !userId) return;

    Alert.alert(
      'Delete Expense',
      'Are you sure you want to delete this expense? This will update all balances and cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setIsDeleting(true);
            try {
              const result = await deleteExpense({
                userId: userId as Id<'users'>,
                expenseId: selectedExpenseId as Id<'expenses'>,
              });

              if (result.success) {
                Alert.alert('Deleted', 'Expense has been deleted and balances updated.');
                closeDetailModal();
              } else {
                Alert.alert('Error', result.error || 'Failed to delete expense');
              }
            } catch (error) {
              console.error('Delete error:', error);
              Alert.alert('Error', 'Something went wrong');
            } finally {
              setIsDeleting(false);
            }
          },
        },
      ]
    );
  };

  const handleEdit = (): void => {
    setShowDetailModal(false);
    setShowEditModal(true);
  };

  const handleEditSuccess = (): void => {
    setShowEditModal(false);
    setSelectedExpenseId(null);
  };

  // Group activities by date
  const groupedActivities = React.useMemo(() => {
    if (!activity) return [];
    
    const groups: { date: string; items: ActivityItem[] }[] = [];
    let currentDate = '';
    
    for (const item of activity) {
      const itemDate = formatDate(item.timestamp);
      if (itemDate !== currentDate) {
        currentDate = itemDate;
        groups.push({ date: itemDate, items: [item] });
      } else {
        groups[groups.length - 1].items.push(item);
      }
    }
    
    return groups;
  }, [activity]);

  const expense = expenseDetail as ExpenseDetail | undefined;

  // Check if current user is a participant (payer or in any split)
  const isParticipant = expense && (
    expense.payerId === userId ||
    expense.items.some(item => item.splits.some(s => s.userId === userId))
  );

  return (
    <View style={styles.container}>
      <ScrollView 
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.primary}
          />
        }
      >
        {groupedActivities.length > 0 ? (
          groupedActivities.map((group, groupIndex) => (
            <View key={groupIndex} style={styles.dateGroup}>
              <Text style={styles.dateHeader}>{group.date}</Text>
              <View style={styles.activityList}>
                {group.items.map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    style={styles.activityItem}
                    activeOpacity={0.7}
                    onPress={() => openExpenseDetail(item)}
                  >
                    <View style={[
                      styles.activityIcon,
                      item.type === 'settlement' && styles.activityIconSettlement
                    ]}>
                      {item.type === 'expense' ? (
                        <Receipt color={COLORS.textPrimary} size={20} />
                      ) : (
                        <ArrowRightLeft color={COLORS.textPrimary} size={20} />
                      )}
                    </View>
                    <View style={styles.activityInfo}>
                      <Text style={styles.activityDescription} numberOfLines={1}>
                        {item.description}
                      </Text>
                      <Text style={styles.activityMeta}>
                        {item.groupName || 'Personal'}
                      </Text>
                    </View>
                    <View style={styles.activityRight}>
                      <Text style={[
                        styles.activityAmount,
                        item.type === 'settlement' && styles.activityAmountSettlement
                      ]}>
                        RM {formatMoney(item.amount)}
                      </Text>
                      {item.type === 'expense' && (
                        <ChevronRight color={COLORS.textMuted} size={18} />
                      )}
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ))
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📋</Text>
            <Text style={styles.emptyText}>No activity yet</Text>
            <Text style={styles.emptySubtext}>
              Your expense and settlement history will appear here
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Expense Detail Modal */}
      <Modal
        visible={showDetailModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={closeDetailModal}
      >
        <View style={styles.modalContainer}>
          {/* Modal Header */}
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={closeDetailModal} style={styles.modalCloseButton}>
              <X color={COLORS.textSecondary} size={24} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Expense Details</Text>
            <View style={styles.modalActions}>
              {isParticipant && (
                <>
                  <TouchableOpacity style={styles.modalActionButton} onPress={handleEdit}>
                    <Edit3 color={COLORS.primary} size={20} />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.modalActionButton} onPress={handleDelete}>
                    {isDeleting ? (
                      <ActivityIndicator size="small" color={COLORS.error} />
                    ) : (
                      <Trash2 color={COLORS.error} size={20} />
                    )}
                  </TouchableOpacity>
                </>
              )}
              {!isParticipant && <View style={styles.modalActionsSpacer} />}
            </View>
          </View>

          {expense ? (
            <ScrollView style={styles.modalContent}>
              {/* Description & Amount */}
              <View style={styles.expenseHeader}>
                <Text style={styles.expenseDescription}>{expense.description}</Text>
                <Text style={styles.expenseAmount}>RM {formatMoney(expense.totalAmount)}</Text>
              </View>

              {/* Meta Info */}
              <View style={styles.metaSection}>
                <View style={styles.metaItem}>
                  <Calendar color={COLORS.textSecondary} size={16} />
                  <Text style={styles.metaText}>{formatFullDate(expense.createdAt)}</Text>
                </View>
              </View>

              {/* Items */}
              <View style={styles.section}>
                <View style={styles.sectionHeaderRow}>
                  <Text style={styles.sectionTitle}>Items & Splits</Text>
                  <View style={styles.paidByBadge}>
                    <Text style={styles.paidByLabel}>Paid by</Text>
                    <View style={styles.paidByChip}>
                      <User color={COLORS.textPrimary} size={12} />
                      <Text style={styles.paidByName}>
                        {expense.payerId === userId ? 'You' : (expense.payerUsername || expense.payerName || 'Unknown')}
                      </Text>
                    </View>
                  </View>
                </View>
                {expense.items.map((item, index) => (
                  <View key={index} style={styles.itemCard}>
                    <View style={styles.itemHeader}>
                      <Text style={styles.itemName}>{item.name}</Text>
                      <Text style={styles.itemAmount}>RM {formatMoney(item.amount)}</Text>
                    </View>
                    <View style={styles.splitsList}>
                      {item.splits.map((split, splitIndex) => (
                        <View key={splitIndex} style={styles.splitRow}>
                          <View style={styles.splitUser}>
                            <View style={[
                              styles.splitAvatar,
                              split.userId === userId && styles.splitAvatarYou
                            ]}>
                              <User color={COLORS.textPrimary} size={12} />
                            </View>
                            <Text style={styles.splitUsername}>
                              {split.userId === userId ? 'You' : (split.username || split.name || 'Friend')}
                            </Text>
                          </View>
                          <Text style={[
                            styles.splitAmount,
                            split.userId === userId && styles.splitAmountYou
                          ]}>
                            RM {formatMoney(split.share)}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </View>
                ))}
              </View>

              <View style={styles.bottomPadding} />
            </ScrollView>
          ) : (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={COLORS.primary} />
            </View>
          )}
        </View>
      </Modal>

      {/* Edit Expense Modal */}
      <EditExpenseModal
        visible={showEditModal}
        expenseId={selectedExpenseId}
        onClose={() => {
          setShowEditModal(false);
          setSelectedExpenseId(null);
        }}
        onSuccess={handleEditSuccess}
      />
    </View>
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
  dateGroup: {
    marginBottom: 20,
  },
  dateHeader: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  activityList: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    overflow: 'hidden',
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  activityIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  activityIconSettlement: {
    backgroundColor: COLORS.cardElevated,
  },
  activityInfo: {
    flex: 1,
  },
  activityDescription: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  activityMeta: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  activityRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  activityAmount: {
    fontSize: 15,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    marginRight: 4,
  },
  activityAmountSettlement: {
    color: COLORS.primary,
  },
  emptyState: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 48,
    alignItems: 'center',
    marginTop: 40,
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
  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  modalCloseButton: {
    padding: 4,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
  },
  modalActions: {
    flexDirection: 'row',
    minWidth: 72,
    justifyContent: 'flex-end',
  },
  modalActionsSpacer: {
    width: 72,
  },
  modalActionButton: {
    padding: 8,
    marginLeft: 8,
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  expenseHeader: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 16,
  },
  expenseDescription: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    marginBottom: 8,
    textAlign: 'center',
  },
  expenseAmount: {
    fontSize: 32,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  ownerNotice: {
    backgroundColor: 'rgba(255, 184, 0, 0.1)',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  ownerNoticeText: {
    fontSize: 13,
    color: COLORS.warning,
    textAlign: 'center',
  },
  metaSection: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  metaText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginLeft: 10,
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  paidByBadge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  paidByLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginRight: 6,
  },
  paidByChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  paidByName: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginLeft: 4,
  },
  itemCard: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    marginBottom: 10,
    overflow: 'hidden',
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  itemName: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  itemAmount: {
    fontSize: 15,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
  },
  splitsList: {
    padding: 10,
  },
  splitRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  splitUser: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  splitAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.cardElevated,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  splitAvatarYou: {
    backgroundColor: COLORS.primary,
  },
  splitUsername: {
    fontSize: 14,
    color: COLORS.textPrimary,
  },
  splitAmount: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  splitAmountYou: {
    color: COLORS.primary,
  },
  bottomPadding: {
    height: 40,
  },
});

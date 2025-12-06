import React, { useState, useCallback, useRef, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  RefreshControl,
  Modal,
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
} from 'react-native';
import { 
  PlusCircle, 
  Users, 
  CreditCard, 
  ChevronRight,
  X,
  Calendar,
  User,
  Edit3,
  Trash2,
} from 'lucide-react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { Id } from '../../convex/_generated/dataModel';
import { AddExpenseModal } from '../../components/AddExpenseModal';
import { CreateGroupModal } from '../../components/CreateGroupModal';
import { SettleUpModal } from '../../components/SettleUpModal';
import { EditExpenseModal } from '../../components/EditExpenseModal';

const COLORS = {
  background: '#121212',
  card: '#1E1E1E',
  cardElevated: '#2A2A2A',
  primary: '#00A86B',
  success: '#00A86B',
  error: '#FF4D4D',
  textPrimary: '#FFFFFF',
  textSecondary: '#B3B3B3',
  textMuted: '#666666',
  border: '#333333',
};

// Animated shimmer component for loading states
const Shimmer: React.FC<{ style?: object }> = ({ style }) => {
  const pulseAnim = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 0.7,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [pulseAnim]);

  return (
    <Animated.View
      style={[
        {
          backgroundColor: COLORS.cardElevated,
          borderRadius: 4,
        },
        style,
        { opacity: pulseAnim },
      ]}
    />
  );
};

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

export default function HomeScreen(): React.ReactElement {
  const router = useRouter();
  const { userId, isLoading: isAuthLoading } = useAuth();
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [showSettleUp, setShowSettleUp] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedExpenseId, setSelectedExpenseId] = useState<string | null>(null);
  const [showExpenseDetail, setShowExpenseDetail] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [screenFocusKey, setScreenFocusKey] = useState(0);

  // Trigger re-render when screen is focused to ensure fresh data
  useFocusEffect(
    useCallback(() => {
      setScreenFocusKey(prev => prev + 1);
    }, [])
  );

  // Fetch dashboard data
  const dashboard = useQuery(
    api.queries.getDashboard,
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
    // The query will automatically refresh
    setTimeout(() => setRefreshing(false), 1000);
  };

  // Check if still loading initial data
  const isInitialLoading = isAuthLoading || (userId && dashboard === undefined);

  const balances = dashboard?.balances;
  const recentActivity = dashboard?.recentActivity || [];
  const groups = dashboard?.groups || [];

  // Animated value for net balance (number animation - only after settling)
  const animatedNetBalance = useRef(new Animated.Value(0)).current;
  const [displayedNetBalance, setDisplayedNetBalance] = useState<number>(0);
  const prevNetBalanceRef = useRef<number | null>(null);
  const pendingAnimationRef = useRef<boolean>(false);

  // Update displayed balance - animate only after settling
  useEffect(() => {
    if (balances) {
      const newNetBalance = balances.netBalance;
      const prevNetBalance = prevNetBalanceRef.current;
      
      if (pendingAnimationRef.current && prevNetBalance !== null && newNetBalance !== prevNetBalance) {
        // Settle just happened and balance changed - animate the number
        pendingAnimationRef.current = false;
        
        animatedNetBalance.setValue(prevNetBalance);
        
        Animated.timing(animatedNetBalance, {
          toValue: newNetBalance,
          duration: 1500,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: false,
        }).start();
        
        // Update displayed value via listener
        const listenerId = animatedNetBalance.addListener(({ value }) => {
          setDisplayedNetBalance(Math.round(value * 100) / 100);
        });
        
        // Cleanup listener after animation
        setTimeout(() => {
          animatedNetBalance.removeListener(listenerId);
          setDisplayedNetBalance(newNetBalance);
        }, 1600);
        
        prevNetBalanceRef.current = newNetBalance;
      } else if (!pendingAnimationRef.current) {
        // Normal update (no pending animation) - just set the value instantly
        setDisplayedNetBalance(newNetBalance);
        animatedNetBalance.setValue(newNetBalance);
        prevNetBalanceRef.current = newNetBalance;
      }
      // If pendingAnimationRef.current is true but balance hasn't changed yet, do nothing and wait
    }
  }, [balances?.netBalance]);

  // Callback for when settle completes - triggers animation on next balance change
  const handleSettleSuccess = useCallback((): void => {
    pendingAnimationRef.current = true;
  }, []);

  const navigateToActivity = (): void => {
    router.push('/(tabs)/activity');
  };

  const openExpenseDetail = (activityId: string, activityType: string): void => {
    if (activityType === 'expense') {
      setSelectedExpenseId(activityId);
      setShowExpenseDetail(true);
    }
  };

  const closeExpenseDetail = (): void => {
    setShowExpenseDetail(false);
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
                closeExpenseDetail();
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
    setShowExpenseDetail(false);
    setShowEditModal(true);
  };

  const handleEditSuccess = (): void => {
    setShowEditModal(false);
    setSelectedExpenseId(null);
  };

  // Check if user owes anyone
  const hasDebts = balances && balances.totalOwe > 0;

  const expense = expenseDetail as ExpenseDetail | undefined;

  // Check if current user is a participant (payer or in any split)
  const isParticipant = expense && (
    expense.payerId === userId ||
    expense.items.some(item => item.splits.some(s => s.userId === userId))
  );

  return (
    <>
      <ScrollView 
        style={styles.container} 
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.primary}
          />
        }
      >
        {/* Balance Card */}
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Net Balance</Text>
          {isInitialLoading ? (
            <Shimmer style={styles.shimmerLarge} />
          ) : (
            <Text style={[
              styles.balanceAmount,
              displayedNetBalance > 0 && styles.balancePositive,
              displayedNetBalance < 0 && styles.balanceNegative,
            ]}>
              {displayedNetBalance !== 0 
                ? (displayedNetBalance > 0 ? '+' : '') 
                : ''}
              RM {formatMoney(displayedNetBalance)}
            </Text>
          )}
          <View style={styles.balanceRow}>
            <View style={styles.balanceItem}>
              <Text style={styles.balanceItemLabel}>You are owed</Text>
              {isInitialLoading ? (
                <Shimmer style={styles.shimmerSmall} />
              ) : (
                <Text style={styles.balancePositiveText}>
                  RM {formatMoney(balances?.totalOwed || 0)}
                </Text>
              )}
            </View>
            <View style={styles.divider} />
            <View style={styles.balanceItem}>
              <Text style={styles.balanceItemLabel}>You owe</Text>
              {isInitialLoading ? (
                <Shimmer style={styles.shimmerSmall} />
              ) : (
                <Text style={styles.balanceNegativeText}>
                  RM {formatMoney(balances?.totalOwe || 0)}
                </Text>
              )}
            </View>
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.actionsRow}>
            <TouchableOpacity 
              style={styles.actionButton} 
              activeOpacity={0.7}
              onPress={() => setShowAddExpense(true)}
            >
              <View style={styles.actionIconContainer}>
                <PlusCircle color={COLORS.primary} size={28} />
              </View>
              <Text style={styles.actionLabel}>Add Expense</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.actionButton} 
              activeOpacity={0.7}
              onPress={() => setShowCreateGroup(true)}
            >
              <View style={styles.actionIconContainer}>
                <Users color={COLORS.primary} size={28} />
              </View>
              <Text style={styles.actionLabel}>New Group</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.actionButton, !hasDebts && styles.actionButtonDisabled]} 
              activeOpacity={0.7}
              onPress={() => hasDebts && setShowSettleUp(true)}
            >
              <View style={styles.actionIconContainer}>
                <CreditCard color={hasDebts ? COLORS.primary : COLORS.textMuted} size={28} />
              </View>
              <Text style={[styles.actionLabel, !hasDebts && styles.actionLabelDisabled]}>
                Settle Up
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Recent Activity */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Activity</Text>
            {!isInitialLoading && recentActivity.length > 0 && (
              <TouchableOpacity onPress={navigateToActivity} style={styles.seeAllButton}>
                <Text style={styles.seeAllText}>See all</Text>
                <ChevronRight color={COLORS.primary} size={16} />
              </TouchableOpacity>
            )}
          </View>
          {isInitialLoading ? (
            <View style={styles.activityList}>
              {[1, 2, 3].map((i) => (
                <View key={i} style={styles.shimmerActivityItem}>
                  <View style={styles.shimmerActivityContent}>
                    <Shimmer style={styles.shimmerActivityTitle} />
                    <Shimmer style={styles.shimmerActivityMeta} />
                  </View>
                  <Shimmer style={styles.shimmerActivityAmount} />
                </View>
              ))}
            </View>
          ) : recentActivity.length > 0 ? (
            <View style={styles.activityList}>
              {recentActivity.slice(0, 5).map((activity) => (
                <TouchableOpacity 
                  key={activity.id} 
                  style={styles.activityItem}
                  activeOpacity={0.7}
                  onPress={() => openExpenseDetail(activity.id, activity.type)}
                >
                  <View style={styles.activityInfo}>
                    <Text style={styles.activityDescription} numberOfLines={1}>
                      {activity.description}
                    </Text>
                    <Text style={styles.activityMeta}>
                      {activity.groupName || 'Personal'} • {new Date(activity.timestamp).toLocaleDateString()}
                    </Text>
                  </View>
                  <View style={styles.activityRight}>
                    <Text style={[
                      styles.activityAmount,
                      activity.type === 'settlement' && styles.activityAmountSettlement,
                    ]}>
                      RM {formatMoney(activity.amount)}
                    </Text>
                    {activity.type === 'expense' && (
                      <ChevronRight color={COLORS.textMuted} size={16} />
                    )}
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No recent activity</Text>
              <Text style={styles.emptySubtext}>Add an expense to get started</Text>
            </View>
          )}
        </View>

        {/* Groups */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Your Groups</Text>
            {!isInitialLoading && groups.length > 0 && (
              <TouchableOpacity onPress={() => setShowCreateGroup(true)} style={styles.seeAllButton}>
                <PlusCircle color={COLORS.primary} size={16} />
                <Text style={[styles.seeAllText, { marginLeft: 4 }]}>New</Text>
              </TouchableOpacity>
            )}
          </View>
          {isInitialLoading ? (
            <View style={styles.groupList}>
              {[1, 2].map((i) => (
                <View key={i} style={styles.shimmerGroupItem}>
                  <Shimmer style={styles.shimmerGroupIcon} />
                  <View style={styles.shimmerGroupContent}>
                    <Shimmer style={styles.shimmerGroupTitle} />
                    <Shimmer style={styles.shimmerGroupMeta} />
                  </View>
                </View>
              ))}
            </View>
          ) : groups.length > 0 ? (
            <View style={styles.groupList}>
              {groups.map((group) => (
                <TouchableOpacity key={group.id} style={styles.groupItem} activeOpacity={0.7}>
                  <View style={styles.groupIcon}>
                    <Users color={COLORS.textPrimary} size={20} />
                  </View>
                  <View style={styles.groupInfo}>
                    <Text style={styles.groupName}>{group.name}</Text>
                    <Text style={styles.groupMembers}>
                      {group.memberCount} member{group.memberCount !== 1 ? 's' : ''}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No groups yet</Text>
              <Text style={styles.emptySubtext}>Create a group to split expenses</Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Modals */}
      <AddExpenseModal
        visible={showAddExpense}
        onClose={() => setShowAddExpense(false)}
        onSuccess={() => {
          // Dashboard will auto-refresh via Convex reactivity
        }}
      />
      
      <CreateGroupModal
        visible={showCreateGroup}
        onClose={() => setShowCreateGroup(false)}
        onSuccess={() => {
          // Groups will auto-refresh
        }}
      />

      <SettleUpModal
        visible={showSettleUp}
        onClose={() => setShowSettleUp(false)}
        onSuccess={handleSettleSuccess}
      />

      {/* Expense Detail Modal */}
      <Modal
        visible={showExpenseDetail}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={closeExpenseDetail}
      >
        <View style={styles.modalContainer}>
          {/* Modal Header */}
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={closeExpenseDetail} style={styles.modalCloseButton}>
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
              {!isParticipant && <View style={styles.modalHeaderSpacer} />}
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
                <View style={styles.metaItem}>
                  <User color={COLORS.textSecondary} size={16} />
                  <Text style={styles.metaText}>
                    Paid by {expense.payerId === userId ? 'You' : (expense.payerUsername || expense.payerName || 'Unknown')}
                  </Text>
                </View>
              </View>

              {/* Items */}
              <View style={styles.expenseSection}>
                <Text style={styles.expenseSectionTitle}>Items & Splits</Text>
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
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  shimmerLarge: {
    width: 160,
    height: 40,
    borderRadius: 6,
    marginBottom: 20,
  },
  shimmerSmall: {
    width: 90,
    height: 22,
    borderRadius: 4,
    marginTop: 2,
  },
  shimmerActivityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  shimmerActivityContent: {
    flex: 1,
  },
  shimmerActivityTitle: {
    width: 140,
    height: 16,
    borderRadius: 4,
  },
  shimmerActivityMeta: {
    width: 100,
    height: 14,
    borderRadius: 4,
    marginTop: 4,
  },
  shimmerActivityAmount: {
    width: 70,
    height: 16,
    borderRadius: 4,
  },
  shimmerGroupItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  shimmerGroupIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  shimmerGroupContent: {
    flex: 1,
  },
  shimmerGroupTitle: {
    width: 120,
    height: 18,
    borderRadius: 4,
  },
  shimmerGroupMeta: {
    width: 70,
    height: 14,
    borderRadius: 4,
    marginTop: 4,
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
  balancePositive: {
    color: COLORS.success,
  },
  balanceNegative: {
    color: COLORS.error,
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
  balancePositiveText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.success,
  },
  balanceNegativeText: {
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
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    marginBottom: 16,
  },
  seeAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  seeAllText: {
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: '600',
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
  actionButtonDisabled: {
    opacity: 0.5,
  },
  actionIconContainer: {
    marginBottom: 8,
  },
  actionLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  actionLabelDisabled: {
    color: COLORS.textMuted,
  },
  activityList: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    overflow: 'hidden',
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
  },
  activityInfo: {
    flex: 1,
    marginRight: 12,
  },
  activityDescription: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  activityMeta: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  activityRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  activityAmount: {
    fontSize: 14,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    marginRight: 4,
  },
  activityAmountSettlement: {
    color: COLORS.success,
  },
  groupList: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    overflow: 'hidden',
  },
  groupItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
  },
  groupIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  groupInfo: {
    flex: 1,
  },
  groupName: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  groupMembers: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
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
    textAlign: 'center',
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
  modalHeaderSpacer: {
    width: 72,
  },
  modalActions: {
    flexDirection: 'row',
    minWidth: 72,
    justifyContent: 'flex-end',
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
  metaSection: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginLeft: 10,
  },
  expenseSection: {
    marginBottom: 16,
  },
  expenseSectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
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

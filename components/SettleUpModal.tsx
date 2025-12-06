import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Alert,
  Animated,
  Easing,
} from 'react-native';
import {
  X,
  User,
  Check,
  ArrowRight,
  Banknote,
  CheckCircle,
} from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../convex/_generated/api';
import { Id } from '../convex/_generated/dataModel';

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

interface DebtItem {
  friendId: string;
  friendUsername: string;
  friendName?: string;
  amount: number;
}

interface SettleUpModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const formatMoney = (amount: number): string => {
  return amount.toFixed(2);
};

type SettlePhase = 'select' | 'transferring' | 'success';

export const SettleUpModal: React.FC<SettleUpModalProps> = ({
  visible,
  onClose,
  onSuccess,
}) => {
  const { userId } = useAuth();
  
  const [selectedDebtId, setSelectedDebtId] = useState<string | null>(null);
  const [phase, setPhase] = useState<SettlePhase>('select');
  const [settledFriend, setSettledFriend] = useState<string>('');
  const [settledAmount, setSettledAmount] = useState<number>(0);

  // Animation values
  const progressAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // Fetch dashboard data to get debts
  const dashboard = useQuery(api.queries.getDashboard,
    userId ? { userId: userId as Id<'users'> } : 'skip'
  );

  // Settle mutation
  const settle = useMutation(api.mutations.settle);

  // Reset when modal opens
  useEffect(() => {
    if (visible) {
      setSelectedDebtId(null);
      setPhase('select');
      setSettledFriend('');
      setSettledAmount(0);
      progressAnim.setValue(0);
      scaleAnim.setValue(0);
      fadeAnim.setValue(0);
    }
  }, [visible]);

  // Calculate who we owe money to from byPerson array
  // byPerson has: { userId, username, name?, amount }
  // Negative amount means we owe them
  const debts: DebtItem[] = React.useMemo(() => {
    if (!dashboard?.balances?.byPerson) return [];
    
    const debtList: DebtItem[] = [];
    for (const person of dashboard.balances.byPerson) {
      // Negative amount means we owe them
      if (person.amount < 0) {
        debtList.push({
          friendId: person.userId,
          friendUsername: person.username,
          friendName: person.name,
          amount: Math.abs(person.amount),
        });
      }
    }
    return debtList;
  }, [dashboard]);

  // Handle settle
  const handleSettle = async (): Promise<void> => {
    if (!selectedDebtId || !userId) return;

    const selectedDebt = debts.find(d => d.friendId === selectedDebtId);
    if (!selectedDebt) return;

    setSettledFriend(selectedDebt.friendUsername);
    setSettledAmount(selectedDebt.amount);
    setPhase('transferring');

    // Start transfer animation
    Animated.sequence([
      Animated.timing(progressAnim, {
        toValue: 1,
        duration: 2000,
        easing: Easing.bezier(0.4, 0, 0.2, 1),
        useNativeDriver: false,
      }),
    ]).start(async () => {
      try {
        const result = await settle({
          fromId: userId as Id<'users'>,
          toId: selectedDebt.friendId as Id<'users'>,
          amount: selectedDebt.amount,
        });

        if (result.success) {
          setPhase('success');
          
          // Success animation
          Animated.parallel([
            Animated.spring(scaleAnim, {
              toValue: 1,
              friction: 4,
              useNativeDriver: true,
            }),
            Animated.timing(fadeAnim, {
              toValue: 1,
              duration: 300,
              useNativeDriver: true,
            }),
          ]).start();

          // Auto close after delay
          setTimeout(() => {
            onSuccess?.();
            onClose();
          }, 2500);
        } else {
          Alert.alert('Error', result.error || 'Settlement failed');
          setPhase('select');
        }
      } catch (error) {
        console.error('Settle error:', error);
        Alert.alert('Error', 'Something went wrong');
        setPhase('select');
      }
    });
  };

  const selectedDebt = debts.find(d => d.friendId === selectedDebtId);

  // Render different phases
  const renderContent = (): React.ReactElement => {
    switch (phase) {
      case 'transferring':
        return (
          <View style={styles.transferContainer}>
            <View style={styles.transferHeader}>
              <Text style={styles.transferTitle}>Sending Payment</Text>
              <Text style={styles.transferSubtitle}>
                to {settledFriend}
              </Text>
            </View>

            <View style={styles.amountDisplay}>
              <Text style={styles.amountText}>RM {formatMoney(settledAmount)}</Text>
            </View>

            {/* Transfer Animation */}
            <View style={styles.transferAnimation}>
              <View style={styles.transferDot}>
                <User color={COLORS.textPrimary} size={24} />
              </View>
              
              <View style={styles.transferProgressContainer}>
                <Animated.View 
                  style={[
                    styles.transferProgress,
                    {
                      width: progressAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: ['0%', '100%'],
                      }),
                    },
                  ]} 
                />
                <Animated.View 
                  style={[
                    styles.transferArrow,
                    {
                      left: progressAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: ['0%', '85%'],
                      }),
                      opacity: progressAnim.interpolate({
                        inputRange: [0, 0.1, 0.9, 1],
                        outputRange: [0, 1, 1, 0],
                      }),
                    },
                  ]}
                >
                  <Banknote color={COLORS.primary} size={20} />
                </Animated.View>
              </View>

              <View style={styles.transferDot}>
                <User color={COLORS.textPrimary} size={24} />
              </View>
            </View>

            <Text style={styles.transferStatus}>Processing transfer...</Text>
            
            <Text style={styles.disclaimerText}>
              Currently doesn't move money; awaiting Ryt bank sifus to partner up ;)
            </Text>
          </View>
        );

      case 'success':
        return (
          <View style={styles.successContainer}>
            <Animated.View 
              style={[
                styles.successIcon,
                {
                  transform: [{ scale: scaleAnim }],
                  opacity: fadeAnim,
                },
              ]}
            >
              <CheckCircle color={COLORS.primary} size={80} />
            </Animated.View>

            <Animated.View style={{ opacity: fadeAnim }}>
              <Text style={styles.successTitle}>Payment Sent!</Text>
              <Text style={styles.successSubtitle}>
                RM {formatMoney(settledAmount)} sent to {settledFriend}
              </Text>
              <Text style={styles.successNote}>
                Your balance has been updated
              </Text>
            </Animated.View>
          </View>
        );

      default: // 'select'
        return (
          <ScrollView style={styles.content}>
            <View style={styles.introSection}>
              <Text style={styles.introTitle}>Who do you want to pay?</Text>
              <Text style={styles.introSubtitle}>
                Select a friend to settle your debt
              </Text>
            </View>

            {debts.length > 0 ? (
              <View style={styles.debtsList}>
                {debts.map((debt) => {
                  const isSelected = selectedDebtId === debt.friendId;
                  return (
                    <TouchableOpacity
                      key={debt.friendId}
                      style={[styles.debtItem, isSelected && styles.debtItemSelected]}
                      onPress={() => setSelectedDebtId(debt.friendId)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.debtInfo}>
                        <View style={[styles.avatar, isSelected && styles.avatarSelected]}>
                          <User color={COLORS.textPrimary} size={20} />
                        </View>
                        <View>
                          <Text style={styles.debtName}>{debt.friendUsername}</Text>
                          {debt.friendName && (
                            <Text style={styles.debtFullName}>{debt.friendName}</Text>
                          )}
                        </View>
                      </View>
                      <View style={styles.debtAmountContainer}>
                        <Text style={styles.debtLabel}>You owe</Text>
                        <Text style={styles.debtAmount}>RM {formatMoney(debt.amount)}</Text>
                      </View>
                      <View style={[styles.radio, isSelected && styles.radioSelected]}>
                        {isSelected && <View style={styles.radioInner} />}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ) : (
              <View style={styles.emptyState}>
                <CheckCircle color={COLORS.primary} size={48} />
                <Text style={styles.emptyTitle}>All settled up!</Text>
                <Text style={styles.emptySubtitle}>
                  You don't owe anyone right now
                </Text>
              </View>
            )}

            {/* Settle Button */}
            {selectedDebt && (
              <TouchableOpacity
                style={styles.settleButton}
                onPress={handleSettle}
                activeOpacity={0.8}
              >
                <View style={styles.settleButtonContent}>
                  <Text style={styles.settleButtonText}>
                    Pay RM {formatMoney(selectedDebt.amount)}
                  </Text>
                  <ArrowRight color={COLORS.textPrimary} size={20} />
                </View>
              </TouchableOpacity>
            )}

            <View style={styles.bottomPadding} />
          </ScrollView>
        );
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={phase === 'select' ? onClose : undefined}
    >
      <View style={styles.container}>
        {/* Header - only show close in select phase */}
        {phase === 'select' && (
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <X color={COLORS.textSecondary} size={24} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Settle Up</Text>
            <View style={styles.headerSpacer} />
          </View>
        )}

        {renderContent()}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  closeButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
  },
  headerSpacer: {
    width: 32,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  introSection: {
    marginBottom: 24,
  },
  introTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    marginBottom: 8,
  },
  introSubtitle: {
    fontSize: 15,
    color: COLORS.textSecondary,
  },
  debtsList: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    overflow: 'hidden',
  },
  debtItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  debtItemSelected: {
    backgroundColor: 'rgba(0, 168, 107, 0.08)',
  },
  debtInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.cardElevated,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarSelected: {
    backgroundColor: COLORS.primary,
  },
  debtName: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  debtFullName: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  debtAmountContainer: {
    alignItems: 'flex-end',
    marginRight: 12,
  },
  debtLabel: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginBottom: 2,
  },
  debtAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.error,
  },
  radio: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: {
    borderColor: COLORS.primary,
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: COLORS.primary,
  },
  settleButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 16,
    padding: 18,
    marginTop: 24,
  },
  settleButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  settleButtonText: {
    fontSize: 17,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    marginRight: 8,
  },
  emptyState: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 48,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 15,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  // Transfer animation styles
  transferContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  transferHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  transferTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    marginBottom: 8,
  },
  transferSubtitle: {
    fontSize: 16,
    color: COLORS.textSecondary,
  },
  amountDisplay: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    paddingHorizontal: 32,
    paddingVertical: 20,
    marginBottom: 48,
  },
  amountText: {
    fontSize: 36,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  transferAnimation: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginBottom: 24,
  },
  transferDot: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: COLORS.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  transferProgressContainer: {
    flex: 1,
    height: 4,
    backgroundColor: COLORS.card,
    marginHorizontal: 12,
    borderRadius: 2,
    position: 'relative',
  },
  transferProgress: {
    height: '100%',
    backgroundColor: COLORS.primary,
    borderRadius: 2,
  },
  transferArrow: {
    position: 'absolute',
    top: -18,
  },
  transferStatus: {
    fontSize: 15,
    color: COLORS.textSecondary,
  },
  // Success styles
  successContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  successIcon: {
    marginBottom: 24,
  },
  successTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.primary,
    marginBottom: 12,
    textAlign: 'center',
  },
  successSubtitle: {
    fontSize: 18,
    color: COLORS.textPrimary,
    marginBottom: 8,
    textAlign: 'center',
  },
  successNote: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  disclaimerText: {
    fontSize: 12,
    color: COLORS.textMuted,
    textAlign: 'center',
    fontStyle: 'italic',
    marginTop: 24,
    paddingHorizontal: 20,
  },
  bottomPadding: {
    height: 40,
  },
});

export default SettleUpModal;


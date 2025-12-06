import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
} from 'react-native';
import { User, Check, AlertCircle } from 'lucide-react-native';

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

// Types
export type SplitType = 'equal' | 'exact' | 'percentage';

export interface SplitUser {
  userId: string;
  username: string;
  name?: string;
}

export interface SplitShare {
  userId: string;
  share: number;
  percentage?: number;
  included: boolean;
}

export interface SplitResult {
  isValid: boolean;
  splitType: SplitType;
  totalAmount: number;
  shares: SplitShare[];
  error?: string;
}

export interface InitialSplitShare {
  userId: string;
  share: number;
}

interface SplitLogicProps {
  amount: number;
  users: SplitUser[];
  currentUserId?: string;
  initialSplitType?: SplitType;
  initialShares?: InitialSplitShare[];
  onChange: (result: SplitResult) => void;
}

const roundMoney = (value: number): number => {
  return Math.round(value * 100) / 100;
};

const formatMoney = (value: number): string => {
  return value.toFixed(2);
};

export const SplitLogic: React.FC<SplitLogicProps> = ({
  amount,
  users,
  currentUserId,
  initialSplitType = 'equal',
  initialShares,
  onChange,
}) => {
  // Helper to display "You" for current user
  const getDisplayName = (user: SplitUser): string => {
    return user.userId === currentUserId ? 'You' : user.username;
  };
  // Determine if we should use exact mode based on initial shares
  const hasInitialShares = initialShares && initialShares.length > 0;
  const effectiveInitialType = hasInitialShares ? 'exact' : initialSplitType;
  
  const [splitType, setSplitType] = useState<SplitType>(effectiveInitialType);
  const [includedUserIds, setIncludedUserIds] = useState<Set<string>>(() => {
    if (hasInitialShares) {
      // Include only users that have a share > 0
      return new Set(initialShares.filter(s => s.share > 0).map(s => s.userId));
    }
    return new Set(users.map(u => u.userId));
  });
  const [exactAmounts, setExactAmounts] = useState<Record<string, string>>(() => {
    if (hasInitialShares) {
      // Pre-fill exact amounts from initial shares
      const amounts: Record<string, string> = {};
      initialShares.forEach(s => {
        if (s.share > 0) {
          amounts[s.userId] = s.share.toString();
        }
      });
      return amounts;
    }
    return {};
  });
  const [percentages, setPercentages] = useState<Record<string, string>>(() => {
    if (hasInitialShares && amount > 0) {
      // Pre-fill percentages from initial shares
      const pcts: Record<string, string> = {};
      initialShares.forEach(s => {
        if (s.share > 0) {
          pcts[s.userId] = roundMoney((s.share / amount) * 100).toString();
        }
      });
      return pcts;
    }
    return {};
  });
  
  // Track previous result to avoid duplicate onChange calls
  const prevResultRef = useRef<string>('');
  const isInitialMount = useRef(true);
  const initializedRef = useRef(false);

  // Reset when users change (but not on first mount if we have initial shares)
  useEffect(() => {
    if (initializedRef.current) {
      const userIds = users.map(u => u.userId);
      setIncludedUserIds(new Set(userIds));
      setExactAmounts({});
      setPercentages({});
    }
    initializedRef.current = true;
  }, [JSON.stringify(users.map(u => u.userId))]);

  // Calculate shares based on split type
  const shares = useMemo((): SplitShare[] => {
    if (splitType === 'equal') {
      const includedUsers = users.filter(u => includedUserIds.has(u.userId));
      const count = includedUsers.length;
      
      if (count === 0) {
        return users.map(u => ({ userId: u.userId, share: 0, percentage: 0, included: false }));
      }

      const equalShare = roundMoney(amount / count);
      const totalEqual = roundMoney(equalShare * count);
      const remainder = roundMoney(amount - totalEqual);
      
      let remainderAssigned = false;
      return users.map(u => {
        const included = includedUserIds.has(u.userId);
        if (!included) {
          return { userId: u.userId, share: 0, percentage: 0, included: false };
        }
        
        let share = equalShare;
        if (!remainderAssigned && remainder !== 0) {
          share = roundMoney(equalShare + remainder);
          remainderAssigned = true;
        }
        
        return {
          userId: u.userId,
          share,
          percentage: amount > 0 ? roundMoney((share / amount) * 100) : 0,
          included: true,
        };
      });
    } else if (splitType === 'exact') {
      return users.map(u => {
        const amountStr = exactAmounts[u.userId] || '';
        const share = parseFloat(amountStr) || 0;
        return {
          userId: u.userId,
          share: roundMoney(share),
          percentage: amount > 0 ? roundMoney((share / amount) * 100) : 0,
          included: share > 0,
        };
      });
    } else {
      // Percentage
      return users.map(u => {
        const pctStr = percentages[u.userId] || '';
        const pct = parseFloat(pctStr) || 0;
        const share = roundMoney((pct / 100) * amount);
        return {
          userId: u.userId,
          share,
          percentage: roundMoney(pct),
          included: pct > 0,
        };
      });
    }
  }, [splitType, users, includedUserIds, exactAmounts, percentages, amount]);

  // Validation
  const validation = useMemo(() => {
    const totalSplit = roundMoney(shares.reduce((sum, s) => sum + s.share, 0));
    const roundedAmount = roundMoney(amount);

    if (totalSplit !== roundedAmount) {
      const diff = roundMoney(roundedAmount - totalSplit);
      if (diff > 0) {
        return { isValid: false, error: `RM ${formatMoney(diff)} remaining` };
      } else {
        return { isValid: false, error: `RM ${formatMoney(Math.abs(diff))} over` };
      }
    }
    return { isValid: true, error: undefined };
  }, [shares, amount]);

  // Emit changes only when result actually changes
  useEffect(() => {
    const result: SplitResult = {
      isValid: validation.isValid,
      splitType,
      totalAmount: amount,
      shares,
      error: validation.error,
    };
    
    const resultKey = JSON.stringify({
      isValid: result.isValid,
      splitType: result.splitType,
      totalAmount: result.totalAmount,
      shares: result.shares.map(s => ({ ...s })),
    });
    
    // Only emit if result actually changed
    if (prevResultRef.current !== resultKey) {
      prevResultRef.current = resultKey;
      // Skip initial mount to prevent loop
      if (!isInitialMount.current) {
        onChange(result);
      } else {
        isInitialMount.current = false;
        // Still need to emit initial result
        onChange(result);
      }
    }
  }, [shares, splitType, amount, validation]);

  // Toggle user inclusion for equal split
  const toggleUserInclusion = (userId: string): void => {
    setIncludedUserIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(userId)) {
        newSet.delete(userId);
      } else {
        newSet.add(userId);
      }
      return newSet;
    });
  };

  // Calculate totals
  const totalAssigned = roundMoney(shares.reduce((sum, s) => sum + s.share, 0));

  return (
    <View style={styles.container}>
      {/* Split Type Tabs */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, splitType === 'equal' && styles.tabActive]}
          onPress={() => setSplitType('equal')}
        >
          <Text style={[styles.tabText, splitType === 'equal' && styles.tabTextActive]}>
            Equal
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, splitType === 'exact' && styles.tabActive]}
          onPress={() => setSplitType('exact')}
        >
          <Text style={[styles.tabText, splitType === 'exact' && styles.tabTextActive]}>
            Exact
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, splitType === 'percentage' && styles.tabActive]}
          onPress={() => setSplitType('percentage')}
        >
          <Text style={[styles.tabText, splitType === 'percentage' && styles.tabTextActive]}>
            %
          </Text>
        </TouchableOpacity>
      </View>

      {/* User List */}
      <ScrollView style={styles.userList} nestedScrollEnabled>
        {users.map((user) => {
          const share = shares.find(s => s.userId === user.userId);
          const isIncluded = share?.included || false;

          return (
            <View key={user.userId} style={styles.userRow}>
              {splitType === 'equal' ? (
                <TouchableOpacity
                  style={styles.userInfo}
                  onPress={() => toggleUserInclusion(user.userId)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.checkbox, isIncluded && styles.checkboxActive]}>
                    {isIncluded && <Check color={COLORS.textPrimary} size={14} />}
                  </View>
                  <View style={[styles.avatar, !isIncluded && styles.avatarDisabled]}>
                    <User color={isIncluded ? COLORS.textPrimary : COLORS.textMuted} size={16} />
                  </View>
                  <Text style={[styles.username, !isIncluded && styles.textDisabled]}>
                    {getDisplayName(user)}
                  </Text>
                </TouchableOpacity>
              ) : (
                <View style={styles.userInfo}>
                  <View style={[styles.avatar, !isIncluded && styles.avatarDisabled]}>
                    <User color={isIncluded ? COLORS.textPrimary : COLORS.textMuted} size={16} />
                  </View>
                  <Text style={[styles.username, !isIncluded && styles.textDisabled]}>
                    {getDisplayName(user)}
                  </Text>
                </View>
              )}

              <View style={styles.inputContainer}>
                {splitType === 'equal' ? (
                  <Text style={[styles.shareText, !isIncluded && styles.textDisabled]}>
                    RM {formatMoney(share?.share || 0)}
                  </Text>
                ) : splitType === 'exact' ? (
                  <View style={styles.inputWrapper}>
                    <Text style={styles.inputPrefix}>RM</Text>
                    <TextInput
                      style={styles.input}
                      keyboardType="decimal-pad"
                      value={exactAmounts[user.userId] || ''}
                      onChangeText={(text) => {
                        const cleaned = text.replace(/[^0-9.]/g, '');
                        const parts = cleaned.split('.');
                        const formatted = parts.length > 2 
                          ? parts[0] + '.' + parts.slice(1).join('')
                          : cleaned;
                        setExactAmounts(prev => ({ ...prev, [user.userId]: formatted }));
                      }}
                      placeholder="0.00"
                      placeholderTextColor={COLORS.textMuted}
                    />
                  </View>
                ) : (
                  <View style={styles.inputWrapper}>
                    <TextInput
                      style={styles.input}
                      keyboardType="decimal-pad"
                      value={percentages[user.userId] || ''}
                      onChangeText={(text) => {
                        const cleaned = text.replace(/[^0-9.]/g, '');
                        const parts = cleaned.split('.');
                        const formatted = parts.length > 2 
                          ? parts[0] + '.' + parts.slice(1).join('')
                          : cleaned;
                        setPercentages(prev => ({ ...prev, [user.userId]: formatted }));
                      }}
                      placeholder="0"
                      placeholderTextColor={COLORS.textMuted}
                    />
                    <Text style={styles.inputSuffix}>%</Text>
                  </View>
                )}
              </View>
            </View>
          );
        })}
      </ScrollView>

      {/* Summary */}
      <View style={styles.summaryContainer}>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Total</Text>
          <Text style={[styles.summaryValue, !validation.isValid && styles.summaryValueError]}>
            RM {formatMoney(totalAssigned)} / RM {formatMoney(amount)}
          </Text>
        </View>
      </View>

      {/* Validation Message */}
      {!validation.isValid && validation.error && (
        <View style={styles.errorContainer}>
          <AlertCircle color={COLORS.warning} size={14} />
          <Text style={styles.errorText}>{validation.error}</Text>
        </View>
      )}

      {/* Valid Indicator */}
      {validation.isValid && (
        <View style={styles.validContainer}>
          <Check color={COLORS.primary} size={14} />
          <Text style={styles.validText}>Split looks good!</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.cardElevated,
    borderRadius: 12,
    padding: 12,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: COLORS.card,
    borderRadius: 8,
    padding: 3,
    marginBottom: 12,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 6,
  },
  tabActive: {
    backgroundColor: COLORS.primary,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  tabTextActive: {
    color: COLORS.textPrimary,
  },
  userList: {
    maxHeight: 200,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  checkboxActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  avatarDisabled: {
    backgroundColor: COLORS.card,
  },
  username: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.textPrimary,
  },
  textDisabled: {
    color: COLORS.textMuted,
  },
  inputContainer: {
    minWidth: 90,
    alignItems: 'flex-end',
  },
  shareText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: 6,
    paddingHorizontal: 8,
    height: 36,
    minWidth: 80,
  },
  inputPrefix: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginRight: 4,
  },
  inputSuffix: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginLeft: 4,
  },
  input: {
    fontSize: 14,
    color: COLORS.textPrimary,
    minWidth: 45,
    width: 45,
    textAlign: 'right',
    padding: 0,
    height: 36,
    // @ts-ignore - web specific
    outlineStyle: 'none',
  },
  summaryContainer: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  summaryLabel: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  summaryValue: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  summaryValueError: {
    color: COLORS.warning,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 184, 0, 0.1)',
    borderRadius: 6,
    padding: 8,
    marginTop: 8,
  },
  errorText: {
    fontSize: 12,
    color: COLORS.warning,
    marginLeft: 6,
  },
  validContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 168, 107, 0.1)',
    borderRadius: 6,
    padding: 8,
    marginTop: 8,
  },
  validText: {
    fontSize: 12,
    color: COLORS.primary,
    marginLeft: 6,
  },
});

export default SplitLogic;

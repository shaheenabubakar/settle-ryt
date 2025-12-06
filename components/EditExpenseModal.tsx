import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import {
  X,
  ChevronDown,
  ChevronUp,
  Receipt,
  Check,
  Plus,
  Trash2,
  User,
  Wallet,
} from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import { SuccessModal } from './SuccessModal';
import { AlertModal } from './AlertModal';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../convex/_generated/api';
import { Id } from '../convex/_generated/dataModel';
import { SplitLogic, SplitResult, SplitUser, InitialSplitShare } from './SplitLogic';

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

interface ExpenseItem {
  id: string;
  name: string;
  amount: string;
  splitResult: SplitResult | null;
  expanded: boolean;
  // Store original splits for initialization
  originalSplits?: Array<{ userId: string; share: number }>;
}

interface EditExpenseModalProps {
  visible: boolean;
  expenseId: string | null;
  onClose: () => void;
  onSuccess?: () => void;
}

const roundMoney = (value: number): number => {
  return Math.round(value * 100) / 100;
};

const formatMoney = (value: number): string => {
  return value.toFixed(2);
};

const generateId = (): string => {
  return Math.random().toString(36).substring(2, 9);
};

export const EditExpenseModal: React.FC<EditExpenseModalProps> = ({
  visible,
  expenseId,
  onClose,
  onSuccess,
}) => {
  const { userId } = useAuth();
  
  // Form state
  const [description, setDescription] = useState('');
  const [payerId, setPayerId] = useState<string | null>(null);
  const [items, setItems] = useState<ExpenseItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [alertModal, setAlertModal] = useState<{ visible: boolean; title: string; message: string }>({
    visible: false,
    title: '',
    message: '',
  });

  // Use refs to store split results
  const splitResultsRef = useRef<Record<string, SplitResult>>({});

  // Fetch expense details
  const expenseDetail = useQuery(
    api.queries.getExpense,
    expenseId ? { expenseId: expenseId as Id<'expenses'> } : 'skip'
  );

  // Fetch group details to get members (only if expense has a groupId)
  const groupDetails = useQuery(
    api.queries.getGroup,
    expenseDetail?.groupId ? { groupId: expenseDetail.groupId as Id<'groups'> } : 'skip'
  );

  // Mutations
  const updateExpense = useMutation(api.mutations.updateExpense);

  // Get members for splits - from group or from expense participants
  const groupMembers = useMemo((): SplitUser[] => {
    // If expense has a group, use group members
    if (expenseDetail?.groupId && groupDetails?.members) {
      return groupDetails.members.map(m => ({
        userId: m.userId,
        username: m.username,
        name: m.name,
      }));
    }
    // If expense has participantIds (no group), extract unique participants from splits
    if (expenseDetail && !expenseDetail.groupId) {
      // Get unique users from splits
      const participantMap = new Map<string, { userId: string; username?: string; name?: string }>();
      expenseDetail.items.forEach(item => {
        item.splits.forEach(split => {
          if (!participantMap.has(split.userId)) {
            participantMap.set(split.userId, {
              userId: split.userId,
              username: split.username || 'Unknown',
              name: split.name,
            });
          }
        });
      });
      return Array.from(participantMap.values());
    }
    return [];
  }, [expenseDetail, groupDetails]);

  // Initialize form when expense and members load
  // For expenses with groups, wait for groupDetails; for individual expenses, members are from splits
  useEffect(() => {
    if (visible && expenseDetail && groupMembers.length > 0 && !isInitialized) {
      setDescription(expenseDetail.description);
      setPayerId(expenseDetail.payerId);
      
      // Convert expense items to form format and pre-create valid split results
      const formItems: ExpenseItem[] = expenseDetail.items.map((item, index) => {
        const itemId = generateId();
        const itemAmount = item.amount;
        
        // Create a valid SplitResult from existing data
        const shares = groupMembers.map(member => {
          const existingSplit = item.splits.find(s => s.userId === member.userId);
          return {
            userId: member.userId,
            share: existingSplit?.share || 0,
            percentage: itemAmount > 0 ? roundMoney(((existingSplit?.share || 0) / itemAmount) * 100) : 0,
            included: (existingSplit?.share || 0) > 0,
          };
        });

        const totalSplit = roundMoney(shares.reduce((sum, s) => sum + s.share, 0));
        const isValid = totalSplit === roundMoney(itemAmount);

        const splitResult: SplitResult = {
          isValid,
          splitType: 'exact', // Since we're loading exact values
          totalAmount: itemAmount,
          shares,
          error: isValid ? undefined : `Split doesn't match amount`,
        };

        // Store in ref
        splitResultsRef.current[itemId] = splitResult;

        return {
          id: itemId,
          name: item.name,
          amount: item.amount.toString(),
          splitResult,
          expanded: index === 0,
          originalSplits: item.splits.map(s => ({ userId: s.userId, share: s.share })),
        };
      });
      
      setItems(formItems);
      setIsInitialized(true);
    }
  }, [visible, expenseDetail, groupMembers, isInitialized]);

  // Reset when modal closes
  useEffect(() => {
    if (!visible) {
      setIsInitialized(false);
      setDescription('');
      setPayerId(null);
      setItems([]);
      splitResultsRef.current = {};
    }
  }, [visible]);

  // Calculate items total
  const itemsTotal = useMemo(() => {
    return roundMoney(items.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0));
  }, [items]);

  // Toggle item expansion
  const toggleItemExpansion = (itemId: string): void => {
    setItems(prev => prev.map(item => ({
      ...item,
      expanded: item.id === itemId ? !item.expanded : false,
    })));
  };

  // Close item
  const closeItem = (itemId: string): void => {
    setItems(prev => prev.map(item => ({
      ...item,
      expanded: item.id === itemId ? false : item.expanded,
    })));
  };

  // Update item field
  const updateItemField = (itemId: string, field: 'name' | 'amount', value: string): void => {
    setItems(prev => prev.map(item => 
      item.id === itemId ? { ...item, [field]: value } : item
    ));
  };

  // Handle split change
  const handleSplitChange = useCallback((itemId: string, result: SplitResult) => {
    splitResultsRef.current[itemId] = result;
    setItems(prev => {
      const item = prev.find(i => i.id === itemId);
      if (item && JSON.stringify(item.splitResult) !== JSON.stringify(result)) {
        return prev.map(i => i.id === itemId ? { ...i, splitResult: result } : i);
      }
      return prev;
    });
  }, []);

  // Add item
  const addItem = (): void => {
    const newItem: ExpenseItem = {
      id: generateId(),
      name: '',
      amount: '',
      splitResult: null,
      expanded: true,
    };
    setItems(prev => [
      ...prev.map(i => ({ ...i, expanded: false })),
      newItem,
    ]);
  };

  // Remove item
  const removeItem = (itemId: string): void => {
    if (items.length <= 1) {
      setAlertModal({ visible: true, title: 'Error', message: 'You need at least one item' });
      return;
    }
    setItems(prev => prev.filter(i => i.id !== itemId));
    delete splitResultsRef.current[itemId];
  };

  // Validate amount input
  const validateAmountInput = (text: string): string => {
    const cleaned = text.replace(/[^0-9.]/g, '');
    const parts = cleaned.split('.');
    let formatted = parts.length > 2 
      ? parts[0] + '.' + parts.slice(1).join('')
      : cleaned;
    if (parts.length === 2 && parts[1].length > 2) {
      formatted = parts[0] + '.' + parts[1].substring(0, 2);
    }
    const num = parseFloat(formatted);
    if (num > 999999.99) {
      return '999999.99';
    }
    return formatted;
  };

  // Check if all splits are valid
  const allSplitsValid = useMemo(() => {
    return items.every(item => {
      const result = splitResultsRef.current[item.id] || item.splitResult;
      const itemAmount = parseFloat(item.amount) || 0;
      return itemAmount > 0 && result?.isValid;
    });
  }, [items]);

  // Validate form
  const validateForm = (): string | null => {
    if (!description.trim()) {
      return 'Please enter a description';
    }
    for (const item of items) {
      const itemAmount = parseFloat(item.amount) || 0;
      if (items.length > 1 && !item.name.trim()) {
        return 'Please name all items';
      }
      if (itemAmount <= 0) {
        return items.length > 1 ? 'All items need an amount' : 'Please enter the item amount';
      }
      const result = splitResultsRef.current[item.id] || item.splitResult;
      if (!result?.isValid) {
        return items.length > 1 ? `Please complete the split for "${item.name || 'item'}"` : 'Please complete the split';
      }
    }
    return null;
  };

  // Handle submit
  const handleSubmit = async (): Promise<void> => {
    const error = validateForm();
    if (error) {
      setAlertModal({ visible: true, title: 'Oops!', message: error });
      return;
    }

    if (!userId || !expenseId) return;

    setIsSubmitting(true);

    try {
      // Build items for mutation
      const expenseItems = items.map(item => {
        const result = splitResultsRef.current[item.id] || item.splitResult;
        return {
          name: item.name.trim() || description.trim(),
          amount: roundMoney(parseFloat(item.amount) || 0),
          splits: (result?.shares || [])
            .filter(s => s.included && s.share > 0)
            .map(s => ({
              userId: s.userId as Id<'users'>,
              share: roundMoney(s.share),
            })),
        };
      });

      const result = await updateExpense({
        userId: userId as Id<'users'>,
        expenseId: expenseId as Id<'expenses'>,
        description: description.trim(),
        payerId: payerId as Id<'users'>,
        items: expenseItems,
      });

      if (result.success) {
        setShowSuccessModal(true);
      } else {
        setAlertModal({ visible: true, title: 'Error', message: result.error || 'Failed to update expense' });
      }
    } catch (error) {
      console.error('Update expense error:', error);
      setAlertModal({ visible: true, title: 'Error', message: 'Something went wrong' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const canSubmit = allSplitsValid && !isSubmitting && groupMembers.length > 0;
  const isSingleItem = items.length === 1;

  // Show loading when expense hasn't loaded yet, or when we're waiting for group details
  const isLoading = !expenseDetail || 
    (expenseDetail.groupId && !groupDetails) || 
    groupMembers.length === 0;

  if (isLoading) {
    return (
      <Modal
        visible={visible}
        animationType="slide"
        onRequestClose={onClose}
      >
        <View style={styles.container}>
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <X color={COLORS.textSecondary} size={24} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Edit Expense</Text>
            <View style={styles.headerSpacer} />
          </View>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={COLORS.primary} />
          </View>
        </View>
      </Modal>
    );
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <X color={COLORS.textSecondary} size={24} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Edit Expense</Text>
          <TouchableOpacity
            style={[styles.submitButton, !canSubmit && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={!canSubmit}
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color={COLORS.textPrimary} />
            ) : (
              <Text style={styles.submitButtonText}>Save</Text>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
          {/* Description */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Description</Text>
            <TextInput
              style={styles.input}
              placeholder="What's this for?"
              placeholderTextColor={COLORS.textMuted}
              value={description}
              onChangeText={setDescription}
              maxLength={100}
            />
          </View>

          {/* Who Paid */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Who paid?</Text>
            <View style={styles.payerContainer}>
              {groupMembers.map(member => (
                <TouchableOpacity
                  key={member.userId}
                  style={[
                    styles.payerOption,
                    payerId === member.userId && styles.payerOptionActive,
                  ]}
                  onPress={() => setPayerId(member.userId)}
                >
                  <View style={styles.payerRadio}>
                    {payerId === member.userId && <View style={styles.payerRadioInner} />}
                  </View>
                  <View style={styles.payerAvatar}>
                    <User color={COLORS.textPrimary} size={16} />
                  </View>
                  <Text style={styles.payerName}>
                    {member.userId === userId ? 'You' : member.username}
                  </Text>
                  {payerId === member.userId && (
                    <Wallet color={COLORS.primary} size={16} style={styles.payerIcon} />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Items */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionLabel}>Items</Text>
              {items.length > 1 && (
                <Text style={styles.itemsCount}>{items.length} items</Text>
              )}
            </View>

            {items.map((item, index) => {
              const itemAmount = parseFloat(item.amount) || 0;
              const currentSplitResult = splitResultsRef.current[item.id] || item.splitResult;
              const hasValidSplit = currentSplitResult?.isValid;

              return (
                <View key={item.id} style={styles.itemCard}>
                  {/* Item Header - only show if multiple items */}
                  {items.length > 1 && (
                    <TouchableOpacity
                      style={styles.itemHeader}
                      onPress={() => toggleItemExpansion(item.id)}
                    >
                      <View style={styles.itemHeaderLeft}>
                        <Receipt color={COLORS.primary} size={18} />
                        <Text style={styles.itemHeaderTitle}>
                          {item.name || `Item ${index + 1}`}
                        </Text>
                      </View>
                      <View style={styles.itemHeaderRight}>
                        {itemAmount > 0 && (
                          <Text style={styles.itemHeaderAmount}>
                            RM {formatMoney(itemAmount)}
                          </Text>
                        )}
                        {hasValidSplit && (
                          <View style={styles.validBadge}>
                            <Check color={COLORS.primary} size={10} />
                          </View>
                        )}
                        {items.length > 1 && (
                          <TouchableOpacity
                            style={styles.removeItemButton}
                            onPress={() => removeItem(item.id)}
                          >
                            <Trash2 color={COLORS.error} size={16} />
                          </TouchableOpacity>
                        )}
                        {item.expanded ? (
                          <ChevronUp color={COLORS.textSecondary} size={18} />
                        ) : (
                          <ChevronDown color={COLORS.textSecondary} size={18} />
                        )}
                      </View>
                    </TouchableOpacity>
                  )}

                  {/* Item Content */}
                  {(item.expanded || isSingleItem) && (
                    <View style={[styles.itemContent, items.length > 1 && styles.itemContentBordered]}>
                      {/* Item name and amount */}
                      <View style={styles.itemInputRow}>
                        <View style={styles.itemNameInputContainer}>
                          <Text style={styles.inputLabel}>Name</Text>
                          <TextInput
                            style={styles.itemInput}
                            placeholder="e.g., Nasi Lemak"
                            placeholderTextColor={COLORS.textMuted}
                            value={item.name}
                            onChangeText={(text) => updateItemField(item.id, 'name', text)}
                            maxLength={50}
                          />
                        </View>
                        <View style={styles.itemAmountInputContainer}>
                          <Text style={styles.inputLabel}>Amount</Text>
                          <View style={styles.itemAmountWrapper}>
                            <Text style={styles.itemAmountPrefix}>RM</Text>
                            <TextInput
                              style={styles.itemAmountInput}
                              placeholder="0.00"
                              placeholderTextColor={COLORS.textMuted}
                              keyboardType="decimal-pad"
                              value={item.amount}
                              onChangeText={(text) => updateItemField(item.id, 'amount', validateAmountInput(text))}
                            />
                          </View>
                        </View>
                      </View>

                      {/* Split Logic */}
                      {itemAmount > 0 && groupMembers.length > 0 && (
                        <View style={styles.itemSplitSection}>
                          <Text style={styles.inputLabel}>Split</Text>
                          <SplitLogic
                            key={`split-${item.id}-${groupMembers.length}`}
                            amount={itemAmount}
                            users={groupMembers}
                            currentUserId={userId || undefined}
                            initialShares={item.originalSplits as InitialSplitShare[] | undefined}
                            onChange={(result) => handleSplitChange(item.id, result)}
                          />
                        </View>
                      )}

                      {/* Done button for multi-item */}
                      {items.length > 1 && hasValidSplit && (
                        <TouchableOpacity
                          style={styles.doneButton}
                          onPress={() => closeItem(item.id)}
                        >
                          <Check color={COLORS.primary} size={16} />
                          <Text style={styles.doneButtonText}>Done</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  )}
                </View>
              );
            })}

            {/* Add Item Button */}
            <TouchableOpacity style={styles.addItemButton} onPress={addItem}>
              <Plus color={COLORS.primary} size={18} />
              <Text style={styles.addItemText}>Add another item</Text>
            </TouchableOpacity>

            {/* Items Total */}
            {items.length > 1 && (
              <View style={styles.itemsTotalContainer}>
                <Text style={styles.itemsTotalLabel}>Total</Text>
                <Text style={styles.itemsTotalAmount}>
                  RM {formatMoney(itemsTotal)}
                </Text>
              </View>
            )}
          </View>

          <View style={styles.bottomPadding} />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Success Modal */}
      <SuccessModal
        visible={showSuccessModal}
        title="Changes Saved"
        message="Your expense has been updated and all balances have been recalculated."
        onDismiss={() => {
          setShowSuccessModal(false);
          onSuccess?.();
          onClose();
        }}
      />

      {/* Alert Modal */}
      <AlertModal
        visible={alertModal.visible}
        type="warning"
        title={alertModal.title}
        message={alertModal.message}
        onDismiss={() => setAlertModal({ ...alertModal, visible: false })}
      />
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
    width: 60,
  },
  submitButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    color: COLORS.textPrimary,
    fontSize: 14,
    fontWeight: 'bold',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  section: {
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  itemsCount: {
    fontSize: 12,
    color: COLORS.textMuted,
  },
  input: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    height: 52,
    minHeight: 52,
    paddingHorizontal: 16,
    fontSize: 16,
    color: COLORS.textPrimary,
    // @ts-ignore - web specific
    outlineStyle: 'none',
  },
  payerContainer: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    overflow: 'hidden',
  },
  payerOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  payerOptionActive: {
    backgroundColor: 'rgba(0, 168, 107, 0.1)',
  },
  payerRadio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  payerRadioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.primary,
  },
  payerAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.cardElevated,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  payerName: {
    flex: 1,
    fontSize: 15,
    color: COLORS.textPrimary,
  },
  payerIcon: {
    marginLeft: 8,
  },
  itemCard: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    marginBottom: 10,
    overflow: 'hidden',
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
  },
  itemHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  itemHeaderTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginLeft: 10,
  },
  itemHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  itemHeaderAmount: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginRight: 8,
  },
  validBadge: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(0, 168, 107, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  removeItemButton: {
    padding: 6,
    marginRight: 4,
  },
  itemContent: {
    padding: 14,
  },
  itemContentBordered: {
    paddingTop: 0,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  itemInputRow: {
    flexDirection: 'row',
    marginTop: 12,
    marginBottom: 12,
  },
  itemNameInputContainer: {
    flex: 2,
    marginRight: 10,
  },
  itemAmountInputContainer: {
    flex: 1,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textMuted,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  itemInput: {
    backgroundColor: COLORS.cardElevated,
    borderRadius: 8,
    height: 44,
    minHeight: 44,
    paddingHorizontal: 12,
    fontSize: 15,
    // @ts-ignore - web specific
    outlineStyle: 'none',
    color: COLORS.textPrimary,
  },
  itemAmountWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.cardElevated,
    borderRadius: 8,
    height: 44,
    paddingHorizontal: 10,
  },
  itemAmountPrefix: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginRight: 4,
  },
  itemAmountInput: {
    flex: 1,
    fontSize: 15,
    color: COLORS.textPrimary,
    minHeight: 36,
    // @ts-ignore - web specific
    outlineStyle: 'none',
  },
  itemSplitSection: {
    marginTop: 12,
  },
  doneButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 168, 107, 0.1)',
    borderRadius: 8,
    paddingVertical: 10,
    marginTop: 12,
  },
  doneButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.primary,
    marginLeft: 6,
  },
  addItemButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 168, 107, 0.1)',
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(0, 168, 107, 0.3)',
    borderStyle: 'dashed',
  },
  addItemText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.primary,
    marginLeft: 8,
  },
  itemsTotalContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.cardElevated,
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
  },
  itemsTotalLabel: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  itemsTotalAmount: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.primary,
  },
  bottomPadding: {
    height: 40,
  },
});

export default EditExpenseModal;

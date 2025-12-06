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
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import {
  X,
  Search,
  Users,
  User,
  ChevronDown,
  ChevronUp,
  Receipt,
  Check,
  Plus,
  Trash2,
  Wallet,
  AlertTriangle,
} from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import { SuccessModal } from './SuccessModal';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../convex/_generated/api';
import { Id } from '../convex/_generated/dataModel';
import { SplitLogic, SplitResult, SplitUser } from './SplitLogic';

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

interface SelectedParticipant {
  id: string;
  type: 'user' | 'group';
  name: string;
  username?: string;
  memberCount?: number;
}

interface ExpenseItem {
  id: string;
  name: string;
  amount: string;
  splitResult: SplitResult | null;
  expanded: boolean;
}

interface AddExpenseModalProps {
  visible: boolean;
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

export const AddExpenseModal: React.FC<AddExpenseModalProps> = ({
  visible,
  onClose,
  onSuccess,
}) => {
  const { userId } = useAuth();
  
  // Form state
  const [description, setDescription] = useState('');
  const [totalAmountStr, setTotalAmountStr] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchResults, setShowSearchResults] = useState(true);
  const [selectedParticipants, setSelectedParticipants] = useState<SelectedParticipant[]>([]);
  const [payerId, setPayerId] = useState<string | null>(null);
  const [itemMode, setItemMode] = useState<'single' | 'multiple'>('single');
  const [items, setItems] = useState<ExpenseItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  // Use refs to store split results to avoid re-render loops
  const splitResultsRef = useRef<Record<string, SplitResult>>({});

  // Fetch data
  const dashboard = useQuery(api.queries.getDashboard, 
    userId ? { userId: userId as Id<'users'> } : 'skip'
  );
  const friends = useQuery(api.queries.getFriends,
    userId ? { userId: userId as Id<'users'> } : 'skip'
  );
  const currentUser = useQuery(api.auth.getUser,
    userId ? { userId: userId as Id<'users'> } : 'skip'
  );

  // Get selected group ID if a group is selected
  const selectedGroupId = useMemo(() => {
    const selectedGroup = selectedParticipants.find(p => p.type === 'group');
    return selectedGroup?.id || null;
  }, [selectedParticipants]);

  // Fetch group details when a group is selected
  const groupDetails = useQuery(
    api.queries.getGroup,
    selectedGroupId ? { groupId: selectedGroupId as Id<'groups'> } : 'skip'
  );

  // Mutations
  const addExpense = useMutation(api.mutations.addExpense);

  // Reset form when modal opens
  useEffect(() => {
    if (visible) {
      setDescription('');
      setTotalAmountStr('');
      setSearchQuery('');
      setShowSearchResults(true);
      setSelectedParticipants([]);
      setPayerId(userId || null);
      setItemMode('single');
      setItems([{
        id: generateId(),
        name: '',
        amount: '',
        splitResult: null,
        expanded: true,
      }]);
      splitResultsRef.current = {};
    }
  }, [visible, userId]);

  // Search results - show all when focused, filter when typing
  // Friends first, then groups (sorted by most recent activity if available)
  const searchResults = useMemo(() => {
    const selectedIds = new Set(selectedParticipants.map(p => p.id));
    const query = searchQuery.toLowerCase().trim();
    
    // Get all available friends (not already selected)
    let availableUsers = (friends || [])
      .filter(f => !selectedIds.has(f.userId));
    
    // Get all available groups (not already selected)
    let availableGroups = (dashboard?.groups || [])
      .filter(g => !selectedIds.has(g.id));
    
    // If there's a search query, filter by it
    if (query) {
      availableUsers = availableUsers.filter(f => 
        f.username.toLowerCase().includes(query) || 
        (f.name && f.name.toLowerCase().includes(query))
      );
      
      availableGroups = availableGroups.filter(g => 
        g.name.toLowerCase().includes(query)
      );
      
      // Show more results when actively searching
      return { 
        users: availableUsers.slice(0, 5), 
        groups: availableGroups.slice(0, 5) 
      };
    }
    
    // Limit results when not searching (default view)
    return { 
      users: availableUsers.slice(0, 3), 
      groups: availableGroups.slice(0, 2) 
    };
  }, [searchQuery, dashboard?.groups, friends, selectedParticipants]);

  // Get all participants for splits from selected group or individual users
  const allParticipants = useMemo((): SplitUser[] => {
    const participants: SplitUser[] = [];
    const addedIds = new Set<string>();
    
    // If a group is selected, use group members
    if (groupDetails?.members) {
      for (const member of groupDetails.members) {
        if (!addedIds.has(member.userId)) {
          participants.push({
            userId: member.userId,
            username: member.username,
            name: member.name,
          });
          addedIds.add(member.userId);
        }
      }
    } else {
      // Otherwise, use individual users selected
      // Always include current user first
      if (currentUser && userId && !addedIds.has(userId)) {
        participants.push({
          userId: userId,
          username: currentUser.username,
          name: currentUser.name,
        });
        addedIds.add(userId);
      }
      
      // Add selected users
      for (const participant of selectedParticipants) {
        if (participant.type === 'user' && !addedIds.has(participant.id)) {
          participants.push({
            userId: participant.id,
            username: participant.username || participant.name,
            name: participant.name,
          });
          addedIds.add(participant.id);
        }
      }
    }
    
    return participants;
  }, [groupDetails, selectedParticipants, currentUser, userId]);

  // Select a participant
  const selectParticipant = (participant: SelectedParticipant): void => {
    setSelectedParticipants(prev => [...prev, participant]);
    setSearchQuery('');
    // Keep showing results so user can add more participants
  };

  // Remove a participant
  const removeParticipant = (id: string): void => {
    setSelectedParticipants(prev => prev.filter(p => p.id !== id));
  };

  // Total amount as number
  const totalAmount = parseFloat(totalAmountStr) || 0;

  // Add item
  const addItem = (): void => {
    // If this is the first time adding (going from 1 to 2 items),
    // keep the first item expanded so user can name it
    const isFirstAdd = items.length === 1;
    
    const newItem: ExpenseItem = {
      id: generateId(),
      name: '',
      amount: '',
      splitResult: null,
      expanded: true,
    };
    
    if (isFirstAdd) {
      // Keep first item expanded too so user can name it
      setItems(prev => [
        ...prev.map(i => ({ ...i, expanded: true })),
        newItem,
      ]);
    } else {
      // Collapse other items, expand new one
      setItems(prev => [
        ...prev.map(i => ({ ...i, expanded: false })),
        newItem,
      ]);
    }
  };

  // Remove item
  const removeItem = (itemId: string): void => {
    if (items.length <= 1) {
      Alert.alert('Error', 'You need at least one item');
      return;
    }
    setItems(prev => prev.filter(i => i.id !== itemId));
    delete splitResultsRef.current[itemId];
  };

  // Toggle item expansion
  const toggleItemExpansion = (itemId: string): void => {
    setItems(prev => prev.map(item => ({
      ...item,
      expanded: item.id === itemId ? !item.expanded : false,
    })));
  };

  // Close/done with item (collapse it)
  const closeItem = (itemId: string): void => {
    setItems(prev => prev.map(item => ({
      ...item,
      expanded: item.id === itemId ? false : item.expanded,
    })));
  };

  // Update item name/amount
  const updateItemField = (itemId: string, field: 'name' | 'amount', value: string): void => {
    setItems(prev => prev.map(item => 
      item.id === itemId ? { ...item, [field]: value } : item
    ));
  };

  // Handle split result change - store in ref to avoid re-render loop
  const handleSplitChange = useCallback((itemId: string, result: SplitResult) => {
    splitResultsRef.current[itemId] = result;
    // Update the item's splitResult in state only once
    setItems(prev => {
      const item = prev.find(i => i.id === itemId);
      if (item && JSON.stringify(item.splitResult) !== JSON.stringify(result)) {
        return prev.map(i => i.id === itemId ? { ...i, splitResult: result } : i);
      }
      return prev;
    });
  }, []);

  // Calculate items total
  const itemsTotal = useMemo(() => {
    return roundMoney(items.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0));
  }, [items]);

  // Check if totals match (for multi-item)
  const totalsMatch = items.length === 1 || itemsTotal === roundMoney(totalAmount);
  const totalsDiff = roundMoney(totalAmount - itemsTotal);

  // Check if all splits are valid
  const allSplitsValid = useMemo(() => {
    return items.every(item => {
      const result = splitResultsRef.current[item.id] || item.splitResult;
      const itemAmount = parseFloat(item.amount) || 0;
      return itemAmount > 0 && result?.isValid;
    });
  }, [items]);

  // Validate amount input
  const validateAmountInput = (text: string): string => {
    const cleaned = text.replace(/[^0-9.]/g, '');
    const parts = cleaned.split('.');
    // Only allow one decimal point
    let formatted = parts.length > 2 
      ? parts[0] + '.' + parts.slice(1).join('')
      : cleaned;
    // Limit to 2 decimal places
    if (parts.length === 2 && parts[1].length > 2) {
      formatted = parts[0] + '.' + parts[1].substring(0, 2);
    }
    // Prevent amounts over 999999.99
    const num = parseFloat(formatted);
    if (num > 999999.99) {
      return '999999.99';
    }
    return formatted;
  };

  // Validate form
  const validateForm = (): string | null => {
    if (!description.trim()) {
      return 'Please enter a description';
    }
    if (totalAmount <= 0) {
      return 'Please enter a valid amount';
    }
    if (totalAmount > 999999.99) {
      return 'Amount cannot exceed RM 999,999.99';
    }
    if (selectedParticipants.length === 0) {
      return 'Please select at least one person to split with';
    }
    if (!payerId) {
      return 'Please select who paid';
    }
    for (const item of items) {
      const itemAmount = parseFloat(item.amount) || 0;
      if (itemMode === 'multiple' && !item.name.trim()) {
        return 'Please name all subitems';
      }
      if (itemAmount <= 0) {
        return itemMode === 'multiple' ? 'All subitems need an amount' : 'Please enter the item amount';
      }
      if (itemAmount > totalAmount) {
        return `Subitem "${item.name || 'item'}" amount cannot exceed total`;
      }
      const result = splitResultsRef.current[item.id] || item.splitResult;
      if (!result?.isValid) {
        return itemMode === 'multiple' ? `Please complete the split for "${item.name || 'item'}"` : 'Please complete the split';
      }
    }
    if (!totalsMatch) {
      return `Subitems total (RM ${formatMoney(itemsTotal)}) doesn't match expense total (RM ${formatMoney(totalAmount)})`;
    }
    return null;
  };

  // Handle submit
  const handleSubmit = async (): Promise<void> => {
    const error = validateForm();
    if (error) {
      Alert.alert('Validation Error', error);
      return;
    }

    if (!userId || !payerId) return;

    setIsSubmitting(true);

    try {
      // Check if a group is selected
      const selectedGroup = selectedParticipants.find(p => p.type === 'group');
      
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

      // If a group is selected, use groupId; otherwise use participantIds
      const result = selectedGroup 
        ? await addExpense({
            userId: payerId as Id<'users'>,
            groupId: selectedGroup.id as Id<'groups'>,
            description: description.trim(),
            items: expenseItems,
          })
        : await addExpense({
            userId: payerId as Id<'users'>,
            participantIds: allParticipants.map(p => p.userId as Id<'users'>),
            description: description.trim(),
            items: expenseItems,
          });

      if (result.success) {
        setShowSuccessModal(true);
      } else {
        Alert.alert('Error', result.error || 'Failed to add expense');
      }
    } catch (error) {
      console.error('Add expense error:', error);
      Alert.alert('Error', 'Something went wrong');
    } finally {
      setIsSubmitting(false);
    }
  };

  const hasParticipants = selectedParticipants.length > 0;
  const hasAmount = totalAmount > 0;
  const hasPayer = payerId !== null;
  const isSingleItem = itemMode === 'single';

  // For single item mode, auto-set its amount to total
  useEffect(() => {
    if (isSingleItem && totalAmount > 0 && items.length > 0) {
      const item = items[0];
      if (item && item.amount !== totalAmountStr) {
        setItems(prev => prev.map((i, idx) => 
          idx === 0 ? { ...i, amount: totalAmountStr } : i
        ));
      }
    }
  }, [totalAmountStr, isSingleItem]);

  // Check if can submit
  const canSubmit = allSplitsValid && hasPayer && totalsMatch && !isSubmitting;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
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
          <Text style={styles.headerTitle}>Add Expense</Text>
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
          {/* Search Bar for Participants */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Split with</Text>
            <View style={styles.searchContainer}>
              {/* Selected Chips */}
              {selectedParticipants.map(participant => (
                <View key={participant.id} style={styles.chip}>
                  {participant.type === 'group' ? (
                    <Users color={COLORS.textPrimary} size={14} />
                  ) : (
                    <User color={COLORS.textPrimary} size={14} />
                  )}
                  <Text style={styles.chipText}>{participant.name}</Text>
                  <TouchableOpacity onPress={() => removeParticipant(participant.id)}>
                    <X color={COLORS.textSecondary} size={14} />
                  </TouchableOpacity>
                </View>
              ))}
              
              {/* Search Input */}
              <View style={styles.searchInputWrapper}>
                <Search color={COLORS.textMuted} size={18} />
                <TextInput
                  style={styles.searchInput}
                  placeholder={selectedParticipants.length > 0 ? "Add more or change..." : "Search groups or friends..."}
                  placeholderTextColor={COLORS.textMuted}
                  value={searchQuery}
                  onChangeText={(text) => {
                    setSearchQuery(text);
                    setShowSearchResults(true);
                  }}
                  onFocus={() => setShowSearchResults(true)}
                />
              </View>
            </View>

            {/* Search Results Dropdown */}
            {/* Search Results Dropdown - shows all available when focused, filters as you type */}
            {showSearchResults && (
              <View style={styles.searchResults}>
                {searchResults.users.length > 0 || searchResults.groups.length > 0 ? (
                  <>
                    {/* Friends first */}
                    {searchResults.users.length > 0 && (
                      <>
                        <Text style={styles.searchResultsHeader}>Friends</Text>
                        {searchResults.users.map(friend => (
                          <TouchableOpacity
                            key={friend.userId}
                            style={styles.searchResultItem}
                            onPress={() => selectParticipant({
                              id: friend.userId,
                              type: 'user',
                              name: friend.name || friend.username,
                              username: friend.username,
                            })}
                          >
                            <User color={COLORS.textSecondary} size={18} />
                            <View style={styles.searchResultInfo}>
                              <Text style={styles.searchResultName}>{friend.username}</Text>
                              {friend.name && <Text style={styles.searchResultMeta}>{friend.name}</Text>}
                            </View>
                          </TouchableOpacity>
                        ))}
                      </>
                    )}
                    {/* Groups second */}
                    {searchResults.groups.length > 0 && (
                      <>
                        <Text style={styles.searchResultsHeader}>Groups</Text>
                        {searchResults.groups.map(group => (
                          <TouchableOpacity
                            key={group.id}
                            style={styles.searchResultItem}
                            onPress={() => selectParticipant({
                              id: group.id,
                              type: 'group',
                              name: group.name,
                              memberCount: group.memberCount,
                            })}
                          >
                            <Users color={COLORS.primary} size={18} />
                            <View style={styles.searchResultInfo}>
                              <Text style={styles.searchResultName}>{group.name}</Text>
                              <Text style={styles.searchResultMeta}>{group.memberCount} members</Text>
                            </View>
                          </TouchableOpacity>
                        ))}
                      </>
                    )}
                  </>
                ) : (
                  <>
                    <Text style={styles.noResultsText}>
                      {searchQuery.trim() ? 'No matches found' : 'No friends or groups yet'}
                    </Text>
                    <Text style={styles.noResultsHint}>
                      {searchQuery.trim() ? 'Try a different search' : 'Add friends to get started'}
                    </Text>
                  </>
                )}
              </View>
            )}
          </View>

          {/* Rest of form only shows after selecting participants */}
          {hasParticipants && (
            <>
              {/* Who Paid */}
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>Who paid?</Text>
                <View style={styles.payerContainer}>
                  {allParticipants.map(participant => (
                    <TouchableOpacity
                      key={participant.userId}
                      style={[
                        styles.payerOption,
                        payerId === participant.userId && styles.payerOptionActive,
                      ]}
                      onPress={() => setPayerId(participant.userId)}
                    >
                      <View style={styles.payerRadio}>
                        {payerId === participant.userId && (
                          <View style={styles.payerRadioInner} />
                        )}
                      </View>
                      <View style={styles.payerAvatar}>
                        <User color={COLORS.textPrimary} size={16} />
                      </View>
                      <Text style={styles.payerName}>
                        {participant.userId === userId ? 'You' : participant.username}
                      </Text>
                      {payerId === participant.userId && (
                        <Wallet color={COLORS.primary} size={16} style={styles.payerIcon} />
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

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

              {/* Total Amount */}
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>Total Amount</Text>
                <View style={styles.amountInputContainer}>
                  <Text style={styles.amountPrefix}>RM</Text>
                  <TextInput
                    style={styles.amountInput}
                    placeholder="0.00"
                    placeholderTextColor={COLORS.textMuted}
                    keyboardType="decimal-pad"
                    value={totalAmountStr}
                    onChangeText={(text) => setTotalAmountStr(validateAmountInput(text))}
                  />
                </View>
              </View>

              {/* Item Mode Toggle - only show after amount entered */}
              {hasAmount && (
                <View style={styles.itemModeSection}>
                  <Text style={styles.sectionLabel}>Split type</Text>
                  <View style={styles.itemModeToggle}>
                    <TouchableOpacity
                      style={[
                        styles.itemModeButton,
                        itemMode === 'single' && styles.itemModeButtonActive,
                      ]}
                      onPress={() => {
                        setItemMode('single');
                        // Reset to single item
                        setItems([{
                          id: generateId(),
                          name: '',
                          amount: totalAmountStr,
                          splitResult: null,
                          expanded: true,
                        }]);
                        splitResultsRef.current = {};
                      }}
                    >
                      <Text style={[
                        styles.itemModeButtonText,
                        itemMode === 'single' && styles.itemModeButtonTextActive,
                      ]}>
                        Single item
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.itemModeButton,
                        itemMode === 'multiple' && styles.itemModeButtonActive,
                      ]}
                      onPress={() => {
                        setItemMode('multiple');
                        // Start with one item for multiple mode
                        if (items.length === 1 && !items[0].name) {
                          setItems([{
                            id: generateId(),
                            name: '',
                            amount: '',
                            splitResult: null,
                            expanded: true,
                          }]);
                          splitResultsRef.current = {};
                        }
                      }}
                    >
                      <Text style={[
                        styles.itemModeButtonText,
                        itemMode === 'multiple' && styles.itemModeButtonTextActive,
                      ]}>
                        Multiple items
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* Split Section - only show after amount entered */}
              {hasAmount && (
                <View style={styles.section}>
                  <View style={styles.sectionHeader}>
                    <Text style={styles.sectionLabel}>Each person's share</Text>
                    {itemMode === 'multiple' && items.length > 0 && (
                      <Text style={styles.itemsCount}>{items.length} subitem{items.length !== 1 ? 's' : ''}</Text>
                    )}
                  </View>

                  {/* Items */}
                  {items.map((item, index) => {
                    const itemAmount = parseFloat(item.amount) || 0;
                    const hasValidSplit = splitResultsRef.current[item.id]?.isValid || item.splitResult?.isValid;
                    const itemExceedsTotal = itemMode === 'multiple' && itemAmount > totalAmount;
                    const isMultiple = itemMode === 'multiple';

                    return (
                      <View key={item.id} style={styles.itemCard}>
                        {/* Item Header - only show if multiple items mode */}
                        {isMultiple && (
                          <TouchableOpacity
                            style={styles.itemHeader}
                            onPress={() => toggleItemExpansion(item.id)}
                          >
                            <View style={styles.itemHeaderLeft}>
                              <Receipt color={COLORS.primary} size={18} />
                              <Text style={styles.itemHeaderTitle}>
                                {item.name || `Subitem ${index + 1}`}
                              </Text>
                            </View>
                            <View style={styles.itemHeaderRight}>
                              {itemAmount > 0 && (
                                <Text style={styles.itemHeaderAmount}>
                                  RM {formatMoney(itemAmount)}
                                </Text>
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

                        {/* Item Content - always show for single item mode */}
                        {(item.expanded || !isMultiple) && (
                          <View style={[styles.itemContent, isMultiple && styles.itemContentBordered]}>
                            {/* Item name and amount - only for multiple items mode */}
                            {isMultiple && (
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
                                  <View style={[styles.itemAmountWrapper, itemExceedsTotal && styles.itemAmountWrapperError]}>
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
                            )}

                            {/* Split Logic */}
                            {(!isMultiple ? totalAmount : itemAmount) > 0 && (
                              <View style={isMultiple ? styles.itemSplitSection : undefined}>
                                <SplitLogic
                                  key={`split-${item.id}-${allParticipants.length}`}
                                  amount={!isMultiple ? totalAmount : itemAmount}
                                  users={allParticipants}
                                  currentUserId={userId || undefined}
                                  onChange={(result) => handleSplitChange(item.id, result)}
                                />
                              </View>
                            )}

                            {/* Done button for multi-item mode */}
                            {isMultiple && hasValidSplit && (
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

                  {/* Add Item Button - only for multiple items mode */}
                  {itemMode === 'multiple' && (
                    <TouchableOpacity style={styles.addItemButton} onPress={addItem}>
                      <Plus color={COLORS.primary} size={18} />
                      <Text style={styles.addItemText}>Add another subitem</Text>
                    </TouchableOpacity>
                  )}

                  {/* Overall Expense Validation Status */}
                  {itemMode === 'multiple' && !totalsMatch && (
                    <View style={styles.totalsMismatchContainer}>
                      <AlertTriangle color={COLORS.warning} size={16} />
                      <View style={styles.totalsMismatchInfo}>
                        <Text style={styles.totalsMismatchText}>
                          {totalsDiff > 0 
                            ? `RM ${formatMoney(totalsDiff)} remaining to allocate`
                            : `RM ${formatMoney(Math.abs(totalsDiff))} over the total`}
                        </Text>
                        <Text style={styles.totalsMismatchSubtext}>
                          Subitems: RM {formatMoney(itemsTotal)} • Total: RM {formatMoney(totalAmount)}
                        </Text>
                      </View>
                    </View>
                  )}

                  {/* Success state for expense - show when totals match AND all splits valid */}
                  {totalsMatch && allSplitsValid && totalAmount > 0 && (
                    <View style={styles.itemsTotalContainerSuccess}>
                      <Check color={COLORS.primary} size={16} />
                      <Text style={styles.itemsTotalAmountSuccess}>
                        {itemMode === 'multiple' 
                          ? `All subitems allocated • RM ${formatMoney(totalAmount)}`
                          : `Split complete • RM ${formatMoney(totalAmount)}`}
                      </Text>
                    </View>
                  )}

                  {/* Partial state - totals match but splits not complete */}
                  {totalsMatch && !allSplitsValid && totalAmount > 0 && (
                    <View style={styles.totalsPendingContainer}>
                      <Text style={styles.totalsPendingText}>
                        Complete the split to continue
                      </Text>
                    </View>
                  )}
                </View>
              )}
            </>
          )}

          <View style={styles.bottomPadding} />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Success Modal */}
      <SuccessModal
        visible={showSuccessModal}
        title="All Done!"
        message="Your expense has been recorded and everyone's balance has been updated."
        onDismiss={() => {
          setShowSuccessModal(false);
          onSuccess?.();
          onClose();
        }}
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
  itemModeSection: {
    marginBottom: 20,
  },
  itemModeToggle: {
    flexDirection: 'row',
    backgroundColor: COLORS.cardElevated,
    borderRadius: 10,
    padding: 4,
  },
  itemModeButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  itemModeButtonActive: {
    backgroundColor: COLORS.primary,
  },
  itemModeButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.textSecondary,
  },
  itemModeButtonTextActive: {
    color: COLORS.textPrimary,
    fontWeight: '600',
  },
  itemsCount: {
    fontSize: 12,
    color: COLORS.textMuted,
  },
  searchContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: 8,
    minHeight: 52,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginRight: 6,
    marginBottom: 4,
    marginTop: 4,
  },
  chipText: {
    fontSize: 13,
    color: COLORS.textPrimary,
    marginHorizontal: 6,
  },
  searchInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    minWidth: 120,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: COLORS.textPrimary,
    marginLeft: 8,
    paddingVertical: 8,
  },
  searchResults: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    marginTop: 8,
    overflow: 'hidden',
  },
  searchResultsHeader: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textMuted,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 4,
    textTransform: 'uppercase',
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  searchResultInfo: {
    marginLeft: 12,
  },
  searchResultName: {
    fontSize: 15,
    color: COLORS.textPrimary,
    fontWeight: '500',
  },
  searchResultMeta: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  noResultsText: {
    fontSize: 14,
    color: COLORS.textMuted,
    paddingTop: 16,
    paddingHorizontal: 16,
    textAlign: 'center',
  },
  noResultsHint: {
    fontSize: 12,
    color: COLORS.textSecondary,
    paddingBottom: 16,
    paddingHorizontal: 16,
    textAlign: 'center',
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
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  payerName: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    color: COLORS.textPrimary,
  },
  payerIcon: {
    marginLeft: 8,
  },
  input: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    height: 52,
    paddingHorizontal: 16,
    fontSize: 16,
    color: COLORS.textPrimary,
  },
  amountInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    height: 56,
    paddingHorizontal: 16,
  },
  amountPrefix: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginRight: 8,
    minWidth: 32,
  },
  amountInput: {
    flex: 1,
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
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
  itemHeaderAmountError: {
    color: COLORS.warning,
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
  warningBadge: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(255, 184, 0, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  removeItemButton: {
    padding: 6,
    marginRight: 4,
  },
  itemContent: {
    padding: 0,
  },
  itemContentBordered: {
    padding: 14,
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
    paddingHorizontal: 12,
    fontSize: 15,
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
  itemAmountWrapperError: {
    borderWidth: 1,
    borderColor: COLORS.warning,
  },
  itemAmountPrefix: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginRight: 4,
    minWidth: 26,
  },
  itemAmountInput: {
    flex: 1,
    fontSize: 15,
    color: COLORS.textPrimary,
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
    minWidth: 40,
  },
  totalsMismatchContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(255, 184, 0, 0.08)',
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 184, 0, 0.2)',
  },
  totalsMismatchInfo: {
    marginLeft: 10,
    flex: 1,
  },
  totalsMismatchText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.warning,
  },
  totalsMismatchSubtext: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
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
    width: '100%',
  },
  addItemText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.primary,
    marginLeft: 8,
    textAlign: 'center',
  },
  itemsTotalContainerSuccess: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 168, 107, 0.1)',
    borderRadius: 8,
    padding: 10,
    marginTop: 10,
  },
  itemsTotalAmountSuccess: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.primary,
    marginLeft: 6,
  },
  totalsPendingContainer: {
    alignItems: 'center',
    padding: 10,
    marginTop: 10,
  },
  totalsPendingText: {
    fontSize: 13,
    color: COLORS.textMuted,
    fontStyle: 'italic',
  },
  bottomPadding: {
    height: 40,
  },
});

export default AddExpenseModal;

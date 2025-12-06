import React, { useState, useEffect, useMemo } from 'react';
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
import { X, Search, User, Check, Users } from 'lucide-react-native';
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
  textPrimary: '#FFFFFF',
  textSecondary: '#B3B3B3',
  textMuted: '#666666',
  border: '#333333',
};

interface CreateGroupModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess?: (groupId: string) => void;
}

export const CreateGroupModal: React.FC<CreateGroupModalProps> = ({
  visible,
  onClose,
  onSuccess,
}) => {
  const { userId } = useAuth();
  
  const [groupName, setGroupName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFriendIds, setSelectedFriendIds] = useState<Set<string>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch friends
  const friends = useQuery(api.queries.getFriends,
    userId ? { userId: userId as Id<'users'> } : 'skip'
  );

  // Mutation
  const createGroup = useMutation(api.mutations.createGroup);

  // Reset form when modal opens
  useEffect(() => {
    if (visible) {
      setGroupName('');
      setSearchQuery('');
      setSelectedFriendIds(new Set());
    }
  }, [visible]);

  // Filtered friends based on search
  const filteredFriends = useMemo(() => {
    if (!friends) return [];
    if (!searchQuery.trim()) return friends;
    
    const query = searchQuery.toLowerCase();
    return friends.filter(f => 
      f.username.toLowerCase().includes(query) ||
      (f.name && f.name.toLowerCase().includes(query))
    );
  }, [friends, searchQuery]);

  // Toggle friend selection
  const toggleFriend = (friendId: string): void => {
    setSelectedFriendIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(friendId)) {
        newSet.delete(friendId);
      } else {
        newSet.add(friendId);
      }
      return newSet;
    });
  };

  // Validate and submit
  const handleSubmit = async (): Promise<void> => {
    if (!groupName.trim()) {
      Alert.alert('Error', 'Please enter a group name');
      return;
    }
    if (selectedFriendIds.size === 0) {
      Alert.alert('Error', 'Please select at least one friend');
      return;
    }
    if (!userId) return;

    setIsSubmitting(true);

    try {
      const memberIds = Array.from(selectedFriendIds).map(id => id as Id<'users'>);
      
      const result = await createGroup({
        userId: userId as Id<'users'>,
        name: groupName.trim(),
        members: memberIds,
      });

      if (result.success && result.groupId) {
        Alert.alert('Success', `Group "${groupName}" created!`);
        onSuccess?.(result.groupId);
        onClose();
      } else {
        Alert.alert('Error', result.error || 'Failed to create group');
      }
    } catch (error) {
      console.error('Create group error:', error);
      Alert.alert('Error', 'Something went wrong');
    } finally {
      setIsSubmitting(false);
    }
  };

  const canSubmit = groupName.trim().length > 0 && selectedFriendIds.size > 0 && !isSubmitting;

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
          <Text style={styles.headerTitle}>New Group</Text>
          <TouchableOpacity
            style={[styles.submitButton, !canSubmit && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={!canSubmit}
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color={COLORS.textPrimary} />
            ) : (
              <Text style={styles.submitButtonText}>Create</Text>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
          {/* Group Icon & Name */}
          <View style={styles.groupIconSection}>
            <View style={styles.groupIconLarge}>
              <Users color={COLORS.textPrimary} size={40} />
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Group Name</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., Apartment, Trip to Langkawi"
              placeholderTextColor={COLORS.textMuted}
              value={groupName}
              onChangeText={setGroupName}
              maxLength={50}
            />
          </View>

          {/* Friends Search */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Add Members</Text>
            <View style={styles.searchContainer}>
              <Search color={COLORS.textMuted} size={18} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search friends..."
                placeholderTextColor={COLORS.textMuted}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
            </View>
          </View>

          {/* Selected Count */}
          {selectedFriendIds.size > 0 && (
            <View style={styles.selectedCountContainer}>
              <Text style={styles.selectedCountText}>
                {selectedFriendIds.size} member{selectedFriendIds.size !== 1 ? 's' : ''} selected
              </Text>
            </View>
          )}

          {/* Friends List */}
          <View style={styles.friendsList}>
            {filteredFriends.length > 0 ? (
              filteredFriends.map((friend) => {
                const isSelected = selectedFriendIds.has(friend.userId);
                return (
                  <TouchableOpacity
                    key={friend.friendshipId}
                    style={[styles.friendItem, isSelected && styles.friendItemSelected]}
                    onPress={() => toggleFriend(friend.userId)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.friendInfo}>
                      <View style={[styles.avatar, isSelected && styles.avatarSelected]}>
                        <User color={COLORS.textPrimary} size={18} />
                      </View>
                      <View>
                        <Text style={styles.friendName}>{friend.username}</Text>
                        {friend.name && (
                          <Text style={styles.friendFullName}>{friend.name}</Text>
                        )}
                      </View>
                    </View>
                    <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
                      {isSelected && <Check color={COLORS.textPrimary} size={14} />}
                    </View>
                  </TouchableOpacity>
                );
              })
            ) : (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>
                  {searchQuery ? 'No friends found' : 'No friends yet'}
                </Text>
                <Text style={styles.emptySubtext}>
                  {searchQuery ? 'Try a different search' : 'Add friends to create groups'}
                </Text>
              </View>
            )}
          </View>

          <View style={styles.bottomPadding} />
        </ScrollView>
      </KeyboardAvoidingView>
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
  groupIconSection: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  groupIconLarge: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  section: {
    marginBottom: 20,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
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
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 48,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: COLORS.textPrimary,
    marginLeft: 10,
  },
  selectedCountContainer: {
    backgroundColor: 'rgba(0, 168, 107, 0.1)',
    borderRadius: 8,
    padding: 10,
    marginBottom: 16,
  },
  selectedCountText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.primary,
    textAlign: 'center',
  },
  friendsList: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    overflow: 'hidden',
  },
  friendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  friendItemSelected: {
    backgroundColor: 'rgba(0, 168, 107, 0.08)',
  },
  friendInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.cardElevated,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarSelected: {
    backgroundColor: COLORS.primary,
  },
  friendName: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  friendFullName: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 1,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  emptyState: {
    padding: 32,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  emptySubtext: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  bottomPadding: {
    height: 40,
  },
});

export default CreateGroupModal;


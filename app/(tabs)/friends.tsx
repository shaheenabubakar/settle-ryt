import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  Modal, 
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { UserPlus, X, Check, User } from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { Id } from '../../convex/_generated/dataModel';

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

export default function FriendsScreen(): React.ReactElement {
  const { userId } = useAuth();
  const [showAddModal, setShowAddModal] = useState(false);
  const [friendUsername, setFriendUsername] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [addError, setAddError] = useState('');

  // Fetch friends and pending requests
  const friends = useQuery(
    api.queries.getFriends,
    userId ? { userId: userId as Id<'users'> } : 'skip'
  );
  
  const pendingRequests = useQuery(
    api.queries.getPendingRequests,
    userId ? { userId: userId as Id<'users'> } : 'skip'
  );

  // Mutations
  const addFriend = useMutation(api.mutations.addFriend);
  const acceptFriend = useMutation(api.mutations.acceptFriend);
  const declineFriend = useMutation(api.mutations.declineFriend);

  const handleAddFriend = async (): Promise<void> => {
    if (!friendUsername.trim()) {
      setAddError('Please enter a username');
      return;
    }

    if (!userId) return;

    setIsAdding(true);
    setAddError('');

    try {
      const result = await addFriend({
        userId: userId as Id<'users'>,
        friendUsername: friendUsername.trim(),
      });

      if (result.success) {
        setShowAddModal(false);
        setFriendUsername('');
        Alert.alert('Success', 'Friend request sent!');
      } else {
        setAddError(result.error || 'Failed to send friend request');
      }
    } catch (error) {
      setAddError('Something went wrong. Please try again.');
      console.error('Add friend error:', error);
    } finally {
      setIsAdding(false);
    }
  };

  const handleAcceptRequest = async (requestId: string): Promise<void> => {
    if (!userId) return;

    try {
      const result = await acceptFriend({
        userId: userId as Id<'users'>,
        friendshipId: requestId as Id<'friends'>,
      });

      if (!result.success) {
        Alert.alert('Error', result.error || 'Failed to accept request');
      }
    } catch (error) {
      Alert.alert('Error', 'Something went wrong');
      console.error('Accept friend error:', error);
    }
  };

  const handleDeclineRequest = async (requestId: string): Promise<void> => {
    if (!userId) return;

    try {
      const result = await declineFriend({
        userId: userId as Id<'users'>,
        friendshipId: requestId as Id<'friends'>,
      });

      if (!result.success) {
        Alert.alert('Error', result.error || 'Failed to decline request');
      }
    } catch (error) {
      Alert.alert('Error', 'Something went wrong');
      console.error('Decline friend error:', error);
    }
  };

  const isLoading = friends === undefined || pendingRequests === undefined;

  return (
    <View style={styles.container}>
      {/* Add Friend Button */}
      <TouchableOpacity 
        style={styles.addButton} 
        activeOpacity={0.8}
        onPress={() => setShowAddModal(true)}
      >
        <UserPlus color={COLORS.textPrimary} size={20} />
        <Text style={styles.addButtonText}>Add Friend</Text>
      </TouchableOpacity>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {/* Pending Requests Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Pending Requests</Text>
            {pendingRequests && pendingRequests.length > 0 ? (
              <View style={styles.listContainer}>
                {pendingRequests.map((request) => (
                  <View key={request.requestId} style={styles.requestItem}>
                    <View style={styles.requestInfo}>
                      <View style={styles.requestAvatar}>
                        <User color={COLORS.textSecondary} size={20} />
                      </View>
                      <View>
                        <Text style={styles.requestName}>{request.username}</Text>
                        <Text style={styles.requestSubtext}>
                          Wants to be friends
                        </Text>
                      </View>
                    </View>
                    <View style={styles.requestActions}>
                      <TouchableOpacity
                        style={styles.acceptButton}
                        onPress={() => handleAcceptRequest(request.requestId)}
                      >
                        <Check color={COLORS.textPrimary} size={18} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.declineButton}
                        onPress={() => handleDeclineRequest(request.requestId)}
                      >
                        <X color={COLORS.error} size={18} />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>No pending requests</Text>
              </View>
            )}
          </View>

          {/* Friends List Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Your Friends ({friends?.length || 0})</Text>
            {friends && friends.length > 0 ? (
              <View style={styles.listContainer}>
                {friends.map((friend) => (
                  <View key={friend.friendshipId} style={styles.friendItem}>
                    <View style={styles.friendAvatar}>
                      <User color={COLORS.textPrimary} size={20} />
                    </View>
                    <View style={styles.friendInfo}>
                      <Text style={styles.friendName}>{friend.username}</Text>
                      {friend.name && (
                        <Text style={styles.friendSubtext}>{friend.name}</Text>
                      )}
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>No friends yet</Text>
                <Text style={styles.emptySubtext}>
                  Add friends to start splitting expenses
                </Text>
              </View>
            )}
          </View>
        </ScrollView>
      )}

      {/* Add Friend Modal */}
      <Modal
        visible={showAddModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowAddModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Friend</Text>
              <TouchableOpacity
                onPress={() => {
                  setShowAddModal(false);
                  setFriendUsername('');
                  setAddError('');
                }}
              >
                <X color={COLORS.textSecondary} size={24} />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalSubtitle}>
              Enter your friend's username to send a friend request
            </Text>

            <TextInput
              style={styles.modalInput}
              placeholder="Enter username"
              placeholderTextColor={COLORS.textMuted}
              value={friendUsername}
              onChangeText={setFriendUsername}
              autoCapitalize="none"
              autoCorrect={false}
            />

            {addError ? (
              <Text style={styles.errorText}>{addError}</Text>
            ) : null}

            <TouchableOpacity
              style={[styles.modalButton, isAdding && styles.modalButtonDisabled]}
              onPress={handleAddFriend}
              disabled={isAdding}
              activeOpacity={0.8}
            >
              {isAdding ? (
                <ActivityIndicator size="small" color={COLORS.textPrimary} />
              ) : (
                <Text style={styles.modalButtonText}>Send Request</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    marginHorizontal: 16,
    marginTop: 16,
    paddingVertical: 14,
    borderRadius: 12,
  },
  addButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    marginLeft: 8,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.textSecondary,
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  listContainer: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    overflow: 'hidden',
  },
  requestItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  requestInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  requestAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.cardElevated,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  requestName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
  },
  requestSubtext: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  requestActions: {
    flexDirection: 'row',
  },
  acceptButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  declineButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.cardElevated,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  friendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  friendAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  friendInfo: {
    flex: 1,
  },
  friendName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
  },
  friendSubtext: {
    fontSize: 13,
    color: COLORS.textSecondary,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COLORS.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
  },
  modalSubtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 24,
  },
  modalInput: {
    backgroundColor: COLORS.cardElevated,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    height: 52,
    paddingHorizontal: 16,
    fontSize: 16,
    color: COLORS.textPrimary,
    marginBottom: 16,
  },
  errorText: {
    color: COLORS.error,
    fontSize: 14,
    marginBottom: 16,
  },
  modalButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalButtonDisabled: {
    opacity: 0.6,
  },
  modalButtonText: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontWeight: 'bold',
  },
});

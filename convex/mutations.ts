import { mutation } from './_generated/server';
import { v } from 'convex/values';
import { Id } from './_generated/dataModel';

// Money utility - round to 2 decimal places
const roundMoney = (amount: number): number => {
  return Math.round(amount * 100) / 100;
};

/**
 * Add a friend by username
 */
export const addFriend = mutation({
  args: {
    userId: v.id('users'),
    friendUsername: v.string(),
  },
  handler: async (ctx, args): Promise<{ success: boolean; error?: string }> => {
    const { userId, friendUsername } = args;

    // Find friend by username
    const friend = await ctx.db
      .query('users')
      .withIndex('by_username', (q) => q.eq('username', friendUsername))
      .first();

    if (!friend) {
      return { success: false, error: 'User not found' };
    }

    if (friend._id === userId) {
      return { success: false, error: 'Cannot add yourself as a friend' };
    }

    // Check if friendship already exists
    const existingFriendship = await ctx.db
      .query('friends')
      .withIndex('by_user_and_friend', (q) => 
        q.eq('userId', userId).eq('friendId', friend._id)
      )
      .first();

    if (existingFriendship) {
      return { success: false, error: 'Friend request already sent' };
    }

    // Check reverse direction too
    const reverseFriendship = await ctx.db
      .query('friends')
      .withIndex('by_user_and_friend', (q) => 
        q.eq('userId', friend._id).eq('friendId', userId)
      )
      .first();

    if (reverseFriendship) {
      if (reverseFriendship.status === 'accepted') {
        return { success: false, error: 'Already friends' };
      }
      return { success: false, error: 'Pending request from this user exists' };
    }

    // Create friend request
    await ctx.db.insert('friends', {
      userId,
      friendId: friend._id,
      status: 'pending',
      createdAt: Date.now(),
    });

    return { success: true };
  },
});

/**
 * Accept a friend request
 */
export const acceptFriend = mutation({
  args: {
    userId: v.id('users'),
    friendshipId: v.id('friends'),
  },
  handler: async (ctx, args): Promise<{ success: boolean; error?: string }> => {
    const { userId, friendshipId } = args;

    const friendship = await ctx.db.get(friendshipId);

    if (!friendship) {
      return { success: false, error: 'Friend request not found' };
    }

    // Verify user is the recipient
    if (friendship.friendId !== userId) {
      return { success: false, error: 'Not authorized to accept this request' };
    }

    if (friendship.status !== 'pending') {
      return { success: false, error: 'Request already processed' };
    }

    // Update status to accepted
    await ctx.db.patch(friendshipId, { status: 'accepted' });

    return { success: true };
  },
});

/**
 * Decline a friend request
 */
export const declineFriend = mutation({
  args: {
    userId: v.id('users'),
    friendshipId: v.id('friends'),
  },
  handler: async (ctx, args): Promise<{ success: boolean; error?: string }> => {
    const { userId, friendshipId } = args;

    const friendship = await ctx.db.get(friendshipId);

    if (!friendship) {
      return { success: false, error: 'Friend request not found' };
    }

    // Verify user is the recipient
    if (friendship.friendId !== userId) {
      return { success: false, error: 'Not authorized to decline this request' };
    }

    // Delete the friendship record
    await ctx.db.delete(friendshipId);

    return { success: true };
  },
});

/**
 * Remove a friend
 */
export const removeFriend = mutation({
  args: {
    userId: v.id('users'),
    friendshipId: v.id('friends'),
  },
  handler: async (ctx, args): Promise<{ success: boolean; error?: string }> => {
    const { userId, friendshipId } = args;

    const friendship = await ctx.db.get(friendshipId);

    if (!friendship) {
      return { success: false, error: 'Friendship not found' };
    }

    // Verify user is part of the friendship
    if (friendship.userId !== userId && friendship.friendId !== userId) {
      return { success: false, error: 'Not authorized' };
    }

    await ctx.db.delete(friendshipId);

    return { success: true };
  },
});

/**
 * Create a new group
 */
export const createGroup = mutation({
  args: {
    userId: v.id('users'),
    name: v.string(),
    members: v.array(v.id('users')),
  },
  handler: async (ctx, args): Promise<{ success: boolean; groupId?: Id<'groups'>; error?: string }> => {
    const { userId, name, members } = args;

    if (!name.trim()) {
      return { success: false, error: 'Group name is required' };
    }

    // Ensure creator is included in members
    const allMembers = members.includes(userId) ? members : [userId, ...members];

    const groupId = await ctx.db.insert('groups', {
      name: name.trim(),
      members: allMembers,
      archived: false,
      createdBy: userId,
      createdAt: Date.now(),
    });

    return { success: true, groupId };
  },
});

/**
 * Add members to a group
 */
export const addGroupMembers = mutation({
  args: {
    userId: v.id('users'),
    groupId: v.id('groups'),
    newMembers: v.array(v.id('users')),
  },
  handler: async (ctx, args): Promise<{ success: boolean; error?: string }> => {
    const { userId, groupId, newMembers } = args;

    const group = await ctx.db.get(groupId);

    if (!group) {
      return { success: false, error: 'Group not found' };
    }

    if (!group.members.includes(userId)) {
      return { success: false, error: 'Not a member of this group' };
    }

    // Merge new members with existing
    const updatedMembers = [...new Set([...group.members, ...newMembers])];

    await ctx.db.patch(groupId, { members: updatedMembers });

    return { success: true };
  },
});

/**
 * Archive a group
 */
export const archiveGroup = mutation({
  args: {
    userId: v.id('users'),
    groupId: v.id('groups'),
  },
  handler: async (ctx, args): Promise<{ success: boolean; error?: string }> => {
    const { userId, groupId } = args;

    const group = await ctx.db.get(groupId);

    if (!group) {
      return { success: false, error: 'Group not found' };
    }

    // Only creator can archive
    if (group.createdBy !== userId) {
      return { success: false, error: 'Only the group creator can archive' };
    }

    await ctx.db.patch(groupId, { archived: true });

    return { success: true };
  },
});

/**
 * Add an expense with itemized splits
 */
export const addExpense = mutation({
  args: {
    userId: v.id('users'),
    groupId: v.optional(v.id('groups')), // Optional - for group expenses
    participantIds: v.optional(v.array(v.id('users'))), // Optional - for individual expenses
    description: v.string(),
    items: v.array(
      v.object({
        name: v.string(),
        amount: v.number(),
        splits: v.array(
          v.object({
            userId: v.id('users'),
            share: v.number(),
          })
        ),
      })
    ),
    category: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{ success: boolean; expenseId?: Id<'expenses'>; error?: string }> => {
    const { userId, groupId, participantIds, description, items, category } = args;

    // Must have either groupId or participantIds
    if (!groupId && (!participantIds || participantIds.length === 0)) {
      return { success: false, error: 'Must specify a group or participants' };
    }

    // Determine valid members for this expense
    let validMembers: Id<'users'>[];

    if (groupId) {
      // Validate group exists and user is a member
      const group = await ctx.db.get(groupId);

      if (!group) {
        return { success: false, error: 'Group not found' };
      }

      if (!group.members.includes(userId)) {
        return { success: false, error: 'Not a member of this group' };
      }

      if (group.archived) {
        return { success: false, error: 'Cannot add expenses to archived group' };
      }

      validMembers = group.members;
    } else {
      // Individual expense - participants must include the payer
      if (!participantIds!.includes(userId)) {
        return { success: false, error: 'Payer must be a participant' };
      }
      validMembers = participantIds!;
    }

    if (!description.trim()) {
      return { success: false, error: 'Description is required' };
    }

    if (items.length === 0) {
      return { success: false, error: 'At least one item is required' };
    }

    // Validate splits sum equals item amount for each item
    for (const item of items) {
      if (item.amount <= 0) {
        return { success: false, error: `Item "${item.name}" must have a positive amount` };
      }

      if (item.splits.length === 0) {
        return { success: false, error: `Item "${item.name}" must have at least one split` };
      }

      const splitSum = roundMoney(
        item.splits.reduce((sum, split) => sum + split.share, 0)
      );
      const itemAmount = roundMoney(item.amount);

      if (splitSum !== itemAmount) {
        return { 
          success: false, 
          error: `Split sum (${splitSum}) does not equal item amount (${itemAmount}) for "${item.name}"` 
        };
      }

      // Validate all split users are valid participants
      for (const split of item.splits) {
        if (!validMembers.includes(split.userId)) {
          return { success: false, error: 'All split users must be participants' };
        }
      }
    }

    // Round all money values
    const processedItems = items.map((item) => ({
      name: item.name,
      amount: roundMoney(item.amount),
      splits: item.splits.map((split) => ({
        userId: split.userId,
        share: roundMoney(split.share),
      })),
    }));

    const expenseId = await ctx.db.insert('expenses', {
      groupId: groupId || undefined,
      participantIds: groupId ? undefined : participantIds,
      payerId: userId,
      description: description.trim(),
      items: processedItems,
      category,
      createdAt: Date.now(),
    });

    return { success: true, expenseId };
  },
});

/**
 * Update an expense (description, payer, items).
 * Any participant (payer or in splits) may edit.
 */
export const updateExpense = mutation({
  args: {
    userId: v.id('users'),
    expenseId: v.id('expenses'),
    description: v.optional(v.string()),
    payerId: v.optional(v.id('users')),
    items: v.optional(
      v.array(
        v.object({
          name: v.string(),
          amount: v.number(),
          splits: v.array(
            v.object({
              userId: v.id('users'),
              share: v.number(),
            })
          ),
        })
      )
    ),
  },
  handler: async (ctx, args): Promise<{ success: boolean; error?: string }> => {
    const { userId, expenseId, description, payerId, items } = args;

    const expense = await ctx.db.get(expenseId);
    if (!expense) {
      return { success: false, error: 'Expense not found' };
    }

    // Only participants (payer or anyone in splits) can edit
    const isParticipant =
      expense.payerId === userId ||
      expense.items.some((item) => item.splits.some((s) => s.userId === userId));
    if (!isParticipant) {
      return { success: false, error: 'Only participants can edit this expense' };
    }

    // Get valid members from group or participantIds
    let validMembers: Id<'users'>[];
    if (expense.groupId) {
      const group = await ctx.db.get(expense.groupId);
      if (!group) {
        return { success: false, error: 'Group not found' };
      }
      validMembers = group.members;
    } else {
      validMembers = expense.participantIds || [];
    }

    const updates: Partial<{
      description: string;
      payerId: Id<'users'>;
      items: Array<{
        name: string;
        amount: number;
        splits: Array<{ userId: Id<'users'>; share: number }>;
      }>;
    }> = {};

    // Description
    if (description !== undefined) {
      if (!description.trim()) {
        return { success: false, error: 'Description cannot be empty' };
      }
      updates.description = description.trim();
    }

    // Payer
    if (payerId !== undefined) {
      if (!validMembers.includes(payerId)) {
        return { success: false, error: 'Payer must be a participant' };
      }
      updates.payerId = payerId;
    }

    // Items and splits
    if (items !== undefined) {
      if (items.length === 0) {
        return { success: false, error: 'At least one item is required' };
      }

      for (const item of items) {
        if (item.amount <= 0) {
          return { success: false, error: `Item "${item.name}" must have a positive amount` };
        }
        if (item.splits.length === 0) {
          return { success: false, error: `Item "${item.name}" must have at least one split` };
        }

        const splitSum = roundMoney(item.splits.reduce((sum, split) => sum + split.share, 0));
        const itemAmount = roundMoney(item.amount);
        if (splitSum !== itemAmount) {
          return {
            success: false,
            error: `Split sum (${splitSum}) does not equal item amount (${itemAmount}) for "${item.name}"`,
          };
        }

        for (const split of item.splits) {
          if (!validMembers.includes(split.userId)) {
            return { success: false, error: 'All split users must be participants' };
          }
        }
      }

      updates.items = items.map((item) => ({
        name: item.name,
        amount: roundMoney(item.amount),
        splits: item.splits.map((split) => ({
          userId: split.userId,
          share: roundMoney(split.share),
        })),
      }));
    }

    if (Object.keys(updates).length > 0) {
      await ctx.db.patch(expenseId, updates);
    }

    return { success: true };
  },
});

/**
 * Delete an expense
 */
export const deleteExpense = mutation({
  args: {
    userId: v.id('users'),
    expenseId: v.id('expenses'),
  },
  handler: async (ctx, args): Promise<{ success: boolean; error?: string }> => {
    const { userId, expenseId } = args;

    const expense = await ctx.db.get(expenseId);

    if (!expense) {
      return { success: false, error: 'Expense not found' };
    }

    // Only payer can delete
    if (expense.payerId !== userId) {
      return { success: false, error: 'Only the payer can delete this expense' };
    }

    await ctx.db.delete(expenseId);

    return { success: true };
  },
});

/**
 * Settle a debt (create settlement record)
 */
export const settle = mutation({
  args: {
    fromId: v.id('users'),
    toId: v.id('users'),
    amount: v.number(),
    expenseId: v.optional(v.id('expenses')),
  },
  handler: async (ctx, args): Promise<{ success: boolean; settlementId?: Id<'settlements'>; error?: string }> => {
    const { fromId, toId, amount, expenseId } = args;

    if (fromId === toId) {
      return { success: false, error: 'Cannot settle with yourself' };
    }

    if (amount <= 0) {
      return { success: false, error: 'Amount must be positive' };
    }

    // Verify users exist
    const fromUser = await ctx.db.get(fromId);
    const toUser = await ctx.db.get(toId);

    if (!fromUser || !toUser) {
      return { success: false, error: 'User not found' };
    }

    const settlementId = await ctx.db.insert('settlements', {
      fromId,
      toId,
      amount: roundMoney(amount),
      expenseId,
      timestamp: Date.now(),
      status: 'paid',
    });

    return { success: true, settlementId };
  },
});

/**
 * Send a payment reminder (creates a notification record)
 * For now, this just logs the reminder - integrate with expo-notifications later
 */
export const remind = mutation({
  args: {
    fromId: v.id('users'),
    toId: v.id('users'),
    amount: v.number(),
  },
  handler: async (ctx, args): Promise<{ success: boolean; error?: string }> => {
    const { fromId, toId, amount } = args;

    if (fromId === toId) {
      return { success: false, error: 'Cannot remind yourself' };
    }

    // Verify users exist
    const fromUser = await ctx.db.get(fromId);
    const toUser = await ctx.db.get(toId);

    if (!fromUser || !toUser) {
      return { success: false, error: 'User not found' };
    }

    // TODO: Integrate with expo-notifications to send push notification
    // For now, just return success
    // In production, you would:
    // 1. Store a notification record
    // 2. Trigger push notification via Expo
    
    console.log(`Reminder: ${fromUser.username} reminded ${toUser.username} about RM${roundMoney(amount).toFixed(2)}`);

    return { success: true };
  },
});

/**
 * Update user profile
 */
export const updateProfile = mutation({
  args: {
    userId: v.id('users'),
    name: v.optional(v.string()),
    email: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{ success: boolean; error?: string }> => {
    const { userId, name, email } = args;

    const user = await ctx.db.get(userId);

    if (!user) {
      return { success: false, error: 'User not found' };
    }

    const updates: { name?: string; email?: string } = {};

    if (name !== undefined) {
      updates.name = name.trim() || undefined;
    }

    if (email !== undefined) {
      // Check if email is already taken
      const existing = await ctx.db
        .query('users')
        .withIndex('by_email', (q) => q.eq('email', email))
        .first();

      if (existing && existing._id !== userId) {
        return { success: false, error: 'Email already in use' };
      }

      updates.email = email;
    }

    if (Object.keys(updates).length > 0) {
      await ctx.db.patch(userId, updates);
    }

    return { success: true };
  },
});

/**
 * Leave a group
 */
export const leaveGroup = mutation({
  args: {
    userId: v.id('users'),
    groupId: v.id('groups'),
  },
  handler: async (ctx, args): Promise<{ success: boolean; error?: string }> => {
    const { userId, groupId } = args;

    const group = await ctx.db.get(groupId);

    if (!group) {
      return { success: false, error: 'Group not found' };
    }

    if (!group.members.includes(userId)) {
      return { success: false, error: 'Not a member of this group' };
    }

    // Creator cannot leave - must archive instead
    if (group.createdBy === userId) {
      return { success: false, error: 'Group creator cannot leave. Archive the group instead.' };
    }

    const updatedMembers = group.members.filter((id) => id !== userId);
    await ctx.db.patch(groupId, { members: updatedMembers });

    return { success: true };
  },
});
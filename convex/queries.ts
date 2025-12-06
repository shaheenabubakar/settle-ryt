import { query } from './_generated/server';
import { v } from 'convex/values';
import { Doc, Id } from './_generated/dataModel';

// Money utility - round to 2 decimal places
const roundMoney = (amount: number): number => {
  return Math.round(amount * 100) / 100;
};

interface Balance {
  totalOwed: number; // Money others owe you
  totalOwe: number; // Money you owe others
  netBalance: number; // Positive = others owe you, Negative = you owe others
  byPerson: Array<{
    userId: Id<'users'>;
    username: string;
    name?: string;
    amount: number; // Positive = they owe you, Negative = you owe them
  }>;
}

interface DashboardData {
  balances: Balance;
  recentActivity: Array<{
    type: 'expense' | 'settlement';
    id: Id<'expenses'> | Id<'settlements'>;
    description: string;
    amount: number;
    timestamp: number;
    groupName?: string;
  }>;
  groups: Array<{
    id: Id<'groups'>;
    name: string;
    memberCount: number;
  }>;
}

/**
 * Get dashboard data including balances, activity, and groups
 */
export const getDashboard = query({
  args: {
    userId: v.id('users'),
  },
  handler: async (ctx, args): Promise<DashboardData> => {
    const { userId } = args;
    
    // Get all expenses where user is involved
    const allExpenses = await ctx.db.query('expenses').collect();
    
    // Get all settlements involving user
    const settlementsFrom = await ctx.db
      .query('settlements')
      .withIndex('by_from', (q) => q.eq('fromId', userId))
      .collect();
    
    const settlementsTo = await ctx.db
      .query('settlements')
      .withIndex('by_to', (q) => q.eq('toId', userId))
      .collect();

    // Calculate balances per person
    const balanceMap = new Map<string, number>();

    // Process expenses
    for (const expense of allExpenses) {
      const isPayer = expense.payerId === userId;
      
      for (const item of expense.items) {
        for (const split of item.splits) {
          const otherUserId = split.userId.toString();
          
          if (isPayer && split.userId !== userId) {
            // User paid, others owe them
            const current = balanceMap.get(otherUserId) || 0;
            balanceMap.set(otherUserId, roundMoney(current + split.share));
          } else if (!isPayer && split.userId === userId) {
            // User owes the payer
            const payerId = expense.payerId.toString();
            const current = balanceMap.get(payerId) || 0;
            balanceMap.set(payerId, roundMoney(current - split.share));
          }
        }
      }
    }

    // Process settlements
    for (const settlement of settlementsFrom) {
      const toId = settlement.toId.toString();
      const current = balanceMap.get(toId) || 0;
      balanceMap.set(toId, roundMoney(current + settlement.amount));
    }

    for (const settlement of settlementsTo) {
      const fromId = settlement.fromId.toString();
      const current = balanceMap.get(fromId) || 0;
      balanceMap.set(fromId, roundMoney(current - settlement.amount));
    }

    // Build balance by person
    const byPerson: Balance['byPerson'] = [];
    let totalOwed = 0;
    let totalOwe = 0;

    for (const [personId, amount] of balanceMap) {
      if (amount === 0) continue;
      
      const user = await ctx.db.get(personId as Id<'users'>);
      if (user) {
        byPerson.push({
          userId: user._id,
          username: user.username,
          name: user.name,
          amount: roundMoney(amount),
        });

        if (amount > 0) {
          totalOwed = roundMoney(totalOwed + amount);
        } else {
          totalOwe = roundMoney(totalOwe + Math.abs(amount));
        }
      }
    }

    // Get all user expenses (filter only, no slicing yet)
    const userExpenses = allExpenses.filter((exp) => 
      exp.payerId === userId || 
      exp.items.some((item) => item.splits.some((s) => s.userId === userId))
    );

    // Get all settlements (no slicing yet)
    const allSettlements = [...settlementsFrom, ...settlementsTo];

    // Build activity items from ALL expenses and settlements
    const recentActivity: DashboardData['recentActivity'] = [];

    for (const expense of userExpenses) {
      const group = await ctx.db.get(expense.groupId);
      const totalAmount = expense.items.reduce((sum, item) => sum + item.amount, 0);
      
      recentActivity.push({
        type: 'expense',
        id: expense._id,
        description: expense.description,
        amount: roundMoney(totalAmount),
        timestamp: expense.createdAt,
        groupName: group?.name,
      });
    }

    for (const settlement of allSettlements) {
      const isFrom = settlement.fromId === userId;
      const otherUser = await ctx.db.get(isFrom ? settlement.toId : settlement.fromId);
      
      recentActivity.push({
        type: 'settlement',
        id: settlement._id,
        description: isFrom 
          ? `You paid ${otherUser?.username || 'someone'}`
          : `${otherUser?.username || 'Someone'} paid you`,
        amount: settlement.amount,
        timestamp: settlement.timestamp,
      });
    }

    // Sort all activity by timestamp FIRST, then slice to get 10 most recent
    recentActivity.sort((a, b) => b.timestamp - a.timestamp);

    // Get user's groups
    const allGroups = await ctx.db.query('groups').collect();
    const userGroups = allGroups
      .filter((group) => !group.archived && group.members.includes(userId))
      .map((group) => ({
        id: group._id,
        name: group.name,
        memberCount: group.members.length,
      }));

    return {
      balances: {
        totalOwed: roundMoney(totalOwed),
        totalOwe: roundMoney(totalOwe),
        netBalance: roundMoney(totalOwed - totalOwe),
        byPerson,
      },
      recentActivity: recentActivity.slice(0, 10),
      groups: userGroups,
    };
  },
});

/**
 * Get friends for a user
 */
export const getFriends = query({
  args: {
    userId: v.id('users'),
  },
  handler: async (ctx, args) => {
    const { userId } = args;

    // Get friendships where user is either userId or friendId with accepted status
    const friendshipsAsUser = await ctx.db
      .query('friends')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .filter((q) => q.eq(q.field('status'), 'accepted'))
      .collect();

    const friendshipsAsFriend = await ctx.db
      .query('friends')
      .withIndex('by_friend', (q) => q.eq('friendId', userId))
      .filter((q) => q.eq(q.field('status'), 'accepted'))
      .collect();

    // Get friend user data
    const friends = [];

    for (const friendship of friendshipsAsUser) {
      const friend = await ctx.db.get(friendship.friendId);
      if (friend) {
        friends.push({
          friendshipId: friendship._id,
          userId: friend._id,
          username: friend.username,
          name: friend.name,
          email: friend.email,
        });
      }
    }

    for (const friendship of friendshipsAsFriend) {
      const friend = await ctx.db.get(friendship.userId);
      if (friend) {
        friends.push({
          friendshipId: friendship._id,
          userId: friend._id,
          username: friend.username,
          name: friend.name,
          email: friend.email,
        });
      }
    }

    return friends;
  },
});

/**
 * Get activity feed for a user
 */
export const getActivity = query({
  args: {
    userId: v.id('users'),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { userId, limit = 20 } = args;

    // Get expenses involving user
    const allExpenses = await ctx.db.query('expenses').collect();
    const userExpenses = allExpenses.filter(
      (exp) =>
        exp.payerId === userId ||
        exp.items.some((item) => item.splits.some((s) => s.userId === userId))
    );

    // Get settlements involving user
    const settlementsFrom = await ctx.db
      .query('settlements')
      .withIndex('by_from', (q) => q.eq('fromId', userId))
      .collect();

    const settlementsTo = await ctx.db
      .query('settlements')
      .withIndex('by_to', (q) => q.eq('toId', userId))
      .collect();

    // Build activity items
    const activity: Array<{
      type: 'expense' | 'settlement';
      id: string;
      description: string;
      amount: number;
      timestamp: number;
      participants: string[];
      groupName?: string;
    }> = [];

    for (const expense of userExpenses) {
      const group = await ctx.db.get(expense.groupId);
      const payer = await ctx.db.get(expense.payerId);
      const totalAmount = expense.items.reduce((sum, item) => sum + item.amount, 0);
      
      // Get unique participant usernames
      const participantIds = new Set<string>();
      expense.items.forEach((item) => {
        item.splits.forEach((split) => {
          participantIds.add(split.userId.toString());
        });
      });

      const participants: string[] = [];
      for (const id of participantIds) {
        const user = await ctx.db.get(id as Id<'users'>);
        if (user) participants.push(user.username);
      }

      activity.push({
        type: 'expense',
        id: expense._id,
        description: `${payer?.username || 'Someone'} paid for "${expense.description}"`,
        amount: roundMoney(totalAmount),
        timestamp: expense.createdAt,
        participants,
        groupName: group?.name,
      });
    }

    for (const settlement of [...settlementsFrom, ...settlementsTo]) {
      const isFrom = settlement.fromId === userId;
      const fromUser = await ctx.db.get(settlement.fromId);
      const toUser = await ctx.db.get(settlement.toId);

      activity.push({
        type: 'settlement',
        id: settlement._id,
        description: isFrom 
          ? `You paid ${toUser?.username || 'someone'}`
          : `${fromUser?.username || 'Someone'} paid you`,
        amount: settlement.amount,
        timestamp: settlement.timestamp,
        participants: [fromUser?.username || '', toUser?.username || ''].filter(Boolean),
      });
    }

    // Sort by timestamp and limit
    return activity
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  },
});

/**
 * Get pending friend requests for a user
 */
export const getPendingRequests = query({
  args: {
    userId: v.id('users'),
  },
  handler: async (ctx, args) => {
    const { userId } = args;

    // Get pending requests where user is the recipient (friendId)
    const pendingRequests = await ctx.db
      .query('friends')
      .withIndex('by_friend', (q) => q.eq('friendId', userId))
      .filter((q) => q.eq(q.field('status'), 'pending'))
      .collect();

    // Get requester details
    const requests = [];
    for (const request of pendingRequests) {
      const requester = await ctx.db.get(request.userId);
      if (requester) {
        requests.push({
          requestId: request._id,
          userId: requester._id,
          username: requester.username,
          name: requester.name,
          createdAt: request.createdAt,
        });
      }
    }

    return requests;
  },
});

/**
 * Get group details with members
 */
export const getGroup = query({
  args: {
    groupId: v.id('groups'),
  },
  handler: async (ctx, args) => {
    const group = await ctx.db.get(args.groupId);
    
    if (!group) {
      return null;
    }

    // Get member details
    const members = [];
    for (const memberId of group.members) {
      const user = await ctx.db.get(memberId);
      if (user) {
        members.push({
          userId: user._id,
          username: user.username,
          name: user.name,
        });
      }
    }

    // Get group expenses
    const expenses = await ctx.db
      .query('expenses')
      .withIndex('by_group', (q) => q.eq('groupId', args.groupId))
      .collect();

    const expenseData = [];
    for (const expense of expenses) {
      const payer = await ctx.db.get(expense.payerId);
      const totalAmount = expense.items.reduce((sum, item) => sum + item.amount, 0);
      
      expenseData.push({
        id: expense._id,
        description: expense.description,
        amount: roundMoney(totalAmount),
        payerUsername: payer?.username,
        category: expense.category,
        createdAt: expense.createdAt,
        itemCount: expense.items.length,
      });
    }

    return {
      ...group,
      members,
      expenses: expenseData.sort((a, b) => b.createdAt - a.createdAt),
    };
  },
});

/**
 * Get expense details
 */
export const getExpense = query({
  args: {
    expenseId: v.id('expenses'),
  },
  handler: async (ctx, args) => {
    const expense = await ctx.db.get(args.expenseId);
    
    if (!expense) {
      return null;
    }

    const group = await ctx.db.get(expense.groupId);
    const payer = await ctx.db.get(expense.payerId);

    // Enrich splits with user data
    const itemsWithUsers = [];
    for (const item of expense.items) {
      const splitsWithUsers = [];
      for (const split of item.splits) {
        const user = await ctx.db.get(split.userId);
        splitsWithUsers.push({
          ...split,
          username: user?.username,
          name: user?.name,
        });
      }
      itemsWithUsers.push({
        ...item,
        splits: splitsWithUsers,
      });
    }

    return {
      ...expense,
      groupName: group?.name,
      payerUsername: payer?.username,
      payerName: payer?.name,
      items: itemsWithUsers,
      totalAmount: roundMoney(expense.items.reduce((sum, item) => sum + item.amount, 0)),
    };
  },
});

/**
 * Search users by username
 */
export const searchUsers = query({
  args: {
    query: v.string(),
    excludeUserId: v.optional(v.id('users')),
  },
  handler: async (ctx, args) => {
    const { query: searchQuery, excludeUserId } = args;
    
    if (searchQuery.length < 2) {
      return [];
    }

    const allUsers = await ctx.db.query('users').collect();
    
    const matches = allUsers
      .filter((user) => {
        if (excludeUserId && user._id === excludeUserId) return false;
        return user.username.toLowerCase().includes(searchQuery.toLowerCase());
      })
      .slice(0, 10)
      .map((user) => ({
        userId: user._id,
        username: user.username,
        name: user.name,
      }));

    return matches;
  },
});


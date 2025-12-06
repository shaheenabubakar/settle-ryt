import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

export default defineSchema({
  // Users table
  users: defineTable({
    email: v.string(),
    username: v.string(),
    passwordHash: v.string(),
    name: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index('by_username', ['username'])
    .index('by_email', ['email']),

  // Friends table
  friends: defineTable({
    userId: v.id('users'),
    friendId: v.id('users'),
    status: v.union(v.literal('pending'), v.literal('accepted')),
    createdAt: v.number(),
  })
    .index('by_user', ['userId'])
    .index('by_friend', ['friendId'])
    .index('by_user_and_friend', ['userId', 'friendId']),

  // Groups table
  groups: defineTable({
    name: v.string(),
    members: v.array(v.id('users')),
    archived: v.boolean(),
    createdBy: v.id('users'),
    createdAt: v.number(),
  })
    .index('by_creator', ['createdBy']),

  // Expenses table with itemized splits
  expenses: defineTable({
    groupId: v.optional(v.id('groups')), // Optional - null for individual expenses
    participantIds: v.optional(v.array(v.id('users'))), // For expenses without a group
    payerId: v.id('users'),
    description: v.string(),
    items: v.array(
      v.object({
        name: v.string(),
        amount: v.number(), // 2-decimal float
        splits: v.array(
          v.object({
            userId: v.id('users'),
            share: v.number(), // 2-decimal float
          })
        ),
      })
    ),
    category: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index('by_payer', ['payerId']),

  // Settlements table
  settlements: defineTable({
    fromId: v.id('users'),
    toId: v.id('users'),
    amount: v.number(), // 2-decimal float
    expenseId: v.optional(v.id('expenses')),
    timestamp: v.number(),
    status: v.literal('paid'),
  })
    .index('by_from', ['fromId'])
    .index('by_to', ['toId']),

  // Auth tokens table
  authTokens: defineTable({
    userId: v.id('users'),
    token: v.string(),
    createdAt: v.number(),
    expiresAt: v.number(),
  })
    .index('by_token', ['token'])
    .index('by_user', ['userId']),
});

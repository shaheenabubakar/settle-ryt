// Type definitions for SettleRyt
// Note: These types mirror the Convex schema for client-side use
// After running `npx convex dev`, you can also import from 'convex/_generated/dataModel'

// User types
export interface User {
  _id: string;
  email: string;
  username: string;
  name?: string;
  createdAt: number;
}

// Friendship types
export type FriendshipStatus = 'pending' | 'accepted';

export interface Friendship {
  _id: string;
  userId: string;
  friendId: string;
  status: FriendshipStatus;
  createdAt: number;
}

export interface FriendWithDetails {
  friendshipId: string;
  userId: string;
  username: string;
  name?: string;
  email: string;
}

// Group types
export interface Group {
  _id: string;
  name: string;
  members: string[];
  archived: boolean;
  createdBy: string;
  createdAt: number;
}

export interface GroupMember {
  userId: string;
  username: string;
  name?: string;
}

// Expense types
export interface ExpenseSplit {
  userId: string;
  share: number; // 2-decimal float
}

export interface ExpenseItem {
  name: string;
  amount: number; // 2-decimal float
  splits: ExpenseSplit[];
}

export interface Expense {
  _id: string;
  groupId: string;
  payerId: string;
  description: string;
  items: ExpenseItem[];
  category?: string;
  createdAt: number;
}

export interface ExpenseWithDetails extends Expense {
  groupName?: string;
  payerUsername?: string;
  payerName?: string;
  totalAmount: number;
}

// Settlement types
export interface Settlement {
  _id: string;
  fromId: string;
  toId: string;
  amount: number; // 2-decimal float
  expenseId?: string;
  timestamp: number;
  status: 'paid';
}

// Dashboard types
export interface PersonBalance {
  userId: string;
  username: string;
  name?: string;
  amount: number; // Positive = they owe you, Negative = you owe them
}

export interface Balance {
  totalOwed: number;
  totalOwe: number;
  netBalance: number;
  byPerson: PersonBalance[];
}

export interface ActivityItem {
  type: 'expense' | 'settlement';
  id: string;
  description: string;
  amount: number;
  timestamp: number;
  groupName?: string;
  participants?: string[];
}

export interface DashboardData {
  balances: Balance;
  recentActivity: ActivityItem[];
  groups: Array<{
    id: string;
    name: string;
    memberCount: number;
  }>;
}

// Auth types
export interface AuthResult {
  success: boolean;
  token?: string;
  userId?: string;
  error?: string;
}

export interface TokenValidation {
  valid: boolean;
  userId?: string;
}

// API Response types
export interface MutationResult {
  success: boolean;
  error?: string;
}

export interface CreateGroupResult extends MutationResult {
  groupId?: string;
}

export interface AddExpenseResult extends MutationResult {
  expenseId?: string;
}

export interface SettleResult extends MutationResult {
  settlementId?: string;
}

// Utility types for money handling
export type Money = number; // Always 2-decimal float

/**
 * Format money with Malaysian Ringgit symbol
 */
export const formatMoney = (amount: Money): string => {
  return `RM ${amount.toFixed(2)}`;
};

/**
 * Round to 2 decimal places to avoid floating point errors
 */
export const roundMoney = (amount: number): Money => {
  return Math.round(amount * 100) / 100;
};

/**
 * Calculate equal split for a given amount and number of people
 */
export const calculateEqualSplit = (totalAmount: Money, numberOfPeople: number): Money => {
  if (numberOfPeople <= 0) return 0;
  return roundMoney(totalAmount / numberOfPeople);
};

/**
 * Calculate percentage split
 */
export const calculatePercentageSplit = (totalAmount: Money, percentage: number): Money => {
  return roundMoney((totalAmount * percentage) / 100);
};

/**
 * Validate that splits sum equals the total amount
 */
export const validateSplits = (totalAmount: Money, splits: number[]): boolean => {
  const sum = roundMoney(splits.reduce((acc, split) => acc + split, 0));
  return sum === roundMoney(totalAmount);
};

// Date formatting utilities (using date-fns patterns)
export const DATE_FORMATS = {
  display: 'MMM d, yyyy',
  displayWithTime: 'MMM d, yyyy h:mm a',
  relative: 'relative', // Use formatDistanceToNow
} as const;

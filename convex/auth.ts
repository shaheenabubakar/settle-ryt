import { mutation, query } from './_generated/server';
import { v } from 'convex/values';
import { Id } from './_generated/dataModel';

// Simple hash function using btoa (for demo purposes only - use bcrypt in production)
const hashPassword = (password: string): string => {
  return btoa(password + 'settleryt_salt');
};

const verifyPassword = (password: string, hash: string): boolean => {
  return hashPassword(password) === hash;
};

// Generate a simple token (for demo purposes - use proper JWT in production)
const generateToken = (): string => {
  const randomBytes = Array.from({ length: 32 }, () =>
    Math.floor(Math.random() * 256).toString(16).padStart(2, '0')
  ).join('');
  return btoa(randomBytes + Date.now().toString());
};

/**
 * Sign up a new user
 */
export const signUp = mutation({
  args: {
    email: v.string(),
    username: v.string(),
    password: v.string(),
    name: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{ success: boolean; token?: string; userId?: Id<'users'>; error?: string }> => {
    // Check if email already exists
    const existingEmail = await ctx.db
      .query('users')
      .withIndex('by_email', (q) => q.eq('email', args.email))
      .first();

    if (existingEmail) {
      return { success: false, error: 'Email already registered' };
    }

    // Check if username already exists
    const existingUsername = await ctx.db
      .query('users')
      .withIndex('by_username', (q) => q.eq('username', args.username))
      .first();

    if (existingUsername) {
      return { success: false, error: 'Username already taken' };
    }

    // Create user
    const userId = await ctx.db.insert('users', {
      email: args.email,
      username: args.username,
      passwordHash: hashPassword(args.password),
      name: args.name,
      createdAt: Date.now(),
    });

    // Generate auth token
    const token = generateToken();
    const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000; // 7 days

    await ctx.db.insert('authTokens', {
      userId,
      token,
      createdAt: Date.now(),
      expiresAt,
    });

    return { success: true, token, userId };
  },
});

/**
 * Sign in an existing user
 */
export const signIn = mutation({
  args: {
    username: v.string(),
    password: v.string(),
  },
  handler: async (ctx, args): Promise<{ success: boolean; token?: string; userId?: Id<'users'>; error?: string }> => {
    // Find user by username
    const user = await ctx.db
      .query('users')
      .withIndex('by_username', (q) => q.eq('username', args.username))
      .first();

    if (!user) {
      return { success: false, error: 'Invalid username or password' };
    }

    // Verify password
    if (!verifyPassword(args.password, user.passwordHash)) {
      return { success: false, error: 'Invalid username or password' };
    }

    // Generate new auth token
    const token = generateToken();
    const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000; // 7 days

    await ctx.db.insert('authTokens', {
      userId: user._id,
      token,
      createdAt: Date.now(),
      expiresAt,
    });

    return { success: true, token, userId: user._id };
  },
});

/**
 * Sign out - invalidate token
 */
export const signOut = mutation({
  args: {
    token: v.string(),
  },
  handler: async (ctx, args): Promise<{ success: boolean }> => {
    const authToken = await ctx.db
      .query('authTokens')
      .withIndex('by_token', (q) => q.eq('token', args.token))
      .first();

    if (authToken) {
      await ctx.db.delete(authToken._id);
    }

    return { success: true };
  },
});

/**
 * Validate token and get user ID
 */
export const validateToken = query({
  args: {
    token: v.string(),
  },
  handler: async (ctx, args): Promise<{ valid: boolean; userId?: Id<'users'> }> => {
    const authToken = await ctx.db
      .query('authTokens')
      .withIndex('by_token', (q) => q.eq('token', args.token))
      .first();

    if (!authToken || authToken.expiresAt < Date.now()) {
      return { valid: false };
    }

    return { valid: true, userId: authToken.userId };
  },
});

/**
 * Get user by ID
 */
export const getUser = query({
  args: {
    userId: v.id('users'),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    
    if (!user) {
      return null;
    }

    // Return user without password hash
    const { passwordHash: _, ...safeUser } = user;
    return safeUser;
  },
});

/**
 * Get current user from token
 */
export const getCurrentUser = query({
  args: {
    token: v.string(),
  },
  handler: async (ctx, args) => {
    const authToken = await ctx.db
      .query('authTokens')
      .withIndex('by_token', (q) => q.eq('token', args.token))
      .first();

    if (!authToken || authToken.expiresAt < Date.now()) {
      return null;
    }

    const user = await ctx.db.get(authToken.userId);
    
    if (!user) {
      return null;
    }

    // Return user without password hash
    const { passwordHash: _, ...safeUser } = user;
    return safeUser;
  },
});


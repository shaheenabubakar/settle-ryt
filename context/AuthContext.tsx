import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

// Storage wrapper - no persistence on web (demo mode)
const storage = {
  async getItem(key: string): Promise<string | null> {
    if (Platform.OS === 'web') {
      return null; // No persistence on web
    }
    return SecureStore.getItemAsync(key);
  },
  async setItem(key: string, value: string): Promise<void> {
    if (Platform.OS === 'web') {
      return; // No persistence on web
    }
    return SecureStore.setItemAsync(key, value);
  },
  async deleteItem(key: string): Promise<void> {
    if (Platform.OS === 'web') {
      return; // No persistence on web
    }
    return SecureStore.deleteItemAsync(key);
  },
};

interface AuthContextType {
  isLoading: boolean;
  isAuthenticated: boolean;
  userId: string | null;
  token: string | null;
  signIn: (token: string, userId: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }): React.ReactElement {
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);

  // Check for existing auth on mount
  useEffect(() => {
    const checkAuth = async (): Promise<void> => {
      try {
        const storedToken = await storage.getItem('authToken');
        const storedUserId = await storage.getItem('userId');

        if (storedToken && storedUserId) {
          setToken(storedToken);
          setUserId(storedUserId);
          setIsAuthenticated(true);
        }
      } catch (error) {
        console.error('Error checking auth:', error);
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, []);

  const signIn = useCallback(async (newToken: string, newUserId: string): Promise<void> => {
    try {
      await storage.setItem('authToken', newToken);
      await storage.setItem('userId', newUserId);
      setToken(newToken);
      setUserId(newUserId);
      setIsAuthenticated(true);
    } catch (error) {
      console.error('Error signing in:', error);
      throw error;
    }
  }, []);

  const signOut = useCallback(async (): Promise<void> => {
    try {
      await storage.deleteItem('authToken');
      await storage.deleteItem('userId');
      setToken(null);
      setUserId(null);
      setIsAuthenticated(false);
    } catch (error) {
      console.error('Error signing out:', error);
      throw error;
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        isLoading,
        isAuthenticated,
        userId,
        token,
        signIn,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}


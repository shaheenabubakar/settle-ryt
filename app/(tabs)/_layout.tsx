import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, Image, Platform } from 'react-native';
import { Tabs, useFocusEffect, usePathname } from 'expo-router';
import { Home, Users, Activity, User } from 'lucide-react-native';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useAuth } from '../../context/AuthContext';
import { Id } from '../../convex/_generated/dataModel';
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
};

const COLORS = {
  background: '#121212',
  card: '#1E1E1E',
  primary: '#00A86B',
  textPrimary: '#FFFFFF',
  inactive: '#666666',
  badge: '#FF4D4D',
};

const LAST_ACTIVITY_KEY = 'settleryt_last_activity_time';

// Badge dot component
const BadgeDot: React.FC = () => (
  <View style={styles.badgeDot} />
);

// Activity icon with optional badge
const ActivityIcon: React.FC<{ color: string; size: number; showBadge: boolean }> = ({ 
  color, 
  size, 
  showBadge 
}) => (
  <View>
    <Activity color={color} size={size} />
    {showBadge && <BadgeDot />}
  </View>
);

export default function TabsLayout(): React.ReactElement {
  const { userId } = useAuth();
  const pathname = usePathname();
  const [hasNewActivity, setHasNewActivity] = useState(false);
  const [lastActivityTime, setLastActivityTime] = useState<number | null>(null);

  // Fetch activity to check for new items
  const activity = useQuery(
    api.queries.getActivity,
    userId ? { userId: userId as Id<'users'>, limit: 1 } : 'skip'
  );

  // Load last viewed activity time
  useEffect(() => {
    const loadLastTime = async (): Promise<void> => {
      try {
        const stored = await storage.getItem(LAST_ACTIVITY_KEY);
        if (stored) {
          setLastActivityTime(parseInt(stored, 10));
        }
      } catch {
        // Ignore errors
      }
    };
    loadLastTime();
  }, []);

  // Check for new activity
  useEffect(() => {
    if (activity && activity.length > 0 && lastActivityTime !== null) {
      const latestTimestamp = activity[0].timestamp;
      setHasNewActivity(latestTimestamp > lastActivityTime);
    } else if (activity && activity.length > 0 && lastActivityTime === null) {
      // First time - mark as new if there's any activity
      setHasNewActivity(true);
    }
  }, [activity, lastActivityTime]);

  // Clear badge when viewing activity tab
  useFocusEffect(
    useCallback(() => {
      if (pathname === '/activity') {
        const clearBadge = async (): Promise<void> => {
          const now = Date.now();
          setHasNewActivity(false);
          setLastActivityTime(now);
          try {
            await storage.setItem(LAST_ACTIVITY_KEY, now.toString());
          } catch {
            // Ignore errors
          }
        };
        clearBadge();
      }
    }, [pathname])
  );

  return (
    <Tabs
      screenOptions={{
        headerStyle: {
          backgroundColor: COLORS.background,
        },
        headerTintColor: COLORS.textPrimary,
        headerTitleStyle: {
          fontSize: 24,
          fontWeight: '700',
        },
        tabBarStyle: {
          backgroundColor: COLORS.card,
          borderTopWidth: 0,
          height: 60,
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.inactive,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          headerTitle: () => (
            <View style={styles.headerLogoContainer}>
              <Image
                source={require('../../settleryt-logo.png')}
                style={styles.headerLogo}
                resizeMode="contain"
              />
            </View>
          ),
          tabBarIcon: ({ color, size }) => (
            <Home color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="friends"
        options={{
          title: 'Friends',
          tabBarIcon: ({ color, size }) => (
            <Users color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="activity"
        options={{
          title: 'Activity',
          tabBarIcon: ({ color, size }) => (
            <ActivityIcon color={color} size={size} showBadge={hasNewActivity} />
          ),
        }}
      />
      <Tabs.Screen
        name="account"
        options={{
          title: 'Account',
          tabBarIcon: ({ color, size }) => (
            <User color={color} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  badgeDot: {
    position: 'absolute',
    top: -2,
    right: -4,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.badge,
  },
  headerLogoContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    height: '100%',
  },
  headerLogo: {
    width: 110,
    height: 28,
    marginTop: 2.75,
    marginLeft: -2,
  },
});

import React, { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { Stack, useRouter, useSegments, useRootNavigationState } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ConvexProvider, ConvexReactClient } from 'convex/react';
import { AuthProvider, useAuth } from '../context/AuthContext';

const COLORS = {
  background: '#121212',
  primary: '#00A86B',
  textPrimary: '#FFFFFF',
};

// Initialize Convex client
const convexUrl = process.env.EXPO_PUBLIC_CONVEX_URL;
if (!convexUrl) {
  throw new Error(
    'Missing EXPO_PUBLIC_CONVEX_URL environment variable. ' +
    'Set it in .env.local for development or in your deployment platform for production.'
  );
}
const convex = new ConvexReactClient(convexUrl);

function useProtectedRoute(): void {
  const { isAuthenticated, isLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const navigationState = useRootNavigationState();

  useEffect(() => {
    // Wait for navigation to be ready and auth to load
    if (!navigationState?.key) return;
    if (isLoading) return;

    const inAuthGroup = segments[0] === 'auth';

    if (!isAuthenticated && !inAuthGroup) {
      // Redirect to login
      router.replace('/auth/login');
    } else if (isAuthenticated && inAuthGroup) {
      // Redirect to main app
      router.replace('/(tabs)');
    }
  }, [isAuthenticated, isLoading, segments, navigationState?.key, router]);
}

function RootLayoutNav(): React.ReactElement {
  const { isLoading } = useAuth();
  
  useProtectedRoute();

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <StatusBar style="light" />
      </View>
    );
  }

  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: {
            backgroundColor: COLORS.background,
          },
          headerTintColor: COLORS.textPrimary,
          contentStyle: {
            backgroundColor: COLORS.background,
          },
        }}
      >
        <Stack.Screen 
          name="(tabs)" 
          options={{ 
            headerShown: false,
          }} 
        />
        <Stack.Screen 
          name="auth/login" 
          options={{ 
            headerShown: false,
          }} 
        />
      </Stack>
    </>
  );
}

export default function RootLayout(): React.ReactElement {
  return (
    <ConvexProvider client={convex}>
      <AuthProvider>
        <RootLayoutNav />
      </AuthProvider>
    </ConvexProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

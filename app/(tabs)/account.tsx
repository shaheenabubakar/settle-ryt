import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { User, Settings, HelpCircle, LogOut, ChevronRight } from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { Id } from '../../convex/_generated/dataModel';

const COLORS = {
  background: '#121212',
  card: '#1E1E1E',
  primary: '#00A86B',
  error: '#FF4D4D',
  textPrimary: '#FFFFFF',
  textSecondary: '#B3B3B3',
  border: '#333333',
};

interface MenuItemProps {
  icon: React.ReactNode;
  label: string;
  onPress?: () => void;
  danger?: boolean;
  disabled?: boolean;
}

const MenuItem = ({ icon, label, onPress, danger, disabled }: MenuItemProps): React.ReactElement => (
  <TouchableOpacity 
    style={[styles.menuItem, disabled && styles.menuItemDisabled]} 
    onPress={onPress}
    activeOpacity={0.7}
    disabled={disabled}
  >
    <View style={styles.menuItemLeft}>
      {icon}
      <Text style={[styles.menuItemLabel, danger && styles.menuItemLabelDanger]}>
        {label}
      </Text>
    </View>
    <ChevronRight color={COLORS.textSecondary} size={20} />
  </TouchableOpacity>
);

export default function AccountScreen(): React.ReactElement {
  const { signOut, userId, isAuthenticated } = useAuth();
  const [isSigningOut, setIsSigningOut] = useState(false);
  
  // Fetch current user data
  const user = useQuery(
    api.auth.getUser, 
    userId ? { userId: userId as Id<'users'> } : 'skip'
  );

  const handleSignOut = async (): Promise<void> => {
    setIsSigningOut(true);
    await signOut();
  };

  // Don't show content if signing out or not authenticated
  if (isSigningOut || !isAuthenticated) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  const isLoading = userId && user === undefined;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Profile Card */}
      <View style={styles.profileCard}>
        <View style={styles.avatar}>
          <User color={COLORS.textPrimary} size={32} />
        </View>
        <View style={styles.profileInfo}>
          {isLoading ? (
            <ActivityIndicator size="small" color={COLORS.primary} />
          ) : (
            <>
              <Text style={styles.profileName}>
                {user?.username || 'Loading...'}
              </Text>
              <Text style={styles.profileEmail}>
                {user?.email || 'Loading...'}
              </Text>
            </>
          )}
        </View>
      </View>

      {/* Menu Items */}
      <View style={styles.menuSection}>
        <MenuItem
          icon={<User color={COLORS.textSecondary} size={22} />}
          label="Edit Profile"
        />
        <MenuItem
          icon={<Settings color={COLORS.textSecondary} size={22} />}
          label="Settings"
        />
        <MenuItem
          icon={<HelpCircle color={COLORS.textSecondary} size={22} />}
          label="Help & Support"
        />
      </View>

      {/* Logout */}
      <View style={styles.menuSection}>
        <MenuItem
          icon={<LogOut color={COLORS.error} size={22} />}
          label="Sign Out"
          danger
          onPress={handleSignOut}
        />
      </View>

      {/* App Info */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>SettleRyt v1.0.0</Text>
        <Text style={styles.footerText}>Malaysian Bill Splitting</Text>
      </View>
    </ScrollView>
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
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  profileEmail: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  menuSection: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    marginBottom: 16,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  menuItemDisabled: {
    opacity: 0.5,
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuItemLabel: {
    fontSize: 16,
    color: COLORS.textPrimary,
    marginLeft: 12,
  },
  menuItemLabelDanger: {
    color: COLORS.error,
  },
  footer: {
    alignItems: 'center',
    marginTop: 32,
  },
  footerText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
});

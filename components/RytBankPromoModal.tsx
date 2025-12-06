import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Animated,
  Easing,
} from 'react-native';
import { X, AlertCircle, ArrowRight, Sparkles } from 'lucide-react-native';

const COLORS = {
  background: '#121212',
  card: '#1E1E1E',
  cardElevated: '#2A2A2A',
  primary: '#00A86B',
  error: '#FF4D4D',
  warning: '#FFB800',
  textPrimary: '#FFFFFF',
  textSecondary: '#B3B3B3',
  textMuted: '#666666',
  border: '#333333',
};

interface RytBankPromoModalProps {
  visible: boolean;
  settledAmount: number;
  onClose: () => void;
}

const formatMoney = (amount: number): string => {
  return amount.toFixed(2);
};

export const RytBankPromoModal: React.FC<RytBankPromoModalProps> = ({
  visible,
  settledAmount,
  onClose,
}) => {
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const bounceAnim = useRef(new Animated.Value(0)).current;

  const cashbackAmount = Math.round(settledAmount * 0.01 * 100) / 100; // 1% cashback

  useEffect(() => {
    if (visible) {
      // Reset animations
      scaleAnim.setValue(0.8);
      opacityAnim.setValue(0);
      bounceAnim.setValue(0);

      // Entrance animation
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 6,
          tension: 100,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();

      // Bouncing coin animation
      Animated.loop(
        Animated.sequence([
          Animated.timing(bounceAnim, {
            toValue: -8,
            duration: 400,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(bounceAnim, {
            toValue: 0,
            duration: 400,
            easing: Easing.in(Easing.quad),
            useNativeDriver: true,
          }),
        ])
      ).start();
    }
  }, [visible]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Animated.View 
          style={[
            styles.container,
            {
              opacity: opacityAnim,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          {/* Close button */}
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <X color={COLORS.textSecondary} size={20} />
          </TouchableOpacity>

          {/* Icon with animation */}
          <Animated.View 
            style={[
              styles.iconContainer,
              { transform: [{ translateY: bounceAnim }] },
            ]}
          >
            <View style={styles.iconBg}>
              <AlertCircle color={COLORS.warning} size={40} />
            </View>
            <View style={styles.sparkle1}>
              <Sparkles color={COLORS.warning} size={16} />
            </View>
            <View style={styles.sparkle2}>
              <Sparkles color={COLORS.primary} size={12} />
            </View>
          </Animated.View>

          {/* Message */}
          <Text style={styles.title}>Oh no!</Text>
          <Text style={styles.message}>
            You haven't linked your{' '}
            <Text style={styles.highlight}>Ryt Bank</Text> account — you just
            missed out on an
          </Text>

          {/* Cashback amount highlight */}
          <View style={styles.cashbackContainer}>
            <Text style={styles.cashbackLabel}>RM</Text>
            <Text style={styles.cashbackAmount}>{formatMoney(cashbackAmount)}</Text>
            <View style={styles.percentBadge}>
              <Text style={styles.percentText}>1% cashback</Text>
            </View>
          </View>

          <Text style={styles.subtitle}>bonus!</Text>

          {/* CTA Buttons */}
          <View style={styles.buttonSection}>
            {/* Primary CTA - Link existing account */}
            <TouchableOpacity style={styles.primaryButton} activeOpacity={0.85}>
              <Text style={styles.primaryButtonText}>Link Ryt Bank Account</Text>
              <ArrowRight color={COLORS.textPrimary} size={18} />
            </TouchableOpacity>

            {/* Divider with "or" */}
            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Secondary CTA - Sign up */}
            <TouchableOpacity style={styles.secondaryButton} activeOpacity={0.85}>
              <Text style={styles.secondaryButtonText}>Sign Up for Ryt Bank</Text>
              <ArrowRight color={COLORS.textSecondary} size={18} />
            </TouchableOpacity>
            <Text style={styles.timeNote}>Registration only takes 2 mins..</Text>
          </View>

          {/* Maybe later */}
          <TouchableOpacity style={styles.laterButton} onPress={onClose} activeOpacity={0.7}>
            <Text style={styles.laterText}>Maybe later</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  container: {
    backgroundColor: COLORS.card,
    borderRadius: 24,
    padding: 28,
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
    position: 'relative',
  },
  closeButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    padding: 4,
  },
  iconContainer: {
    position: 'relative',
    marginBottom: 20,
    marginTop: 8,
  },
  iconBg: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 184, 0, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sparkle1: {
    position: 'absolute',
    top: -5,
    right: -10,
  },
  sparkle2: {
    position: 'absolute',
    bottom: 5,
    left: -8,
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    marginBottom: 12,
  },
  message: {
    fontSize: 15,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  highlight: {
    color: COLORS.primary,
    fontWeight: '600',
  },
  cashbackContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginVertical: 16,
  },
  cashbackLabel: {
    fontSize: 20,
    fontWeight: '600',
    color: COLORS.warning,
    marginRight: 4,
  },
  cashbackAmount: {
    fontSize: 42,
    fontWeight: 'bold',
    color: COLORS.warning,
  },
  percentBadge: {
    backgroundColor: 'rgba(255, 184, 0, 0.2)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginLeft: 10,
  },
  percentText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.warning,
  },
  subtitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: 24,
  },
  buttonSection: {
    width: '100%',
    alignItems: 'center',
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 24,
    width: '100%',
    gap: 8,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginVertical: 16,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: COLORS.border,
  },
  dividerText: {
    fontSize: 13,
    color: COLORS.textMuted,
    marginHorizontal: 16,
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 24,
    width: '100%',
    borderWidth: 1.5,
    borderColor: COLORS.border,
    gap: 8,
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  timeNote: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 10,
    fontStyle: 'italic',
    textAlign: 'center',
    width: '100%',
  },
  laterButton: {
    marginTop: 24,
    paddingVertical: 8,
  },
  laterText: {
    fontSize: 14,
    color: COLORS.textMuted,
    textDecorationLine: 'underline',
  },
});

export default RytBankPromoModal;


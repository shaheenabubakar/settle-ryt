import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Animated,
} from 'react-native';
import { AlertTriangle, Info, Trash2 } from 'lucide-react-native';

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

type ModalType = 'warning' | 'error' | 'info' | 'delete';

interface ConfirmModalProps {
  visible: boolean;
  type?: ModalType;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  visible,
  type = 'warning',
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  onConfirm,
  onCancel,
  isLoading = false,
}) => {
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      scaleAnim.setValue(0.8);
      opacityAnim.setValue(0);

      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 8,
          tension: 100,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  const getIconColor = (): string => {
    switch (type) {
      case 'error':
      case 'delete':
        return COLORS.error;
      case 'warning':
        return COLORS.warning;
      default:
        return COLORS.primary;
    }
  };

  const getIconBgColor = (): string => {
    switch (type) {
      case 'error':
      case 'delete':
        return 'rgba(255, 77, 77, 0.12)';
      case 'warning':
        return 'rgba(255, 184, 0, 0.12)';
      default:
        return 'rgba(0, 168, 107, 0.12)';
    }
  };

  const getConfirmButtonColor = (): string => {
    switch (type) {
      case 'error':
      case 'delete':
        return COLORS.error;
      default:
        return COLORS.primary;
    }
  };

  const renderIcon = (): React.ReactElement => {
    const iconColor = getIconColor();
    switch (type) {
      case 'delete':
        return <Trash2 color={iconColor} size={32} />;
      case 'error':
      case 'warning':
        return <AlertTriangle color={iconColor} size={32} />;
      default:
        return <Info color={iconColor} size={32} />;
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onCancel}
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
          {/* Icon */}
          <View style={[styles.iconContainer, { backgroundColor: getIconBgColor() }]}>
            {renderIcon()}
          </View>

          {/* Title */}
          <Text style={styles.title}>{title}</Text>

          {/* Message */}
          <Text style={styles.message}>{message}</Text>

          {/* Buttons */}
          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={onCancel}
              activeOpacity={0.8}
              disabled={isLoading}
            >
              <Text style={styles.cancelButtonText}>{cancelText}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.confirmButton,
                { backgroundColor: getConfirmButtonColor() },
                isLoading && styles.buttonDisabled,
              ]}
              onPress={onConfirm}
              activeOpacity={0.8}
              disabled={isLoading}
            >
              <Text style={styles.confirmButtonText}>
                {isLoading ? 'Please wait...' : confirmText}
              </Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  container: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 320,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  iconContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    marginBottom: 8,
    textAlign: 'center',
  },
  message: {
    fontSize: 15,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  buttonRow: {
    flexDirection: 'row',
    width: '100%',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: COLORS.cardElevated,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cancelButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  confirmButton: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  confirmButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});

export default ConfirmModal;


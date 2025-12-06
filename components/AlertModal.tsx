import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Animated,
} from 'react-native';
import { AlertTriangle, Info, XCircle } from 'lucide-react-native';

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

type AlertType = 'error' | 'warning' | 'info';

interface AlertModalProps {
  visible: boolean;
  type?: AlertType;
  title: string;
  message: string;
  buttonText?: string;
  onDismiss: () => void;
}

export const AlertModal: React.FC<AlertModalProps> = ({
  visible,
  type = 'info',
  title,
  message,
  buttonText = 'OK',
  onDismiss,
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
        return 'rgba(255, 77, 77, 0.12)';
      case 'warning':
        return 'rgba(255, 184, 0, 0.12)';
      default:
        return 'rgba(0, 168, 107, 0.12)';
    }
  };

  const renderIcon = (): React.ReactElement => {
    const iconColor = getIconColor();
    switch (type) {
      case 'error':
        return <XCircle color={iconColor} size={32} />;
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
      onRequestClose={onDismiss}
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

          {/* Button */}
          <TouchableOpacity
            style={styles.button}
            onPress={onDismiss}
            activeOpacity={0.8}
          >
            <Text style={styles.buttonText}>{buttonText}</Text>
          </TouchableOpacity>
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
  button: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 48,
    width: '100%',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textPrimary,
    textAlign: 'center',
  },
});

export default AlertModal;


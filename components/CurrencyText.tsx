import React from 'react';
import { Text, TextStyle, StyleProp } from 'react-native';

interface CurrencyTextProps {
  amount: number;
  style?: StyleProp<TextStyle>;
  showSign?: boolean; // Show + or - prefix
  colored?: boolean; // Green for positive, red for negative
}

const COLORS = {
  positive: '#00A86B',
  negative: '#FF4D4D',
  neutral: '#FFFFFF',
};

/**
 * CurrencyText - Formats numbers to Malaysian Ringgit (RM X.XX)
 * 
 * @param amount - The number to format (2-decimal float)
 * @param style - Additional text styles
 * @param showSign - Whether to show + or - prefix
 * @param colored - Whether to color based on positive/negative
 */
export const CurrencyText = ({ 
  amount, 
  style, 
  showSign = false,
  colored = false,
}: CurrencyTextProps): React.ReactElement => {
  // Round to 2 decimal places to avoid floating point issues
  const roundedAmount = Math.round(amount * 100) / 100;
  const isPositive = roundedAmount > 0;
  const isNegative = roundedAmount < 0;
  
  // Format the absolute value
  const formattedValue = Math.abs(roundedAmount).toFixed(2);
  
  // Build the display string
  let displayString = `RM ${formattedValue}`;
  
  if (showSign) {
    if (isPositive) {
      displayString = `+RM ${formattedValue}`;
    } else if (isNegative) {
      displayString = `-RM ${formattedValue}`;
    }
  } else if (isNegative) {
    displayString = `-RM ${formattedValue}`;
  }

  // Determine color
  let color: string | undefined;
  if (colored) {
    if (isPositive) {
      color = COLORS.positive;
    } else if (isNegative) {
      color = COLORS.negative;
    } else {
      color = COLORS.neutral;
    }
  }

  return (
    <Text style={[style, color ? { color } : undefined]}>
      {displayString}
    </Text>
  );
};

/**
 * Utility function to format currency without component
 */
export const formatCurrency = (amount: number): string => {
  const roundedAmount = Math.round(amount * 100) / 100;
  const isNegative = roundedAmount < 0;
  const formattedValue = Math.abs(roundedAmount).toFixed(2);
  
  return isNegative ? `-RM ${formattedValue}` : `RM ${formattedValue}`;
};

/**
 * Utility function to format currency with sign
 */
export const formatCurrencyWithSign = (amount: number): string => {
  const roundedAmount = Math.round(amount * 100) / 100;
  const formattedValue = Math.abs(roundedAmount).toFixed(2);
  
  if (roundedAmount > 0) {
    return `+RM ${formattedValue}`;
  } else if (roundedAmount < 0) {
    return `-RM ${formattedValue}`;
  }
  return `RM ${formattedValue}`;
};


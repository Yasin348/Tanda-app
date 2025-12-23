import React from 'react';
import { View, StyleSheet, ViewStyle, TouchableOpacity, StyleProp } from 'react-native';

interface CardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  variant?: 'default' | 'elevated' | 'outlined';
}

export const Card: React.FC<CardProps> = ({
  children,
  style,
  onPress,
  variant = 'default',
}) => {
  const getCardStyle = (): ViewStyle[] => {
    const baseStyle: ViewStyle[] = [styles.card];

    if (variant === 'elevated') baseStyle.push(styles.elevated);
    else if (variant === 'outlined') baseStyle.push(styles.outlined);
    else baseStyle.push(styles.default);

    return baseStyle;
  };

  if (onPress) {
    return (
      <TouchableOpacity
        style={[...getCardStyle(), style]}
        onPress={onPress}
        activeOpacity={0.7}
      >
        {children}
      </TouchableOpacity>
    );
  }

  return <View style={[...getCardStyle(), style]}>{children}</View>;
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    padding: 16,
  },
  default: {
    backgroundColor: '#fff',
  },
  elevated: {
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  outlined: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
});

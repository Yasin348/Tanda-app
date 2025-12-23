import React from 'react';
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  StyleSheet,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { colors, spacing, borderRadius, typography } from '../theme';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost';
  size?: 'small' | 'medium' | 'large';
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  fullWidth?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  size = 'medium',
  disabled = false,
  loading = false,
  style,
  textStyle,
  fullWidth = true,
}) => {
  const getButtonStyle = (): ViewStyle[] => {
    const baseStyle: ViewStyle[] = [styles.base];

    // Size
    if (size === 'small') baseStyle.push(styles.small);
    else if (size === 'large') baseStyle.push(styles.large);
    else baseStyle.push(styles.medium);

    // Variant
    if (variant === 'primary') baseStyle.push(styles.primary);
    else if (variant === 'secondary') baseStyle.push(styles.secondary);
    else if (variant === 'outline') baseStyle.push(styles.outline);
    else if (variant === 'danger') baseStyle.push(styles.danger);
    else if (variant === 'ghost') baseStyle.push(styles.ghost);

    // State
    if (disabled || loading) baseStyle.push(styles.disabled);

    // Width
    if (!fullWidth) baseStyle.push(styles.autoWidth);

    return baseStyle;
  };

  const getTextStyle = (): TextStyle[] => {
    const baseTextStyle: TextStyle[] = [styles.text];

    // Size
    if (size === 'small') baseTextStyle.push(styles.smallText);
    else if (size === 'large') baseTextStyle.push(styles.largeText);
    else baseTextStyle.push(styles.mediumText);

    // Variant
    if (variant === 'outline') baseTextStyle.push(styles.outlineText);
    else if (variant === 'secondary') baseTextStyle.push(styles.secondaryText);
    else if (variant === 'ghost') baseTextStyle.push(styles.ghostText);

    return baseTextStyle;
  };

  const getLoaderColor = () => {
    if (variant === 'outline' || variant === 'ghost') return colors.primary[500];
    if (variant === 'secondary') return colors.text.primary;
    return colors.text.inverse;
  };

  return (
    <TouchableOpacity
      style={[...getButtonStyle(), style]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
    >
      {loading ? (
        <ActivityIndicator color={getLoaderColor()} />
      ) : (
        <Text style={[...getTextStyle(), textStyle]}>{title}</Text>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  base: {
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    width: '100%',
  },
  autoWidth: {
    width: 'auto',
  },
  small: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
  },
  medium: {
    paddingVertical: spacing.md - 2,
    paddingHorizontal: spacing.lg,
  },
  large: {
    paddingVertical: spacing.md + 2,
    paddingHorizontal: spacing.xl,
  },
  primary: {
    backgroundColor: colors.primary[500],
    shadowColor: colors.primary[700],
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  secondary: {
    backgroundColor: colors.gray[100],
  },
  outline: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: colors.primary[500],
  },
  danger: {
    backgroundColor: colors.error,
    shadowColor: colors.error,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  ghost: {
    backgroundColor: 'transparent',
  },
  disabled: {
    opacity: 0.5,
  },
  text: {
    color: colors.text.inverse,
    fontWeight: '600',
  },
  smallText: {
    fontSize: 14,
  },
  mediumText: {
    fontSize: 16,
  },
  largeText: {
    fontSize: 17,
    fontWeight: '600',
  },
  outlineText: {
    color: colors.primary[500],
  },
  secondaryText: {
    color: colors.text.primary,
  },
  ghostText: {
    color: colors.primary[500],
  },
});

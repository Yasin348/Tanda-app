import React, { useState } from 'react';
import {
  View,
  TextInput,
  Text,
  StyleSheet,
  TextInputProps,
  TouchableOpacity,
  TextStyle,
} from 'react-native';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  onRightIconPress?: () => void;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  leftIcon,
  rightIcon,
  onRightIconPress,
  style,
  ...props
}) => {
  const [isFocused, setIsFocused] = useState(false);

  const inputStyle: TextStyle[] = [styles.input];
  if (leftIcon) inputStyle.push(styles.inputWithLeftIcon);

  return (
    <View style={styles.container}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View
        style={[
          styles.inputContainer,
          isFocused && styles.focused,
          error ? styles.error : undefined,
        ]}
      >
        {leftIcon && <View style={styles.leftIcon}>{leftIcon}</View>}
        <TextInput
          style={[...inputStyle, style as TextStyle]}
          placeholderTextColor="#94a3b8"
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          {...props}
        />
        {rightIcon && (
          <TouchableOpacity
            style={styles.rightIcon}
            onPress={onRightIconPress}
            disabled={!onRightIconPress}
          >
            {rightIcon}
          </TouchableOpacity>
        )}
      </View>
      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1e293b',
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  focused: {
    borderColor: '#3b82f6',
    backgroundColor: '#fff',
  },
  error: {
    borderColor: '#ef4444',
  },
  input: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#1e293b',
  },
  inputWithLeftIcon: {
    paddingLeft: 8,
  },
  leftIcon: {
    paddingLeft: 16,
  },
  rightIcon: {
    paddingRight: 16,
  },
  errorText: {
    fontSize: 12,
    color: '#ef4444',
    marginTop: 4,
    marginLeft: 4,
  },
});

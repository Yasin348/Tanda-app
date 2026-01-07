import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  TextInput,
  StyleSheet,
  Text,
  TouchableOpacity,
  Platform,
} from 'react-native';

interface PinInputProps {
  length?: number;
  onComplete: (pin: string) => void;
  error?: string;
  title?: string;
  subtitle?: string;
  resetKey?: string | number; // Para forzar reset del componente
}

export const PinInput: React.FC<PinInputProps> = ({
  length = 6,
  onComplete,
  error,
  title,
  subtitle,
  resetKey,
}) => {
  const [pin, setPin] = useState<string[]>(Array(length).fill(''));
  const [focusedIndex, setFocusedIndex] = useState(0);
  const inputRefs = useRef<(TextInput | null)[]>([]);
  const isWeb = Platform.OS === 'web';

  // Reset cuando cambia resetKey o error
  useEffect(() => {
    setPin(Array(length).fill(''));
    setFocusedIndex(0);
    setTimeout(() => {
      inputRefs.current[0]?.focus();
    }, 100);
  }, [resetKey, length]);

  useEffect(() => {
    if (error) {
      setPin(Array(length).fill(''));
      setFocusedIndex(0);
      setTimeout(() => {
        inputRefs.current[0]?.focus();
      }, 100);
    }
  }, [error, length]);

  // Focus inicial
  useEffect(() => {
    setTimeout(() => {
      inputRefs.current[0]?.focus();
    }, 100);
  }, []);

  const handleChange = (value: string, index: number) => {
    // Solo permitir dígitos
    const cleanValue = value.replace(/[^0-9]/g, '');

    if (cleanValue.length === 0) {
      const newPin = [...pin];
      newPin[index] = '';
      setPin(newPin);
      return;
    }

    // Tomar solo el último dígito si pegan varios
    const digit = cleanValue[cleanValue.length - 1];

    const newPin = [...pin];
    newPin[index] = digit;
    setPin(newPin);

    // Mover al siguiente input
    if (index < length - 1) {
      setFocusedIndex(index + 1);
      inputRefs.current[index + 1]?.focus();
    }

    // Verificar si está completo
    const fullPin = newPin.join('');
    if (fullPin.length === length && newPin.every(d => d !== '')) {
      onComplete(fullPin);
    }
  };

  const handleKeyPress = (e: any, index: number) => {
    const key = e.nativeEvent?.key || e.key;

    if (key === 'Backspace') {
      if (!pin[index] && index > 0) {
        // Si el campo actual está vacío, ir al anterior
        const newPin = [...pin];
        newPin[index - 1] = '';
        setPin(newPin);
        setFocusedIndex(index - 1);
        inputRefs.current[index - 1]?.focus();
      } else {
        // Limpiar el campo actual
        const newPin = [...pin];
        newPin[index] = '';
        setPin(newPin);
      }
    }
  };

  const handleFocus = (index: number) => {
    setFocusedIndex(index);
  };

  const handlePress = (index: number) => {
    setFocusedIndex(index);
    inputRefs.current[index]?.focus();
  };

  return (
    <View style={styles.container}>
      {title && <Text style={styles.title}>{title}</Text>}
      {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}

      <View style={styles.inputContainer}>
        {pin.map((digit, index) => (
          <TouchableOpacity
            key={index}
            style={[
              styles.inputWrapper,
              digit ? styles.inputFilled : undefined,
              focusedIndex === index ? styles.inputFocused : undefined,
              error ? styles.inputError : undefined,
            ]}
            onPress={() => handlePress(index)}
            activeOpacity={1}
          >
            {isWeb ? (
              // En web, mostrar input visible
              <TextInput
                ref={(ref) => {
                  inputRefs.current[index] = ref;
                }}
                style={styles.inputWeb}
                value={digit ? '•' : ''}
                onChangeText={(value) => handleChange(value, index)}
                onKeyPress={(e) => handleKeyPress(e, index)}
                onFocus={() => handleFocus(index)}
                keyboardType="number-pad"
                maxLength={2}
                autoComplete="off"
                autoCorrect={false}
                caretHidden={true}
              />
            ) : (
              // En native, input oculto con dot visual
              <>
                <TextInput
                  ref={(ref) => {
                    inputRefs.current[index] = ref;
                  }}
                  style={styles.inputNative}
                  value={digit}
                  onChangeText={(value) => handleChange(value, index)}
                  onKeyPress={(e) => handleKeyPress(e, index)}
                  onFocus={() => handleFocus(index)}
                  keyboardType="number-pad"
                  maxLength={1}
                  selectTextOnFocus
                  secureTextEntry
                />
                {digit ? <View style={styles.dot} /> : null}
              </>
            )}
          </TouchableOpacity>
        ))}
      </View>

      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#64748b',
    marginBottom: 32,
    textAlign: 'center',
  },
  inputContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
  },
  inputWrapper: {
    width: 48,
    height: 56,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
    borderWidth: 2,
    borderColor: '#e2e8f0',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  inputFilled: {
    borderColor: '#3b82f6',
    backgroundColor: '#eff6ff',
  },
  inputFocused: {
    borderColor: '#3b82f6',
    borderWidth: 2,
  },
  inputError: {
    borderColor: '#ef4444',
    backgroundColor: '#fef2f2',
  },
  inputWeb: {
    width: '100%',
    height: '100%',
    textAlign: 'center',
    fontSize: 24,
    fontWeight: '700',
    color: '#3b82f6',
    backgroundColor: 'transparent',
    borderWidth: 0,
    outlineStyle: 'none',
  } as any,
  inputNative: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    opacity: 0,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#3b82f6',
  },
  error: {
    color: '#ef4444',
    fontSize: 14,
    marginTop: 16,
    textAlign: 'center',
  },
});

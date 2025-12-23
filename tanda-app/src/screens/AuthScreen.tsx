import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  Platform,
  TextInput,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
} from 'react-native';
import { PinInput, Button } from '../components';
import { useAuthStore } from '../stores/authStore';
import { secureStorage } from '../services/storage';

interface AuthScreenProps {
  onSuccess: () => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ onSuccess }) => {
  const { securitySettings, authenticate, authenticateWithPin, logout, initializeFromSeed } = useAuthStore();
  const [showPinInput, setShowPinInput] = useState(false);
  const [pinError, setPinError] = useState<string | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(true);

  // Estado para recuperación con seed
  const [showSeedRecovery, setShowSeedRecovery] = useState(false);
  const [seedWords, setSeedWords] = useState<string[]>(Array(12).fill(''));
  const [seedError, setSeedError] = useState<string | null>(null);
  const [isVerifyingSeed, setIsVerifyingSeed] = useState(false);
  const [showNewPinSetup, setShowNewPinSetup] = useState(false);
  const [newPin, setNewPin] = useState('');

  const handleForgotPin = () => {
    // Mostrar pantalla de recuperación con seed en vez de borrar directamente
    setShowSeedRecovery(true);
    setSeedWords(Array(12).fill(''));
    setSeedError(null);
  };

  const handleSeedWordChange = (index: number, word: string) => {
    const newWords = [...seedWords];
    newWords[index] = word.toLowerCase().trim();
    setSeedWords(newWords);
    setSeedError(null);
  };

  const handleVerifySeed = async () => {
    const enteredSeed = seedWords.join(' ').trim();

    if (seedWords.some(w => !w)) {
      setSeedError('Completa todas las palabras');
      return;
    }

    setIsVerifyingSeed(true);
    setSeedError(null);

    try {
      // Obtener la seed guardada
      const storedSeed = await secureStorage.getSeed();

      if (!storedSeed) {
        setSeedError('No hay cuenta en este dispositivo');
        setIsVerifyingSeed(false);
        return;
      }

      // Comparar seeds
      if (enteredSeed === storedSeed) {
        // Seed correcta - mostrar configuración de nuevo PIN
        setShowNewPinSetup(true);
        setShowSeedRecovery(false);
      } else {
        setSeedError('La frase no coincide con tu cuenta');
      }
    } catch (error) {
      console.error('Error verifying seed:', error);
      setSeedError('Error al verificar. Intenta de nuevo.');
    } finally {
      setIsVerifyingSeed(false);
    }
  };

  const handleNewPinComplete = async (pin: string) => {
    if (!newPin) {
      // Primera entrada - guardar y pedir confirmación
      setNewPin(pin);
      return;
    }

    // Confirmar PIN
    if (pin !== newPin) {
      setPinError('Los PINs no coinciden');
      setNewPin('');
      return;
    }

    // Guardar nuevo PIN
    try {
      const hash = await secureStorage.hashPinAsync(pin);
      await secureStorage.savePinHash(hash);

      // Actualizar settings
      const settings = await secureStorage.getSecuritySettings();
      if (settings) {
        await secureStorage.saveSecuritySettings({
          ...settings,
          pinEnabled: true,
          pinHash: hash,
        });
      }

      // Éxito - continuar
      onSuccess();
    } catch (error) {
      console.error('Error saving new PIN:', error);
      setPinError('Error al guardar el PIN');
    }
  };

  const handleCancelRecovery = () => {
    setShowSeedRecovery(false);
    setShowNewPinSetup(false);
    setSeedWords(Array(12).fill(''));
    setSeedError(null);
    setNewPin('');
    setPinError(null);
  };

  useEffect(() => {
    attemptBiometricAuth();
  }, []);

  const attemptBiometricAuth = async () => {
    if (securitySettings?.noProtection) {
      onSuccess();
      return;
    }

    if (securitySettings?.biometricEnabled) {
      setIsAuthenticating(true);
      const success = await authenticate();
      setIsAuthenticating(false);

      if (success) {
        onSuccess();
        return;
      }
    }

    // Si la biometría falla o no está disponible, mostrar PIN
    if (securitySettings?.pinEnabled) {
      setShowPinInput(true);
    }

    setIsAuthenticating(false);
  };

  const handlePinComplete = async (pin: string) => {
    const success = await authenticateWithPin(pin);
    if (success) {
      onSuccess();
    } else {
      setPinError('PIN incorrecto');
    }
  };

  const getBiometricLabel = () => {
    if (securitySettings?.biometricType === 'faceId') return 'Face ID';
    return 'huella dactilar';
  };

  if (isAuthenticating) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          <View style={styles.iconContainer}>
            <Text style={styles.icon}>🔐</Text>
          </View>
          <Text style={styles.title}>Verificando...</Text>
          <ActivityIndicator size="large" color="#3b82f6" style={{ marginTop: 20 }} />
        </View>
      </SafeAreaView>
    );
  }

  // Pantalla de configuración de nuevo PIN
  if (showNewPinSetup) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          <PinInput
            title={newPin ? "Confirma tu nuevo PIN" : "Crea un nuevo PIN"}
            subtitle={newPin ? "Ingresa el mismo PIN para confirmar" : "Elige un PIN de 4 digitos que recuerdes"}
            onComplete={handleNewPinComplete}
            error={pinError || undefined}
          />

          <Button
            title="Cancelar"
            onPress={handleCancelRecovery}
            variant="ghost"
            style={{ marginTop: 24 }}
          />
        </View>
      </SafeAreaView>
    );
  }

  // Pantalla de recuperación con seed
  if (showSeedRecovery) {
    return (
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          <ScrollView
            contentContainerStyle={styles.seedRecoveryContent}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.seedHeader}>
              <View style={styles.seedIconContainer}>
                <Text style={styles.seedIcon}>🔑</Text>
              </View>
              <Text style={styles.seedTitle}>Recuperar con frase</Text>
              <Text style={styles.seedSubtitle}>
                Ingresa las 12 palabras de tu frase de recuperacion en orden
              </Text>
            </View>

            <View style={styles.seedGrid}>
              {seedWords.map((word, index) => (
                <View key={index} style={styles.seedWordContainer}>
                  <Text style={styles.seedWordNumber}>{index + 1}</Text>
                  <TextInput
                    style={styles.seedWordInput}
                    value={word}
                    onChangeText={(text) => handleSeedWordChange(index, text)}
                    placeholder="palabra"
                    placeholderTextColor="#94a3b8"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>
              ))}
            </View>

            {seedError && (
              <View style={styles.seedErrorContainer}>
                <Text style={styles.seedErrorText}>{seedError}</Text>
              </View>
            )}

            <View style={styles.seedButtons}>
              <Button
                title={isVerifyingSeed ? "Verificando..." : "Verificar y continuar"}
                onPress={handleVerifySeed}
                disabled={isVerifyingSeed || seedWords.some(w => !w)}
                loading={isVerifyingSeed}
              />
              <Button
                title="Cancelar"
                onPress={handleCancelRecovery}
                variant="ghost"
                style={{ marginTop: 12 }}
              />
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  if (showPinInput) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          <PinInput
            title="Ingresa tu PIN"
            subtitle="Verifica tu identidad para continuar"
            onComplete={handlePinComplete}
            error={pinError || undefined}
          />

          {securitySettings?.biometricEnabled && (
            <Button
              title={`Usar ${getBiometricLabel()}`}
              onPress={attemptBiometricAuth}
              variant="outline"
              style={{ marginTop: 24 }}
            />
          )}

          <Button
            title="Olvide mi PIN"
            onPress={handleForgotPin}
            variant="ghost"
            style={{ marginTop: 16 }}
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <Text style={styles.icon}>🔐</Text>
        </View>
        <Text style={styles.title}>Tanda</Text>
        <Text style={styles.subtitle}>Verifica tu identidad</Text>

        {securitySettings?.biometricEnabled && (
          <Button
            title={`Usar ${getBiometricLabel()}`}
            onPress={attemptBiometricAuth}
            style={{ marginTop: 32 }}
          />
        )}

        {securitySettings?.pinEnabled && (
          <Button
            title="Usar PIN"
            onPress={() => setShowPinInput(true)}
            variant="outline"
            style={{ marginTop: 12 }}
          />
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  iconContainer: {
    width: 100,
    height: 100,
    borderRadius: 24,
    backgroundColor: '#eff6ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  icon: {
    fontSize: 48,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#64748b',
  },
  // Seed recovery styles
  seedRecoveryContent: {
    padding: 24,
    paddingBottom: 40,
  },
  seedHeader: {
    alignItems: 'center',
    marginBottom: 32,
  },
  seedIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 20,
    backgroundColor: '#fef3c7',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  seedIcon: {
    fontSize: 40,
  },
  seedTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 8,
  },
  seedSubtitle: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 20,
  },
  seedGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  seedWordContainer: {
    width: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  seedWordNumber: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94a3b8',
    width: 20,
  },
  seedWordInput: {
    flex: 1,
    fontSize: 15,
    color: '#1e293b',
    paddingVertical: 8,
  },
  seedErrorContainer: {
    backgroundColor: '#fef2f2',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  seedErrorText: {
    color: '#dc2626',
    fontSize: 14,
    textAlign: 'center',
  },
  seedButtons: {
    marginTop: 8,
  },
});

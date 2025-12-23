import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Platform,
  Modal,
} from 'react-native';
import { Card, Button } from '../../components';
import { useAuthStore } from '../../stores/authStore';
import { secureStorage } from '../../services/storage';

interface SecuritySettingsScreenProps {
  navigation: any;
}

export const SecuritySettingsScreen: React.FC<SecuritySettingsScreenProps> = ({
  navigation,
}) => {
  const { securitySettings, setSecuritySettings } = useAuthStore();
  const [showChangePin, setShowChangePin] = useState(false);
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showSeedModal, setShowSeedModal] = useState(false);
  const [seedWords, setSeedWords] = useState<string[]>([]);

  const handleChangePin = async () => {
    setError(null);

    // Validar PIN actual
    if (securitySettings?.pinEnabled) {
      const isValid = await secureStorage.verifyPin(currentPin);
      if (!isValid) {
        setError('El PIN actual es incorrecto');
        return;
      }
    }

    // Validar nuevo PIN
    if (newPin.length < 4) {
      setError('El PIN debe tener al menos 4 dígitos');
      return;
    }

    if (newPin !== confirmPin) {
      setError('Los PINs no coinciden');
      return;
    }

    setIsLoading(true);
    try {
      const pinHash = secureStorage.hashPin(newPin);
      await secureStorage.savePinHash(pinHash);

      const newSettings = {
        biometricEnabled: securitySettings?.biometricEnabled ?? false,
        biometricType: securitySettings?.biometricType ?? null,
        noProtection: false,
        pinEnabled: true,
        pinHash: pinHash,
      };
      await setSecuritySettings(newSettings);

      // Reset form
      setCurrentPin('');
      setNewPin('');
      setConfirmPin('');
      setShowChangePin(false);

      if (Platform.OS === 'web') {
        window.alert('PIN actualizado correctamente');
      } else {
        Alert.alert('Éxito', 'PIN actualizado correctamente');
      }
    } catch (err) {
      setError('Error al actualizar el PIN');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisablePin = async () => {
    const confirmMessage = '¿Estás seguro de desactivar el PIN? Tu cuenta quedará menos protegida.';

    const doDisable = async () => {
      try {
        const newSettings = {
          biometricEnabled: securitySettings?.biometricEnabled ?? false,
          biometricType: securitySettings?.biometricType ?? null,
          pinEnabled: false,
          pinHash: undefined,
          noProtection: !securitySettings?.biometricEnabled,
        };
        await setSecuritySettings(newSettings);

        if (Platform.OS === 'web') {
          window.alert('PIN desactivado');
        } else {
          Alert.alert('Éxito', 'PIN desactivado');
        }
      } catch (err) {
        console.error('Error disabling PIN:', err);
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm(confirmMessage)) {
        await doDisable();
      }
    } else {
      Alert.alert('Desactivar PIN', confirmMessage, [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Desactivar', style: 'destructive', onPress: doDisable },
      ]);
    }
  };

  const handleShowSeed = async () => {
    const seed = await secureStorage.getSeed();
    if (seed) {
      setSeedWords(seed.split(' '));
      setShowSeedModal(true);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Seguridad</Text>
          <Text style={styles.subtitle}>
            Gestiona la seguridad de tu cuenta
          </Text>
        </View>

        {/* Seed Phrase */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Frase de recuperación</Text>
          <TouchableOpacity onPress={handleShowSeed}>
            <Card variant="outlined" style={styles.menuItem}>
              <Text style={styles.menuIcon}>🔑</Text>
              <View style={styles.menuContent}>
                <Text style={styles.menuTitle}>Ver 12 palabras secretas</Text>
                <Text style={styles.menuSubtitle}>
                  Úsalas para recuperar tu cuenta en otro dispositivo
                </Text>
              </View>
              <Text style={styles.menuArrow}>›</Text>
            </Card>
          </TouchableOpacity>
        </View>

        {/* PIN Management */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>PIN de acceso</Text>

          {!showChangePin ? (
            <>
              <TouchableOpacity onPress={() => setShowChangePin(true)}>
                <Card variant="outlined" style={styles.menuItem}>
                  <Text style={styles.menuIcon}>🔢</Text>
                  <View style={styles.menuContent}>
                    <Text style={styles.menuTitle}>
                      {securitySettings?.pinEnabled ? 'Cambiar PIN' : 'Configurar PIN'}
                    </Text>
                    <Text style={styles.menuSubtitle}>
                      {securitySettings?.pinEnabled
                        ? 'Actualiza tu código de acceso'
                        : 'Protege tu cuenta con un código'}
                    </Text>
                  </View>
                  <Text style={styles.menuArrow}>›</Text>
                </Card>
              </TouchableOpacity>

              {securitySettings?.pinEnabled && (
                <TouchableOpacity onPress={handleDisablePin}>
                  <Card variant="outlined" style={[styles.menuItem, styles.dangerItem]}>
                    <Text style={styles.menuIcon}>🚫</Text>
                    <View style={styles.menuContent}>
                      <Text style={[styles.menuTitle, styles.dangerText]}>Desactivar PIN</Text>
                      <Text style={styles.menuSubtitle}>
                        No recomendado - tu cuenta quedará desprotegida
                      </Text>
                    </View>
                  </Card>
                </TouchableOpacity>
              )}
            </>
          ) : (
            <Card variant="outlined" style={styles.pinForm}>
              <Text style={styles.pinFormTitle}>
                {securitySettings?.pinEnabled ? 'Cambiar PIN' : 'Crear PIN'}
              </Text>

              {securitySettings?.pinEnabled && (
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>PIN actual</Text>
                  <TextInput
                    style={styles.pinInput}
                    value={currentPin}
                    onChangeText={setCurrentPin}
                    placeholder="••••"
                    keyboardType="numeric"
                    secureTextEntry
                    maxLength={6}
                  />
                </View>
              )}

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Nuevo PIN</Text>
                <TextInput
                  style={styles.pinInput}
                  value={newPin}
                  onChangeText={setNewPin}
                  placeholder="••••"
                  keyboardType="numeric"
                  secureTextEntry
                  maxLength={6}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Confirmar PIN</Text>
                <TextInput
                  style={styles.pinInput}
                  value={confirmPin}
                  onChangeText={setConfirmPin}
                  placeholder="••••"
                  keyboardType="numeric"
                  secureTextEntry
                  maxLength={6}
                />
              </View>

              {error && (
                <View style={styles.errorContainer}>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}

              <View style={styles.pinFormButtons}>
                <Button
                  title="Guardar"
                  onPress={handleChangePin}
                  loading={isLoading}
                  disabled={!newPin || !confirmPin}
                />
                <Button
                  title="Cancelar"
                  variant="secondary"
                  onPress={() => {
                    setShowChangePin(false);
                    setCurrentPin('');
                    setNewPin('');
                    setConfirmPin('');
                    setError(null);
                  }}
                />
              </View>
            </Card>
          )}
        </View>

        {/* Warning */}
        <Card variant="outlined" style={styles.warningCard}>
          <Text style={styles.warningIcon}>⚠️</Text>
          <Text style={styles.warningText}>
            El PIN solo funciona en este dispositivo. Si cambias de dispositivo,
            necesitarás tu frase de 12 palabras para recuperar tu cuenta.
          </Text>
        </Card>
      </ScrollView>

      {/* Seed Phrase Modal */}
      <Modal
        visible={showSeedModal}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowSeedModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalIcon}>🔑</Text>
              <Text style={styles.modalTitle}>Tus 12 palabras secretas</Text>
            </View>

            <View style={styles.seedGrid}>
              {seedWords.map((word, index) => (
                <View key={index} style={styles.wordCard}>
                  <Text style={styles.wordNumber}>{index + 1}</Text>
                  <Text style={styles.wordText}>{word}</Text>
                </View>
              ))}
            </View>

            <View style={styles.modalWarning}>
              <Text style={styles.modalWarningIcon}>⚠️</Text>
              <Text style={styles.modalWarningText}>
                No compartas estas palabras con nadie
              </Text>
            </View>

            <Button
              title="Cerrar"
              onPress={() => setShowSeedModal(false)}
              variant="secondary"
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  scrollContent: {
    padding: 20,
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: '#64748b',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 12,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    marginBottom: 8,
  },
  dangerItem: {
    borderColor: '#fecaca',
    backgroundColor: '#fef2f2',
  },
  menuIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  menuContent: {
    flex: 1,
  },
  menuTitle: {
    fontSize: 15,
    fontWeight: '500',
    color: '#1e293b',
  },
  dangerText: {
    color: '#dc2626',
  },
  menuSubtitle: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 2,
  },
  menuArrow: {
    fontSize: 20,
    color: '#94a3b8',
  },
  pinForm: {
    padding: 20,
  },
  pinFormTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 16,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#64748b',
    marginBottom: 8,
  },
  pinInput: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 14,
    fontSize: 18,
    textAlign: 'center',
    letterSpacing: 8,
    backgroundColor: '#f8fafc',
  },
  errorContainer: {
    backgroundColor: '#fef2f2',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  errorText: {
    color: '#dc2626',
    fontSize: 14,
    textAlign: 'center',
  },
  pinFormButtons: {
    gap: 12,
    marginTop: 8,
  },
  warningCard: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#fffbeb',
    borderColor: '#fcd34d',
  },
  warningIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  warningText: {
    flex: 1,
    fontSize: 13,
    color: '#92400e',
    lineHeight: 18,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  modalIcon: {
    fontSize: 40,
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1e293b',
    textAlign: 'center',
  },
  seedGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
  },
  wordCard: {
    width: '31%',
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  wordNumber: {
    fontSize: 11,
    fontWeight: '600',
    color: '#94a3b8',
    width: 18,
  },
  wordText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#1e293b',
    flex: 1,
  },
  modalWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef2f2',
    padding: 12,
    borderRadius: 10,
    marginBottom: 16,
  },
  modalWarningIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  modalWarningText: {
    fontSize: 13,
    color: '#dc2626',
    fontWeight: '500',
  },
});

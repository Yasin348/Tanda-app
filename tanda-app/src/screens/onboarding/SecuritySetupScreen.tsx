import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Platform,
  StatusBar,
} from 'react-native';
import { Button, PinInput } from '../../components';
import { secureStorage } from '../../services/storage';
import { SecuritySettings } from '../../types';
import { colors, spacing, borderRadius, typography, shadows } from '../../theme';
import { showAlert, alertMessage } from '../../utils/alert';

interface SecuritySetupScreenProps {
  onContinue: (settings: SecuritySettings) => void;
  onBack: () => void;
}

type SecurityMethod = 'biometric' | 'pin' | 'none';
type SetupStep = 'select' | 'pin_create' | 'pin_confirm';

export const SecuritySetupScreen: React.FC<SecuritySetupScreenProps> = ({
  onContinue,
  onBack,
}) => {
  const [step, setStep] = useState<SetupStep>('select');
  const [selectedMethods, setSelectedMethods] = useState<SecurityMethod[]>([]);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricType, setBiometricType] = useState<'fingerprint' | 'faceId' | null>(null);
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);

  useEffect(() => {
    checkBiometric();
  }, []);

  const checkBiometric = async () => {
    const { available, type } = await secureStorage.checkBiometricAvailability();
    setBiometricAvailable(available);
    setBiometricType(type);
  };

  const toggleMethod = (method: SecurityMethod) => {
    if (method === 'none') {
      if (selectedMethods.includes('none')) {
        setSelectedMethods([]);
      } else {
        showAlert(
          '¿Estás seguro?',
          'Sin protección, cualquiera con acceso a tu dispositivo podría ver tu cuenta.',
          [
            { text: 'Cancelar', style: 'cancel' },
            {
              text: 'Continuar sin protección',
              style: 'destructive',
              onPress: () => setSelectedMethods(['none']),
            },
          ]
        );
      }
      return;
    }

    let newMethods = selectedMethods.filter((m) => m !== 'none');

    if (newMethods.includes(method)) {
      newMethods = newMethods.filter((m) => m !== method);
    } else {
      newMethods.push(method);
    }

    setSelectedMethods(newMethods);
  };

  const handleContinue = () => {
    if (selectedMethods.length === 0) {
      alertMessage('Selecciona un método', 'Debes elegir al menos un método de seguridad.');
      return;
    }

    if (selectedMethods.includes('pin')) {
      setStep('pin_create');
    } else {
      finishSetup();
    }
  };

  const handlePinCreate = (enteredPin: string) => {
    setPin(enteredPin);
    setPinError(null);
    setStep('pin_confirm');
  };

  const handlePinConfirm = (confirmedPin: string) => {
    if (confirmedPin === pin) {
      finishSetup(confirmedPin);
    } else {
      setPinError('Los PINs no coinciden. Intenta de nuevo.');
      setPin('');
      setStep('pin_create');
    }
  };

  const finishSetup = (pinValue?: string) => {
    const settings: SecuritySettings = {
      biometricEnabled: selectedMethods.includes('biometric'),
      biometricType: selectedMethods.includes('biometric') ? biometricType : null,
      pinEnabled: selectedMethods.includes('pin'),
      pinHash: pinValue ? secureStorage.hashPin(pinValue) : undefined,
      noProtection: selectedMethods.includes('none'),
    };

    onContinue(settings);
  };

  const getBiometricLabel = () => {
    if (biometricType === 'faceId') return 'Face ID';
    if (biometricType === 'fingerprint') return 'Huella dactilar';
    return 'Biometría';
  };

  const getBiometricIcon = () => {
    if (biometricType === 'faceId') return '👤';
    return '👆';
  };

  if (step === 'pin_create' || step === 'pin_confirm') {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" />
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.pinContainer}>
            <View style={styles.pinHeader}>
              <View style={styles.pinIconContainer}>
                <Text style={styles.pinIcon}>🔢</Text>
              </View>
              <Text style={styles.pinTitle}>
                {step === 'pin_create' ? 'Crea tu PIN' : 'Confirma tu PIN'}
              </Text>
              <Text style={styles.pinSubtitle}>
                {step === 'pin_create'
                  ? 'Elige 6 dígitos que puedas recordar'
                  : 'Ingresa los mismos 6 dígitos'}
              </Text>
            </View>

            <PinInput
              onComplete={step === 'pin_create' ? handlePinCreate : handlePinConfirm}
              error={pinError || undefined}
              resetKey={step}
            />
          </View>

          <View style={styles.buttons}>
            <Button
              title="Volver"
              onPress={() => {
                if (step === 'pin_confirm') {
                  setStep('pin_create');
                  setPin('');
                } else {
                  setStep('select');
                }
              }}
              variant="ghost"
              size="large"
            />
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.iconContainer}>
              <Text style={styles.icon}>🛡️</Text>
            </View>
            <Text style={styles.title}>Protege tu cuenta</Text>
            <Text style={styles.subtitle}>
              Elige cómo quieres verificar tu identidad al abrir la app
            </Text>
          </View>

          {/* Options */}
          <View style={styles.options}>
            {biometricAvailable && (
              <SecurityOption
                icon={getBiometricIcon()}
                title={getBiometricLabel()}
                description="Rápido y seguro"
                selected={selectedMethods.includes('biometric')}
                onPress={() => toggleMethod('biometric')}
                recommended
              />
            )}

            <SecurityOption
              icon="🔢"
              title="PIN de 6 dígitos"
              description="Siempre disponible como respaldo"
              selected={selectedMethods.includes('pin')}
              onPress={() => toggleMethod('pin')}
            />

            <SecurityOption
              icon="⚠️"
              title="Sin protección"
              description="No recomendado"
              selected={selectedMethods.includes('none')}
              onPress={() => toggleMethod('none')}
              danger
            />
          </View>

          {/* Info Card */}
          {selectedMethods.includes('biometric') && selectedMethods.includes('pin') && (
            <View style={styles.infoCard}>
              <Text style={styles.infoIcon}>💡</Text>
              <Text style={styles.infoText}>
                Usaremos {getBiometricLabel()} como método principal y el PIN como respaldo
              </Text>
            </View>
          )}
        </ScrollView>

        {/* Buttons */}
        <View style={styles.buttons}>
          <Button
            title="Continuar"
            onPress={handleContinue}
            size="large"
            disabled={selectedMethods.length === 0}
          />
          <Button
            title="Volver"
            onPress={onBack}
            variant="ghost"
            size="large"
          />
        </View>
      </SafeAreaView>
    </View>
  );
};

const SecurityOption: React.FC<{
  icon: string;
  title: string;
  description: string;
  selected: boolean;
  onPress: () => void;
  recommended?: boolean;
  danger?: boolean;
}> = ({ icon, title, description, selected, onPress, recommended, danger }) => (
  <TouchableOpacity
    style={[
      styles.option,
      selected && styles.optionSelected,
      danger && styles.optionDanger,
      selected && danger && styles.optionDangerSelected,
    ]}
    onPress={onPress}
    activeOpacity={0.7}
  >
    <View style={styles.optionLeft}>
      <View style={[
        styles.optionIconContainer,
        selected && styles.optionIconSelected,
        danger && styles.optionIconDanger,
      ]}>
        <Text style={styles.optionIcon}>{icon}</Text>
      </View>
      <View style={styles.optionText}>
        <View style={styles.optionTitleRow}>
          <Text style={styles.optionTitle}>{title}</Text>
          {recommended && (
            <View style={styles.recommendedBadge}>
              <Text style={styles.recommendedText}>Recomendado</Text>
            </View>
          )}
        </View>
        <Text style={styles.optionDescription}>{description}</Text>
      </View>
    </View>
    <View style={[
      styles.radio,
      selected && styles.radioSelected,
      selected && danger && styles.radioDanger,
    ]}>
      {selected && <View style={styles.radioInner} />}
    </View>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: 0,
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  iconContainer: {
    width: 72,
    height: 72,
    borderRadius: 24,
    backgroundColor: colors.primary[50],
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  icon: {
    fontSize: 36,
  },
  title: {
    ...typography.h2,
    color: colors.text.primary,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  subtitle: {
    ...typography.body,
    color: colors.text.tertiary,
    textAlign: 'center',
  },
  options: {
    gap: spacing.sm,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  optionSelected: {
    borderColor: colors.primary[500],
    backgroundColor: colors.primary[50],
  },
  optionDanger: {
    backgroundColor: colors.gray[50],
  },
  optionDangerSelected: {
    borderColor: colors.error,
    backgroundColor: '#fef2f2',
  },
  optionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  optionIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: colors.background.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  optionIconSelected: {
    backgroundColor: colors.primary[100],
  },
  optionIconDanger: {
    backgroundColor: '#fee2e2',
  },
  optionIcon: {
    fontSize: 24,
  },
  optionText: {
    flex: 1,
  },
  optionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  optionTitle: {
    ...typography.bodySemibold,
    color: colors.text.primary,
  },
  optionDescription: {
    ...typography.small,
    color: colors.text.tertiary,
    marginTop: 2,
  },
  recommendedBadge: {
    backgroundColor: colors.primary[100],
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
  },
  recommendedText: {
    ...typography.caption,
    color: colors.primary[700],
    fontWeight: '600',
  },
  radio: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.gray[300],
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioSelected: {
    borderColor: colors.primary[500],
  },
  radioDanger: {
    borderColor: colors.error,
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.primary[500],
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary[50],
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginTop: spacing.lg,
    borderWidth: 1,
    borderColor: colors.primary[100],
  },
  infoIcon: {
    fontSize: 20,
    marginRight: spacing.sm,
  },
  infoText: {
    ...typography.small,
    color: colors.primary[700],
    flex: 1,
  },
  buttons: {
    padding: spacing.lg,
    gap: spacing.sm,
  },
  // PIN Screen styles
  pinContainer: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  pinHeader: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  pinIconContainer: {
    width: 72,
    height: 72,
    borderRadius: 24,
    backgroundColor: colors.primary[50],
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  pinIcon: {
    fontSize: 36,
  },
  pinTitle: {
    ...typography.h2,
    color: colors.text.primary,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  pinSubtitle: {
    ...typography.body,
    color: colors.text.tertiary,
    textAlign: 'center',
  },
});

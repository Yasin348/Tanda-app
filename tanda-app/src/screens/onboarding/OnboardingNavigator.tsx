import React, { useState, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import {
  WelcomeScreen,
  AccountOwnershipScreen,
  SeedPhraseScreen,
  VerifySeedScreen,
  SecuritySetupScreen,
  SuccessScreen,
  RecoverAccountScreen,
  ExistingAccountScreen,
} from './index';
import { AuthScreen } from '../AuthScreen';
import { useAuthStore } from '../../stores/authStore';
import { useUserStore } from '../../stores/userStore';
import { useTandaStore } from '../../stores/tandaStore';
import { secureStorage } from '../../services/storage';
import { SecuritySettings } from '../../types';

type OnboardingStep =
  | 'welcome'
  | 'existing_account'
  | 'ownership'
  | 'seed'
  | 'verify'
  | 'security'
  | 'success'
  | 'recover'
  | 'recover_security'
  | 'pin_login';

interface OnboardingNavigatorProps {
  onComplete: () => void;
}

export const OnboardingNavigator: React.FC<OnboardingNavigatorProps> = ({
  onComplete,
}) => {
  const [step, setStep] = useState<OnboardingStep>('welcome');
  const [seed, setSeed] = useState<string>('');
  const [publicKey, setPublicKey] = useState<string>('');
  const [hasLocalAccount, setHasLocalAccount] = useState<boolean>(false);

  const { createAccount, recoverAccount, setSecuritySettings, initialize } = useAuthStore();
  const { loadUser, fetchBalance } = useUserStore();
  const { loadTandas } = useTandaStore();

  // Verificar si hay cuenta local al montar
  useEffect(() => {
    checkLocalAccount();
  }, []);

  const checkLocalAccount = async () => {
    try {
      const onboardingComplete = await secureStorage.isOnboardingComplete();
      const securitySettings = await secureStorage.getSecuritySettings();
      const hasPinEnabled = securitySettings?.pinEnabled || false;
      setHasLocalAccount(onboardingComplete && hasPinEnabled);
    } catch (error) {
      console.error('Error checking local account:', error);
      setHasLocalAccount(false);
    }
  };

  const handleExistingAccount = async () => {
    // Verificar si hay cuenta local antes de mostrar opciones
    await checkLocalAccount();
    setStep('existing_account');
  };

  const handlePinLoginSuccess = async () => {
    // Reinicializar el store y completar
    await initialize();
    onComplete();
  };

  const handleCreateAccount = async (securitySettings: SecuritySettings) => {
    try {
      const newPublicKey = await createAccount(seed, securitySettings);
      setPublicKey(newPublicKey);

      // Esperar un momento para que la transaccion se confirme en blockchain
      console.log('[Onboarding] Waiting for blockchain confirmation...');
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Refresh estado después de crear la wallet
      await loadUser();

      // Retry fetchBalance con backoff para asegurar que el balance se actualice
      let retries = 3;
      while (retries > 0) {
        await fetchBalance();
        const currentBalance = useUserStore.getState().xlmBalance;
        if (currentBalance > 0) {
          console.log('[Onboarding] Balance confirmed:', currentBalance);
          break;
        }
        retries--;
        if (retries > 0) {
          console.log('[Onboarding] Balance not yet available, retrying...');
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }

      await loadTandas();

      setStep('success');
    } catch (error) {
      console.error('Error creating account:', error);
    }
  };

  const handleRecoverAccount = async (recoveredSeed: string) => {
    try {
      const recoveredPublicKey = await recoverAccount(recoveredSeed);
      setSeed(recoveredSeed);
      setPublicKey(recoveredPublicKey);
      setStep('recover_security');
    } catch (error) {
      console.error('Error recovering account:', error);
    }
  };

  const handleRecoverSecuritySetup = async (securitySettings: SecuritySettings) => {
    try {
      await setSecuritySettings(securitySettings);
      await createAccount(seed, securitySettings);

      // Esperar un momento para que la transacción se confirme en blockchain
      console.log('[Onboarding] Waiting for blockchain confirmation...');
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Refresh estado después de recuperar la wallet
      await loadUser();

      // Retry fetchBalance con backoff
      let retries = 3;
      while (retries > 0) {
        await fetchBalance();
        const currentBalance = useUserStore.getState().xlmBalance;
        if (currentBalance > 0) {
          console.log('[Onboarding] Balance confirmed:', currentBalance);
          break;
        }
        retries--;
        if (retries > 0) {
          console.log('[Onboarding] Balance not yet available, retrying...');
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }

      await loadTandas();

      setStep('success');
    } catch (error) {
      console.error('Error setting up security:', error);
    }
  };

  const renderStep = () => {
    switch (step) {
      case 'welcome':
        return (
          <WelcomeScreen
            onCreateAccount={() => setStep('ownership')}
            onRecoverAccount={handleExistingAccount}
          />
        );

      case 'existing_account':
        return (
          <ExistingAccountScreen
            hasLocalAccount={hasLocalAccount}
            onLoginWithPin={() => setStep('pin_login')}
            onRecoverWithSeed={() => setStep('recover')}
            onBack={() => setStep('welcome')}
          />
        );

      case 'pin_login':
        return (
          <AuthScreen onSuccess={handlePinLoginSuccess} />
        );

      case 'ownership':
        return (
          <AccountOwnershipScreen
            onContinue={() => setStep('seed')}
            onBack={() => setStep('welcome')}
          />
        );

      case 'seed':
        return (
          <SeedPhraseScreen
            onContinue={(newSeed) => {
              setSeed(newSeed);
              setStep('verify');
            }}
            onBack={() => setStep('ownership')}
          />
        );

      case 'verify':
        return (
          <VerifySeedScreen
            seed={seed}
            onContinue={() => setStep('security')}
            onBack={() => setStep('seed')}
          />
        );

      case 'security':
        return (
          <SecuritySetupScreen
            onContinue={handleCreateAccount}
            onBack={() => setStep('verify')}
          />
        );

      case 'success':
        return (
          <SuccessScreen
            publicKey={publicKey}
            onFinish={onComplete}
          />
        );

      case 'recover':
        return (
          <RecoverAccountScreen
            onRecover={handleRecoverAccount}
            onBack={() => setStep('existing_account')}
          />
        );

      case 'recover_security':
        return (
          <SecuritySetupScreen
            onContinue={handleRecoverSecuritySetup}
            onBack={() => setStep('recover')}
          />
        );

      default:
        return null;
    }
  };

  return <View style={styles.container}>{renderStep()}</View>;
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

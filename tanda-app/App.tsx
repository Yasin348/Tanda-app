import React, { useEffect, useState, useMemo } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, StyleSheet, Platform } from 'react-native';
import { NavigationContainer, LinkingOptions } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Linking from 'expo-linking';

import { AppNavigator } from './src/navigation/AppNavigator';
import { OnboardingNavigator } from './src/screens/onboarding/OnboardingNavigator';
import { AuthScreen } from './src/screens/AuthScreen';
import { useAuthStore } from './src/stores/authStore';
import { deepLinkingService, APP_SCHEME } from './src/services/deepLinking';
import { notificationService } from './src/services/notifications';

type AppState = 'loading' | 'onboarding' | 'auth' | 'app';

// Función para crear linking config de forma segura
function createLinkingConfig(): LinkingOptions<any> | undefined {
  // En web, el deep linking puede causar problemas - deshabilitarlo por ahora
  if (Platform.OS === 'web') {
    return undefined;
  }

  try {
    return {
      prefixes: [Linking.createURL('/'), `${APP_SCHEME}://`],
      config: {
        screens: {
          // Rutas de deep linking
          KYC: 'kyc-callback',
          TandaDetail: {
            path: 'tanda/:tandaId',
            parse: {
              tandaId: (tandaId: string) => tandaId,
            },
          },
        },
      },
    };
  } catch (error) {
    console.warn('[App] Error creating linking config:', error);
    return undefined;
  }
}

export default function App() {
  const [appState, setAppState] = useState<AppState>('loading');
  const { initialize, isLoading, onboardingComplete, isAuthenticated, securitySettings } =
    useAuthStore();

  // Crear linking config de forma segura (memoizado para evitar recrearlo)
  const linking = useMemo(() => createLinkingConfig(), []);

  useEffect(() => {
    initializeApp();

    // Solo inicializar deep linking en native (no web)
    if (Platform.OS !== 'web') {
      deepLinkingService.initialize();
    }

    // Cleanup al desmontar
    return () => {
      if (Platform.OS !== 'web') {
        deepLinkingService.cleanup();
      }
    };
  }, []);

  useEffect(() => {
    if (!isLoading) {
      if (!onboardingComplete) {
        setAppState('onboarding');
      } else if (!isAuthenticated && !securitySettings?.noProtection) {
        setAppState('auth');
      } else {
        setAppState('app');
      }
    }
  }, [isLoading, onboardingComplete, isAuthenticated, securitySettings]);

  const initializeApp = async () => {
    await initialize();

    // Initialize notification service for payment reminders
    await notificationService.initialize();
  };

  const handleOnboardingComplete = () => {
    setAppState('app');
  };

  const handleAuthSuccess = () => {
    setAppState('app');
  };

  if (appState === 'loading') {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3b82f6" />
        <StatusBar style="auto" />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <NavigationContainer linking={linking}>
        {appState === 'onboarding' && (
          <OnboardingNavigator onComplete={handleOnboardingComplete} />
        )}
        {appState === 'auth' && <AuthScreen onSuccess={handleAuthSuccess} />}
        {appState === 'app' && <AppNavigator />}
        <StatusBar style="auto" />
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
});



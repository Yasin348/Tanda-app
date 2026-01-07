/**
 * Deposit Screen - Mykobo SEP-24 Integration
 *
 * Allows users to deposit EUR and receive EURC via Mykobo's SEP-24 flow.
 * KYC is handled inside Mykobo's WebView.
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
} from 'react-native';
import { mykoboService } from '../../services/mykobo';
import { stellarService } from '../../services/stellar';
import { useUserStore } from '../../stores/userStore';
import { MykoboWebView } from '../../components/MykoboWebView';

interface DepositScreenProps {
  navigation: any;
}

type DepositStep = 'amount' | 'setup' | 'webview' | 'processing' | 'success' | 'error';

// Mykobo limits (from their API /sep24/info)
const MYKOBO_LIMITS = {
  minDeposit: 25, // EUR - Mykobo minimum
  maxDeposit: 30000, // EUR
  fee: 0, // Mykobo typically has 0% fee for SEPA
};

export const DepositScreen: React.FC<DepositScreenProps> = ({ navigation }) => {
  // State
  const [step, setStep] = useState<DepositStep>('amount');
  const [amount, setAmount] = useState('100');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // WebView state
  const [webViewUrl, setWebViewUrl] = useState<string | null>(null);
  const [transactionId, setTransactionId] = useState<string | null>(null);

  // Transaction result
  const [completedAmount, setCompletedAmount] = useState<number | null>(null);

  const { fetchBalance, isTestMode, accountStatus, setupStellarAccount, checkAccountStatus } = useUserStore();

  // Check account status on mount
  useEffect(() => {
    checkAccountStatus();
  }, []);

  // Parse amount safely
  const parseAmount = (value: string): number => {
    const cleaned = value.replace(',', '.').replace(/[^0-9.]/g, '');
    return parseFloat(cleaned) || 0;
  };

  const amountValue = parseAmount(amount);
  const isValidAmount = amountValue >= MYKOBO_LIMITS.minDeposit && amountValue <= MYKOBO_LIMITS.maxDeposit;

  // Start deposit flow
  const handleStartDeposit = async () => {
    if (!isValidAmount) {
      setError(`El monto debe estar entre ${MYKOBO_LIMITS.minDeposit}€ y ${MYKOBO_LIMITS.maxDeposit.toLocaleString()}€`);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Step 1: Ensure Stellar account is ready to receive EURC
      if (!accountStatus.isReady) {
        setStep('setup');
        setIsLoading(false);
        console.log('[Deposit] Account not ready, setting up...');
        const setupResult = await setupStellarAccount();

        if (!setupResult.success) {
          setError('Error preparando tu cuenta: ' + (setupResult.error || 'Intenta de nuevo'));
          setStep('error');
          return;
        }

        console.log('[Deposit] Account setup complete:', {
          activated: setupResult.accountActivated,
          trustline: setupResult.trustlineCreated,
        });
      }

      setIsLoading(true);
      console.log('[Deposit] Initiating Mykobo deposit for', amountValue, 'EUR');

      // Step 2: Get WebView URL from Mykobo
      const result = await mykoboService.initiateDeposit(amountValue);

      console.log('[Deposit] Got WebView URL:', result.url);
      console.log('[Deposit] Transaction ID:', result.id);

      setWebViewUrl(result.url);
      setTransactionId(result.id);
      setStep('webview');
    } catch (err: any) {
      console.error('[Deposit] Error:', err);
      setError(err.message || 'Error al iniciar el deposito');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle WebView completion
  const handleWebViewComplete = async (txId: string) => {
    console.log('[Deposit] WebView completed, transaction:', txId);
    setStep('processing');

    // Poll for transaction status
    try {
      let attempts = 0;
      const maxAttempts = 30; // 5 minutes max

      while (attempts < maxAttempts) {
        const status = await mykoboService.getTransactionStatus(txId);
        console.log('[Deposit] Transaction status:', status.status);

        if (status.status === 'completed') {
          setCompletedAmount(parseFloat(status.amount_out || '0'));
          setStep('success');
          fetchBalance(); // Refresh balance
          return;
        }

        if (status.status === 'error' || status.status === 'expired') {
          setError(status.message || 'La transaccion fallo');
          setStep('error');
          return;
        }

        // Wait 10 seconds before next poll
        await new Promise(resolve => setTimeout(resolve, 10000));
        attempts++;
      }

      // Timeout - show pending message
      setStep('success');
      setCompletedAmount(amountValue);
    } catch (err: any) {
      console.error('[Deposit] Status check error:', err);
      // Don't show error - transaction might still complete
      setStep('success');
      setCompletedAmount(amountValue);
    }
  };

  // Handle WebView close
  const handleWebViewClose = () => {
    const closeWebView = () => {
      setStep('amount');
      setWebViewUrl(null);
      setTransactionId(null);
    };

    // On web, use window.confirm
    if (Platform.OS === 'web') {
      const confirmed = window.confirm('¿Cancelar depósito? Si cierras ahora, el depósito no se completará.');
      if (confirmed) {
        closeWebView();
      }
    } else {
      // On native, use Alert
      Alert.alert(
        'Cancelar deposito?',
        'Si cierras ahora, el deposito no se completara.',
        [
          { text: 'Continuar', style: 'cancel' },
          {
            text: 'Cancelar',
            style: 'destructive',
            onPress: closeWebView,
          },
        ]
      );
    }
  };

  // Handle WebView error
  const handleWebViewError = (errorMsg: string) => {
    setError(errorMsg);
    setStep('error');
    setWebViewUrl(null);
  };

  // Reset flow
  const resetFlow = () => {
    setStep('amount');
    setAmount('100');
    setError(null);
    setWebViewUrl(null);
    setTransactionId(null);
    setCompletedAmount(null);
  };

  // Render WebView modal
  if (step === 'webview' && webViewUrl) {
    return (
      <Modal
        visible={true}
        animationType="slide"
        presentationStyle="fullScreen"
      >
        <MykoboWebView
          url={webViewUrl}
          transactionId={transactionId || ''}
          type="deposit"
          amount={amountValue}
          onClose={handleWebViewClose}
          onComplete={handleWebViewComplete}
          onError={handleWebViewError}
        />
      </Modal>
    );
  }

  return (
    <SafeAreaView style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity
          onPress={() => step === 'amount' ? navigation.goBack() : resetFlow()}
          style={s.backButton}
        >
          <Text style={s.backButtonText}>
            {step === 'success' ? 'Cerrar' : '‹ Volver'}
          </Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>Depositar EUR</Text>
        <View style={s.stellarBadge}>
          <Text style={s.stellarBadgeText}>Stellar</Text>
        </View>
      </View>

      <ScrollView style={s.content} keyboardShouldPersistTaps="handled">
        {/* Amount Step */}
        {step === 'amount' && (
          <>
            <Text style={s.title}>Cuanto quieres depositar?</Text>
            <Text style={s.subtitle}>
              Deposita euros y recibe EURC en tu wallet Stellar
            </Text>

            {/* Amount Input */}
            <View style={s.amountContainer}>
              <Text style={s.currencySymbol}>€</Text>
              <TextInput
                style={s.amountInput}
                value={amount}
                onChangeText={setAmount}
                placeholder="0"
                placeholderTextColor="#adb5bd"
                keyboardType="decimal-pad"
                autoFocus
              />
            </View>

            {/* Estimate Card */}
            <View style={s.estimateCard}>
              <View style={s.estimateRow}>
                <Text style={s.estimateLabel}>Envias</Text>
                <Text style={s.estimateValue}>{amountValue.toFixed(2)} EUR</Text>
              </View>
              <View style={s.estimateRow}>
                <Text style={s.estimateLabel}>Comision Mykobo</Text>
                <Text style={s.estimateFree}>GRATIS</Text>
              </View>
              <View style={s.estimateDivider} />
              <View style={s.estimateRow}>
                <Text style={s.estimateLabelBold}>Recibiras</Text>
                <Text style={s.estimateValueBold}>{amountValue.toFixed(2)} EURC</Text>
              </View>
            </View>

            {/* Error */}
            {error && (
              <View style={s.errorBanner}>
                <Text style={s.errorBannerText}>{error}</Text>
              </View>
            )}

            {/* Deposit Button */}
            <TouchableOpacity
              style={[s.depositButton, !isValidAmount && s.depositButtonDisabled]}
              onPress={handleStartDeposit}
              disabled={!isValidAmount || isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={s.depositButtonText}>
                  Depositar {amountValue.toFixed(2)} EUR
                </Text>
              )}
            </TouchableOpacity>

            {/* Limits */}
            <Text style={s.limitsText}>
              Min: {MYKOBO_LIMITS.minDeposit}€ · Max: {MYKOBO_LIMITS.maxDeposit.toLocaleString()}€
            </Text>

            {/* How it works */}
            <View style={s.howItWorks}>
              <Text style={s.howItWorksTitle}>Como funciona</Text>

              <View style={s.stepRow}>
                <View style={s.stepNumber}>
                  <Text style={s.stepNumberText}>1</Text>
                </View>
                <View style={s.stepContent}>
                  <Text style={s.stepText}>Introduce el monto</Text>
                  <Text style={s.stepHint}>Minimo {MYKOBO_LIMITS.minDeposit}€</Text>
                </View>
              </View>

              <View style={s.stepRow}>
                <View style={s.stepNumber}>
                  <Text style={s.stepNumberText}>2</Text>
                </View>
                <View style={s.stepContent}>
                  <Text style={s.stepText}>Completa el pago en Mykobo</Text>
                  <Text style={s.stepHint}>Tarjeta o transferencia SEPA</Text>
                </View>
              </View>

              <View style={s.stepRow}>
                <View style={[s.stepNumber, { backgroundColor: '#2f9e44' }]}>
                  <Text style={s.stepNumberText}>3</Text>
                </View>
                <View style={s.stepContent}>
                  <Text style={s.stepText}>Recibe EURC en tu wallet</Text>
                  <Text style={s.stepHint}>Instantaneo con tarjeta</Text>
                </View>
              </View>
            </View>

            {/* Info Box */}
            <View style={s.infoBox}>
              <Text style={s.infoTitle}>Sobre EURC</Text>
              <Text style={s.infoText}>
                EURC es un euro digital emitido por Mykobo, respaldado 1:1 con euros reales.
                Regulado en Lituania bajo supervision del Banco de Lituania.
              </Text>
            </View>
          </>
        )}

        {/* Account Setup Step */}
        {step === 'setup' && (
          <View style={s.processingContainer}>
            <ActivityIndicator size="large" color="#6366f1" />
            <Text style={s.processingTitle}>Preparando tu cuenta...</Text>
            <Text style={s.processingSubtitle}>
              {!accountStatus.accountExists
                ? 'Activando cuenta Stellar...'
                : !accountStatus.hasTrustline
                ? 'Configurando EURC...'
                : 'Casi listo...'}
            </Text>
          </View>
        )}

        {/* Processing Step */}
        {step === 'processing' && (
          <View style={s.processingContainer}>
            <ActivityIndicator size="large" color="#6366f1" />
            <Text style={s.processingTitle}>Procesando deposito...</Text>
            <Text style={s.processingSubtitle}>
              Esto puede tardar unos minutos
            </Text>
          </View>
        )}

        {/* Success Step */}
        {step === 'success' && (
          <View style={s.successContainer}>
            <View style={s.successIcon}>
              <Text style={s.successIconText}>✓</Text>
            </View>
            <Text style={s.successTitle}>Deposito iniciado!</Text>
            <Text style={s.successSubtitle}>
              {completedAmount
                ? `Recibiras ${completedAmount.toFixed(2)} EURC en tu wallet`
                : 'Tu deposito esta siendo procesado'}
            </Text>

            <View style={s.successCard}>
              <View style={s.successRow}>
                <Text style={s.successLabel}>Monto</Text>
                <Text style={s.successValue}>{amountValue.toFixed(2)} EUR</Text>
              </View>
              <View style={s.successRow}>
                <Text style={s.successLabel}>Recibiras</Text>
                <Text style={s.successValueGreen}>{amountValue.toFixed(2)} EURC</Text>
              </View>
              {transactionId && (
                <View style={s.successRow}>
                  <Text style={s.successLabel}>ID</Text>
                  <Text style={s.successValueMono}>{transactionId.slice(0, 8)}...</Text>
                </View>
              )}
            </View>

            <TouchableOpacity
              style={s.doneButton}
              onPress={() => navigation.navigate('Home')}
            >
              <Text style={s.doneButtonText}>Volver al inicio</Text>
            </TouchableOpacity>

            <TouchableOpacity style={s.anotherButton} onPress={resetFlow}>
              <Text style={s.anotherButtonText}>Hacer otro deposito</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Error Step */}
        {step === 'error' && (
          <View style={s.errorContainer}>
            <View style={s.errorIcon}>
              <Text style={s.errorIconText}>!</Text>
            </View>
            <Text style={s.errorTitle}>Error en el deposito</Text>
            <Text style={s.errorSubtitle}>{error || 'Algo salio mal'}</Text>

            <TouchableOpacity style={s.retryButton} onPress={resetFlow}>
              <Text style={s.retryButtonText}>Intentar de nuevo</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={s.cancelButton}
              onPress={() => navigation.goBack()}
            >
              <Text style={s.cancelButtonText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  headerTitle: { fontSize: 18, fontWeight: '600', color: '#212529' },
  backButton: { position: 'absolute', left: 16 },
  backButtonText: { fontSize: 16, color: '#6366f1', fontWeight: '500' },
  stellarBadge: {
    position: 'absolute',
    right: 16,
    backgroundColor: '#e7f5ff',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  stellarBadgeText: { fontSize: 11, color: '#1971c2', fontWeight: '600' },
  content: { flex: 1, padding: 20 },

  // Amount step
  title: { fontSize: 24, fontWeight: '700', color: '#212529', marginBottom: 8 },
  subtitle: { fontSize: 15, color: '#868e96', marginBottom: 24 },

  amountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#6366f1',
  },
  currencySymbol: { fontSize: 36, fontWeight: '700', color: '#212529', marginRight: 8 },
  amountInput: {
    flex: 1,
    fontSize: 36,
    fontWeight: '700',
    color: '#212529',
    padding: 0,
  },

  estimateCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  estimateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  estimateLabel: { fontSize: 14, color: '#868e96' },
  estimateValue: { fontSize: 14, fontWeight: '500', color: '#212529' },
  estimateFree: { fontSize: 14, fontWeight: '600', color: '#2f9e44' },
  estimateDivider: { height: 1, backgroundColor: '#e9ecef', marginVertical: 8 },
  estimateLabelBold: { fontSize: 15, fontWeight: '600', color: '#212529' },
  estimateValueBold: { fontSize: 17, fontWeight: '700', color: '#2f9e44' },

  errorBanner: {
    backgroundColor: '#ffe3e3',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  errorBannerText: { color: '#c92a2a', fontSize: 14, textAlign: 'center' },

  depositButton: {
    backgroundColor: '#6366f1',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  depositButtonDisabled: { backgroundColor: '#adb5bd' },
  depositButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },

  limitsText: {
    fontSize: 12,
    color: '#868e96',
    textAlign: 'center',
    marginBottom: 24,
  },

  howItWorks: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  howItWorksTitle: { fontSize: 16, fontWeight: '600', color: '#212529', marginBottom: 16 },
  stepRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 14 },
  stepNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#6366f1',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  stepNumberText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  stepContent: { flex: 1 },
  stepText: { fontSize: 15, color: '#212529', fontWeight: '500' },
  stepHint: { fontSize: 13, color: '#868e96', marginTop: 2 },

  infoBox: {
    backgroundColor: '#e7f5ff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
  },
  infoTitle: { fontSize: 14, fontWeight: '600', color: '#1971c2', marginBottom: 6 },
  infoText: { fontSize: 13, color: '#1971c2', lineHeight: 20 },

  // Processing
  processingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
  },
  processingTitle: { fontSize: 18, fontWeight: '600', color: '#212529', marginTop: 20 },
  processingSubtitle: { fontSize: 14, color: '#868e96', marginTop: 8 },

  // Success
  successContainer: { alignItems: 'center', paddingVertical: 40 },
  successIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#d3f9d8',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  successIconText: { fontSize: 36, color: '#2f9e44' },
  successTitle: { fontSize: 24, fontWeight: '700', color: '#212529', marginBottom: 8 },
  successSubtitle: { fontSize: 16, color: '#868e96', textAlign: 'center', marginBottom: 24 },
  successCard: {
    width: '100%',
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  successRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  successLabel: { fontSize: 14, color: '#868e96' },
  successValue: { fontSize: 14, fontWeight: '500', color: '#212529' },
  successValueGreen: { fontSize: 14, fontWeight: '600', color: '#2f9e44' },
  successValueMono: { fontSize: 12, fontFamily: 'monospace', color: '#868e96' },
  doneButton: {
    backgroundColor: '#6366f1',
    paddingVertical: 16,
    paddingHorizontal: 48,
    borderRadius: 12,
    marginBottom: 12,
  },
  doneButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  anotherButton: { paddingVertical: 12 },
  anotherButtonText: { color: '#6366f1', fontSize: 14, fontWeight: '500' },

  // Error
  errorContainer: { alignItems: 'center', paddingVertical: 40 },
  errorIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#ffe3e3',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  errorIconText: { fontSize: 36, color: '#c92a2a' },
  errorTitle: { fontSize: 24, fontWeight: '700', color: '#212529', marginBottom: 8 },
  errorSubtitle: { fontSize: 16, color: '#868e96', textAlign: 'center', marginBottom: 24 },
  retryButton: {
    backgroundColor: '#6366f1',
    paddingVertical: 16,
    paddingHorizontal: 48,
    borderRadius: 12,
    marginBottom: 12,
  },
  retryButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  cancelButton: { paddingVertical: 12 },
  cancelButtonText: { color: '#868e96', fontSize: 14, fontWeight: '500' },
});

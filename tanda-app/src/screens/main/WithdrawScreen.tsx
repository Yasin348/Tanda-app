/**
 * Withdraw Screen - Mykobo SEP-24 Integration
 *
 * Allows users to withdraw EURC and receive EUR via Mykobo's SEP-24 flow.
 * KYC and bank details are handled inside Mykobo's WebView.
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
import { useUserStore } from '../../stores/userStore';
import { MykoboWebView } from '../../components/MykoboWebView';

interface WithdrawScreenProps {
  navigation: any;
}

type WithdrawStep = 'amount' | 'webview' | 'processing' | 'success' | 'error';

// Mykobo limits
const MYKOBO_LIMITS = {
  minWithdraw: 20, // EUR
  maxWithdraw: 15000, // EUR
  fee: 0, // Mykobo typically has 0% fee for SEPA
};

export const WithdrawScreen: React.FC<WithdrawScreenProps> = ({ navigation }) => {
  // State
  const [step, setStep] = useState<WithdrawStep>('amount');
  const [amount, setAmount] = useState('50');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // WebView state
  const [webViewUrl, setWebViewUrl] = useState<string | null>(null);
  const [transactionId, setTransactionId] = useState<string | null>(null);

  // Transaction result
  const [completedAmount, setCompletedAmount] = useState<number | null>(null);

  const {
    eurcBalance,
    eurcBalanceFormatted,
    fetchBalance,
    isTestMode,
  } = useUserStore();

  // Refresh balance when screen is focused
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      fetchBalance();
      resetFlow();
    });
    return unsubscribe;
  }, [navigation, fetchBalance]);

  // Parse amount safely
  const parseAmount = (value: string): number => {
    const cleaned = value.replace(',', '.').replace(/[^0-9.]/g, '');
    return parseFloat(cleaned) || 0;
  };

  const amountValue = parseAmount(amount);
  const isValidAmount =
    amountValue >= MYKOBO_LIMITS.minWithdraw &&
    amountValue <= MYKOBO_LIMITS.maxWithdraw &&
    amountValue <= eurcBalance;

  // Start withdrawal flow
  const handleStartWithdraw = async () => {
    if (!isValidAmount) {
      if (amountValue > eurcBalance) {
        setError('No tienes suficiente saldo');
      } else {
        setError(`El monto debe estar entre ${MYKOBO_LIMITS.minWithdraw}€ y ${MYKOBO_LIMITS.maxWithdraw.toLocaleString()}€`);
      }
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      console.log('[Withdraw] Initiating Mykobo withdrawal for', amountValue, 'EURC');

      // Get WebView URL from Mykobo
      const result = await mykoboService.initiateWithdrawal(amountValue);

      console.log('[Withdraw] Got WebView URL:', result.url);
      console.log('[Withdraw] Transaction ID:', result.id);

      setWebViewUrl(result.url);
      setTransactionId(result.id);
      setStep('webview');
    } catch (err: any) {
      console.error('[Withdraw] Error:', err);
      setError(err.message || 'Error al iniciar el retiro');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle WebView completion
  const handleWebViewComplete = async (txId: string) => {
    console.log('[Withdraw] WebView completed, transaction:', txId);
    setStep('processing');

    // Poll for transaction status
    try {
      let attempts = 0;
      const maxAttempts = 30; // 5 minutes max

      while (attempts < maxAttempts) {
        const status = await mykoboService.getTransactionStatus(txId);
        console.log('[Withdraw] Transaction status:', status.status);

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
      console.error('[Withdraw] Status check error:', err);
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
      const confirmed = window.confirm('¿Cancelar retiro? Si cierras ahora, el retiro no se completará.');
      if (confirmed) {
        closeWebView();
      }
    } else {
      // On native, use Alert
      Alert.alert(
        'Cancelar retiro?',
        'Si cierras ahora, el retiro no se completara.',
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
    setAmount('50');
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
          type="withdraw"
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
        <Text style={s.headerTitle}>Retirar a banco</Text>
        <View style={s.stellarBadge}>
          <Text style={s.stellarBadgeText}>Stellar</Text>
        </View>
      </View>

      <ScrollView style={s.content} keyboardShouldPersistTaps="handled">
        {/* Amount Step */}
        {step === 'amount' && (
          <>
            <Text style={s.title}>Cuanto quieres retirar?</Text>
            <Text style={s.subtitle}>
              Retira EURC y recibe euros en tu cuenta bancaria
            </Text>

            {/* Balance display */}
            <View style={s.balanceCard}>
              <Text style={s.balanceLabel}>Saldo disponible</Text>
              <Text style={s.balanceValue}>{eurcBalanceFormatted}</Text>
            </View>

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

            {/* Quick amounts */}
            <View style={s.quickAmounts}>
              {[20, 50, 100, 'MAX'].map((val) => (
                <TouchableOpacity
                  key={val}
                  style={s.quickAmountButton}
                  onPress={() => {
                    const newAmount = val === 'MAX'
                      ? Math.min(eurcBalance, MYKOBO_LIMITS.maxWithdraw)
                      : val;
                    setAmount(String(newAmount));
                  }}
                >
                  <Text style={s.quickAmountText}>
                    {val === 'MAX' ? 'MAX' : `${val}€`}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Estimate Card */}
            <View style={s.estimateCard}>
              <View style={s.estimateRow}>
                <Text style={s.estimateLabel}>Envias</Text>
                <Text style={s.estimateValue}>{amountValue.toFixed(2)} EURC</Text>
              </View>
              <View style={s.estimateRow}>
                <Text style={s.estimateLabel}>Comision Mykobo</Text>
                <Text style={s.estimateFree}>GRATIS</Text>
              </View>
              <View style={s.estimateDivider} />
              <View style={s.estimateRow}>
                <Text style={s.estimateLabelBold}>Recibiras</Text>
                <Text style={s.estimateValueBold}>{amountValue.toFixed(2)} EUR</Text>
              </View>
            </View>

            {/* Error */}
            {error && (
              <View style={s.errorBanner}>
                <Text style={s.errorBannerText}>{error}</Text>
              </View>
            )}

            {/* Withdraw Button */}
            <TouchableOpacity
              style={[s.withdrawButton, !isValidAmount && s.withdrawButtonDisabled]}
              onPress={handleStartWithdraw}
              disabled={!isValidAmount || isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={s.withdrawButtonText}>
                  Retirar {amountValue.toFixed(2)} EURC
                </Text>
              )}
            </TouchableOpacity>

            {/* Limits */}
            <Text style={s.limitsText}>
              Min: {MYKOBO_LIMITS.minWithdraw}€ · Max: {MYKOBO_LIMITS.maxWithdraw.toLocaleString()}€
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
                  <Text style={s.stepHint}>Minimo {MYKOBO_LIMITS.minWithdraw}€</Text>
                </View>
              </View>

              <View style={s.stepRow}>
                <View style={s.stepNumber}>
                  <Text style={s.stepNumberText}>2</Text>
                </View>
                <View style={s.stepContent}>
                  <Text style={s.stepText}>Introduce tus datos bancarios</Text>
                  <Text style={s.stepHint}>IBAN europeo (SEPA)</Text>
                </View>
              </View>

              <View style={s.stepRow}>
                <View style={[s.stepNumber, { backgroundColor: '#2f9e44' }]}>
                  <Text style={s.stepNumberText}>3</Text>
                </View>
                <View style={s.stepContent}>
                  <Text style={s.stepText}>Recibe EUR en tu banco</Text>
                  <Text style={s.stepHint}>1-2 dias laborables via SEPA</Text>
                </View>
              </View>
            </View>

            {/* Info Box */}
            <View style={s.infoBox}>
              <Text style={s.infoTitle}>Sobre retiros</Text>
              <Text style={s.infoText}>
                Tu EURC se convierte a euros y se envia a tu cuenta bancaria europea
                via transferencia SEPA. Procesado por Mykobo, regulado en Lituania.
              </Text>
            </View>
          </>
        )}

        {/* Processing Step */}
        {step === 'processing' && (
          <View style={s.processingContainer}>
            <ActivityIndicator size="large" color="#6366f1" />
            <Text style={s.processingTitle}>Procesando retiro...</Text>
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
            <Text style={s.successTitle}>Retiro iniciado!</Text>
            <Text style={s.successSubtitle}>
              {completedAmount
                ? `Recibiras ${completedAmount.toFixed(2)} EUR en tu cuenta bancaria`
                : 'Tu retiro esta siendo procesado'}
            </Text>

            <View style={s.successCard}>
              <View style={s.successRow}>
                <Text style={s.successLabel}>Monto</Text>
                <Text style={s.successValue}>{amountValue.toFixed(2)} EURC</Text>
              </View>
              <View style={s.successRow}>
                <Text style={s.successLabel}>Recibiras</Text>
                <Text style={s.successValueGreen}>{amountValue.toFixed(2)} EUR</Text>
              </View>
              <View style={s.successRow}>
                <Text style={s.successLabel}>Tiempo estimado</Text>
                <Text style={s.successValue}>1-2 dias laborables</Text>
              </View>
              {transactionId && (
                <View style={s.successRow}>
                  <Text style={s.successLabel}>ID</Text>
                  <Text style={s.successValueMono}>{transactionId.slice(0, 8)}...</Text>
                </View>
              )}
            </View>

            <View style={s.infoBoxBlue}>
              <Text style={s.infoBoxBlueText}>
                Recibiras un email cuando la transferencia se complete.
              </Text>
            </View>

            <TouchableOpacity
              style={s.doneButton}
              onPress={() => navigation.navigate('Home')}
            >
              <Text style={s.doneButtonText}>Volver al inicio</Text>
            </TouchableOpacity>

            <TouchableOpacity style={s.anotherButton} onPress={resetFlow}>
              <Text style={s.anotherButtonText}>Hacer otro retiro</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Error Step */}
        {step === 'error' && (
          <View style={s.errorContainer}>
            <View style={s.errorIcon}>
              <Text style={s.errorIconText}>!</Text>
            </View>
            <Text style={s.errorTitle}>Error en el retiro</Text>
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
  subtitle: { fontSize: 15, color: '#868e96', marginBottom: 20 },

  balanceCard: {
    backgroundColor: '#e7f5ff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  balanceLabel: { fontSize: 14, color: '#1971c2' },
  balanceValue: { fontSize: 18, fontWeight: '700', color: '#1971c2' },

  amountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
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

  quickAmounts: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  quickAmountButton: {
    flex: 1,
    backgroundColor: '#f1f3f5',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  quickAmountText: { fontSize: 14, fontWeight: '600', color: '#495057' },

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

  withdrawButton: {
    backgroundColor: '#6366f1',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  withdrawButtonDisabled: { backgroundColor: '#adb5bd' },
  withdrawButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },

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
    marginBottom: 16,
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

  infoBoxBlue: {
    width: '100%',
    backgroundColor: '#e7f5ff',
    padding: 14,
    borderRadius: 12,
    marginBottom: 24,
  },
  infoBoxBlueText: { fontSize: 13, color: '#1971c2', textAlign: 'center', lineHeight: 20 },

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

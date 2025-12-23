/**
 * Pantalla de herramientas de desarrollo
 * Solo visible en testnet - para probar faucets y bridges
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
  Platform,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { stellarService } from '../../services/stellar';
import { anchorService } from '../../services/anchor';
import { useUserStore } from '../../stores/userStore';
import { useAuthStore } from '../../stores/authStore';
import { ENV, formatEuro, getAnchorUrl } from '../../config/network';

interface DevToolsScreenProps {
  navigation: any;
}

export const DevToolsScreen: React.FC<DevToolsScreenProps> = ({ navigation }) => {
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [stellarBalance, setStellarBalance] = useState<{ xlm: number; eurc: number } | null>(null);
  const [isLoadingStellar, setIsLoadingStellar] = useState(false);
  const [stellarError, setStellarError] = useState<string | null>(null);
  const [anchorInfo, setAnchorInfo] = useState<{
    publicKey: string;
    isOnline: boolean;
  } | null>(null);
  const [isLoadingAnchor, setIsLoadingAnchor] = useState(false);

  const { eurcBalance, eurcBalanceFormatted, xlmBalance, fetchBalance, isTestMode } = useUserStore();
  const { publicKey: authPublicKey } = useAuthStore();

  // Stellar public key
  const stellarPublicKey = stellarService.isInitialized() ? stellarService.getPublicKey() : (authPublicKey || '');

  // Cargar balances al montar
  useEffect(() => {
    fetchBalance();
    loadStellarBalance();
    loadAnchorInfo();
  }, []);

  const loadAnchorInfo = async () => {
    setIsLoadingAnchor(true);
    try {
      const isOnline = await anchorService.healthCheck();
      if (isOnline) {
        const config = await anchorService.getGasConfig();
        setAnchorInfo({
          publicKey: config.anchorPublicKey,
          isOnline: true,
        });
      } else {
        setAnchorInfo({ publicKey: '', isOnline: false });
      }
    } catch (e) {
      setAnchorInfo({ publicKey: '', isOnline: false });
    } finally {
      setIsLoadingAnchor(false);
    }
  };

  const loadStellarBalance = async () => {
    if (!stellarService.isInitialized()) {
      setStellarError('Stellar no inicializado');
      return;
    }

    setIsLoadingStellar(true);
    setStellarError(null);

    try {
      const balances = await stellarService.getBalances();
      setStellarBalance(balances);
    } catch (e: any) {
      console.error('[DevTools] Error loading Stellar balance:', e);
      setStellarError(e.message || 'Error al cargar balance');
    } finally {
      setIsLoadingStellar(false);
    }
  };

  const copyToClipboard = async (text: string, field: string) => {
    await Clipboard.setStringAsync(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const openURL = async (url: string) => {
    if (Platform.OS === 'web') {
      window.open(url, '_blank');
    } else {
      await Linking.openURL(url);
    }
  };

  const simulateDeposit = (amount: number) => {
    // En el nuevo sistema, los balances se gestionan desde el Anchor
    if (Platform.OS === 'web') {
      window.alert(`Simulación no disponible. Usa el faucet de Stellar para obtener tokens de prueba.`);
    }
    // Refrescar balance
    fetchBalance();
  };

  // No mostrar si no estamos en testnet
  if (!isTestMode()) {
    return (
      <SafeAreaView style={s.container}>
        <View style={s.center}>
          <Text style={s.errorIcon}>🔒</Text>
          <Text style={s.errorText}>Dev Tools solo disponible en testnet</Text>
          <TouchableOpacity style={s.backButton} onPress={() => navigation.goBack()}>
            <Text style={s.backButtonText}>Volver</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.headerBackButton}>
          <Text style={s.headerBackText}>‹ Volver</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>Dev Tools</Text>
        <Text style={s.testBadge}>TESTNET</Text>
      </View>

      <ScrollView style={s.content} showsVerticalScrollIndicator={false}>
        {/* Balances Card */}
        <View style={s.card}>
          <Text style={s.cardTitle}>Balances</Text>

          {/* Balance EURC */}
          <View style={s.balanceRow}>
            <View style={s.balanceInfo}>
              <Text style={s.balanceLabel}>EURC (Euro)</Text>
              <Text style={s.balanceValue}>{eurcBalanceFormatted}</Text>
            </View>
            <TouchableOpacity style={s.refreshButton} onPress={fetchBalance}>
              <Text style={s.refreshIcon}>↻</Text>
            </TouchableOpacity>
          </View>

          {/* Balance XLM */}
          <View style={s.balanceRow}>
            <View style={s.balanceInfo}>
              <Text style={s.balanceLabel}>XLM (Gas)</Text>
              <Text style={s.balanceValue}>{xlmBalance?.toFixed(2) || '0.00'} XLM</Text>
            </View>
            <TouchableOpacity style={s.refreshButton} onPress={loadStellarBalance}>
              <Text style={s.refreshIcon}>↻</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Direcciones Card */}
        <View style={s.card}>
          <Text style={s.cardTitle}>Tu Direccion Stellar</Text>

          {/* Stellar Address */}
          <View style={s.addressSection}>
            <Text style={s.addressLabel}>Stellar Network</Text>
            <TouchableOpacity
              style={s.addressBox}
              onPress={() => copyToClipboard(stellarPublicKey, 'stellar')}
            >
              <Text style={s.addressText} numberOfLines={1}>
                {stellarPublicKey || 'No inicializado'}
              </Text>
              <Text style={s.copyIcon}>
                {copiedField === 'stellar' ? '✓' : '📋'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Faucets Card */}
        <View style={s.card}>
          <Text style={s.cardTitle}>Faucets (Obtener tokens de prueba)</Text>

          {/* Stellar Faucet */}
          <View style={s.faucetSection}>
            <View style={s.faucetHeader}>
              <Text style={s.faucetIcon}>🪙</Text>
              <View style={s.faucetInfo}>
                <Text style={s.faucetTitle}>Stellar Testnet Faucet</Text>
                <Text style={s.faucetDescription}>
                  Obtiene XLM (gas token) para probar en testnet
                </Text>
              </View>
            </View>
            <View style={s.faucetSteps}>
              <Text style={s.stepText}>1. Copia tu Stellar public key (arriba)</Text>
              <Text style={s.stepText}>2. Abre el faucet y pegala</Text>
              <Text style={s.stepText}>3. Solicita tokens de prueba</Text>
            </View>
            <TouchableOpacity style={s.faucetButton} onPress={() => openURL('https://friendbot.stellar.org')}>
              <Text style={s.faucetButtonText}>Abrir Stellar Faucet</Text>
            </TouchableOpacity>
          </View>

        </View>

        {/* Simulacion Card */}
        <View style={s.card}>
          <Text style={s.cardTitle}>Simulacion (Sin blockchain)</Text>
          <Text style={s.simulationDescription}>
            Agrega balance simulado para probar la app sin necesidad de tokens reales.
            El balance simulado se guarda localmente.
          </Text>

          <View style={s.simulationButtons}>
            <TouchableOpacity
              style={s.simButton}
              onPress={() => simulateDeposit(10)}
            >
              <Text style={s.simButtonText}>+10 EUR</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={s.simButton}
              onPress={() => simulateDeposit(50)}
            >
              <Text style={s.simButtonText}>+50 EUR</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={s.simButton}
              onPress={() => simulateDeposit(100)}
            >
              <Text style={s.simButtonText}>+100 EUR</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={s.simButton}
              onPress={() => simulateDeposit(500)}
            >
              <Text style={s.simButtonText}>+500 EUR</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Anchor Info Card */}
        <View style={s.card}>
          <Text style={s.cardTitle}>Info del Anchor</Text>

          {isLoadingAnchor ? (
            <ActivityIndicator size="small" color="#6366f1" />
          ) : anchorInfo ? (
            <>
              <View style={s.infoRow}>
                <Text style={s.infoLabel}>Estado</Text>
                <View style={[s.statusBadge, { backgroundColor: anchorInfo.isOnline ? '#d3f9d8' : '#ffe3e3' }]}>
                  <Text style={[s.statusText, { color: anchorInfo.isOnline ? '#2f9e44' : '#e03131' }]}>
                    {anchorInfo.isOnline ? 'Online' : 'Offline'}
                  </Text>
                </View>
              </View>
              <View style={s.infoRow}>
                <Text style={s.infoLabel}>URL</Text>
                <Text style={s.infoValue} numberOfLines={1}>{getAnchorUrl()}</Text>
              </View>
              <View style={s.addressSection}>
                <Text style={s.addressLabel}>Anchor Wallet</Text>
                <TouchableOpacity
                  style={s.addressBox}
                  onPress={() => anchorInfo.publicKey && copyToClipboard(anchorInfo.publicKey, 'anchor')}
                >
                  <Text style={s.addressText} numberOfLines={1}>
                    {anchorInfo.publicKey || 'No disponible'}
                  </Text>
                  <Text style={s.copyIcon}>
                    {copiedField === 'anchor' ? '✓' : '📋'}
                  </Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity style={s.refreshButton} onPress={loadAnchorInfo}>
                <Text style={s.refreshIcon}>↻</Text>
              </TouchableOpacity>
            </>
          ) : (
            <Text style={s.balanceError}>No se pudo conectar al Anchor</Text>
          )}
        </View>

        {/* Network Info Card */}
        <View style={s.card}>
          <Text style={s.cardTitle}>Info de la Red</Text>

          <View style={s.infoRow}>
            <Text style={s.infoLabel}>Red</Text>
            <Text style={s.infoValue}>Stellar Testnet</Text>
          </View>
          <View style={s.infoRow}>
            <Text style={s.infoLabel}>Token</Text>
            <Text style={s.infoValue}>EURC (Mykobo)</Text>
          </View>
          <View style={s.infoRow}>
            <Text style={s.infoLabel}>On/Off Ramp</Text>
            <Text style={s.infoValue}>Mykobo (SEP-24)</Text>
          </View>
          <View style={s.infoRow}>
            <Text style={s.infoLabel}>Estado</Text>
            <View style={s.statusBadge}>
              <Text style={s.statusText}>Testnet</Text>
            </View>
          </View>

          <View style={s.warningBox}>
            <Text style={s.warningIcon}>⚠️</Text>
            <Text style={s.warningText}>
              Mykobo solo opera en mainnet. En testnet usa la simulacion para probar.
            </Text>
          </View>
        </View>

        {/* Contract Info */}
        <View style={s.card}>
          <Text style={s.cardTitle}>Contratos</Text>

          <View style={s.contractRow}>
            <Text style={s.contractLabel}>EURC (Base Sepolia)</Text>
            <TouchableOpacity
              onPress={() => copyToClipboard('0x808456652fdb597867f38412077A9182bf77359F', 'eurc')}
            >
              <Text style={s.contractAddress}>
                0x808456...9F {copiedField === 'eurc' ? '✓' : '📋'}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={s.contractRow}>
            <Text style={s.contractLabel}>TandaPool</Text>
            <Text style={s.contractPending}>Pendiente de deploy</Text>
          </View>
        </View>

        <View style={s.footer}>
          <Text style={s.footerText}>
            Tanda v2.0.0 - Base Sepolia Testnet
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  errorIcon: { fontSize: 48, marginBottom: 16 },
  errorText: { fontSize: 16, color: '#868e96', textAlign: 'center' },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    backgroundColor: '#1a1a2e',
    gap: 8,
  },
  headerTitle: { fontSize: 18, fontWeight: '600', color: '#fff' },
  headerBackButton: { position: 'absolute', left: 16 },
  headerBackText: { fontSize: 16, color: '#6366f1', fontWeight: '500' },
  testBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#fbbf24',
    borderRadius: 4,
    fontSize: 10,
    fontWeight: '700',
    color: '#1a1a2e',
  },

  content: { flex: 1, padding: 16 },

  // Cards
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#212529',
    marginBottom: 16,
  },

  // Balances
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f3f4',
  },
  balanceInfo: { flex: 1 },
  balanceLabel: { fontSize: 13, color: '#868e96', marginBottom: 4 },
  balanceValue: { fontSize: 18, fontWeight: '600', color: '#212529' },
  balanceError: { fontSize: 14, color: '#e03131' },
  refreshButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f1f3f4',
    justifyContent: 'center',
    alignItems: 'center',
  },
  refreshIcon: { fontSize: 18, color: '#495057' },

  // Addresses
  addressSection: { marginBottom: 16 },
  addressLabel: { fontSize: 13, color: '#868e96', marginBottom: 6 },
  addressBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  addressText: {
    flex: 1,
    fontSize: 13,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    color: '#212529',
    marginRight: 8,
  },
  copyIcon: { fontSize: 14, color: '#6366f1' },
  linkText: { fontSize: 13, color: '#6366f1', marginTop: 8 },

  // Faucets
  faucetSection: { marginBottom: 8 },
  faucetHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 },
  faucetIcon: { fontSize: 28, marginRight: 12 },
  faucetInfo: { flex: 1 },
  faucetTitle: { fontSize: 15, fontWeight: '600', color: '#212529' },
  faucetDescription: { fontSize: 13, color: '#868e96', marginTop: 2 },
  faucetSteps: {
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  stepText: { fontSize: 13, color: '#495057', marginBottom: 4 },
  faucetButton: {
    backgroundColor: '#6366f1',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  faucetButtonText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  divider: {
    height: 1,
    backgroundColor: '#e9ecef',
    marginVertical: 16,
  },

  // Simulation
  simulationDescription: {
    fontSize: 13,
    color: '#868e96',
    marginBottom: 16,
    lineHeight: 20,
  },
  simulationButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  simButton: {
    backgroundColor: '#2f9e44',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  simButtonText: { color: '#fff', fontSize: 14, fontWeight: '600' },

  // Info rows
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f3f4',
  },
  infoLabel: { fontSize: 14, color: '#868e96' },
  infoValue: { fontSize: 14, color: '#212529', fontWeight: '500' },
  statusBadge: {
    backgroundColor: '#fff3bf',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  statusText: { fontSize: 12, color: '#e67700', fontWeight: '500' },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#fff4e6',
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
  },
  warningIcon: { fontSize: 16, marginRight: 8 },
  warningText: { flex: 1, fontSize: 13, color: '#e8590c', lineHeight: 18 },

  // Contracts
  contractRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  contractLabel: { fontSize: 14, color: '#495057' },
  contractAddress: { fontSize: 13, color: '#6366f1', fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  contractPending: { fontSize: 13, color: '#868e96', fontStyle: 'italic' },

  // Footer
  footer: { alignItems: 'center', paddingVertical: 20 },
  footerText: { fontSize: 12, color: '#adb5bd' },

  // Back button
  backButton: {
    backgroundColor: '#6366f1',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 16,
  },
  backButtonText: { color: '#fff', fontWeight: '600' },
});

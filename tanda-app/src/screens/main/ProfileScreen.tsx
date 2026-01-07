import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Alert,
  Share,
  Platform,
  TextInput,
  Modal,
  Pressable,
} from 'react-native';
import { Card, Button } from '../../components';
import { useUserStore } from '../../stores/userStore';
import { useAuthStore } from '../../stores/authStore';
import { stellarService } from '../../services/stellar';
import { anchorService } from '../../services/anchor';
import { formatEuro, ENV } from '../../config/network';

interface ProfileScreenProps {
  navigation: any;
}

export const ProfileScreen: React.FC<ProfileScreenProps> = ({ navigation }) => {
  const { user, eurcBalance, transactions } = useUserStore();
  const { securitySettings, logout, publicKey: authPublicKey } = useAuthStore();
  const [showFullKey, setShowFullKey] = useState(false);
  const [showPrivateKey, setShowPrivateKey] = useState(false);
  const [privateKeyVisible, setPrivateKeyVisible] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [editingName, setEditingName] = useState(false);
  const [newName, setNewName] = useState('');
  const [savingName, setSavingName] = useState(false);

  const publicKey = stellarService.isInitialized() ? stellarService.getPublicKey() : (authPublicKey || '');
  const isTestnet = ENV.current !== 'mainnet';

  // Load display name from backend
  useEffect(() => {
    const loadDisplayName = async () => {
      if (!publicKey) return;
      try {
        const response = await anchorService.getUsersBatch([publicKey]);
        if (response.success && response.users[publicKey]?.displayName) {
          setDisplayName(response.users[publicKey].displayName);
        }
      } catch (error) {
        console.error('[Profile] Error loading display name:', error);
      }
    };
    loadDisplayName();
  }, [publicKey]);

  const handleEditName = () => {
    setNewName(displayName);
    setEditingName(true);
  };

  const handleSaveName = async () => {
    if (!publicKey || !newName.trim()) return;

    setSavingName(true);
    try {
      const response = await fetch(`${anchorService.getAnchorUrl()}/api/users/${publicKey}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName: newName.trim() }),
      });
      const data = await response.json();

      if (data.success) {
        setDisplayName(newName.trim());
        setEditingName(false);
        if (Platform.OS === 'web') {
          window.alert('Nombre actualizado');
        } else {
          Alert.alert('Éxito', 'Nombre actualizado correctamente');
        }
      } else {
        throw new Error(data.error || 'Error al guardar');
      }
    } catch (error: any) {
      console.error('[Profile] Error saving name:', error);
      if (Platform.OS === 'web') {
        window.alert('Error al guardar el nombre');
      } else {
        Alert.alert('Error', 'No se pudo guardar el nombre');
      }
    } finally {
      setSavingName(false);
    }
  };

  const handleShare = async () => {
    try {
      await Share.share({ message: 'Mi direccion en Tanda: ' + publicKey });
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  const handleCopyKey = () => {
    if (Platform.OS === 'web') {
      navigator.clipboard.writeText(publicKey);
      window.alert('Direccion copiada');
    } else {
      Alert.alert('Copiado', 'Tu direccion ha sido copiada');
    }
  };

  const handleShowPrivateKey = () => {
    const msg = '⚠️ SOLO PARA TESTNET\n\nStellar Network usa direcciones propias. No compatible con MetaMask.\n\nUsa la pantalla de "Ver palabras secretas" para exportar tu frase de recuperación.';
    if (Platform.OS === 'web') {
      window.alert(msg);
    } else {
      Alert.alert('Información', msg, [
        { text: 'OK' },
      ]);
    }
  };

  const handleLogout = async () => {
    const msg = 'Estas seguro? Necesitaras tus 12 palabras para volver a entrar.';
    if (Platform.OS === 'web') {
      if (window.confirm(msg)) { await logout(); }
    } else {
      Alert.alert('Cerrar sesion', msg, [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Cerrar sesion', style: 'destructive', onPress: () => logout() },
      ]);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return '#22c55e';
    if (score >= 50) return '#f59e0b';
    return '#ef4444';
  };

  const formatKey = (key: string, full: boolean) => {
    if (full || !key) return key;
    return key.slice(0, 20) + '...' + key.slice(-10);
  };

  if (!user) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContent}><Text>Cargando...</Text></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={[styles.avatarContainer, displayName && styles.avatarWithInitial]}>
            <Text style={[styles.avatar, displayName && styles.avatarInitialText]}>
              {displayName ? displayName.charAt(0).toUpperCase() : '👤'}
            </Text>
          </View>
          <TouchableOpacity onPress={handleEditName} style={styles.nameContainer}>
            <Text style={styles.displayName}>
              {displayName || 'Toca para añadir tu nombre'}
            </Text>
            <Text style={styles.editIcon}>✏️</Text>
          </TouchableOpacity>
          <Text style={styles.balanceLabel}>Balance</Text>
          <Text style={styles.balance}>{formatEuro(eurcBalance)}</Text>
        </View>

        {/* Edit Name Modal */}
        <Modal
          visible={editingName}
          transparent
          animationType="fade"
          onRequestClose={() => setEditingName(false)}
        >
          <Pressable style={styles.modalOverlay} onPress={() => setEditingName(false)}>
            <Pressable style={styles.modalContent} onPress={e => e.stopPropagation()}>
              <Text style={styles.modalTitle}>Tu nombre</Text>
              <Text style={styles.modalSubtitle}>Este nombre será visible para otros participantes</Text>
              <TextInput
                style={styles.nameInput}
                value={newName}
                onChangeText={setNewName}
                placeholder="Ej: Juan García"
                placeholderTextColor="#94a3b8"
                autoFocus
                maxLength={50}
              />
              <View style={styles.modalButtons}>
                <Button
                  title="Cancelar"
                  onPress={() => setEditingName(false)}
                  variant="outline"
                  size="small"
                />
                <Button
                  title={savingName ? "Guardando..." : "Guardar"}
                  onPress={handleSaveName}
                  size="small"
                  disabled={savingName || !newName.trim()}
                />
              </View>
            </Pressable>
          </Pressable>
        </Modal>

        <Card variant="outlined" style={styles.keyCard}>
          <View style={styles.keyHeader}>
            <Text style={styles.keyLabel}>Tu direccion</Text>
            <TouchableOpacity onPress={() => setShowFullKey(!showFullKey)}>
              <Text style={styles.toggleText}>{showFullKey ? 'Ocultar' : 'Ver completa'}</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.keyValue} numberOfLines={showFullKey ? undefined : 1}>{formatKey(publicKey, showFullKey)}</Text>
          <View style={styles.keyActions}>
            <Button title="Copiar" onPress={handleCopyKey} variant="outline" size="small" />
            <Button title="Compartir" onPress={handleShare} variant="outline" size="small" />
          </View>
        </Card>

        <View style={styles.euroSection}>
          <TouchableOpacity style={styles.euroBtn} onPress={() => navigation.navigate('Deposit')}>
            <Text style={styles.euroBtnIcon}>💶</Text>
            <Text style={styles.euroBtnText}>Depositar</Text>
            <Text style={styles.euroBtnSub}>EUR → Wallet</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.euroBtn, styles.euroBtnWithdraw]} onPress={() => navigation.navigate('Withdraw')}>
            <Text style={styles.euroBtnIcon}>💸</Text>
            <Text style={styles.euroBtnText}>Retirar</Text>
            <Text style={styles.euroBtnSub}>Wallet → EUR</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.statsRow}>
          <Card variant="elevated" style={styles.statCard}>
            <Text style={[styles.statValue, { color: getScoreColor(user.score) }]}>{user.score}</Text>
            <Text style={styles.statLabel}>Puntuacion</Text>
          </Card>
          <Card variant="elevated" style={styles.statCard}>
            <Text style={styles.statValue}>{user.totalTandas}</Text>
            <Text style={styles.statLabel}>Tandas</Text>
          </Card>
          <Card variant="elevated" style={styles.statCard}>
            <Text style={styles.statValue}>{user.completedTandas}</Text>
            <Text style={styles.statLabel}>Completadas</Text>
          </Card>
        </View>

        {user.activeDebt && (
          <Card variant="outlined" style={styles.debtCard}>
            <Text style={styles.debtIcon}>⚠️</Text>
            <View style={styles.debtContent}>
              <Text style={styles.debtTitle}>Tienes deuda activa</Text>
              <Text style={styles.debtText}>No podras unirte a nuevas tandas hasta saldarla</Text>
            </View>
          </Card>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Actividad reciente</Text>
          {transactions.length === 0 ? (
            <Card variant="outlined" style={styles.emptyCard}><Text style={styles.emptyText}>Sin actividad reciente</Text></Card>
          ) : (
            <View style={styles.transactionsList}>
              {transactions.slice(0, 5).map((tx) => (
                <Card key={tx.id} variant="outlined" style={styles.txCard}>
                  <View style={styles.txRow}>
                    <View style={styles.txLeft}>
                      <Text style={styles.txIcon}>{tx.type === 'deposit' ? '📤' : tx.type === 'withdrawal' ? '📥' : '💰'}</Text>
                      <View>
                        <Text style={styles.txType}>{tx.type === 'deposit' ? 'Deposito' : tx.type === 'withdrawal' ? 'Retiro' : 'Recibido'}</Text>
                        <Text style={styles.txTanda}>{tx.tandaName}</Text>
                      </View>
                    </View>
                    <Text style={[styles.txAmount, { color: tx.type === 'deposit' ? '#ef4444' : '#22c55e' }]}>
                      {tx.type === 'deposit' ? '-' : '+'}{formatEuro(tx.amount)}
                    </Text>
                  </View>
                </Card>
              ))}
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Seguridad</Text>
          <TouchableOpacity onPress={() => navigation.navigate('SecuritySettings')}>
            <Card variant="outlined" style={styles.menuItem}>
              <Text style={styles.menuIcon}>🔑</Text>
              <View style={styles.menuContent}>
                <Text style={styles.menuTitle}>Ver palabras secretas</Text>
                <Text style={styles.menuSubtitle}>Accede a tu frase de recuperacion</Text>
              </View>
              <Text style={styles.menuArrow}>›</Text>
            </Card>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate('SecuritySettings')}>
            <Card variant="outlined" style={styles.menuItem}>
              <Text style={styles.menuIcon}>🛡️</Text>
              <View style={styles.menuContent}>
                <Text style={styles.menuTitle}>Gestionar PIN</Text>
                <Text style={styles.menuSubtitle}>{securitySettings?.pinEnabled ? 'PIN activado' : 'Sin PIN configurado'}</Text>
              </View>
              <Text style={styles.menuArrow}>›</Text>
            </Card>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Testnet Tools</Text>
          <TouchableOpacity onPress={() => navigation.navigate('DevTools')}>
            <Card variant="outlined" style={styles.menuItem}>
              <Text style={styles.menuIcon}>🛠️</Text>
              <View style={styles.menuContent}>
                <Text style={styles.menuTitle}>Dev Tools</Text>
                <Text style={styles.menuSubtitle}>Faucets, balances y simulacion</Text>
              </View>
              <Text style={styles.menuArrow}>›</Text>
            </Card>
          </TouchableOpacity>
          <Card variant="outlined" style={styles.menuItem}>
            <Text style={styles.menuIcon}>🌐</Text>
            <View style={styles.menuContent}>
              <Text style={styles.menuTitle}>Red Stellar Network</Text>
              <Text style={styles.menuSubtitle}>Direcciones Stellar (no compatible con MetaMask)</Text>
            </View>
          </Card>
        </View>

        <View style={styles.section}>
          <Button title="Cerrar sesion" onPress={handleLogout} variant="danger" />
        </View>
        <Text style={styles.version}>Tanda v2.0.0 - Stellar Network</Text>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  centerContent: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scrollContent: { padding: 20 },
  header: { alignItems: 'center', marginBottom: 24 },
  avatarContainer: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#e2e8f0', justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  avatarWithInitial: { backgroundColor: '#3b82f6' },
  avatar: { fontSize: 40, color: '#1e293b' },
  avatarInitialText: { color: '#ffffff', fontWeight: '700' },
  nameContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  displayName: { fontSize: 20, fontWeight: '600', color: '#1e293b' },
  editIcon: { fontSize: 14, marginLeft: 8 },
  balanceLabel: { fontSize: 14, color: '#64748b' },
  balance: { fontSize: 32, fontWeight: '700', color: '#1e293b' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { backgroundColor: '#fff', borderRadius: 16, padding: 24, width: '85%', maxWidth: 400 },
  modalTitle: { fontSize: 20, fontWeight: '700', color: '#1e293b', textAlign: 'center', marginBottom: 8 },
  modalSubtitle: { fontSize: 14, color: '#64748b', textAlign: 'center', marginBottom: 20 },
  nameInput: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, padding: 16, fontSize: 16, color: '#1e293b', backgroundColor: '#f8fafc', marginBottom: 20 },
  modalButtons: { flexDirection: 'row', gap: 12, justifyContent: 'center' },
  keyCard: { padding: 16, marginBottom: 16 },
  keyHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  keyLabel: { fontSize: 14, fontWeight: '600', color: '#64748b' },
  toggleText: { fontSize: 14, color: '#3b82f6' },
  keyValue: { fontSize: 14, fontFamily: 'monospace', color: '#1e293b', marginBottom: 12 },
  keyActions: { flexDirection: 'row', gap: 12 },
  euroSection: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  euroBtn: { flex: 1, backgroundColor: '#20c997', borderRadius: 16, padding: 16, alignItems: 'center' },
  euroBtnWithdraw: { backgroundColor: '#ff6b6b' },
  euroBtnIcon: { fontSize: 28, marginBottom: 8 },
  euroBtnText: { fontSize: 16, fontWeight: '600', color: '#fff' },
  euroBtnSub: { fontSize: 12, color: '#fff', opacity: 0.9, marginTop: 4 },
  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  statCard: { flex: 1, alignItems: 'center', padding: 16 },
  statValue: { fontSize: 24, fontWeight: '700', color: '#1e293b' },
  statLabel: { fontSize: 12, color: '#64748b', marginTop: 4 },
  debtCard: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: '#fef2f2', borderColor: '#fecaca', marginBottom: 16 },
  debtIcon: { fontSize: 24, marginRight: 12 },
  debtContent: { flex: 1 },
  debtTitle: { fontSize: 15, fontWeight: '600', color: '#dc2626' },
  debtText: { fontSize: 13, color: '#b91c1c', marginTop: 2 },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 18, fontWeight: '600', color: '#1e293b', marginBottom: 12 },
  emptyCard: { padding: 24, alignItems: 'center' },
  emptyText: { fontSize: 14, color: '#94a3b8' },
  transactionsList: { gap: 8 },
  txCard: { padding: 12 },
  txRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  txLeft: { flexDirection: 'row', alignItems: 'center' },
  txIcon: { fontSize: 24, marginRight: 12 },
  txType: { fontSize: 15, fontWeight: '500', color: '#1e293b' },
  txTanda: { fontSize: 13, color: '#64748b' },
  txAmount: { fontSize: 15, fontWeight: '600' },
  menuItem: { flexDirection: 'row', alignItems: 'center', padding: 16, marginBottom: 8 },
  menuIcon: { fontSize: 24, marginRight: 12 },
  menuContent: { flex: 1 },
  menuTitle: { fontSize: 15, fontWeight: '500', color: '#1e293b' },
  menuSubtitle: { fontSize: 13, color: '#64748b', marginTop: 2 },
  menuArrow: { fontSize: 20, color: '#94a3b8' },
  version: { textAlign: 'center', fontSize: 12, color: '#94a3b8', marginTop: 20 },
  privateKeyCard: { padding: 16 },
  warningText: { fontSize: 14, fontWeight: '600', color: '#dc2626', textAlign: 'center', marginBottom: 12 },
  privateKeyValue: { fontSize: 12, fontFamily: 'monospace', color: '#1e293b', backgroundColor: '#f1f5f9', padding: 12, borderRadius: 8, textAlign: 'center', marginBottom: 12 },
  privateKeyActions: { flexDirection: 'row', justifyContent: 'center', gap: 12, marginBottom: 16 },
  instructionsBox: { backgroundColor: '#fef3c7', padding: 12, borderRadius: 8 },
  instructionsTitle: { fontSize: 13, fontWeight: '600', color: '#92400e', marginBottom: 8 },
  instructionsText: { fontSize: 12, color: '#78350f', marginBottom: 4 },
});

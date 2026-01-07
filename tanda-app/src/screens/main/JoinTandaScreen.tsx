import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Alert,
  TouchableOpacity,
} from 'react-native';
import { Button, Input, Card } from '../../components';
import { useTandaStore } from '../../stores/tandaStore';
import { useUserStore, SCORE_CONFIG } from '../../stores/userStore';
import { formatEuro } from '../../config/network';
import { anchorService, Tanda as AnchorTanda } from '../../services/anchor';
import { Tanda } from '../../types';

// Convert Anchor tanda to local Tanda type
const convertAnchorTanda = (anchorTanda: AnchorTanda): Tanda => {
  return {
    id: anchorTanda.id,
    creatorPublicKey: anchorTanda.creator,
    name: anchorTanda.name,
    amount: anchorTanda.amount,
    maxParticipants: anchorTanda.maxParticipants,
    minScore: 0,
    participants: anchorTanda.participants.map(p => ({
      publicKey: p.walletAddress,
      joinedAt: p.joinedAt,
      hasDeposited: p.hasDeposited,
      hasWithdrawn: p.hasWithdrawn,
      score: SCORE_CONFIG.INITIAL, // Default, will be updated from Anchor
    })),
    currentCycle: anchorTanda.currentCycle,
    totalCycles: anchorTanda.totalCycles,
    status: anchorTanda.status,
    createdAt: anchorTanda.createdAt,
    beneficiaryIndex: anchorTanda.currentCycle,
    beneficiaryOrder: anchorTanda.beneficiaryOrder.map(addr =>
      anchorTanda.participants.findIndex(p => p.walletAddress === addr)
    ).filter(idx => idx >= 0),
  };
};

interface JoinTandaScreenProps {
  navigation: any;
}

export const JoinTandaScreen: React.FC<JoinTandaScreenProps> = ({
  navigation,
}) => {
  const [code, setCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [foundTanda, setFoundTanda] = useState<any>(null);

  const { getTandaById, joinTanda } = useTandaStore();
  const { user, incrementTandaCount, isBlocked } = useUserStore();

  const [isSearching, setIsSearching] = useState(false);

  const handleSearch = async () => {
    if (!code.trim()) {
      Alert.alert('Error', 'Ingresa el código de la tanda');
      return;
    }

    setIsSearching(true);

    try {
      // Primero buscar en estado local
      let tanda: Tanda | undefined = getTandaById(code.trim());

      // Si no está local, buscar directamente en Anchor
      if (!tanda) {
        console.log('[JoinTanda] Not found locally, fetching from Anchor...');
        try {
          const response = await anchorService.getTanda(code.trim());
          if (response.success && response.tanda) {
            tanda = convertAnchorTanda(response.tanda);
            console.log('[JoinTanda] Found in Anchor:', tanda.name);
          }
        } catch (anchorError) {
          console.log('[JoinTanda] Anchor fetch failed:', anchorError);
        }
      }

      if (!tanda) {
        Alert.alert('No encontrada', 'No se encontró ninguna tanda con ese código');
        return;
      }

      setFoundTanda(tanda);
    } finally {
      setIsSearching(false);
    }
  };

  const handleJoin = async () => {
    if (!foundTanda || !user) return;

    // Verificar si el usuario está bloqueado
    if (isBlocked()) {
      Alert.alert(
        'Cuenta bloqueada',
        `Tu puntuación es menor a ${SCORE_CONFIG.BLOCK_THRESHOLD}. No puedes unirte a tandas hasta mejorar tu reputación.`
      );
      return;
    }

    // Verificar puntuación mínima
    if (user.score < foundTanda.minScore) {
      Alert.alert(
        'Puntuación insuficiente',
        `Necesitas al menos ${foundTanda.minScore} puntos para unirte. Tu puntuación actual es ${user.score}.`
      );
      return;
    }

    // Verificar deuda activa
    if (user.activeDebt) {
      Alert.alert(
        'Deuda pendiente',
        'No puedes unirte a nuevas tandas mientras tengas deudas activas.'
      );
      return;
    }

    setIsLoading(true);

    try {
      await joinTanda(foundTanda.id);
      await incrementTandaCount();

      Alert.alert(
        '¡Te uniste!',
        `Ahora eres parte de "${foundTanda.name}"`,
        [
          {
            text: 'Ver tanda',
            onPress: () => navigation.replace('TandaDetail', { tandaId: foundTanda.id }),
          },
        ]
      );
    } catch (error: any) {
      Alert.alert('Error', error.message || 'No se pudo unir a la tanda');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Text style={styles.title}>Unirse a una tanda</Text>
          <Text style={styles.subtitle}>
            Ingresa el código o escanea el QR de la tanda
          </Text>
        </View>

        <View style={styles.inputSection}>
          <Input
            label="Código de la tanda"
            placeholder="Ingresa el código"
            value={code}
            onChangeText={(text) => {
              setCode(text);
              setFoundTanda(null);
            }}
            autoCapitalize="none"
          />
          <Button
            title="Buscar"
            onPress={handleSearch}
            variant="outline"
            loading={isSearching}
          />
        </View>

        {/* QR Scanner placeholder */}
        <Card variant="outlined" style={styles.qrCard}>
          <Text style={styles.qrIcon}>📷</Text>
          <Text style={styles.qrText}>
            Próximamente: Escanear código QR
          </Text>
        </Card>

        {/* Found Tanda Info */}
        {foundTanda && (
          <Card variant="elevated" style={styles.tandaCard}>
            <View style={styles.tandaHeader}>
              <Text style={styles.tandaName}>{foundTanda.name}</Text>
              <View
                style={[
                  styles.statusBadge,
                  {
                    backgroundColor:
                      foundTanda.status === 'waiting' ? '#fef3c7' : '#fee2e2',
                  },
                ]}
              >
                <Text
                  style={[
                    styles.statusText,
                    {
                      color:
                        foundTanda.status === 'waiting' ? '#d97706' : '#dc2626',
                    },
                  ]}
                >
                  {foundTanda.status === 'waiting'
                    ? 'Esperando'
                    : 'No disponible'}
                </Text>
              </View>
            </View>

            <View style={styles.tandaDetails}>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Monto por ciclo</Text>
                <Text style={styles.detailValue}>{formatEuro(foundTanda.amount)}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Participantes</Text>
                <Text style={styles.detailValue}>
                  {foundTanda.participants.length}/{foundTanda.maxParticipants}
                </Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Puntuación mínima</Text>
                <Text style={styles.detailValue}>{foundTanda.minScore}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Total de ciclos</Text>
                <Text style={styles.detailValue}>
                  {foundTanda.maxParticipants} ciclos
                </Text>
              </View>
            </View>

            {user && user.score < foundTanda.minScore && (
              <View style={styles.warningBox}>
                <Text style={styles.warningIcon}>⚠️</Text>
                <Text style={styles.warningText}>
                  Tu puntuación ({user.score}) es menor a la requerida ({foundTanda.minScore})
                </Text>
              </View>
            )}

            {foundTanda.participants.length >= foundTanda.maxParticipants && (
              <View style={styles.warningBox}>
                <Text style={styles.warningIcon}>🚫</Text>
                <Text style={styles.warningText}>
                  Esta tanda ya está llena
                </Text>
              </View>
            )}

            {foundTanda.status === 'waiting' &&
              foundTanda.participants.length < foundTanda.maxParticipants &&
              user &&
              user.score >= foundTanda.minScore && (
                <Button
                  title="Unirme a esta tanda"
                  onPress={handleJoin}
                  loading={isLoading}
                  style={{ marginTop: 16 }}
                />
              )}
          </Card>
        )}

        {/* Info */}
        <Card variant="outlined" style={styles.infoCard}>
          <Text style={styles.infoTitle}>💡 Antes de unirte</Text>
          <Text style={styles.infoText}>
            • Verifica que conoces al creador de la tanda
          </Text>
          <Text style={styles.infoText}>
            • Asegúrate de poder depositar el monto cada ciclo
          </Text>
          <Text style={styles.infoText}>
            • Lee las reglas y compromisos de la tanda
          </Text>
        </Card>
      </ScrollView>

      <View style={styles.buttons}>
        <Button
          title="Cancelar"
          onPress={() => navigation.goBack()}
          variant="secondary"
          size="large"
        />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
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
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#64748b',
  },
  inputSection: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
    alignItems: 'flex-end',
  },
  qrCard: {
    padding: 40,
    alignItems: 'center',
    marginBottom: 20,
    backgroundColor: '#f8fafc',
    borderStyle: 'dashed',
  },
  qrIcon: {
    fontSize: 48,
    marginBottom: 12,
    opacity: 0.5,
  },
  qrText: {
    fontSize: 14,
    color: '#94a3b8',
  },
  tandaCard: {
    padding: 20,
    marginBottom: 20,
  },
  tandaHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  tandaName: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1e293b',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  tandaDetails: {
    gap: 12,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  detailLabel: {
    fontSize: 15,
    color: '#64748b',
  },
  detailValue: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1e293b',
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef2f2',
    padding: 12,
    borderRadius: 8,
    marginTop: 16,
  },
  warningIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  warningText: {
    flex: 1,
    fontSize: 14,
    color: '#dc2626',
  },
  infoCard: {
    padding: 16,
    backgroundColor: '#f0f9ff',
    borderColor: '#bae6fd',
  },
  infoTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0369a1',
    marginBottom: 12,
  },
  infoText: {
    fontSize: 14,
    color: '#0c4a6e',
    marginBottom: 6,
    lineHeight: 20,
  },
  buttons: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
});

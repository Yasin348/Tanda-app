import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
} from 'react-native';
import { Button, Input, Card } from '../../components';
import { useTandaStore } from '../../stores/tandaStore';
import { useUserStore, SCORE_CONFIG } from '../../stores/userStore';
import { formatEuro, TANDA_CONFIG } from '../../config/network';
import { alertMessage } from '../../utils/alert';

interface CreateTandaScreenProps {
  navigation: any;
}

export const CreateTandaScreen: React.FC<CreateTandaScreenProps> = ({
  navigation,
}) => {
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [participants, setParticipants] = useState('');
  const [minScore, setMinScore] = useState('50');
  const [isLoading, setIsLoading] = useState(false);

  const { createTanda } = useTandaStore();
  const { incrementTandaCount, eurcBalance, eurcBalanceFormatted, isBlocked } = useUserStore();

  const MIN_BALANCE_REQUIRED = 1;
  const participantsNum = parseInt(participants) || 0;
  const amountNum = parseFloat(amount) || 0;

  // Form validation function
  const validateForm = (): string | null => {
    // Validate name length
    if (name.trim().length > 50) {
      return 'El nombre no puede superar 50 caracteres';
    }

    // Validate amount
    if (isNaN(amountNum) || amountNum < 10) {
      return 'El monto minimo es 10 EUR';
    }
    if (amountNum > 10000) {
      return 'El monto maximo es 10,000 EUR';
    }

    // Validate participants
    if (isNaN(participantsNum) || participantsNum < 2) {
      return 'Minimo 2 participantes';
    }
    if (participantsNum > 12) {
      return 'Maximo 12 participantes';
    }

    // Validate minScore
    const minScoreNum = parseInt(minScore);
    if (isNaN(minScoreNum) || minScoreNum < 0 || minScoreNum > 100) {
      return 'La puntuacion minima debe ser entre 0 y 100';
    }

    return null;
  };

  const handleCreate = async () => {
    // Check if user is blocked
    if (isBlocked()) {
      alertMessage(
        'Cuenta bloqueada',
        `Tu puntuación es menor a ${SCORE_CONFIG.BLOCK_THRESHOLD}. No puedes crear tandas hasta mejorar tu reputación.`
      );
      return;
    }

    if (eurcBalance < MIN_BALANCE_REQUIRED) {
      alertMessage(
        'Balance insuficiente',
        `Necesitas al menos ${formatEuro(MIN_BALANCE_REQUIRED)} en tu cuenta para crear una tanda. Tu balance actual es ${eurcBalanceFormatted}.`
      );
      return;
    }

    // Run form validation
    const validationError = validateForm();
    if (validationError) {
      alertMessage('Error de validacion', validationError);
      return;
    }

    const minScoreNum = parseInt(minScore);

    setIsLoading(true);
    try {
      const tanda = await createTanda({
        name: name.trim() || undefined,
        amount: amountNum,
        maxParticipants: participantsNum,
        minScore: minScoreNum,
      });
      await incrementTandaCount();
      const displayName = tanda.name || 'Tu tanda';
      alertMessage(
        'Tanda creada!',
        displayName + ' esta lista. Comparte el codigo para que otros se unan.',
        () => navigation.replace('TandaDetail', { tandaId: tanda.id })
      );
    } catch (error: any) {
      console.error('Error creating tanda:', error);

      if (error?.code === 'INSUFFICIENT_BALANCE' || error?.message?.includes('€1')) {
        alertMessage(
          'Balance insuficiente',
          'Necesitas al menos €1 en tu cuenta para crear una tanda. Deposita fondos primero.'
        );
      } else {
        const errorMsg = error?.message || error?.toString() || 'Error desconocido';
        alertMessage('Error', `No se pudo crear la tanda: ${errorMsg}`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const OrderPreview = () => {
    if (participantsNum < 2) return null;
    const cycles = participantsNum;
    return (
      <Card variant="outlined" style={styles.orderCard}>
        <Text style={styles.orderTitle}>Orden de cobro (ejemplo)</Text>
        <Text style={styles.orderSubtitle}>El orden se define al iniciar la tanda</Text>
        <View style={styles.timeline}>
          {Array.from({ length: Math.min(cycles, 4) }).map((_, idx) => (
            <View key={idx} style={styles.timelineItem}>
              <View style={[styles.timelineDot, idx === 0 && styles.timelineDotFirst]} />
              {idx < Math.min(cycles, 4) - 1 && <View style={styles.timelineLine} />}
              <View style={styles.timelineContent}>
                <Text style={styles.timelineCycle}>Ciclo {idx + 1}</Text>
                <Text style={styles.timelineAction}>
                  Todos depositan {formatEuro(amountNum)}
                </Text>
                <Text style={styles.timelineBeneficiary}>
                  Participante {idx + 1} recibe {formatEuro(amountNum * participantsNum)}
                </Text>
              </View>
            </View>
          ))}
          {cycles > 4 && (
            <Text style={styles.moreText}>... y {cycles - 4} ciclos mas</Text>
          )}
        </View>
      </Card>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <Text style={styles.title}>Crear nueva tanda</Text>
            <Text style={styles.subtitle}>
              Configura los detalles de tu grupo de ahorro
            </Text>
          </View>

          <View style={styles.form}>
            <Input
              label="Nombre (opcional)"
              placeholder="Ej: Ahorro vacaciones"
              value={name}
              onChangeText={setName}
              maxLength={30}
            />

            <Input
              label="Monto por ciclo (EUR)"
              placeholder="Minimo 1 EUR"
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
            />

            <Input
              label="Numero de participantes"
              placeholder="Entre 2 y 12"
              value={participants}
              onChangeText={setParticipants}
              keyboardType="number-pad"
            />

            <Input
              label="Puntuacion minima requerida"
              placeholder="0-100"
              value={minScore}
              onChangeText={setMinScore}
              keyboardType="number-pad"
            />
          </View>

          <Card variant="outlined" style={styles.infoCard}>
            <Text style={styles.infoTitle}>Como funciona</Text>
            <View style={styles.infoItem}>
              <Text style={styles.infoBullet}>1.</Text>
              <Text style={styles.infoText}>
                Todos depositan {formatEuro(amountNum || 0)} cada ciclo
              </Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoBullet}>2.</Text>
              <Text style={styles.infoText}>
                Cuando todos depositan, cualquiera puede activar el pago
              </Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoBullet}>3.</Text>
              <Text style={styles.infoText}>
                El beneficiario del ciclo recibe el total
              </Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoBullet}>4.</Text>
              <Text style={styles.infoText}>
                Si alguien no paga en 6 dias, puede ser expulsado
              </Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoBullet}>5.</Text>
              <Text style={styles.infoText}>
                La tanda termina cuando todos han cobrado
              </Text>
            </View>
          </Card>

          <OrderPreview />

          {amount && participants && (
            <Card variant="elevated" style={styles.summaryCard}>
              <Text style={styles.summaryTitle}>Resumen</Text>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Cada participante aporta</Text>
                <Text style={styles.summaryValue}>{formatEuro(amountNum)}/ciclo</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Total por ciclo</Text>
                <Text style={styles.summaryValue}>
                  {formatEuro(amountNum * participantsNum)}
                </Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Beneficiario recibe</Text>
                <Text style={styles.summaryValueHighlight}>
                  {formatEuro(amountNum * participantsNum)}
                </Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Numero de ciclos</Text>
                <Text style={styles.summaryValue}>{participantsNum} ciclos</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Limite de pago</Text>
                <Text style={styles.summaryValue}>6 dias por ciclo</Text>
              </View>
            </Card>
          )}

          <View style={styles.commissionInfo}>
            <Text style={styles.commissionIcon}>💡</Text>
            <View style={styles.commissionTextContainer}>
              <Text style={styles.commissionTitle}>Comisiones</Text>
              <Text style={styles.commissionText}>
                • Crear tanda: {formatEuro(TANDA_CONFIG.createTandaFee)}
              </Text>
              <Text style={styles.commissionText}>
                • Por deposito: {TANDA_CONFIG.depositCommissionPercent}%
              </Text>
            </View>
          </View>
        </ScrollView>

        <View style={styles.buttons}>
          {eurcBalance < MIN_BALANCE_REQUIRED && (
            <View style={styles.balanceWarning}>
              <Text style={styles.balanceWarningIcon}>⚠️</Text>
              <View style={styles.balanceWarningContent}>
                <Text style={styles.balanceWarningTitle}>Balance insuficiente</Text>
                <Text style={styles.balanceWarningText}>
                  Necesitas al menos {formatEuro(MIN_BALANCE_REQUIRED)} para crear una tanda.
                  Tu balance: {eurcBalanceFormatted}
                </Text>
                <TouchableOpacity
                  style={styles.balanceWarningButton}
                  onPress={() => navigation.navigate('Deposit')}
                >
                  <Text style={styles.balanceWarningButtonText}>Depositar fondos</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          <Button
            title="Crear tanda"
            onPress={handleCreate}
            size="large"
            loading={isLoading}
            disabled={!amount || !participants || eurcBalance < MIN_BALANCE_REQUIRED}
          />
          <Button
            title="Cancelar"
            onPress={() => navigation.goBack()}
            variant="secondary"
            size="large"
          />
        </View>
      </KeyboardAvoidingView>
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
  form: {
    marginBottom: 24,
  },
  orderCard: {
    padding: 16,
    marginBottom: 16,
  },
  orderTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 4,
  },
  orderSubtitle: {
    fontSize: 12,
    color: '#94a3b8',
    marginBottom: 16,
  },
  timeline: {
    paddingLeft: 8,
  },
  timelineItem: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  timelineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#e2e8f0',
    marginRight: 12,
    marginTop: 4,
  },
  timelineDotFirst: {
    backgroundColor: '#3b82f6',
  },
  timelineLine: {
    position: 'absolute',
    left: 5,
    top: 16,
    width: 2,
    height: 50,
    backgroundColor: '#e2e8f0',
  },
  timelineContent: {
    flex: 1,
    paddingBottom: 16,
  },
  timelineCycle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 4,
  },
  timelineAction: {
    fontSize: 13,
    color: '#ef4444',
    marginBottom: 2,
  },
  timelineBeneficiary: {
    fontSize: 13,
    color: '#22c55e',
    fontWeight: '500',
  },
  moreText: {
    fontSize: 13,
    color: '#94a3b8',
    fontStyle: 'italic',
    marginLeft: 24,
  },
  infoCard: {
    padding: 16,
    backgroundColor: '#f8fafc',
    marginBottom: 16,
  },
  infoTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 12,
  },
  infoItem: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  infoBullet: {
    fontSize: 14,
    color: '#3b82f6',
    marginRight: 8,
    fontWeight: '600',
    width: 20,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: '#64748b',
    lineHeight: 20,
  },
  summaryCard: {
    padding: 20,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  summaryLabel: {
    fontSize: 14,
    color: '#64748b',
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e293b',
  },
  summaryValueHighlight: {
    fontSize: 16,
    fontWeight: '700',
    color: '#22c55e',
  },
  buttons: {
    padding: 20,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  balanceWarning: {
    flexDirection: 'row',
    backgroundColor: '#fef3c7',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#fcd34d',
  },
  balanceWarningIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  balanceWarningContent: {
    flex: 1,
  },
  balanceWarningTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#92400e',
    marginBottom: 4,
  },
  balanceWarningText: {
    fontSize: 13,
    color: '#a16207',
    lineHeight: 18,
    marginBottom: 12,
  },
  balanceWarningButton: {
    backgroundColor: '#f59e0b',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  balanceWarningButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  commissionInfo: {
    flexDirection: 'row',
    backgroundColor: '#f0f9ff',
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#bae6fd',
  },
  commissionIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  commissionTextContainer: {
    flex: 1,
  },
  commissionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0369a1',
    marginBottom: 4,
  },
  commissionText: {
    fontSize: 13,
    color: '#0c4a6e',
    lineHeight: 20,
  },
});

import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Share,
  Platform,
  Modal,
  TouchableOpacity,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { Button, Card } from '../../components';
import { useTandaStore } from '../../stores/tandaStore';
import { useUserStore } from '../../stores/userStore';
import { useAuthStore } from '../../stores/authStore';
import { stellarService } from '../../services/stellar';
import { Tanda, TandaParticipant, FailedDeposit, DEPOSIT_RETRY_CONFIG } from '../../types';
import { formatEuro, TANDA_CONFIG } from '../../config/network';
import { depositRetryService } from '../../services/depositRetry';
import { showAlert, alertMessage } from '../../utils/alert';
import { QRCodeDisplay } from '../../components/QRCodeDisplay';
import { colors } from '../../theme';
import { anchorService } from '../../services/anchor';

// Types for payment schedule
interface PaymentScheduleItem {
  cycle: number;
  dueDate: number;
  beneficiary: string;
  status: 'upcoming' | 'pending' | 'completed';
}

interface NextPaymentInfo {
  cycle: number;
  dueDate: number;
  amount: number;
  beneficiary: string;
  daysRemaining: number;
  isOverdue: boolean;
}

interface TandaDetailScreenProps {
  route: { params: { tandaId: string } };
  navigation: any;
}

export const TandaDetailScreen: React.FC<TandaDetailScreenProps> = ({
  route,
  navigation,
}) => {
  const { tandaId } = route.params;
  const [tanda, setTanda] = useState<Tanda | null>(null);
  const [isDepositing, setIsDepositing] = useState(false);
  const [isAdvancing, setIsAdvancing] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [failedDeposit, setFailedDeposit] = useState<FailedDeposit | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);
  const [paymentSchedule, setPaymentSchedule] = useState<PaymentScheduleItem[]>([]);
  const [nextPayment, setNextPayment] = useState<NextPaymentInfo | null>(null);
  const [isLoadingSchedule, setIsLoadingSchedule] = useState(false);
  const [participantNames, setParticipantNames] = useState<Record<string, string | null>>({});

  const { getTandaById, deposit, advance, leaveTanda, refreshTanda, retryFailedDeposit, getFailedDepositInfo, getPaymentSchedule, getNextPayment } = useTandaStore();
  const { user, eurcBalance } = useUserStore();
  const { publicKey: authPublicKey } = useAuthStore();
  const myPublicKey = stellarService.isInitialized() ? stellarService.getPublicKey() : (authPublicKey || '');

  // Load payment schedule from Anchor
  const loadPaymentSchedule = useCallback(async () => {
    if (!tandaId) return;

    setIsLoadingSchedule(true);
    try {
      const schedule = await getPaymentSchedule(tandaId);
      setPaymentSchedule(schedule);

      const next = await getNextPayment(tandaId);
      setNextPayment(next);
    } catch (error) {
      console.error('[TandaDetail] Error loading payment schedule:', error);
    } finally {
      setIsLoadingSchedule(false);
    }
  }, [tandaId, getPaymentSchedule, getNextPayment]);

  useEffect(() => {
    loadTanda();
    loadPaymentSchedule();
    const interval = setInterval(() => {
      refreshTanda(tandaId);
      loadTanda();
      loadPaymentSchedule();
    }, 60000); // Actualizar cada minuto

    return () => clearInterval(interval);
  }, [tandaId, loadPaymentSchedule]);

  // Load participant names from backend when tanda data changes
  useEffect(() => {
    const loadParticipantNames = async () => {
      if (!tanda || !tanda.participants || tanda.participants.length === 0) {
        console.log('[TandaDetail] No tanda or no participants, tanda:', !!tanda);
        return;
      }

      const publicKeys = tanda.participants.map(p => p.publicKey);
      console.log('[TandaDetail] Loading names for:', publicKeys);
      try {
        const response = await anchorService.getUsersBatch(publicKeys);
        console.log('[TandaDetail] Batch response:', JSON.stringify(response));
        if (response.success && response.users) {
          const names: Record<string, string | null> = {};
          for (const pk of publicKeys) {
            names[pk] = response.users[pk]?.displayName || null;
          }
          console.log('[TandaDetail] Setting participant names:', JSON.stringify(names));
          setParticipantNames(names);
        }
      } catch (error) {
        console.error('[TandaDetail] Error loading participant names:', error);
      }
    };

    loadParticipantNames();
  }, [tanda]);

  const loadTanda = () => {
    const tandaData = getTandaById(tandaId);
    if (tandaData) {
      setTanda(tandaData);
      // Check for failed deposits
      const failed = getFailedDepositInfo(tandaId);
      setFailedDeposit(failed || null);
    }
  };

  const handleDeposit = async () => {
    if (!tanda) return;

    const commission = TANDA_CONFIG.calculateDepositCommission(tanda.amount);
    const total = tanda.amount + commission;

    showAlert(
      'Confirmar depósito',
      `Depósito: ${formatEuro(tanda.amount)}\nComisión (${TANDA_CONFIG.depositCommissionPercent}%): ${formatEuro(commission)}\n\nTotal a transferir: ${formatEuro(total)}`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: `Pagar ${formatEuro(total)}`,
          onPress: async () => {
            setIsDepositing(true);
            try {
              await deposit(tandaId);
              alertMessage('¡Listo!', 'Tu depósito fue registrado.');
              loadTanda();
            } catch (error: any) {
              alertMessage('Error', error.message || 'No se pudo realizar el depósito');
              loadTanda(); // Reload to check for failed deposit status
            } finally {
              setIsDepositing(false);
            }
          },
        },
      ]
    );
  };

  const handleRetryDeposit = async () => {
    if (!tanda || !failedDeposit) return;

    const commission = TANDA_CONFIG.calculateDepositCommission(tanda.amount);
    const total = tanda.amount + commission;

    // Check if user has enough balance now (including commission)
    if (eurcBalance < total) {
      alertMessage(
        'Fondos insuficientes',
        `Necesitas ${formatEuro(total)} (${formatEuro(tanda.amount)} + ${formatEuro(commission)} comisión) para completar el depósito. Tu balance actual es ${formatEuro(eurcBalance)}.`
      );
      return;
    }

    setIsRetrying(true);
    try {
      const success = await retryFailedDeposit(tandaId);
      if (success) {
        alertMessage('¡Exito!', 'Tu deposito fue completado correctamente.');
        setFailedDeposit(null);
      } else {
        alertMessage('Error', 'No se pudo completar el deposito. Intenta de nuevo.');
      }
      loadTanda();
    } catch (error: any) {
      alertMessage('Error', error.message || 'Error al reintentar el deposito');
    } finally {
      setIsRetrying(false);
    }
  };

  // Calculate days remaining for failed deposit
  const getFailedDepositDetails = () => {
    if (!failedDeposit) return null;

    const now = Date.now();
    const maxRetryTime = failedDeposit.firstFailedAt + (6 * 24 * 60 * 60 * 1000); // 6 days
    const msRemaining = maxRetryTime - now;
    const daysRemaining = Math.max(0, Math.ceil(msRemaining / (24 * 60 * 60 * 1000)));
    const hoursRemaining = Math.max(0, Math.ceil(msRemaining / (60 * 60 * 1000)));
    const commission = TANDA_CONFIG.calculateDepositCommission(tanda?.amount || 0);
    const totalRequired = (tanda?.amount || 0) + commission;
    const hasEnoughBalance = eurcBalance >= totalRequired;

    return {
      daysRemaining,
      hoursRemaining,
      attemptCount: failedDeposit.attemptCount,
      maxAttempts: DEPOSIT_RETRY_CONFIG.maxAttempts,
      hasEnoughBalance,
      amount: tanda?.amount || 0,
      commission,
      totalRequired,
    };
  };

  const failedDepositDetails = getFailedDepositDetails();

  const handleAdvance = async () => {
    if (!tanda) return;

    const allDeposited = tanda.participants.every(p => p.hasDeposited);
    const beneficiaryAmount = formatEuro(tanda.amount * tanda.participants.length);
    const beneficiary = tanda.participants[tanda.beneficiaryIndex];

    const title = allDeposited ? 'Confirmar pago' : 'Confirmar expulsión';
    const message = allDeposited
      ? `Se pagará ${beneficiaryAmount} al beneficiario de este ciclo.\n\n✅ Avanzar es GRATIS`
      : `Se expulsarán los participantes que no han depositado en 6+ días.\n\n✅ Avanzar es GRATIS`;

    showAlert(
      title,
      message,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          onPress: async () => {
            setIsAdvancing(true);
            try {
              await advance(tandaId);
              if (allDeposited) {
                alertMessage('¡Listo!', `Se ha pagado al beneficiario del ciclo.`);
              } else {
                alertMessage('¡Listo!', 'Se han expulsado los morosos.');
              }
              loadTanda();
            } catch (error: any) {
              alertMessage('Error', error.message || 'No se pudo avanzar la tanda');
            } finally {
              setIsAdvancing(false);
            }
          },
        },
      ]
    );
  };

  const handleShare = () => {
    setShowShareModal(true);
  };

  const handleCopyCode = () => {
    if (!tanda) return;

    if (Platform.OS === 'web' && navigator.clipboard) {
      navigator.clipboard.writeText(tanda.id);
      alertMessage('Copiado', 'El código se ha copiado al portapapeles');
    } else {
      // En native se podría usar Clipboard de react-native
      alertMessage('Código', `Tu código es: ${tanda.id}`);
    }
  };

  const handleShareExternal = async () => {
    if (!tanda) return;

    const message = `¡Únete a mi tanda "${tanda.name}"!\n\nCódigo: ${tanda.id}\n\nMonto: ${formatEuro(tanda.amount)} por ciclo\nParticipantes: ${tanda.participants.length}/${tanda.maxParticipants}`;

    if (Platform.OS === 'web') {
      if (navigator.share) {
        try {
          await navigator.share({ text: message });
        } catch {
          // Usuario canceló o no soportado
          handleCopyCode();
        }
      } else {
        handleCopyCode();
      }
    } else {
      try {
        await Share.share({ message });
      } catch (error) {
        console.error('Error sharing:', error);
      }
    }
  };

  const handleLeave = () => {
    if (!tanda) return;

    showAlert(
      'Salir de la tanda',
      '¿Estás seguro que quieres salir? Solo puedes salir si la tanda aún está en espera.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Salir',
          style: 'destructive',
          onPress: async () => {
            try {
              await leaveTanda(tandaId);
              navigation.goBack();
            } catch (error: any) {
              alertMessage('Error', error.message);
            }
          },
        },
      ]
    );
  };

  if (!tanda) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContent}>
          <Text style={styles.loadingText}>Cargando...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const myParticipant = tanda.participants.find(p => p.publicKey === myPublicKey);
  const isBeneficiary = tanda.participants[tanda.beneficiaryIndex]?.publicKey === myPublicKey;
  // In new model: can deposit anytime if not already deposited this cycle
  const canDeposit = tanda.status === 'active' && myParticipant && !myParticipant.hasDeposited;
  // Check if all participants have deposited (can trigger payout)
  const allDeposited = tanda.participants.every(p => p.hasDeposited);
  // Check if there are delinquents (6+ days without depositing since last payout)
  const DELINQUENCY_MS = 6 * 24 * 60 * 60 * 1000; // 6 days in milliseconds
  const lastPayoutTime = tanda.lastPayoutAt || tanda.createdAt;
  const hasDelinquents = tanda.status === 'active' &&
    (Date.now() - lastPayoutTime > DELINQUENCY_MS) &&
    tanda.participants.some(p => !p.hasDeposited);
  // Can advance if all deposited OR if there are delinquents to expel
  const canAdvance = tanda.status === 'active' && (allDeposited || hasDelinquents);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>{tanda.name}</Text>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(tanda.status) + '20' }]}>
            <Text style={[styles.statusText, { color: getStatusColor(tanda.status) }]}>
              {getStatusLabel(tanda.status)}
            </Text>
          </View>
        </View>

        {/* Cycle Status */}
        {tanda.status === 'active' && (
          <Card variant="elevated" style={styles.phaseCard}>
            <View style={styles.phaseHeader}>
              <Text style={styles.phaseEmoji}>
                {allDeposited ? '✅' : hasDelinquents ? '⚠️' : '💰'}
              </Text>
              <View>
                <Text style={styles.phaseTitle}>
                  Ciclo {tanda.currentCycle + 1} de {tanda.totalCycles}
                </Text>
                <Text style={styles.phaseTime}>
                  {allDeposited
                    ? 'Todos han depositado - listo para pagar'
                    : hasDelinquents
                      ? `Hay morosos (6+ días sin pagar)`
                      : `${tanda.participants.filter(p => p.hasDeposited).length}/${tanda.participants.length} han depositado`
                  }
                </Text>
              </View>
            </View>

            {canDeposit && (
              <Button
                title={`Depositar ${formatEuro(tanda.amount)}`}
                onPress={handleDeposit}
                loading={isDepositing}
                style={{ marginTop: 16 }}
              />
            )}

            {canAdvance && (
              <Button
                title={allDeposited ? 'Avanzar (pagar al beneficiario)' : 'Avanzar (expulsar morosos)'}
                onPress={handleAdvance}
                loading={isAdvancing}
                variant={allDeposited ? 'primary' : 'danger'}
                style={{ marginTop: 16 }}
              />
            )}

            {myParticipant?.hasDeposited && !allDeposited && !hasDelinquents && (
              <View style={styles.completedBadge}>
                <Text style={styles.completedText}>✓ Ya depositaste este ciclo</Text>
              </View>
            )}
          </Card>
        )}

        {/* Payment Calendar - Manual Payments */}
        {tanda.status === 'active' && (
          <Card variant="elevated" style={styles.calendarCard}>
            <View style={styles.calendarHeader}>
              <Text style={styles.calendarTitle}>📅 Calendario de pagos</Text>
              {isLoadingSchedule && (
                <ActivityIndicator size="small" color={colors.primary} />
              )}
            </View>

            {/* Next Payment Due */}
            {nextPayment && !myParticipant?.hasDeposited && (
              <View style={[
                styles.nextPaymentBox,
                nextPayment.isOverdue && styles.nextPaymentBoxOverdue
              ]}>
                <View style={styles.nextPaymentHeader}>
                  <Text style={styles.nextPaymentLabel}>
                    {nextPayment.isOverdue ? '⚠️ Pago vencido' : 'Proximo pago'}
                  </Text>
                  <Text style={[
                    styles.nextPaymentDays,
                    nextPayment.isOverdue && styles.nextPaymentDaysOverdue
                  ]}>
                    {nextPayment.isOverdue
                      ? 'Vence hoy'
                      : nextPayment.daysRemaining === 0
                        ? 'Vence hoy'
                        : nextPayment.daysRemaining === 1
                          ? 'Vence mañana'
                          : `${nextPayment.daysRemaining} días restantes`
                    }
                  </Text>
                </View>

                <View style={styles.nextPaymentDetails}>
                  <View style={styles.nextPaymentAmountRow}>
                    <Text style={styles.nextPaymentAmountLabel}>Monto</Text>
                    <Text style={styles.nextPaymentAmount}>{formatEuro(nextPayment.amount)}</Text>
                  </View>
                  <View style={styles.nextPaymentDateRow}>
                    <Text style={styles.nextPaymentDateLabel}>Fecha limite</Text>
                    <Text style={styles.nextPaymentDate}>
                      {new Date(nextPayment.dueDate).toLocaleDateString('es-ES', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric'
                      })}
                    </Text>
                  </View>
                  <View style={styles.nextPaymentBeneficiaryRow}>
                    <Text style={styles.nextPaymentBeneficiaryLabel}>Beneficiario</Text>
                    <Text style={styles.nextPaymentBeneficiary}>
                      {shortenKey(nextPayment.beneficiary)}
                    </Text>
                  </View>
                </View>

                {/* Pay Now Button */}
                <TouchableOpacity
                  style={[
                    styles.payNowButton,
                    isDepositing && styles.payNowButtonDisabled
                  ]}
                  onPress={handleDeposit}
                  disabled={isDepositing}
                >
                  {isDepositing ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.payNowButtonText}>
                      Pagar {formatEuro(nextPayment.amount + TANDA_CONFIG.calculateDepositCommission(nextPayment.amount))}
                    </Text>
                  )}
                </TouchableOpacity>
                <Text style={styles.commissionNote}>
                  Incluye {TANDA_CONFIG.depositCommissionPercent}% de comisión
                </Text>
              </View>
            )}

            {myParticipant?.hasDeposited && (
              <View style={styles.paymentCompletedBox}>
                <Text style={styles.paymentCompletedIcon}>✓</Text>
                <Text style={styles.paymentCompletedText}>
                  Ya realizaste tu pago de este ciclo
                </Text>
              </View>
            )}

            {/* Payment Schedule List */}
            {paymentSchedule.length > 0 && (
              <View style={styles.scheduleList}>
                <Text style={styles.scheduleListTitle}>Proximos pagos</Text>
                {paymentSchedule.slice(0, 5).map((item, index) => (
                  <View key={item.cycle} style={styles.scheduleItem}>
                    <View style={styles.scheduleItemLeft}>
                      <View style={[
                        styles.scheduleItemDot,
                        item.status === 'completed' && styles.scheduleItemDotCompleted,
                        item.status === 'pending' && styles.scheduleItemDotPending
                      ]} />
                      <View>
                        <Text style={styles.scheduleItemCycle}>Ciclo {item.cycle + 1}</Text>
                        <Text style={styles.scheduleItemDate}>
                          {new Date(item.dueDate).toLocaleDateString('es-ES', {
                            day: 'numeric',
                            month: 'short'
                          })}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.scheduleItemRight}>
                      <Text style={[
                        styles.scheduleItemStatus,
                        item.status === 'completed' && styles.scheduleItemStatusCompleted,
                        item.status === 'pending' && styles.scheduleItemStatusPending
                      ]}>
                        {item.status === 'completed' ? '✓ Pagado' : item.status === 'pending' ? 'Pendiente' : 'Proximo'}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {!nextPayment && !myParticipant?.hasDeposited && !isLoadingSchedule && (
              <Text style={styles.noPaymentText}>
                No hay pagos pendientes en este momento
              </Text>
            )}
          </Card>
        )}

        {/* Failed Deposit Warning */}
        {failedDeposit && failedDepositDetails && (
          <Card variant="elevated" style={styles.failedDepositCard}>
            <View style={styles.failedDepositHeader}>
              <Text style={styles.failedDepositIcon}>⚠️</Text>
              <View style={styles.failedDepositHeaderText}>
                <Text style={styles.failedDepositTitle}>Deposito pendiente</Text>
                <Text style={styles.failedDepositSubtitle}>
                  Tu deposito fallo por fondos insuficientes
                </Text>
              </View>
            </View>

            <View style={styles.failedDepositInfo}>
              <View style={styles.failedDepositRow}>
                <Text style={styles.failedDepositLabel}>Monto requerido</Text>
                <Text style={styles.failedDepositValue}>{formatEuro(failedDepositDetails.amount)}</Text>
              </View>
              <View style={styles.failedDepositRow}>
                <Text style={styles.failedDepositLabel}>Tu balance actual</Text>
                <Text style={[
                  styles.failedDepositValue,
                  !failedDepositDetails.hasEnoughBalance && styles.failedDepositValueDanger
                ]}>
                  {formatEuro(eurcBalance)}
                </Text>
              </View>
              <View style={styles.failedDepositRow}>
                <Text style={styles.failedDepositLabel}>Intentos</Text>
                <Text style={styles.failedDepositValue}>
                  {failedDepositDetails.attemptCount}/{failedDepositDetails.maxAttempts}
                </Text>
              </View>
              <View style={styles.failedDepositRow}>
                <Text style={styles.failedDepositLabel}>Tiempo restante</Text>
                <Text style={[
                  styles.failedDepositValue,
                  failedDepositDetails.daysRemaining <= 1 && styles.failedDepositValueDanger
                ]}>
                  {failedDepositDetails.daysRemaining > 0
                    ? `${failedDepositDetails.daysRemaining} dias`
                    : `${failedDepositDetails.hoursRemaining} horas`
                  }
                </Text>
              </View>
            </View>

            {failedDepositDetails.hasEnoughBalance ? (
              <TouchableOpacity
                style={styles.retryButton}
                onPress={handleRetryDeposit}
                disabled={isRetrying}
              >
                <Text style={styles.retryButtonText}>
                  {isRetrying ? 'Reintentando...' : 'Reintentar deposito'}
                </Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.depositFundsButton}
                onPress={() => navigation.navigate('Deposit')}
              >
                <Text style={styles.depositFundsButtonText}>Depositar fondos</Text>
              </TouchableOpacity>
            )}

            <Text style={styles.failedDepositWarning}>
              Si no completas el deposito en {failedDepositDetails.daysRemaining} dias, seras expulsado de la tanda y tu puntuacion bajara 25 puntos.
            </Text>
          </Card>
        )}

        {/* Stats */}
        <Card variant="outlined" style={styles.statsCard}>
          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{formatEuro(tanda.amount, false)}</Text>
              <Text style={styles.statLabel}>€/ciclo</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>
                {tanda.participants.length}/{tanda.maxParticipants}
              </Text>
              <Text style={styles.statLabel}>Participantes</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>
                {tanda.currentCycle + 1}/{tanda.totalCycles}
              </Text>
              <Text style={styles.statLabel}>Ciclo</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{formatEuro(tanda.amount * tanda.participants.length)}</Text>
              <Text style={styles.statLabel}>Total/ciclo</Text>
            </View>
          </View>
        </Card>

        {/* Beneficiary Info */}
        {tanda.status === 'active' && (
          <Card variant="outlined" style={styles.beneficiaryCard}>
            <Text style={styles.beneficiaryTitle}>🎯 Beneficiario de este ciclo</Text>
            <View style={styles.beneficiaryInfo}>
              <Text style={styles.beneficiaryKey}>
                {shortenKey(tanda.participants[tanda.beneficiaryIndex]?.publicKey || '')}
              </Text>
              {isBeneficiary && (
                <View style={styles.youBadge}>
                  <Text style={styles.youBadgeText}>¡Eres tú!</Text>
                </View>
              )}
            </View>
            <Text style={styles.beneficiaryAmount}>
              Recibirá: {formatEuro(tanda.amount * tanda.participants.length * 0.95)}
            </Text>
          </Card>
        )}

        {/* Participants */}
        <View style={styles.participantsSection}>
          <Text style={styles.sectionTitle}>Participantes</Text>
          {tanda.participants.map((participant, index) => (
            <ParticipantRow
              key={participant.publicKey}
              participant={participant}
              index={index}
              isMe={participant.publicKey === myPublicKey}
              isBeneficiary={index === tanda.beneficiaryIndex}
              displayName={participantNames[participant.publicKey] || null}
            />
          ))}
        </View>
      </ScrollView>

      {/* Actions */}
      <View style={styles.actions}>
        <Button
          title="Compartir código"
          onPress={handleShare}
          variant="outline"
        />
        {tanda.status === 'waiting' && myParticipant && (
          <Button
            title="Salir de la tanda"
            onPress={handleLeave}
            variant="danger"
          />
        )}
      </View>

      {/* Share Modal */}
      <Modal
        visible={showShareModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowShareModal(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowShareModal(false)}
        >
          <Pressable style={styles.modalContent} onPress={e => e.stopPropagation()}>
            <Text style={styles.modalTitle}>Comparte tu tanda</Text>
            <Text style={styles.modalSubtitle}>{tanda.name}</Text>

            {/* QR Code */}
            <View style={styles.qrContainer}>
              <QRCodeDisplay
                value={`tanda://${tanda.id}`}
                size={180}
              />
            </View>

            {/* Code Display */}
            <View style={styles.codeContainer}>
              <Text style={styles.codeLabel}>Código de la tanda</Text>
              <Text style={styles.codeValue} selectable>{tanda.id}</Text>
            </View>

            {/* Info */}
            <View style={styles.modalInfo}>
              <Text style={styles.modalInfoText}>
                {formatEuro(tanda.amount)}/ciclo • {tanda.participants.length}/{tanda.maxParticipants} participantes
              </Text>
            </View>

            {/* Buttons */}
            <View style={styles.modalButtons}>
              <Button
                title="Copiar código"
                onPress={handleCopyCode}
                variant="outline"
                size="small"
              />
              <Button
                title="Compartir"
                onPress={handleShareExternal}
                size="small"
              />
            </View>

            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setShowShareModal(false)}
            >
              <Text style={styles.closeButtonText}>Cerrar</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
};

const ParticipantRow: React.FC<{
  participant: TandaParticipant;
  index: number;
  isMe: boolean;
  isBeneficiary: boolean;
  displayName: string | null;
}> = ({ participant, index, isMe, isBeneficiary, displayName }) => (
  <View style={[styles.participantRow, isMe && styles.participantRowMe]}>
    <View style={styles.participantLeft}>
      <Text style={styles.participantIndex}>#{index + 1}</Text>
      <View>
        <View style={styles.participantNameRow}>
          <Text style={styles.participantName}>
            {displayName || shortenKey(participant.publicKey)}
          </Text>
          {isMe && <Text style={styles.meBadge}>Tú</Text>}
          {isBeneficiary && <Text style={styles.beneficiaryBadge}>🎯</Text>}
        </View>
        {displayName && (
          <Text style={styles.participantKey}>
            {shortenKey(participant.publicKey)}
          </Text>
        )}
        <Text style={styles.participantScore}>
          Puntuación: {participant.score}
        </Text>
      </View>
    </View>
    <View style={styles.participantStatus}>
      <Text style={participant.hasDeposited ? styles.statusDone : styles.statusPending}>
        {participant.hasDeposited ? '✓' : '○'}
      </Text>
    </View>
  </View>
);

const getStatusColor = (status: string) => {
  switch (status) {
    case 'active': return '#22c55e';
    case 'waiting': return '#f59e0b';
    case 'completed': return '#3b82f6';
    default: return '#94a3b8';
  }
};

const getStatusLabel = (status: string) => {
  switch (status) {
    case 'active': return 'Activa';
    case 'waiting': return 'Esperando participantes';
    case 'completed': return 'Completada';
    default: return status;
  }
};

const shortenKey = (key: string) => {
  if (key.length <= 16) return key;
  return `${key.slice(0, 8)}...${key.slice(-6)}`;
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#64748b',
  },
  scrollContent: {
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1e293b',
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 13,
    fontWeight: '600',
  },
  phaseCard: {
    marginBottom: 16,
    padding: 20,
  },
  phaseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  phaseEmoji: {
    fontSize: 40,
    marginRight: 16,
  },
  phaseTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1e293b',
  },
  phaseTime: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 2,
  },
  completedBadge: {
    marginTop: 16,
    backgroundColor: '#f0fdf4',
    padding: 12,
    borderRadius: 8,
  },
  completedText: {
    color: '#22c55e',
    fontWeight: '600',
    textAlign: 'center',
  },
  statsCard: {
    marginBottom: 16,
    padding: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  statItem: {
    width: '50%',
    alignItems: 'center',
    paddingVertical: 8,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1e293b',
  },
  statLabel: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 4,
  },
  beneficiaryCard: {
    marginBottom: 16,
    padding: 16,
    backgroundColor: '#fef3c7',
    borderColor: '#f59e0b',
  },
  beneficiaryTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#92400e',
    marginBottom: 8,
  },
  beneficiaryInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  beneficiaryKey: {
    fontSize: 14,
    color: '#78350f',
    fontFamily: 'monospace',
  },
  youBadge: {
    marginLeft: 8,
    backgroundColor: '#22c55e',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  youBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  beneficiaryAmount: {
    fontSize: 14,
    color: '#92400e',
  },
  participantsSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 12,
  },
  participantRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  participantRowMe: {
    borderColor: '#3b82f6',
    backgroundColor: '#eff6ff',
  },
  participantLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  participantIndex: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94a3b8',
    marginRight: 12,
    width: 24,
  },
  participantNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  participantName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1e293b',
  },
  participantKey: {
    fontSize: 12,
    color: '#64748b',
    fontFamily: 'monospace',
  },
  meBadge: {
    marginLeft: 8,
    fontSize: 12,
    color: '#3b82f6',
    fontWeight: '600',
  },
  beneficiaryBadge: {
    marginLeft: 4,
    fontSize: 14,
  },
  participantScore: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  participantStatus: {},
  statusDone: {
    color: '#22c55e',
    fontSize: 18,
    fontWeight: '700',
  },
  statusPending: {
    color: '#cbd5e1',
    fontSize: 18,
  },
  actions: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    backgroundColor: '#fff',
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
    maxWidth: 360,
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: 16,
    color: '#64748b',
    marginBottom: 20,
  },
  qrContainer: {
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 20,
  },
  codeContainer: {
    width: '100%',
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  codeLabel: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 4,
  },
  codeValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1e293b',
    fontFamily: 'monospace',
    letterSpacing: 1,
  },
  modalInfo: {
    marginBottom: 20,
  },
  modalInfoText: {
    fontSize: 14,
    color: '#64748b',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  closeButton: {
    marginTop: 16,
    padding: 8,
  },
  closeButtonText: {
    fontSize: 14,
    color: '#64748b',
  },
  // Failed deposit styles
  failedDepositCard: {
    marginBottom: 16,
    padding: 20,
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  failedDepositHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  failedDepositIcon: {
    fontSize: 32,
    marginRight: 12,
  },
  failedDepositHeaderText: {
    flex: 1,
  },
  failedDepositTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#991b1b',
    marginBottom: 4,
  },
  failedDepositSubtitle: {
    fontSize: 14,
    color: '#dc2626',
  },
  failedDepositInfo: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  failedDepositRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  failedDepositLabel: {
    fontSize: 14,
    color: '#64748b',
  },
  failedDepositValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e293b',
  },
  failedDepositValueDanger: {
    color: '#dc2626',
  },
  retryButton: {
    backgroundColor: '#22c55e',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  depositFundsButton: {
    backgroundColor: '#f59e0b',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  depositFundsButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  failedDepositWarning: {
    fontSize: 12,
    color: '#991b1b',
    textAlign: 'center',
    lineHeight: 18,
  },
  // Payment Calendar styles
  calendarCard: {
    marginBottom: 16,
    padding: 20,
  },
  calendarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  calendarTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1e293b',
  },
  nextPaymentBox: {
    backgroundColor: '#f0f9ff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#bae6fd',
    marginBottom: 16,
  },
  nextPaymentBoxOverdue: {
    backgroundColor: '#fef2f2',
    borderColor: '#fecaca',
  },
  nextPaymentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  nextPaymentLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0369a1',
  },
  nextPaymentDays: {
    fontSize: 13,
    color: '#0c4a6e',
    fontWeight: '500',
  },
  nextPaymentDaysOverdue: {
    color: '#dc2626',
  },
  nextPaymentDetails: {
    gap: 8,
    marginBottom: 16,
  },
  nextPaymentAmountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  nextPaymentAmountLabel: {
    fontSize: 14,
    color: '#64748b',
  },
  nextPaymentAmount: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1e293b',
  },
  nextPaymentDateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  nextPaymentDateLabel: {
    fontSize: 14,
    color: '#64748b',
  },
  nextPaymentDate: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1e293b',
  },
  nextPaymentBeneficiaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  nextPaymentBeneficiaryLabel: {
    fontSize: 14,
    color: '#64748b',
  },
  nextPaymentBeneficiary: {
    fontSize: 14,
    color: '#1e293b',
    fontFamily: 'monospace',
  },
  payNowButton: {
    backgroundColor: '#22c55e',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  payNowButtonDisabled: {
    opacity: 0.6,
  },
  payNowButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  paymentCompletedBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f0fdf4',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  paymentCompletedIcon: {
    fontSize: 20,
    color: '#22c55e',
    marginRight: 8,
  },
  paymentCompletedText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#22c55e',
  },
  scheduleList: {
    marginTop: 8,
  },
  scheduleListTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
    marginBottom: 12,
  },
  scheduleItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  scheduleItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  scheduleItemDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#94a3b8',
    marginRight: 12,
  },
  scheduleItemDotCompleted: {
    backgroundColor: '#22c55e',
  },
  scheduleItemDotPending: {
    backgroundColor: '#f59e0b',
  },
  scheduleItemCycle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1e293b',
  },
  scheduleItemDate: {
    fontSize: 12,
    color: '#64748b',
  },
  scheduleItemRight: {},
  scheduleItemStatus: {
    fontSize: 12,
    color: '#64748b',
  },
  scheduleItemStatusCompleted: {
    color: '#22c55e',
    fontWeight: '600',
  },
  scheduleItemStatusPending: {
    color: '#f59e0b',
    fontWeight: '600',
  },
  noPaymentText: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    paddingVertical: 20,
  },
  commissionNote: {
    fontSize: 12,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 8,
  },
});

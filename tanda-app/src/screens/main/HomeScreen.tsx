import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Pressable,
  StatusBar,
  Platform,
  Modal,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Card, Button } from '../../components';
import { useUserStore, SCORE_CONFIG } from '../../stores/userStore';
// Note: KYC is handled by Mykobo during deposit flow, no separate KYC UI needed
import { useTandaStore } from '../../stores/tandaStore';
import { useAuthStore } from '../../stores/authStore';
import { anchorService } from '../../services/anchor';
import { Tanda } from '../../types';
import { colors, spacing, borderRadius, typography, shadows } from '../../theme';
import { formatEuro } from '../../config/network';

interface HomeScreenProps {
  navigation: any;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({ navigation }) => {
  const { user, eurcBalanceFormatted, fetchBalance, loadUser } = useUserStore();
  const { activeTandas, loadTandas, isLoading } = useTandaStore();
  const { isAuthenticated, publicKey } = useAuthStore();
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  const [showScoreInfo, setShowScoreInfo] = useState(false);

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
        console.error('[Home] Error loading display name:', error);
      }
    };
    loadDisplayName();
  }, [publicKey]);

  useEffect(() => {
    const loadInitialData = async () => {
      console.log('🏠 [HomeScreen] Loading data...');
      console.log('🏠 [HomeScreen] publicKey:', publicKey);

      loadUser();
      await loadTandas();
      setInitialLoadComplete(true);

      // Solo obtener balance si hay wallet (publicKey existe)
      if (publicKey) {
        console.log('🏠 [HomeScreen] Wallet ready, fetching balance...');
        fetchBalance().then(() => {
          console.log('🏠 [HomeScreen] Balance fetched successfully');
        }).catch(err => {
          console.error('🏠 [HomeScreen] Balance error:', err);
        });
      } else {
        console.log('🏠 [HomeScreen] No wallet yet, skipping balance fetch');
      }
    };

    loadInitialData();
  }, [publicKey]);

  const onRefresh = async () => {
    console.log('🏠 [HomeScreen] Refreshing...');
    await Promise.all([loadUser(), loadTandas(), fetchBalance()]);
    console.log('🏠 [HomeScreen] Refresh complete');
  };

  // Score range: 0-100 (starts at 50, blocked below 25)
  const getScoreColor = (score: number) => {
    if (score < SCORE_CONFIG.BLOCK_THRESHOLD) return colors.error; // Bloqueado: rojo
    if (score >= 75) return colors.success;       // Excelente: verde
    if (score >= 50) return colors.primary[500];  // Buena: azul
    return colors.warning;                        // Mala: amarillo
  };

  const getScoreLabel = (score: number) => {
    if (score < SCORE_CONFIG.BLOCK_THRESHOLD) return 'Bloqueado';
    if (score >= 75) return 'Excelente';
    if (score >= 50) return 'Buena';
    return 'Mala';
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Header con gradiente */}
      <LinearGradient
        colors={[colors.primary[600], colors.primary[700]]}
        style={styles.headerGradient}
      >
        <SafeAreaView>
          <View style={styles.header}>
            <View style={styles.headerTop}>
              <View>
                <Text style={styles.greeting}>
                  {displayName ? `Hola, ${displayName.split(' ')[0]}` : 'Hola de nuevo'}
                </Text>
                <Text style={styles.balanceLabel}>Balance disponible</Text>
              </View>
              <TouchableOpacity
                style={styles.profileButton}
                onPress={() => navigation.navigate('Profile')}
              >
                <Text style={styles.profileInitial}>
                  {displayName ? displayName.charAt(0).toUpperCase() : (user?.publicKey?.slice(0, 1).toUpperCase() || 'T')}
                </Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.balance}>{eurcBalanceFormatted}</Text>

            {/* Deposit / Withdraw buttons */}
            <View style={styles.moneyActions}>
              <Pressable
                style={styles.depositBtn}
                onPress={() => {
                  console.log('DEPOSIT CLICK');
                  navigation.navigate('Deposit');
                }}
              >
                <Text style={styles.moneyBtnIcon}>💶</Text>
                <Text style={styles.moneyBtnText}>Depositar</Text>
              </Pressable>
              <Pressable
                style={styles.withdrawBtn}
                onPress={() => {
                  console.log('WITHDRAW CLICK');
                  navigation.navigate('Withdraw');
                }}
              >
                <Text style={styles.moneyBtnIcon}>💸</Text>
                <Text style={styles.moneyBtnText}>Retirar</Text>
              </Pressable>
            </View>

            {/* Quick Actions en el header */}
            <View style={styles.quickActions}>
              <QuickActionButton
                icon="+"
                label="Crear"
                onPress={() => navigation.navigate('CreateTanda')}
              />
              <QuickActionButton
                icon="→"
                label="Unirse"
                onPress={() => navigation.navigate('JoinTanda')}
              />
            </View>
          </View>
        </SafeAreaView>
      </LinearGradient>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={onRefresh}
            tintColor={colors.primary[500]}
          />
        }
      >
        {/* Score Card */}
        {user && (
          <View style={styles.scoreCard}>
            <View style={styles.scoreHeader}>
              <View>
                <View style={styles.scoreTitleRow}>
                  <Text style={styles.scoreTitle}>Tu puntuación</Text>
                  <TouchableOpacity
                    style={styles.scoreInfoButton}
                    onPress={() => setShowScoreInfo(true)}
                  >
                    <Text style={styles.scoreInfoIcon}>ℹ️</Text>
                  </TouchableOpacity>
                </View>
                <Text style={styles.scoreSubtitle}>
                  {getScoreLabel(user.score)}
                </Text>
              </View>
              <View style={styles.scoreCircle}>
                <Text style={[styles.scoreValue, { color: getScoreColor(user.score) }]}>
                  {user.score}
                </Text>
                <Text style={styles.scoreMax}>/{SCORE_CONFIG.MAX}</Text>
              </View>
            </View>
            <View style={styles.scoreBarContainer}>
              <View style={styles.scoreBar}>
                <View
                  style={[
                    styles.scoreBarFill,
                    {
                      width: `${(user.score / SCORE_CONFIG.MAX) * 100}%`,
                      backgroundColor: getScoreColor(user.score),
                    },
                  ]}
                />
              </View>
              <Text style={styles.scoreHint}>
                Mayor puntuación = mejores tandas
              </Text>
            </View>
          </View>
        )}

        {/* Stats Row */}
        <View style={styles.statsRow}>
          <StatCard
            value={user?.totalTandas || 0}
            label="Tandas"
            icon="📊"
          />
          <StatCard
            value={user?.completedTandas || 0}
            label="Completadas"
            icon="✅"
          />
          <StatCard
            value={activeTandas.length}
            label="Activas"
            icon="🔥"
          />
        </View>

        {/* Active Tandas */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Tus tandas</Text>
            {activeTandas.length > 0 && (
              <TouchableOpacity>
                <Text style={styles.seeAll}>Ver todas</Text>
              </TouchableOpacity>
            )}
          </View>

          {!initialLoadComplete ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIconContainer}>
                <Text style={styles.emptyIcon}>⏳</Text>
              </View>
              <Text style={styles.emptyTitle}>Cargando tandas...</Text>
            </View>
          ) : activeTandas.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIconContainer}>
                <Text style={styles.emptyIcon}>🤝</Text>
              </View>
              <Text style={styles.emptyTitle}>Sin tandas activas</Text>
              <Text style={styles.emptyText}>
                Crea o únete a una tanda para empezar a ahorrar con tu comunidad
              </Text>
              <Button
                title="Crear mi primera tanda"
                onPress={() => navigation.navigate('CreateTanda')}
                style={styles.emptyButton}
              />
            </View>
          ) : (
            <View style={styles.tandaList}>
              {activeTandas.map((tanda) => (
                <TandaCard
                  key={tanda.id}
                  tanda={tanda}
                  onPress={() =>
                    navigation.navigate('TandaDetail', { tandaId: tanda.id })
                  }
                />
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Score Info Modal */}
      <Modal
        visible={showScoreInfo}
        transparent
        animationType="fade"
        onRequestClose={() => setShowScoreInfo(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowScoreInfo(false)}
        >
          <Pressable style={styles.modalContent} onPress={e => e.stopPropagation()}>
            <Text style={styles.modalTitle}>¿Cómo funciona?</Text>

            <View style={styles.scoreRulesList}>
              <View style={styles.scoreRuleItem}>
                <Text style={styles.scoreRulePoints}>+5</Text>
                <Text style={styles.scoreRuleText}>Depositar en una tanda</Text>
              </View>
              <View style={styles.scoreRuleItem}>
                <Text style={styles.scoreRulePoints}>+20</Text>
                <Text style={styles.scoreRuleText}>Completar toda la tanda</Text>
              </View>
              <View style={styles.scoreRuleItem}>
                <Text style={styles.scoreRulePoints}>+5</Text>
                <Text style={styles.scoreRuleText}>Crear una tanda</Text>
              </View>
              <View style={[styles.scoreRuleItem, styles.scoreRuleNegative]}>
                <Text style={[styles.scoreRulePoints, styles.scoreRulePointsNegative]}>-25</Text>
                <Text style={styles.scoreRuleText}>Ser expulsado (6 días sin pagar)</Text>
              </View>
            </View>

            <View style={styles.scoreLevels}>
              <Text style={styles.scoreLevelsTitle}>Niveles</Text>
              <View style={styles.scoreLevelItem}>
                <View style={[styles.scoreLevelDot, { backgroundColor: colors.success }]} />
                <Text style={styles.scoreLevelText}>75-100: Excelente</Text>
              </View>
              <View style={styles.scoreLevelItem}>
                <View style={[styles.scoreLevelDot, { backgroundColor: colors.primary[500] }]} />
                <Text style={styles.scoreLevelText}>50-74: Buena (inicio)</Text>
              </View>
              <View style={styles.scoreLevelItem}>
                <View style={[styles.scoreLevelDot, { backgroundColor: colors.warning }]} />
                <Text style={styles.scoreLevelText}>25-49: Mala</Text>
              </View>
              <View style={styles.scoreLevelItem}>
                <View style={[styles.scoreLevelDot, { backgroundColor: colors.error }]} />
                <Text style={styles.scoreLevelText}>0-24: Bloqueado</Text>
              </View>
            </View>

            <View style={styles.scoreBlockedNote}>
              <Text style={styles.scoreBlockedNoteText}>
                Los usuarios con menos de 25 puntos no pueden participar en tandas.
              </Text>
            </View>

            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setShowScoreInfo(false)}
            >
              <Text style={styles.modalCloseButtonText}>Entendido</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
};

const QuickActionButton: React.FC<{
  icon: string;
  label: string;
  onPress: () => void;
}> = ({ icon, label, onPress }) => (
  <TouchableOpacity style={styles.quickAction} onPress={onPress} activeOpacity={0.8}>
    <View style={styles.quickActionIcon}>
      <Text style={styles.quickActionIconText}>{icon}</Text>
    </View>
    <Text style={styles.quickActionLabel}>{label}</Text>
  </TouchableOpacity>
);

const StatCard: React.FC<{
  value: number;
  label: string;
  icon: string;
}> = ({ value, label, icon }) => (
  <View style={styles.statCard}>
    <Text style={styles.statIcon}>{icon}</Text>
    <Text style={styles.statValue}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);

const TandaCard: React.FC<{ tanda: Tanda; onPress: () => void }> = ({
  tanda,
  onPress,
}) => {
  const getStatusColor = () => {
    switch (tanda.status) {
      case 'active':
        return colors.success;
      case 'waiting':
        return colors.warning;
      default:
        return colors.gray[400];
    }
  };

  const getStatusLabel = () => {
    switch (tanda.status) {
      case 'active':
        return 'Activa';
      case 'waiting':
        return 'Esperando';
      case 'completed':
        return 'Completada';
      default:
        return tanda.status;
    }
  };

  const progress = (tanda.currentCycle / tanda.totalCycles) * 100;

  return (
    <TouchableOpacity style={styles.tandaCard} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.tandaHeader}>
        <View style={styles.tandaNameRow}>
          <View style={[styles.tandaAvatar, { backgroundColor: colors.primary[100] }]}>
            <Text style={styles.tandaAvatarText}>
              {tanda.name.slice(0, 1).toUpperCase()}
            </Text>
          </View>
          <View>
            <Text style={styles.tandaName}>{tanda.name}</Text>
            <Text style={styles.tandaAmount}>{formatEuro(tanda.amount)} / ciclo</Text>
          </View>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor() + '15' }]}>
          <View style={[styles.statusDot, { backgroundColor: getStatusColor() }]} />
          <Text style={[styles.statusText, { color: getStatusColor() }]}>
            {getStatusLabel()}
          </Text>
        </View>
      </View>

      <View style={styles.tandaProgress}>
        <View style={styles.progressInfo}>
          <Text style={styles.progressLabel}>Progreso</Text>
          <Text style={styles.progressValue}>
            Ciclo {tanda.currentCycle + 1} de {tanda.totalCycles}
          </Text>
        </View>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${Math.max(progress, 5)}%` }]} />
        </View>
      </View>

      <View style={styles.tandaFooter}>
        <View style={styles.tandaFooterItem}>
          <Text style={styles.footerIcon}>👥</Text>
          <Text style={styles.footerValue}>
            {tanda.participants.length}/{tanda.maxParticipants}
          </Text>
        </View>
        <View style={styles.tandaFooterItem}>
          <Text style={styles.footerIcon}>💰</Text>
          <Text style={styles.footerValue}>
            {tanda.participants.filter(p => p.hasDeposited).length}/{tanda.participants.length}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.secondary,
  },
  headerGradient: {
    paddingBottom: spacing.xl,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  greeting: {
    ...typography.body,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 2,
  },
  balanceLabel: {
    ...typography.small,
    color: 'rgba(255,255,255,0.6)',
  },
  balance: {
    ...typography.display,
    color: colors.text.inverse,
    marginBottom: spacing.lg,
  },
  profileButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  profileInitial: {
    ...typography.bodySemibold,
    color: colors.text.inverse,
    fontSize: 18,
  },
  moneyActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  depositBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(32, 201, 151, 0.9)',
    borderRadius: borderRadius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    gap: spacing.xs,
  },
  withdrawBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 107, 107, 0.9)',
    borderRadius: borderRadius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    gap: spacing.xs,
  },
  moneyBtnIcon: {
    fontSize: 18,
  },
  moneyBtnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: spacing.sm,
  },
  quickAction: {
    alignItems: 'center',
  },
  quickActionIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  quickActionIconText: {
    fontSize: 22,
    color: colors.text.inverse,
    fontWeight: '600',
  },
  quickActionLabel: {
    ...typography.small,
    color: 'rgba(255,255,255,0.9)',
    fontWeight: '500',
  },
  content: {
    flex: 1,
    marginTop: -spacing.md,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingTop: spacing.lg,
  },
  scoreCard: {
    backgroundColor: colors.background.primary,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    ...shadows.md,
  },
  scoreHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  scoreTitle: {
    ...typography.bodySemibold,
    color: colors.text.primary,
  },
  scoreSubtitle: {
    ...typography.small,
    color: colors.text.tertiary,
  },
  scoreCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.gray[50],
    justifyContent: 'center',
    alignItems: 'center',
  },
  scoreValue: {
    fontSize: 24,
    fontWeight: '700',
  },
  scoreMax: {
    fontSize: 12,
    color: colors.text.tertiary,
    fontWeight: '500',
  },
  scoreBarContainer: {
    gap: spacing.xs,
  },
  scoreBar: {
    height: 6,
    backgroundColor: colors.gray[100],
    borderRadius: 3,
    overflow: 'hidden',
  },
  scoreBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  scoreHint: {
    ...typography.caption,
    color: colors.text.tertiary,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.background.primary,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
    ...shadows.sm,
  },
  statIcon: {
    fontSize: 20,
    marginBottom: spacing.xs,
  },
  statValue: {
    ...typography.h3,
    color: colors.text.primary,
  },
  statLabel: {
    ...typography.caption,
    color: colors.text.tertiary,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  sectionTitle: {
    ...typography.h3,
    color: colors.text.primary,
  },
  seeAll: {
    ...typography.smallMedium,
    color: colors.primary[500],
  },
  emptyState: {
    backgroundColor: colors.background.primary,
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    alignItems: 'center',
    ...shadows.sm,
  },
  emptyIconContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.primary[50],
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  emptyIcon: {
    fontSize: 32,
  },
  emptyTitle: {
    ...typography.bodySemibold,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  emptyText: {
    ...typography.small,
    color: colors.text.tertiary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  emptyButton: {
    width: '100%',
  },
  tandaList: {
    gap: spacing.sm,
  },
  tandaCard: {
    backgroundColor: colors.background.primary,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    ...shadows.sm,
  },
  tandaHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  tandaNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  tandaAvatar: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tandaAvatarText: {
    ...typography.bodySemibold,
    color: colors.primary[600],
  },
  tandaName: {
    ...typography.bodySemibold,
    color: colors.text.primary,
  },
  tandaAmount: {
    ...typography.small,
    color: colors.text.tertiary,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    gap: 6,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    ...typography.caption,
    fontWeight: '600',
  },
  tandaProgress: {
    marginBottom: spacing.md,
  },
  progressInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  progressLabel: {
    ...typography.caption,
    color: colors.text.tertiary,
  },
  progressValue: {
    ...typography.caption,
    color: colors.text.secondary,
    fontWeight: '500',
  },
  progressBar: {
    height: 4,
    backgroundColor: colors.gray[100],
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary[500],
    borderRadius: 2,
  },
  tandaFooter: {
    flexDirection: 'row',
    gap: spacing.lg,
  },
  tandaFooterItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  footerIcon: {
    fontSize: 14,
  },
  footerValue: {
    ...typography.small,
    color: colors.text.secondary,
  },
  // Score info styles
  scoreTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  scoreInfoButton: {
    padding: 4,
  },
  scoreInfoIcon: {
    fontSize: 16,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  modalContent: {
    backgroundColor: colors.background.primary,
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    width: '100%',
    maxWidth: 340,
  },
  modalTitle: {
    ...typography.h3,
    color: colors.text.primary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  scoreRulesList: {
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  scoreRuleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.xs,
  },
  scoreRulePoints: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.success,
    width: 40,
  },
  scoreRuleText: {
    ...typography.body,
    color: colors.text.primary,
    flex: 1,
  },
  scoreRuleNegative: {
    backgroundColor: colors.error + '10',
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.sm,
    marginHorizontal: -spacing.sm,
  },
  scoreRulePointsNegative: {
    color: colors.error,
  },
  scoreLevels: {
    backgroundColor: colors.gray[50],
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  scoreLevelsTitle: {
    ...typography.smallMedium,
    color: colors.text.secondary,
    marginBottom: spacing.sm,
  },
  scoreLevelItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 4,
  },
  scoreLevelDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  scoreLevelText: {
    ...typography.small,
    color: colors.text.primary,
  },
  modalCloseButton: {
    backgroundColor: colors.primary[500],
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  modalCloseButtonText: {
    ...typography.bodySemibold,
    color: colors.text.inverse,
  },
  scoreBlockedNote: {
    backgroundColor: colors.error + '15',
    borderRadius: borderRadius.sm,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  scoreBlockedNoteText: {
    ...typography.small,
    color: colors.error,
    textAlign: 'center',
  },
});


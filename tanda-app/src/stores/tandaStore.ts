/**
 * Tanda Store
 * Manages tanda operations via Anchor server
 *
 * All tanda logic happens on the Anchor server:
 * - Create/join tandas
 * - Deposits go to Storage Accounts
 * - Anchor manages payouts
 */

import { create } from 'zustand';
import { Tanda, TandaParticipant, TandaStatus, FailedDeposit } from '../types';
import { secureStorage } from '../services/storage';
import { stellarService } from '../services/stellar';
import { anchorStellarService } from '../services/anchorStellar';
import { depositRetryService } from '../services/depositRetry';
import { notificationService } from '../services/notifications';
import { TANDA_CONFIG } from '../config/network';
import {
  anchorService,
  Tanda as AnchorTanda,
  GasOperationType,
} from '../services/anchor';
import { useAuthStore } from './authStore';
import { useUserStore, SCORE_CONFIG } from './userStore';

interface TandaState {
  tandas: Tanda[];
  activeTandas: Tanda[];
  isLoading: boolean;
  error: string | null;

  // Actions
  loadTandas: () => Promise<void>;
  createTanda: (params: CreateTandaParams) => Promise<Tanda>;
  joinTanda: (tandaId: string) => Promise<void>;
  leaveTanda: (tandaId: string) => Promise<void>;
  deposit: (tandaId: string) => Promise<void>;
  advance: (tandaId: string) => Promise<void>;
  getTandaById: (tandaId: string) => Tanda | undefined;
  refreshTanda: (tandaId: string) => Promise<void>;
  clearError: () => void;

  // Payment schedule (manual payments with calendar)
  getPaymentSchedule: (tandaId: string) => Promise<PaymentScheduleItem[]>;
  getNextPayment: (tandaId: string) => Promise<NextPaymentInfo | null>;

  // Notifications
  schedulePaymentReminders: (tandaId: string) => Promise<void>;

  // Deposit retry system
  initializeRetrySystem: () => Promise<void>;
  expelUserFromTanda: (tandaId: string, walletAddress: string, reason: string) => Promise<void>;
  retryFailedDeposit: (tandaId: string) => Promise<boolean>;
  getFailedDepositInfo: (tandaId: string) => FailedDeposit | undefined;

  // Reset
  reset: () => void;
}

// Payment schedule types
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

interface CreateTandaParams {
  name?: string;
  amount: number;           // Amount per cycle in EURC
  maxParticipants: number;
  minScore: number;
}

// Convert Anchor tanda to local Tanda type
const convertAnchorTanda = (anchorTanda: AnchorTanda): Tanda => {
  return {
    id: anchorTanda.id,
    creatorPublicKey: anchorTanda.creator,
    name: anchorTanda.name,
    amount: anchorTanda.amount,
    maxParticipants: anchorTanda.maxParticipants,
    minScore: 0, // TODO: Add to Anchor
    participants: anchorTanda.participants.map(p => ({
      publicKey: p.walletAddress,
      joinedAt: p.joinedAt,
      hasDeposited: p.hasDeposited,
      hasWithdrawn: p.hasWithdrawn,
      score: SCORE_CONFIG.INITIAL, // TODO: Get from Anchor
    })),
    currentCycle: anchorTanda.currentCycle,
    totalCycles: anchorTanda.totalCycles,
    status: anchorTanda.status,
    createdAt: anchorTanda.createdAt,
    beneficiaryIndex: anchorTanda.currentCycle,
    // Convert wallet addresses to indices
    beneficiaryOrder: anchorTanda.beneficiaryOrder.map(addr =>
      anchorTanda.participants.findIndex(p => p.walletAddress === addr)
    ).filter(idx => idx >= 0),
  };
};

export const useTandaStore = create<TandaState>((set, get) => ({
  tandas: [],
  activeTandas: [],
  isLoading: false,
  error: null,

  clearError: () => set({ error: null }),

  loadTandas: async () => {
    set({ isLoading: true, error: null });

    try {
      // Load local tandas FIRST and update state immediately (instant!)
      const localTandas = await secureStorage.getTandas();
      console.log('[TandaStore] Local tandas loaded:', localTandas.length);

      const activeTandas = localTandas.filter(
        (t: Tanda) => t.status === 'active' || t.status === 'waiting'
      );

      // Update UI immediately with local data
      set({ tandas: localTandas, activeTandas, isLoading: false });

      // Schedule payment reminders
      const walletAddress = useAuthStore.getState().publicKey;
      if (walletAddress) {
        for (const tanda of activeTandas) {
          if (tanda.status === 'active' && tanda.participants.some((p: { publicKey: string }) => p.publicKey === walletAddress)) {
            get().schedulePaymentReminders(tanda.id);
          }
        }
      }

      // Sync with Anchor in BACKGROUND (don't wait)
      anchorService.getTandas().then(async response => {
        if (response.success && response.tandas && response.tandas.length > 0) {
          const anchorTandas = response.tandas.map(convertAnchorTanda);
          console.log('[TandaStore] Anchor sync complete:', anchorTandas.length);

          // Merge with current local tandas
          const currentTandas = get().tandas;
          const anchorIds = new Set(anchorTandas.map(t => t.id));
          const localOnlyTandas = currentTandas.filter((t: Tanda) => !anchorIds.has(t.id));
          const mergedTandas = [...anchorTandas, ...localOnlyTandas];

          const mergedActiveTandas = mergedTandas.filter(
            t => t.status === 'active' || t.status === 'waiting'
          );

          set({ tandas: mergedTandas, activeTandas: mergedActiveTandas });
          await secureStorage.saveTandas(mergedTandas);
        }
      }).catch(() => {
        // Silently fail - we already have local data
      });

    } catch (error: any) {
      console.error('[TandaStore] Error loading tandas:', error);
      set({ tandas: [], activeTandas: [], isLoading: false, error: error?.message });
    }
  },

  createTanda: async (params: CreateTandaParams) => {
    const walletAddress = useAuthStore.getState().publicKey;
    if (!walletAddress) throw new Error('Wallet not initialized');

    set({ isLoading: true, error: null });

    try {
      // Request gas for create_tanda operation (charges commission after first operation)
      console.log('[TandaStore] Requesting gas for create_tanda...');
      const gasResult = await anchorService.requestGas(walletAddress, 'create_tanda');
      if (!gasResult.success) {
        if (gasResult.error?.includes('PERMISSION')) {
          throw new Error('Se requiere permiso para rellenar gas. Ve a Configuración.');
        }
        console.warn('[TandaStore] Gas request failed:', gasResult.error);
      } else {
        console.log(`[TandaStore] Gas provided: ${gasResult.gasProvided} XLM, Commission: ${gasResult.commissionCharged}`);
      }

      // Create via Anchor
      const response = await anchorService.createTanda({
        name: params.name || `Tanda ${Date.now()}`,
        amount: params.amount,
        maxParticipants: params.maxParticipants,
        totalCycles: params.maxParticipants, // One cycle per participant
        cycleDays: 0, // No fixed cycles in new model
        minScore: params.minScore,
        creatorWallet: walletAddress,
      });

      if (response.success && response.tanda) {
        const tanda = convertAnchorTanda(response.tanda);

        const { tandas } = get();
        const updatedTandas = [...tandas, tanda];

        set({
          tandas: updatedTandas,
          activeTandas: updatedTandas.filter(t => t.status === 'active' || t.status === 'waiting'),
          isLoading: false,
        });

        // Refresh balance after successful creation (gas/commission may have been consumed)
        console.log('[TandaStore] Refreshing balance after tanda creation...');
        useUserStore.getState().fetchBalance();

        return tanda;
      }

      throw new Error(response.error || 'Failed to create tanda');
    } catch (error: any) {
      console.error('[TandaStore] Error creating tanda:', error);

      // Fallback: Create locally if Anchor is unavailable
      const tandaId = 'local_' + Date.now();
      const userScore = useUserStore.getState().user?.score ?? SCORE_CONFIG.INITIAL;

      const newTanda: Tanda = {
        id: tandaId,
        creatorPublicKey: walletAddress,
        name: params.name || '',
        amount: params.amount,
        maxParticipants: params.maxParticipants,
        minScore: params.minScore,
        participants: [{
          publicKey: walletAddress,
          joinedAt: Date.now(),
          hasDeposited: false,
          hasWithdrawn: false,
          score: userScore,
        }],
        currentCycle: 0,
        totalCycles: params.maxParticipants,
        status: 'waiting',
        createdAt: Date.now(),
        beneficiaryIndex: 0,
        beneficiaryOrder: [],
      };

      const { tandas } = get();
      const updatedTandas = [...tandas, newTanda];
      await secureStorage.saveTandas(updatedTandas);

      set({
        tandas: updatedTandas,
        activeTandas: updatedTandas.filter(t => t.status === 'active' || t.status === 'waiting'),
        isLoading: false,
        error: 'Created locally (Anchor unavailable)',
      });

      // Refresh balance even on fallback (gas might have been consumed before failure)
      useUserStore.getState().fetchBalance();

      return newTanda;
    }
  },

  joinTanda: async (tandaId: string) => {
    const walletAddress = useAuthStore.getState().publicKey;
    if (!walletAddress) throw new Error('Wallet not initialized');

    set({ isLoading: true, error: null });

    try {
      // Note: join_tanda does NOT consume gas - it's just a local registration
      // No blockchain transaction is executed, so no gas request needed
      console.log('[TandaStore] Joining tanda (no gas needed - local registration only)...');

      const response = await anchorService.joinTanda(tandaId, walletAddress);

      if (response.success && response.tanda) {
        const tanda = convertAnchorTanda(response.tanda);

        const { tandas } = get();
        const updatedTandas = tandas.map(t => t.id === tandaId ? tanda : t);

        set({
          tandas: updatedTandas,
          activeTandas: updatedTandas.filter(t => t.status === 'active' || t.status === 'waiting'),
          isLoading: false,
        });

        // Schedule payment reminders if tanda is active
        if (tanda.status === 'active') {
          get().schedulePaymentReminders(tandaId);
        }
      } else {
        throw new Error(response.error || 'Failed to join tanda');
      }
    } catch (error: any) {
      console.error('[TandaStore] Error joining tanda:', error);

      // Fallback: Join locally
      const { tandas } = get();
      const tanda = tandas.find(t => t.id === tandaId);

      // Validate before joining
      if (!tanda) {
        throw new Error('Tanda no encontrada');
      }
      if (tanda.participants.length >= tanda.maxParticipants) {
        throw new Error('Esta tanda ya está llena');
      }
      if (tanda.status !== 'waiting') {
        throw new Error('Esta tanda ya no acepta participantes');
      }
      if (tanda.participants.find(p => p.publicKey === walletAddress)) {
        throw new Error('Ya eres participante de esta tanda');
      }

      const userScore = useUserStore.getState().user?.score ?? SCORE_CONFIG.INITIAL;

      const updatedTandas = tandas.map(t => {
        if (t.id === tandaId) {
          return {
            ...t,
            participants: [...t.participants, {
              publicKey: walletAddress,
              joinedAt: Date.now(),
              hasDeposited: false,
              hasWithdrawn: false,
              score: userScore,
            }],
          };
        }
        return t;
      });

      await secureStorage.saveTandas(updatedTandas);
      set({
        tandas: updatedTandas,
        activeTandas: updatedTandas.filter(t => t.status === 'active' || t.status === 'waiting'),
        isLoading: false,
        error: 'Joined locally (Anchor unavailable)',
      });
    }
  },

  leaveTanda: async (tandaId: string) => {
    const walletAddress = useAuthStore.getState().publicKey;
    if (!walletAddress) throw new Error('Wallet not initialized');

    set({ isLoading: true, error: null });

    try {
      const response = await anchorService.leaveTanda(tandaId, walletAddress);

      if (response.success && response.tanda) {
        const tanda = convertAnchorTanda(response.tanda);

        const { tandas } = get();
        const updatedTandas = tandas.map(t => t.id === tandaId ? tanda : t);

        set({
          tandas: updatedTandas,
          activeTandas: updatedTandas.filter(t => t.status === 'active' || t.status === 'waiting'),
          isLoading: false,
        });
      }
    } catch (error: any) {
      console.error('[TandaStore] Error leaving tanda:', error);

      // Fallback: Leave locally
      const { tandas } = get();
      const updatedTandas = tandas.map(t => {
        if (t.id === tandaId) {
          return {
            ...t,
            participants: t.participants.filter(p => p.publicKey !== walletAddress),
          };
        }
        return t;
      });

      await secureStorage.saveTandas(updatedTandas);
      set({
        tandas: updatedTandas,
        activeTandas: updatedTandas.filter(t => t.status === 'active' || t.status === 'waiting'),
        isLoading: false,
      });
    }
  },

  /**
   * Manual deposit flow:
   * 1. User transfers EURC to Storage Account
   * 2. Frontend confirms deposit with txHash
   *
   * @param tandaId - The tanda ID
   * @param storageAccountAddress - The Storage Account to send EURC to
   * @returns The transaction hash for confirmation
   */
  deposit: async (tandaId: string) => {
    const walletAddress = useAuthStore.getState().publicKey;
    if (!walletAddress) throw new Error('Wallet not initialized');

    set({ isLoading: true, error: null });

    try {
      // Step 1: Request gas for deposit operation
      console.log('[TandaStore] Requesting gas for deposit...');
      const gasResult = await anchorService.requestGas(walletAddress, 'deposit');
      if (!gasResult.success) {
        console.warn('[TandaStore] Gas request failed:', gasResult.error);
        // Continue anyway - user might have enough gas
      } else {
        console.log(`[TandaStore] Gas provided: ${gasResult.gasProvided} XLM`);
      }

      // Step 2: Get tanda details
      const tanda = get().getTandaById(tandaId);
      if (!tanda) throw new Error('Tanda no encontrada');

      // Step 3: Calculate total (deposit + commission)
      const commission = TANDA_CONFIG.commission;
      const totalAmount = tanda.amount + commission;

      // Step 4: Check if user has sufficient balance (including commission)
      const userBalance = useUserStore.getState().eurcBalance;
      if (userBalance < totalAmount) {
        const errorMsg = `Fondos insuficientes. Necesitas €${totalAmount.toFixed(2)} (€${tanda.amount.toFixed(2)} + €${commission.toFixed(2)} comisión) pero solo tienes €${userBalance.toFixed(2)}`;
        console.warn('[TandaStore] Insufficient funds:', errorMsg);

        await depositRetryService.registerFailedDeposit(
          tandaId,
          walletAddress,
          totalAmount, // Register with total amount
          tanda.currentCycle,
          errorMsg
        );

        set({ isLoading: false, error: errorMsg });
        throw new Error(errorMsg);
      }

      // Step 5: Get tanda's Storage Account address from Anchor
      const tandaResponse = await anchorService.getTanda(tandaId);
      if (!tandaResponse.success || !tandaResponse.tanda) {
        throw new Error('No se pudo obtener la información de la tanda');
      }
      const storageAccountAddress = tandaResponse.tanda.storageAccount;
      if (!storageAccountAddress) {
        throw new Error('La tanda no tiene cuenta de almacenamiento configurada');
      }

      // Step 6: Transfer EURC to Storage Account (includes commission)
      console.log(`[TandaStore] Transferring €${totalAmount.toFixed(2)} (€${tanda.amount.toFixed(2)} + €${commission.toFixed(2)} commission) to Storage Account: ${storageAccountAddress}`);

      // Build the transaction with Stellar service
      const buildResult = await stellarService.buildEurcTransfer(storageAccountAddress, totalAmount, `tanda:${tandaId}`);
      if (!buildResult.success || !buildResult.txXdr) {
        throw new Error(buildResult.error || 'Error al construir la transaccion');
      }

      // Sponsor and submit the transaction via Anchor
      const sponsorResult = await anchorStellarService.sponsorTransaction(buildResult.txXdr, 'tanda_deposit');
      if (!sponsorResult.success || !sponsorResult.txHash) {
        throw new Error(sponsorResult.error || 'Error al enviar la transaccion');
      }

      const transferResult = { success: true, txHash: sponsorResult.txHash };

      console.log(`[TandaStore] Transfer successful, txHash: ${transferResult.txHash}`);

      // Step 6: Confirm deposit with Anchor (includes txHash for verification)
      console.log('[TandaStore] Confirming deposit with Anchor...');
      const confirmResult = await anchorService.confirmDeposit(tandaId, walletAddress, transferResult.txHash);

      if (confirmResult.success && confirmResult.tanda) {
        const updatedTanda = convertAnchorTanda(confirmResult.tanda);

        const { tandas } = get();
        const updatedTandas = tandas.map(t => t.id === tandaId ? updatedTanda : t);

        set({
          tandas: updatedTandas,
          activeTandas: updatedTandas.filter(t => t.status === 'active' || t.status === 'waiting'),
          isLoading: false,
        });

        // Mark any pending retry as resolved
        await depositRetryService.markAsResolved(tandaId, walletAddress, updatedTanda.currentCycle);

        // Cancel payment reminders (user has deposited)
        await notificationService.cancelRemindersForTanda(tandaId);

        // Send success notification
        await notificationService.sendPaymentSuccessNotification(
          updatedTanda.name || `Tanda ${tandaId.slice(0, 8)}`,
          tanda.amount
        );

        // Refresh balance after successful deposit
        console.log('[TandaStore] Refreshing balance after deposit...');
        useUserStore.getState().fetchBalance();
      } else {
        // Transfer succeeded but confirmation failed - inform user
        const errorMsg = confirmResult.error || 'Error al confirmar el depósito';
        console.error('[TandaStore] Deposit confirmation failed:', errorMsg);

        // Still refresh balance since transfer was successful
        useUserStore.getState().fetchBalance();

        throw new Error(`Transferencia exitosa pero error en confirmación: ${errorMsg}. Tu txHash: ${transferResult.txHash}`);
      }
    } catch (error: any) {
      console.error('[TandaStore] Error depositing:', error);

      const errorMessage = error?.message || 'Error en el depósito';
      set({
        isLoading: false,
        error: errorMessage,
      });

      // Refresh balance in case anything changed
      useUserStore.getState().fetchBalance();

      throw error;
    }
  },

  /**
   * Advance the tanda:
   * - If there are delinquents (6+ days), expels them
   * - If all remaining members deposited, triggers payout to beneficiary
   */
  advance: async (tandaId: string) => {
    const walletAddress = useAuthStore.getState().publicKey;
    if (!walletAddress) throw new Error('Wallet not initialized');

    set({ isLoading: true, error: null });

    try {
      // Advance is FREE for users - no commission charged
      // The Anchor sponsors the gas cost (~0.01 XLM = ~€0.004)
      console.log('[TandaStore] Advancing tanda (FREE operation)...');

      // Call processPayout which will handle expulsion and payout
      const response = await anchorService.processPayout(tandaId);

      if (response.success && response.tanda) {
        const tanda = convertAnchorTanda(response.tanda);

        const { tandas } = get();
        const updatedTandas = tandas.map(t => t.id === tandaId ? tanda : t);

        set({
          tandas: updatedTandas,
          activeTandas: updatedTandas.filter(t => t.status === 'active' || t.status === 'waiting'),
          isLoading: false,
        });

        // Refresh balance after successful advance
        console.log('[TandaStore] Refreshing balance after advance...');
        useUserStore.getState().fetchBalance();
      }
    } catch (error: any) {
      console.error('[TandaStore] Error advancing tanda:', error);

      set({
        isLoading: false,
        error: error?.message,
      });

      // Refresh balance on error (gas might have been consumed)
      useUserStore.getState().fetchBalance();
    }
  },

  getTandaById: (tandaId: string) => {
    return get().tandas.find(t => t.id === tandaId);
  },

  refreshTanda: async (tandaId: string) => {
    try {
      const response = await anchorService.getTanda(tandaId);

      if (response.success && response.tanda) {
        const tanda = convertAnchorTanda(response.tanda);

        const { tandas } = get();
        const updatedTandas = tandas.map(t => t.id === tandaId ? tanda : t);

        set({
          tandas: updatedTandas,
          activeTandas: updatedTandas.filter(t => t.status === 'active' || t.status === 'waiting'),
        });
      }
    } catch (error) {
      console.error('[TandaStore] Error refreshing tanda:', error);
    }
  },

  /**
   * Get the payment schedule for a tanda (manual payments with calendar)
   */
  getPaymentSchedule: async (tandaId: string): Promise<PaymentScheduleItem[]> => {
    try {
      console.log('[TandaStore] Fetching payment schedule for:', tandaId);
      const response = await anchorService.getPaymentSchedule(tandaId);

      if (response.success && response.schedule) {
        return response.schedule;
      }

      console.warn('[TandaStore] Failed to get payment schedule:', response.error);
      return [];
    } catch (error) {
      console.error('[TandaStore] Error getting payment schedule:', error);
      return [];
    }
  },

  /**
   * Get the next payment due for the current user in a tanda
   */
  getNextPayment: async (tandaId: string): Promise<NextPaymentInfo | null> => {
    const walletAddress = useAuthStore.getState().publicKey;
    if (!walletAddress) return null;

    try {
      console.log('[TandaStore] Fetching next payment for:', tandaId);
      const response = await anchorService.getNextPayment(tandaId, walletAddress);

      if (response.success && response.nextPayment) {
        return response.nextPayment;
      }

      console.log('[TandaStore] No next payment:', response.message);
      return null;
    } catch (error) {
      console.error('[TandaStore] Error getting next payment:', error);
      return null;
    }
  },

  /**
   * Initialize the deposit retry system
   * Should be called when the app starts
   */
  initializeRetrySystem: async () => {
    console.log('[TandaStore] Initializing deposit retry system...');

    // Set up callbacks for the retry service
    depositRetryService.setCallbacks(
      // onRetry callback - attempts to deposit again
      async (failedDeposit: FailedDeposit): Promise<boolean> => {
        console.log('[TandaStore] Retry callback triggered for:', failedDeposit.id);

        const walletAddress = useAuthStore.getState().publicKey;
        if (walletAddress !== failedDeposit.walletAddress) {
          console.warn('[TandaStore] Wallet mismatch, skipping retry');
          return false;
        }

        // Check balance before retrying
        const userBalance = useUserStore.getState().eurcBalance;
        if (userBalance < failedDeposit.amount) {
          console.log('[TandaStore] Still insufficient funds for retry');
          return false;
        }

        try {
          // Attempt to deposit again
          await get().deposit(failedDeposit.tandaId);
          return true;
        } catch (error) {
          console.error('[TandaStore] Retry deposit failed:', error);
          return false;
        }
      },

      // onExpel callback - expels user after max retries
      async (failedDeposit: FailedDeposit): Promise<void> => {
        console.log('[TandaStore] Expel callback triggered for:', failedDeposit.id);
        await get().expelUserFromTanda(
          failedDeposit.tandaId,
          failedDeposit.walletAddress,
          `Deposito fallido tras ${failedDeposit.attemptCount} intentos`
        );
      }
    );

    // Initialize the service (loads from storage, starts scheduler)
    await depositRetryService.initialize();
  },

  /**
   * Expel a user from a tanda due to failed deposits
   * Applies scoring penalty and removes user from tanda
   */
  expelUserFromTanda: async (tandaId: string, walletAddress: string, reason: string) => {
    console.log('[TandaStore] Expelling user from tanda:', tandaId, walletAddress, reason);

    try {
      // 1. Apply scoring penalty to user
      const currentWallet = useAuthStore.getState().publicKey;
      if (currentWallet === walletAddress) {
        await useUserStore.getState().applyDepositFailurePenalty(tandaId, reason);
      }

      // 2. Notify Anchor about expulsion
      // The advance() function handles delinquent expulsion automatically
      try {
        const response = await anchorService.leaveTanda(tandaId, walletAddress);
        if (response.success) {
          console.log('[TandaStore] User expelled via Anchor');
        }
      } catch (anchorError) {
        console.warn('[TandaStore] Could not expel via Anchor:', anchorError);
      }

      // 3. Update local state
      const { tandas } = get();
      const updatedTandas = tandas.map(t => {
        if (t.id === tandaId) {
          return {
            ...t,
            participants: t.participants.filter(p => p.publicKey !== walletAddress),
          };
        }
        return t;
      });

      await secureStorage.saveTandas(updatedTandas);
      set({
        tandas: updatedTandas,
        activeTandas: updatedTandas.filter(t => t.status === 'active' || t.status === 'waiting'),
      });

      // 4. Cancel any remaining retries for this user in this tanda
      await depositRetryService.cancelRetries(tandaId, walletAddress);

      console.log('[TandaStore] User expelled successfully');
    } catch (error) {
      console.error('[TandaStore] Error expelling user:', error);
    }
  },

  /**
   * Manually retry a failed deposit (e.g., when user adds funds)
   */
  retryFailedDeposit: async (tandaId: string): Promise<boolean> => {
    const walletAddress = useAuthStore.getState().publicKey;
    if (!walletAddress) return false;

    const tanda = get().getTandaById(tandaId);
    if (!tanda) return false;

    console.log('[TandaStore] Manual retry for tanda:', tandaId);

    // Force retry via the service
    return await depositRetryService.forceRetry(tandaId, walletAddress, tanda.currentCycle);
  },

  /**
   * Get information about a failed deposit for a tanda
   */
  getFailedDepositInfo: (tandaId: string): FailedDeposit | undefined => {
    const walletAddress = useAuthStore.getState().publicKey;
    if (!walletAddress) return undefined;

    const tanda = get().getTandaById(tandaId);
    if (!tanda) return undefined;

    return depositRetryService.getFailedDeposit(tandaId, walletAddress, tanda.currentCycle);
  },

  /**
   * Schedule payment reminders for a tanda
   * Notifications are scheduled 3 days before, 1 day before, and on due date
   */
  schedulePaymentReminders: async (tandaId: string) => {
    const walletAddress = useAuthStore.getState().publicKey;
    if (!walletAddress) return;

    try {
      const tanda = get().getTandaById(tandaId);
      if (!tanda || tanda.status !== 'active') return;

      // Get the next payment info
      const nextPayment = await get().getNextPayment(tandaId);
      if (!nextPayment) {
        console.log('[TandaStore] No next payment to schedule reminders for');
        return;
      }

      // Check if user has already deposited this cycle
      const participant = tanda.participants.find(p => p.publicKey === walletAddress);
      if (participant?.hasDeposited) {
        console.log('[TandaStore] User already deposited, canceling reminders');
        await notificationService.cancelRemindersForTanda(tandaId);
        return;
      }

      // Schedule the reminders
      console.log('[TandaStore] Scheduling payment reminders for tanda:', tandaId);
      await notificationService.schedulePaymentReminders({
        tandaId,
        tandaName: tanda.name || `Tanda ${tandaId.slice(0, 8)}`,
        amount: tanda.amount,
        dueDate: nextPayment.dueDate,
        cycle: nextPayment.cycle,
      });
    } catch (error) {
      console.error('[TandaStore] Error scheduling payment reminders:', error);
    }
  },

  /**
   * Reset all tanda state (called on logout)
   */
  reset: () => {
    console.log('[TandaStore] Resetting all state');
    set({
      tandas: [],
      activeTandas: [],
      isLoading: false,
      error: null,
    });
  },
}));

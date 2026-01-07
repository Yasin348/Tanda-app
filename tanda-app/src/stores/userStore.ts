/**
 * User Store
 * Manages user data, balances, and KYC status
 *
 * Uses Stellar Network for balances (EURC + XLM)
 * Uses Anchor for fee sponsorship
 */

import { create } from 'zustand';
import { User, Transaction } from '../types';
import { secureStorage } from '../services/storage';
import { stellarService } from '../services/stellar';
import { anchorStellarService } from '../services/anchorStellar';
import { anchorService } from '../services/anchor';
import { formatEuro, ENV } from '../config/network';
import { useAuthStore } from './authStore';

// KYC Status Types
export type KYCStatusType = 'not_started' | 'pending' | 'in_progress' | 'approved' | 'rejected';

interface KYCData {
  status: KYCStatusType;
  country?: string;
  approvedAt?: number;
  verificationURL?: string;
  startedAt?: number;
}

// Account Setup Types
export interface AccountSetupStatus {
  accountExists: boolean;
  hasTrustline: boolean;
  isReady: boolean;         // Account exists AND has trustline
  isSettingUp: boolean;     // Currently in setup process
  lastChecked: number | null;
}

export interface AccountSetupResult {
  success: boolean;
  accountActivated: boolean;
  trustlineCreated: boolean;
  error?: string;
}

interface UserState {
  user: User | null;

  // Balances
  eurcBalance: number;          // EURC balance (in euros)
  eurcBalanceFormatted: string; // Formatted with symbol
  xlmBalance: number;           // XLM balance (for display only, fees are sponsored)

  transactions: Transaction[];
  isLoading: boolean;

  // Testnet simulation
  _hasSimulatedBalance: boolean;

  // KYC State
  kycStatus: KYCStatusType;
  kycData: KYCData | null;

  // Actions
  loadUser: () => Promise<void>;
  updateScore: (delta: number) => Promise<void>;
  setActiveDebt: (hasDebt: boolean) => Promise<void>;
  incrementTandaCount: () => Promise<void>;
  completeTanda: () => Promise<void>;
  fetchBalance: () => Promise<void>;
  addTransaction: (transaction: Transaction) => void;
  isTestMode: () => boolean;
  addSimulatedDeposit: (amount: number) => Promise<void>;
  subtractSimulatedWithdraw: (amount: number) => Promise<boolean>;
  loadSimulatedBalance: () => Promise<void>;

  // KYC Functions
  loadKYCStatus: () => Promise<void>;
  updateKYCStatus: (status: KYCStatusType, data?: Partial<KYCData>) => Promise<void>;
  isKYCApproved: () => boolean;

  // Account Setup
  accountStatus: AccountSetupStatus;
  setupStellarAccount: () => Promise<AccountSetupResult>;
  checkAccountStatus: () => Promise<void>;

  // Reset
  reset: () => void;

  // Penalties
  applyDepositFailurePenalty: (tandaId: string, reason: string) => Promise<void>;

  // Score checks
  isBlocked: () => boolean;
}

// Score Configuration
const SCORE_CONFIG = {
  MAX: 100,           // Puntuación máxima
  INITIAL: 50,        // Puntuación inicial (nuevos usuarios)
  BLOCK_THRESHOLD: 25, // Por debajo de esto = bloqueado
};

// Score Rules (sin plazos - modelo simple)
const SCORE_RULES = {
  DEPOSIT: 5,           // Depositar en una tanda
  NO_DEPOSIT: -25,      // Ser expulsado (6 días sin pagar)
  COMPLETE_TANDA: 20,   // Completar toda la tanda
  CREATE_TANDA: 5,      // Crear una tanda
};

export const useUserStore = create<UserState>((set, get) => ({
  user: null,
  eurcBalance: 0,
  eurcBalanceFormatted: formatEuro(0),
  xlmBalance: 0,
  transactions: [],
  isLoading: false,
  kycStatus: 'not_started',
  kycData: null,
  _hasSimulatedBalance: false,
  accountStatus: {
    accountExists: false,
    hasTrustline: false,
    isReady: false,
    isSettingUp: false,
    lastChecked: null,
  },

  isTestMode: () => {
    return ENV.current === 'testnet';
  },

  /**
   * Simulate a deposit (testnet only)
   */
  addSimulatedDeposit: async (amount: number) => {
    const currentBalance = get().eurcBalance;
    const newBalance = currentBalance + amount;
    console.log('[UserStore] Simulated deposit:', amount, '-> New balance:', newBalance);
    set({
      eurcBalance: newBalance,
      eurcBalanceFormatted: formatEuro(newBalance),
      _hasSimulatedBalance: true,
    });
    const walletAddress = useAuthStore.getState().publicKey;
    await secureStorage.saveSimulatedBalance(newBalance, walletAddress || undefined);
  },

  /**
   * Simulate a withdrawal (testnet only)
   */
  subtractSimulatedWithdraw: async (amount: number): Promise<boolean> => {
    const currentBalance = get().eurcBalance;
    if (currentBalance < amount) {
      console.warn('[UserStore] Insufficient balance:', amount, '> balance:', currentBalance);
      return false;
    }
    const newBalance = currentBalance - amount;
    console.log('[UserStore] Simulated withdraw:', amount, '-> New balance:', newBalance);
    set({
      eurcBalance: newBalance,
      eurcBalanceFormatted: formatEuro(newBalance),
      _hasSimulatedBalance: true,
    });
    const walletAddress = useAuthStore.getState().publicKey;
    await secureStorage.saveSimulatedBalance(newBalance, walletAddress || undefined);
    return true;
  },

  /**
   * Load persisted simulated balance (testnet only)
   */
  loadSimulatedBalance: async () => {
    if (!get().isTestMode()) return;

    const walletAddress = useAuthStore.getState().publicKey;
    const savedBalance = await secureStorage.getSimulatedBalance(walletAddress || undefined);

    if (savedBalance !== null) {
      console.log('[UserStore] Loaded simulated balance:', savedBalance);
      set({
        eurcBalance: savedBalance,
        eurcBalanceFormatted: formatEuro(savedBalance),
        _hasSimulatedBalance: true,
      });
    }
  },

  /**
   * KYC is now handled by Mykobo during deposit/withdrawal flow.
   * Always returns true since we don't block at the app level anymore.
   */
  isKYCApproved: () => {
    // Mykobo handles all KYC during deposit/withdrawal
    // No need to block users at the app level
    return true;
  },

  /**
   * Load KYC status - simplified since Mykobo handles verification
   */
  loadKYCStatus: async () => {
    // With Mykobo integration, KYC is handled during deposit/withdrawal flow
    // We just set it as approved to not block any features
    console.log('[UserStore] KYC handled by Mykobo during deposit/withdrawal');
    set({ kycStatus: 'approved', kycData: { status: 'approved' } });
  },

  /**
   * Update KYC status - simplified since Mykobo handles it
   */
  updateKYCStatus: async (_status: KYCStatusType, _data?: Partial<KYCData>) => {
    // KYC is handled by Mykobo, so we just keep it as approved
    console.log('[UserStore] KYC status managed by Mykobo');
    set({ kycStatus: 'approved', kycData: { status: 'approved' } });
  },

  // ==================== ACCOUNT SETUP ====================

  /**
   * Check account status on Stellar network
   */
  checkAccountStatus: async () => {
    const publicKey = useAuthStore.getState().publicKey;
    if (!publicKey) {
      console.log('[UserStore] No public key, cannot check account status');
      return;
    }

    try {
      console.log('[UserStore] Checking account status...');
      const response = await anchorService.getAccountStatus(publicKey);

      if (response.success) {
        set({
          accountStatus: {
            accountExists: response.accountExists,
            hasTrustline: response.hasTrustline,
            isReady: response.readyForDeposit,
            isSettingUp: false,
            lastChecked: Date.now(),
          },
        });
        console.log('[UserStore] Account status:', {
          exists: response.accountExists,
          trustline: response.hasTrustline,
          ready: response.readyForDeposit,
        });
      }
    } catch (error) {
      console.error('[UserStore] Error checking account status:', error);
    }
  },

  /**
   * Setup Stellar account: activate + create trustline
   * This is called automatically after KYC or manually if needed
   */
  setupStellarAccount: async (): Promise<AccountSetupResult> => {
    const publicKey = useAuthStore.getState().publicKey;
    if (!publicKey) {
      return { success: false, accountActivated: false, trustlineCreated: false, error: 'No wallet' };
    }

    // On testnet, skip account setup - EURC issuer doesn't exist
    // Mykobo only works on mainnet anyway
    if (get().isTestMode()) {
      console.log('[UserStore] Testnet mode - skipping account setup');
      set({
        accountStatus: {
          accountExists: true,
          hasTrustline: true,
          isReady: true,
          isSettingUp: false,
          lastChecked: Date.now(),
        },
      });
      return { success: true, accountActivated: false, trustlineCreated: false };
    }

    set(state => ({
      accountStatus: { ...state.accountStatus, isSettingUp: true },
    }));

    let accountActivated = false;
    let trustlineCreated = false;

    try {
      console.log('[UserStore] Setting up Stellar account...');

      // Step 1: Check current status
      const statusResponse = await anchorService.getAccountStatus(publicKey);

      if (!statusResponse.success) {
        throw new Error(statusResponse.error || 'Failed to check account status');
      }

      // Step 2: Activate account if needed
      if (!statusResponse.accountExists) {
        console.log('[UserStore] Account does not exist, activating...');
        const activateResponse = await anchorService.activateAccount(publicKey);

        if (!activateResponse.success) {
          throw new Error(activateResponse.error || 'Failed to activate account');
        }

        accountActivated = !activateResponse.alreadyActive;
        console.log('[UserStore] Account activated:', activateResponse.txHash);
      } else {
        console.log('[UserStore] Account already exists');
      }

      // Step 3: Create trustline if needed
      if (!statusResponse.hasTrustline) {
        console.log('[UserStore] Creating EURC trustline...');

        // Build trustline transaction locally (we have the keypair)
        const buildResult = await stellarService.buildEurcTrustline();

        if (!buildResult.success || !buildResult.txXdr) {
          throw new Error(buildResult.error || 'Failed to build trustline transaction');
        }

        // Submit to sponsor for fee-bump
        console.log('[UserStore] Submitting trustline for sponsorship...');
        const sponsorResponse = await anchorService.sponsorTransaction(
          buildResult.txXdr,
          'trustline'
        );

        if (!sponsorResponse.success) {
          throw new Error(sponsorResponse.error || 'Failed to sponsor trustline');
        }

        trustlineCreated = true;
        console.log('[UserStore] Trustline created:', sponsorResponse.txHash);
      } else {
        console.log('[UserStore] Trustline already exists');
      }

      // Update status
      set({
        accountStatus: {
          accountExists: true,
          hasTrustline: true,
          isReady: true,
          isSettingUp: false,
          lastChecked: Date.now(),
        },
      });

      console.log('[UserStore] Account setup complete!');

      return {
        success: true,
        accountActivated,
        trustlineCreated,
      };
    } catch (error: any) {
      console.error('[UserStore] Account setup failed:', error);

      set(state => ({
        accountStatus: { ...state.accountStatus, isSettingUp: false },
      }));

      return {
        success: false,
        accountActivated,
        trustlineCreated,
        error: error.message || 'Unknown error',
      };
    }
  },

  loadUser: async () => {
    try {
      set({ isLoading: true });

      const userData = await secureStorage.getUserData();

      if (userData) {
        set({ user: userData });
      } else if (stellarService.isInitialized()) {
        // Create new user with initial score of 50
        const newUser: User = {
          publicKey: stellarService.getPublicKey(),
          score: SCORE_CONFIG.INITIAL,
          createdAt: Date.now(),
          totalTandas: 0,
          completedTandas: 0,
          activeDebt: false,
        };

        await secureStorage.saveUserData(newUser);
        set({ user: newUser });
      }

      // Load KYC status
      await get().loadKYCStatus();

      // Load simulated balance (testnet)
      await get().loadSimulatedBalance();

      set({ isLoading: false });
    } catch (error) {
      console.error('[UserStore] Error loading user:', error);
      set({ isLoading: false });
    }
  },

  updateScore: async (delta: number) => {
    const { user } = get();
    if (!user) return;

    const newScore = Math.max(0, Math.min(SCORE_CONFIG.MAX, user.score + delta));
    const updatedUser = { ...user, score: newScore };
    await secureStorage.saveUserData(updatedUser);
    set({ user: updatedUser });
  },

  setActiveDebt: async (hasDebt: boolean) => {
    const { user } = get();
    if (!user) return;

    const updatedUser = { ...user, activeDebt: hasDebt };
    await secureStorage.saveUserData(updatedUser);
    set({ user: updatedUser });
  },

  incrementTandaCount: async () => {
    const { user, updateScore } = get();
    if (!user) return;

    const updatedUser = { ...user, totalTandas: user.totalTandas + 1 };
    await secureStorage.saveUserData(updatedUser);
    set({ user: updatedUser });
    await updateScore(SCORE_RULES.CREATE_TANDA);
  },

  completeTanda: async () => {
    const { user, updateScore } = get();
    if (!user) return;

    const updatedUser = { ...user, completedTandas: user.completedTandas + 1 };
    await secureStorage.saveUserData(updatedUser);
    set({ user: updatedUser });
    await updateScore(SCORE_RULES.COMPLETE_TANDA);
  },

  /**
   * Fetch EURC and XLM balances from Stellar
   */
  fetchBalance: async () => {
    console.log('[UserStore] Fetching balances from Stellar...');

    // In testnet with simulated balance, preserve it
    const state = get();
    if (state.isTestMode() && state._hasSimulatedBalance) {
      console.log('[UserStore] Testnet: Preserving simulated balance:', state.eurcBalance);

      // Still fetch real XLM balance for display
      if (stellarService.isInitialized()) {
        try {
          const balances = await stellarService.getBalances();
          set({ xlmBalance: balances.xlm });
        } catch (e) {
          console.log('[UserStore] Could not fetch XLM balance');
        }
      }
      return;
    }

    if (!stellarService.isInitialized()) {
      console.log('[UserStore] Stellar not initialized');
      set({
        eurcBalance: 0,
        eurcBalanceFormatted: formatEuro(0),
        xlmBalance: 0,
      });
      return;
    }

    try {
      const balances = await stellarService.getBalances();
      console.log('[UserStore] Stellar balances:', balances);

      set({
        eurcBalance: balances.eurc,
        eurcBalanceFormatted: formatEuro(balances.eurc),
        xlmBalance: balances.xlm,
      });
    } catch (error) {
      console.error('[UserStore] Error fetching balance:', error);
      set({
        eurcBalance: 0,
        eurcBalanceFormatted: formatEuro(0),
        xlmBalance: 0,
      });
    }
  },

  addTransaction: (transaction: Transaction) => {
    const { transactions } = get();
    set({ transactions: [transaction, ...transactions].slice(0, 50) });
  },

  /**
   * Apply penalty for permanent deposit failure
   */
  applyDepositFailurePenalty: async (tandaId: string, reason: string) => {
    const { user, updateScore, setActiveDebt, addTransaction } = get();
    if (!user) return;

    console.log('[UserStore] Applying deposit failure penalty:', tandaId, reason);

    await updateScore(SCORE_RULES.NO_DEPOSIT);
    await setActiveDebt(true);

    addTransaction({
      id: `failed_deposit_${tandaId}_${Date.now()}`,
      type: 'deposit',
      amount: 0,
      tandaId,
      tandaName: 'Deposito fallido',
      timestamp: Date.now(),
      status: 'failed',
    });

    console.log('[UserStore] Penalty applied: -25 score, active debt set');
  },

  /**
   * Check if user is blocked from participating (score < 25)
   */
  isBlocked: () => {
    const { user } = get();
    if (!user) return false;
    return user.score < SCORE_CONFIG.BLOCK_THRESHOLD;
  },

  /**
   * Reset all user state
   */
  reset: () => {
    console.log('[UserStore] Resetting all state');
    set({
      user: null,
      eurcBalance: 0,
      eurcBalanceFormatted: formatEuro(0),
      xlmBalance: 0,
      transactions: [],
      isLoading: false,
      kycStatus: 'not_started',
      kycData: null,
      _hasSimulatedBalance: false,
      accountStatus: {
        accountExists: false,
        hasTrustline: false,
        isReady: false,
        isSettingUp: false,
        lastChecked: null,
      },
    });
  },
}));

export { SCORE_RULES, SCORE_CONFIG };

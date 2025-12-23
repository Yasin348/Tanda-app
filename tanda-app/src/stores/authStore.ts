/**
 * Authentication Store
 * Manages wallet creation, recovery, and authentication
 *
 * Uses Stellar Network + Mykobo (SEP-24)
 */

import { create } from 'zustand';
import { secureStorage } from '../services/storage';
import { stellarService } from '../services/stellar';
import { mykoboService } from '../services/mykobo';
import { anchorStellarService } from '../services/anchorStellar';
import { SecuritySettings } from '../types';
import { useUserStore, SCORE_CONFIG } from './userStore';
import { useTandaStore } from './tandaStore';

interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  publicKey: string | null;        // Stellar public key (wallet address)
  securitySettings: SecuritySettings | null;
  onboardingComplete: boolean;
  isNewUser: boolean;

  // Actions
  initialize: () => Promise<void>;
  createAccount: (seed: string, securitySettings: SecuritySettings) => Promise<string>;
  recoverAccount: (seed: string) => Promise<string>;
  authenticate: () => Promise<boolean>;
  authenticateWithPin: (pin: string) => Promise<boolean>;
  recoverSessionData: () => Promise<void>;
  logout: () => Promise<void>;
  setSecuritySettings: (settings: SecuritySettings) => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  isAuthenticated: false,
  isLoading: true,
  publicKey: null,
  securitySettings: null,
  onboardingComplete: false,
  isNewUser: false,

  initialize: async () => {
    console.log('[AuthStore] Initialize started');
    try {
      set({ isLoading: true });

      const onboardingComplete = await secureStorage.isOnboardingComplete();
      const securitySettings = await secureStorage.getSecuritySettings();
      console.log('[AuthStore] Onboarding complete:', onboardingComplete);

      if (onboardingComplete) {
        const seed = await secureStorage.getSeed();
        console.log('[AuthStore] Seed found:', !!seed);

        if (seed) {
          // Initialize Stellar wallet
          const publicKey = stellarService.initializeFromSeed(seed);
          console.log('[AuthStore] Stellar wallet initialized:', publicKey);

          set({
            publicKey,
            securitySettings,
            onboardingComplete: true,
            isAuthenticated: securitySettings?.noProtection || false,
          });
        }
      }

      set({ isLoading: false, onboardingComplete });
      console.log('[AuthStore] Initialize completed');
    } catch (error) {
      console.error('[AuthStore] Error:', error);
      set({ isLoading: false });
    }
  },

  createAccount: async (seed: string, securitySettings: SecuritySettings) => {
    try {
      console.log('[AuthStore] Creating new account...');

      // Clear any previous data
      console.log('[AuthStore] Clearing previous data...');
      await secureStorage.clearAll();

      // Reset user state
      const userStore = useUserStore.getState();
      userStore.reset();
      console.log('[AuthStore] User state reset');

      // Save seed and security settings
      await secureStorage.saveSeed(seed);
      await secureStorage.saveSecuritySettings(securitySettings);

      if (securitySettings.pinEnabled && securitySettings.pinHash) {
        await secureStorage.savePinHash(securitySettings.pinHash);
      }

      // Initialize Stellar wallet
      const publicKey = stellarService.initializeFromSeed(seed);
      console.log('[AuthStore] Stellar wallet created:', publicKey);

      // Check if account exists on Stellar network
      const exists = await stellarService.accountExists();
      console.log('[AuthStore] Account exists on network:', exists);

      // If account exists, check balances
      if (exists) {
        const balances = await stellarService.getBalances();
        console.log('[AuthStore] Balances:', balances);
      }

      // Check anchor health
      const isNewUser = false;
      try {
        const healthy = await anchorStellarService.checkHealth();
        console.log('[AuthStore] Anchor health:', healthy);
      } catch (error) {
        console.warn('[AuthStore] Anchor check failed (may be offline):', error);
      }

      // Save user data
      await secureStorage.saveUserData({
        publicKey,
        score: SCORE_CONFIG.INITIAL,
        createdAt: Date.now(),
        totalTandas: 0,
        completedTandas: 0,
        activeDebt: false,
      });

      await secureStorage.setOnboardingComplete();

      set({
        publicKey,
        securitySettings,
        onboardingComplete: true,
        isAuthenticated: true,
        isNewUser,
      });

      return publicKey;
    } catch (error) {
      console.error('[AuthStore] Error creating account:', error);
      throw error;
    }
  },

  recoverAccount: async (seed: string) => {
    try {
      console.log('[AuthStore] Recovering account...');

      // Initialize Stellar wallet from seed
      const publicKey = stellarService.initializeFromSeed(seed);
      console.log('[AuthStore] Stellar wallet recovered:', publicKey);

      // Save seed
      await secureStorage.saveSeed(seed);

      // Check account on network
      const exists = await stellarService.accountExists();
      console.log('[AuthStore] Account exists:', exists);

      if (exists) {
        const balances = await stellarService.getBalances();
        console.log('[AuthStore] Balances:', balances);
      }

      set({ publicKey });
      return publicKey;
    } catch (error) {
      console.error('[AuthStore] Error recovering account:', error);
      throw error;
    }
  },

  authenticate: async () => {
    const { securitySettings } = get();

    if (!securitySettings) return false;

    if (securitySettings.noProtection) {
      set({ isAuthenticated: true });
      get().recoverSessionData();
      return true;
    }

    if (securitySettings.biometricEnabled) {
      const success = await secureStorage.authenticateWithBiometric();
      if (success) {
        set({ isAuthenticated: true });
        get().recoverSessionData();
        return true;
      }
    }

    return false;
  },

  authenticateWithPin: async (pin: string) => {
    const isValid = await secureStorage.verifyPin(pin);
    if (isValid) {
      set({ isAuthenticated: true });
      get().recoverSessionData();
    }
    return isValid;
  },

  /**
   * Recover all user data after PIN/biometric unlock
   */
  recoverSessionData: async () => {
    console.log('[AuthStore] Recovering session data...');

    const { publicKey } = get();
    if (!publicKey) {
      console.warn('[AuthStore] No publicKey, skipping session recovery');
      return;
    }

    try {
      const userStore = useUserStore.getState();
      const tandaStore = useTandaStore.getState();

      await Promise.all([
        // 1. Load user profile from local storage
        userStore.loadUser(),

        // 2. Fetch balances from Stellar blockchain
        userStore.fetchBalance(),

        // 3. Load KYC status (tries Mykobo/Anchor)
        userStore.loadKYCStatus(),

        // 4. Load tandas from Anchor server
        tandaStore.loadTandas(),
      ]);

      console.log('[AuthStore] Session data recovered successfully');
      console.log('[AuthStore] - Balance:', userStore.eurcBalanceFormatted);
      console.log('[AuthStore] - KYC:', userStore.kycStatus);
      console.log('[AuthStore] - Tandas:', tandaStore.activeTandas.length);
    } catch (error) {
      console.error('[AuthStore] Error recovering session data:', error);
    }
  },

  logout: async () => {
    // Disconnect services
    stellarService.disconnect();
    mykoboService.clearSession();

    // Reset all stores
    useUserStore.getState().reset();
    useTandaStore.getState().reset();

    // Clear all storage
    await secureStorage.clearAll();

    set({
      isAuthenticated: false,
      publicKey: null,
      securitySettings: null,
      onboardingComplete: false,
      isNewUser: false,
    });
  },

  setSecuritySettings: async (settings: SecuritySettings) => {
    await secureStorage.saveSecuritySettings(settings);
    if (settings.pinHash) {
      await secureStorage.savePinHash(settings.pinHash);
    }
    set({ securitySettings: settings });
  },
}));

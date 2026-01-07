/**
 * Anchor Service
 * Communicates with the Tanda Anchor server for gas management and tanda operations
 */

import { ANCHOR_CONFIG, ENV } from '../config/network';

// Types for API requests/responses

export interface CheckGasResponse {
  success: boolean;
  message: string;
  xlmBalance: number;
  needsRefill: boolean;
  isFirstTime?: boolean;
  refilled?: boolean;
  txHash?: string;
  eurcCharged?: number;
  error?: string;
}

// Gas operation types that consume gas on Stellar Network
// KYC: FREE (no commission)
// create_tanda, deposit, advance: €0.05 commission (included in transfer)
export type GasOperationType = 'kyc' | 'create_tanda' | 'deposit' | 'advance';

export interface RequestGasResponse {
  success: boolean;
  message: string;
  operation: GasOperationType;
  gasProvided: number;        // XLM (internal, user doesn't see)
  commissionCharged: number;  // Always 0 - commission is in user's transfer
  isFree: boolean;            // true for KYC (no commission)
  txHash?: string;
  error?: string;
}

export interface GasConfigResponse {
  success: boolean;
  config: {
    initialAmount: number;
    minThreshold: number;
    refillAmount: number;
    refillEurcCost: number;
  };
  anchorPublicKey: string;
}

export interface BalanceResponse {
  success: boolean;
  walletAddress: string;
  xlmBalance: number;
  eurcBalance: number;
  isRegistered: boolean;
  hasPermission: boolean;
  needsRefill: boolean;
}

export interface PermissionCheckResponse {
  success: boolean;
  walletAddress: string;
  hasPermission: boolean;
  anchorPublicKey?: string;
  message?: string;
  error?: string;
}

export interface PermissionInfoResponse {
  success: boolean;
  anchorPublicKey: string;
  permissionType: string;
  description: string;
}

export interface KYCCompletedResponse {
  success: boolean;
  message: string;
  isNewUser: boolean;        // True si es el primer KYC de este usuario
  feeCharged?: number;       // Fee cobrado por KYC (si aplica)
  txHash?: string;           // Hash de la transacción de fee
  error?: string;
}

export interface KYCStatusResponse {
  success: boolean;
  walletAddress: string;
  isKYCVerified: boolean;  // Matches server response field name
  country?: string;
  verifiedAt?: number;
  error?: string;
}

export interface AccountStatusResponse {
  success: boolean;
  publicKey: string;
  accountExists: boolean;
  hasTrustline: boolean;
  balances: {
    xlm: number;
    eurc: number;
  };
  needsActivation: boolean;
  needsTrustline: boolean;
  readyForDeposit: boolean;
  error?: string;
}

export interface AccountActivationResponse {
  success: boolean;
  message: string;
  alreadyActive: boolean;
  txHash?: string;
  error?: string;
  activationFee?: {
    pending: boolean;
    amountEurc: number;
    note?: string;
  };
}

export interface ActivationFeeStatusResponse {
  success: boolean;
  publicKey: string;
  accountActivated: boolean;
  feePending: boolean;
  feeAmount: number;
  feePaidAt?: number;
  error?: string;
}

export interface TrustlineResponse {
  success: boolean;
  txXdr?: string;
  alreadyExists?: boolean;
  message?: string;
  error?: string;
}

export interface SponsorTxResponse {
  success: boolean;
  txHash?: string;
  feePaidXlm?: number;
  error?: string;
}

export interface CreateTandaParams {
  name: string;
  amount: number;           // Amount per cycle in EURC
  maxParticipants: number;
  totalCycles: number;
  cycleDays?: number;       // Deprecated - no fixed cycles in new model
  minScore?: number;        // Minimum reputation score
  creatorWallet: string;
}

export interface TandaResponse {
  success: boolean;
  tanda?: Tanda;
  error?: string;
}

export interface Tanda {
  id: string;
  name: string;
  creator: string;
  amount: number;
  maxParticipants: number;
  currentParticipants: number;
  totalCycles: number;
  currentCycle: number;
  cycleDays: number;
  status: 'waiting' | 'active' | 'completed' | 'cancelled';
  storageAccount: string;   // Stellar Storage Account address
  participants: TandaParticipant[];
  beneficiaryOrder: string[];
  createdAt: number;
}

export interface TandaParticipant {
  walletAddress: string;
  joinedAt: number;
  hasDeposited: boolean;
  hasWithdrawn: boolean;
}

// Payment schedule item (for manual payments with calendar)
export interface PaymentScheduleItem {
  cycle: number;
  dueDate: number;        // Timestamp of when payment is due
  beneficiary: string;    // Wallet address of beneficiary
  status: 'upcoming' | 'pending' | 'completed';
}

export interface PaymentScheduleResponse {
  success: boolean;
  tandaId: string;
  schedule: PaymentScheduleItem[];
  error?: string;
}

export interface NextPaymentResponse {
  success: boolean;
  tandaId: string;
  walletAddress: string;
  nextPayment?: {
    cycle: number;
    dueDate: number;
    amount: number;
    beneficiary: string;
    daysRemaining: number;
    isOverdue: boolean;
  };
  message?: string;
  error?: string;
}

export interface ConfirmDepositResponse {
  success: boolean;
  message?: string;
  tanda?: Tanda;
  error?: string;
}

export interface TandaListResponse {
  success: boolean;
  tandas: Tanda[];
  error?: string;
}

// Retry configuration
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

class AnchorService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = ANCHOR_CONFIG[ENV.current].url;
  }

  /**
   * Make an API request with automatic retries
   */
  private async request<T>(
    method: 'GET' | 'POST',
    endpoint: string,
    body?: object
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        console.log(`[Anchor] ${method} ${endpoint} (attempt ${attempt})`);

        const response = await fetch(url, {
          method,
          headers: {
            'Content-Type': 'application/json',
          },
          body: body ? JSON.stringify(body) : undefined,
        });

        const data = await response.json();

        if (!response.ok) {
          // Create error with code attached for specific error handling
          const error = new Error(data.error || `HTTP ${response.status}`) as Error & { code?: string };
          if (data.code) {
            error.code = data.code;
          }
          throw error;
        }

        return data as T;
      } catch (error: any) {
        lastError = error;
        console.error(`[Anchor] Request failed (attempt ${attempt}):`, error.message);

        if (attempt < MAX_RETRIES) {
          await this.sleep(RETRY_DELAY_MS * attempt);
        }
      }
    }

    throw lastError || new Error('Request failed after retries');
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ==================== GAS MANAGEMENT ====================

  /**
   * Check and manage user's gas (XLM) - LEGACY
   * - First time: sends FREE XLM
   * - Refill: charges EURC, sends XLM
   * @deprecated Use requestGas instead for proper commission charging
   */
  async checkGas(walletAddress: string): Promise<CheckGasResponse> {
    return this.request<CheckGasResponse>('POST', '/api/check-gas', {
      walletAddress,
    });
  }

  /**
   * Request gas for a specific operation
   * This is the proper way to request gas - charges commission per operation
   * - First operation: FREE gas
   * - Subsequent operations: charges commission + sends gas
   */
  async requestGas(walletAddress: string, operation: GasOperationType): Promise<RequestGasResponse> {
    return this.request<RequestGasResponse>('POST', '/api/gas/request', {
      walletAddress,
      operation,
    });
  }

  /**
   * Get gas configuration and Anchor's public key
   */
  async getGasConfig(): Promise<GasConfigResponse> {
    return this.request<GasConfigResponse>('GET', '/api/gas/config');
  }

  /**
   * Get user's current balances
   */
  async getBalance(walletAddress: string): Promise<BalanceResponse> {
    return this.request<BalanceResponse>('GET', `/api/gas/balance/${walletAddress}`);
  }

  /**
   * Get Anchor's public key (needed for granting permissions)
   */
  async getAnchorPublicKey(): Promise<string> {
    const config = await this.getGasConfig();
    return config.anchorPublicKey;
  }

  /**
   * Check if user has granted SEND_ON_BEHALF permission to Anchor
   */
  async checkPermission(walletAddress: string): Promise<PermissionCheckResponse> {
    return this.request<PermissionCheckResponse>('GET', `/api/gas/permission/check/${walletAddress}`);
  }

  /**
   * Get permission info (Anchor public key and description)
   */
  async getPermissionInfo(): Promise<PermissionInfoResponse> {
    return this.request<PermissionInfoResponse>('GET', '/api/gas/permission/info');
  }

  // ==================== KYC ====================

  /**
   * Get KYC status from Anchor server
   * Used to sync KYC status after PIN login
   */
  async getKYCStatus(walletAddress: string): Promise<KYCStatusResponse> {
    console.log('[Anchor] Getting KYC status for wallet:', walletAddress);
    return this.request<KYCStatusResponse>('GET', `/api/kyc/status/${walletAddress}`);
  }

  /**
   * Report KYC completed to backend
   * - Registers new user with KYC approved
   * - Backend can charge KYC fee if configured
   * - Backend contabilizes new verified user
   */
  async reportKYCCompleted(
    walletAddress: string,
    country: string,
    kycData?: {
      firstName?: string;
      lastName?: string;
      email?: string;
    }
  ): Promise<KYCCompletedResponse> {
    console.log('[Anchor] Reporting KYC completed for wallet:', walletAddress);
    return this.request<KYCCompletedResponse>('POST', '/api/kyc/completed', {
      walletAddress,
      country,
      ...kycData,
      completedAt: Date.now(),
    });
  }

  // ==================== ACCOUNT ACTIVATION ====================

  /**
   * Check account status on Stellar network
   */
  async getAccountStatus(walletAddress: string): Promise<AccountStatusResponse> {
    return this.request<AccountStatusResponse>('GET', `/api/users/account/status/${walletAddress}`);
  }

  /**
   * Activate a Stellar account (creates with minimum XLM)
   * Called automatically on KYC completion, but can be called manually
   */
  async activateAccount(walletAddress: string): Promise<AccountActivationResponse> {
    return this.request<AccountActivationResponse>('POST', '/api/users/account/activate', {
      publicKey: walletAddress,
    });
  }

  /**
   * Get trustline transaction XDR for user to sign
   */
  async getTrustlineTransaction(walletAddress: string): Promise<TrustlineResponse> {
    return this.request<TrustlineResponse>('POST', '/api/users/account/trustline', {
      publicKey: walletAddress,
    });
  }

  /**
   * Get activation fee status for a user
   */
  async getActivationFeeStatus(walletAddress: string): Promise<ActivationFeeStatusResponse> {
    return this.request<ActivationFeeStatusResponse>('GET', `/api/users/account/activation-fee/${walletAddress}`);
  }

  /**
   * Submit a signed transaction for fee-bump sponsorship
   */
  async sponsorTransaction(signedTxXdr: string, operation: string): Promise<SponsorTxResponse> {
    return this.request<SponsorTxResponse>('POST', '/api/sponsor/tx', {
      txXdr: signedTxXdr,
      operation,
    });
  }

  // ==================== TANDA OPERATIONS ====================

  /**
   * Create a new tanda
   */
  async createTanda(params: CreateTandaParams): Promise<TandaResponse> {
    return this.request<TandaResponse>('POST', '/api/tanda/create', params);
  }

  /**
   * Join an existing tanda
   */
  async joinTanda(tandaId: string, walletAddress: string): Promise<TandaResponse> {
    return this.request<TandaResponse>('POST', '/api/tanda/join', {
      tandaId,
      walletAddress,
    });
  }

  /**
   * Get all tandas (optionally filter by status)
   */
  async getTandas(status?: 'waiting' | 'active' | 'completed'): Promise<TandaListResponse> {
    const endpoint = status
      ? `/api/tanda/list?status=${status}`
      : '/api/tanda/list';
    return this.request<TandaListResponse>('GET', endpoint);
  }

  /**
   * Get a specific tanda by ID
   */
  async getTanda(tandaId: string): Promise<TandaResponse> {
    return this.request<TandaResponse>('GET', `/api/tanda/${tandaId}`);
  }

  /**
   * Confirm a deposit to a tanda (manual payment flow)
   * Called after the user has transferred EURC to the Storage Account
   * @param tandaId - The tanda ID
   * @param walletAddress - The user's wallet address
   * @param txHash - The transaction hash from the EURC transfer
   */
  async confirmDeposit(tandaId: string, walletAddress: string, txHash: string): Promise<ConfirmDepositResponse> {
    return this.request<ConfirmDepositResponse>('POST', `/api/tanda/${tandaId}/confirm-deposit`, {
      walletAddress,
      txHash,
    });
  }

  /**
   * Get the payment schedule for a tanda
   * Returns all scheduled payments with dates and beneficiaries
   */
  async getPaymentSchedule(tandaId: string): Promise<PaymentScheduleResponse> {
    return this.request<PaymentScheduleResponse>('GET', `/api/tanda/${tandaId}/schedule`);
  }

  /**
   * Get the next payment due for a user in a tanda
   */
  async getNextPayment(tandaId: string, walletAddress: string): Promise<NextPaymentResponse> {
    return this.request<NextPaymentResponse>('GET', `/api/tanda/${tandaId}/next-payment/${walletAddress}`);
  }

  /**
   * Get the EURC balance of a tanda's Storage Account
   */
  async getTandaBalance(tandaId: string): Promise<{ success: boolean; balance: number; error?: string }> {
    return this.request<{ success: boolean; balance: number; error?: string }>('GET', `/api/tanda/${tandaId}/balance`);
  }

  /**
   * Process payout for current cycle's beneficiary
   * Only the Anchor can trigger this (called automatically or by admin)
   */
  async processPayout(tandaId: string): Promise<TandaResponse> {
    return this.request<TandaResponse>('POST', `/api/tanda/${tandaId}/payout`, {});
  }

  /**
   * Leave a tanda (only if not started yet)
   */
  async leaveTanda(tandaId: string, walletAddress: string): Promise<TandaResponse> {
    return this.request<TandaResponse>('POST', `/api/tanda/${tandaId}/leave`, {
      walletAddress,
    });
  }

  // ==================== USER INFO ====================

  /**
   * Get display names for multiple users (for participant lists)
   */
  async getUsersBatch(publicKeys: string[]): Promise<{
    success: boolean;
    users: Record<string, { displayName: string | null; kycVerified: boolean }>;
    error?: string;
  }> {
    console.log('[Anchor] getUsersBatch called with:', publicKeys);
    const result = await this.request<{
      success: boolean;
      users: Record<string, { displayName: string | null; kycVerified: boolean }>;
      error?: string;
    }>('POST', '/api/users/batch', { publicKeys });
    console.log('[Anchor] getUsersBatch result:', JSON.stringify(result));
    return result;
  }

  // ==================== HELPERS ====================

  /**
   * Check if Anchor server is reachable
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/health`);
      const data = await response.json();
      return data.status === 'ok';
    } catch {
      return false;
    }
  }

  /**
   * Get the current Anchor URL
   */
  getAnchorUrl(): string {
    return this.baseUrl;
  }

  /**
   * Update the base URL (useful for testing)
   */
  setBaseUrl(url: string): void {
    this.baseUrl = url;
  }
}

// Export singleton instance
export const anchorService = new AnchorService();

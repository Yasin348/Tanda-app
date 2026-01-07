/**
 * Anchor Stellar Service
 *
 * Client for the Tanda Anchor backend.
 * Handles fee sponsorship and user tracking.
 */

import { stellarService } from './stellar';

// ==================== CONFIGURATION ====================

const ANCHOR_CONFIG = {
  // Backend URL - Fly.io production
  baseUrl: __DEV__
    ? 'http://localhost:3001'
    : 'https://tanda-anchor.fly.dev',
};

// ==================== TYPES ====================

export interface SponsorResult {
  success: boolean;
  txHash?: string;
  feePaidXlm?: number;
  error?: string;
}

export interface SponsorStatus {
  publicKey: string;
  xlmBalance: number;
  eurcBalance: number;
  isLowBalance: boolean;
  totalTxSponsored: number;
  totalXlmSpent: number;
}

export interface OperationFee {
  operation: string;
  description: string;
  commission: number;
  isFree: boolean;
}

export interface KycReportResult {
  success: boolean;
  message?: string;
  error?: string;
}

export interface UserProfile {
  publicKey: string;
  kycVerified: boolean;
  kycProvider?: string;
  kycDate?: string;
  country?: string;
  tandasJoined: number;
  tandasCreated: number;
  totalContributions: number;
  createdAt: string;
  updatedAt: string;
}

// ==================== SERVICE ====================

class AnchorStellarService {
  private static instance: AnchorStellarService;

  private constructor() {}

  static getInstance(): AnchorStellarService {
    if (!AnchorStellarService.instance) {
      AnchorStellarService.instance = new AnchorStellarService();
    }
    return AnchorStellarService.instance;
  }

  // ==================== SPONSORSHIP ====================

  /**
   * Submit a transaction for sponsorship
   * The backend will fee-bump and submit to network
   */
  async sponsorTransaction(
    txXdr: string,
    operation: string
  ): Promise<SponsorResult> {
    const publicKey = stellarService.getPublicKey();

    try {
      console.log(`[Anchor] Requesting sponsorship for ${operation}...`);

      const response = await fetch(`${ANCHOR_CONFIG.baseUrl}/api/sponsor/tx`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          txXdr,
          userPublicKey: publicKey,
          operation,
        }),
      });

      const data = await response.json() as SponsorResult;

      if (data.success) {
        console.log(`[Anchor] Transaction sponsored: ${data.txHash}`);
      } else {
        console.error(`[Anchor] Sponsorship failed: ${data.error}`);
      }

      return data;
    } catch (error: any) {
      console.error('[Anchor] Sponsorship error:', error);
      return {
        success: false,
        error: error?.message || 'Network error',
      };
    }
  }

  /**
   * Get sponsor wallet status
   */
  async getSponsorStatus(): Promise<SponsorStatus | null> {
    try {
      const response = await fetch(
        `${ANCHOR_CONFIG.baseUrl}/api/sponsor/status`
      );

      if (!response.ok) {
        throw new Error(`Status request failed: ${response.status}`);
      }

      const data = await response.json() as { status: SponsorStatus };
      return data.status;
    } catch (error) {
      console.error('[Anchor] Status error:', error);
      return null;
    }
  }

  // ==================== FEES ====================

  /**
   * Get all operation fees
   */
  async getAllFees(): Promise<OperationFee[]> {
    try {
      const response = await fetch(`${ANCHOR_CONFIG.baseUrl}/api/sponsor/fees`);

      if (!response.ok) {
        throw new Error(`Fees request failed: ${response.status}`);
      }

      const data = await response.json() as { fees: OperationFee[] };
      return data.fees;
    } catch (error) {
      console.error('[Anchor] Fees error:', error);
      return [];
    }
  }

  /**
   * Get fee for a specific operation
   */
  async getOperationFee(operation: string): Promise<OperationFee | null> {
    try {
      const response = await fetch(
        `${ANCHOR_CONFIG.baseUrl}/api/sponsor/fee/${operation}`
      );

      if (!response.ok) {
        throw new Error(`Fee request failed: ${response.status}`);
      }

      const data = await response.json() as { fee: OperationFee };
      return data.fee;
    } catch (error) {
      console.error('[Anchor] Fee error:', error);
      return null;
    }
  }

  // ==================== KYC ====================

  /**
   * Report KYC completion to backend
   */
  async reportKycCompleted(
    provider: string,
    country?: string
  ): Promise<KycReportResult> {
    const publicKey = stellarService.getPublicKey();

    try {
      console.log('[Anchor] Reporting KYC completion...');

      const response = await fetch(`${ANCHOR_CONFIG.baseUrl}/api/users/kyc`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          publicKey,
          provider,
          country,
        }),
      });

      const data = await response.json() as KycReportResult;

      if (data.success) {
        console.log('[Anchor] KYC reported successfully');
      }

      return data;
    } catch (error: any) {
      console.error('[Anchor] KYC report error:', error);
      return {
        success: false,
        error: error?.message || 'Network error',
      };
    }
  }

  /**
   * Get KYC status from backend
   */
  async getKycStatus(): Promise<{
    verified: boolean;
    provider?: string;
    date?: string;
  }> {
    const publicKey = stellarService.getPublicKey();

    try {
      const response = await fetch(
        `${ANCHOR_CONFIG.baseUrl}/api/users/kyc/status/${publicKey}`
      );

      if (!response.ok) {
        return { verified: false };
      }

      const data = await response.json() as {
        verified: boolean;
        provider?: string;
        date?: string;
      };

      return data;
    } catch (error) {
      console.error('[Anchor] KYC status error:', error);
      return { verified: false };
    }
  }

  // ==================== USER PROFILE ====================

  /**
   * Get user profile from backend
   */
  async getUserProfile(): Promise<UserProfile | null> {
    const publicKey = stellarService.getPublicKey();

    try {
      const response = await fetch(
        `${ANCHOR_CONFIG.baseUrl}/api/users/${publicKey}`
      );

      if (!response.ok) {
        return null;
      }

      const data = await response.json() as { user: UserProfile };
      return data.user;
    } catch (error) {
      console.error('[Anchor] Profile error:', error);
      return null;
    }
  }

  /**
   * Update user profile
   */
  async updateUserProfile(updates: {
    tandasJoined?: number;
    tandasCreated?: number;
    totalContributions?: number;
  }): Promise<boolean> {
    const publicKey = stellarService.getPublicKey();

    try {
      const response = await fetch(
        `${ANCHOR_CONFIG.baseUrl}/api/users/${publicKey}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(updates),
        }
      );

      return response.ok;
    } catch (error) {
      console.error('[Anchor] Profile update error:', error);
      return false;
    }
  }

  // ==================== HEALTH ====================

  /**
   * Check if anchor backend is healthy
   */
  async checkHealth(): Promise<boolean> {
    try {
      const response = await fetch(`${ANCHOR_CONFIG.baseUrl}/health`);
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Get anchor status with stats
   */
  async getAnchorStatus(): Promise<{
    status: string;
    network: string;
    sponsorHealthy: boolean;
    stats: {
      totalTxSponsored: number;
      totalXlmSpent: number;
      totalEurcCommissions: number;
      totalKycUsers: number;
    };
  } | null> {
    try {
      const response = await fetch(
        `${ANCHOR_CONFIG.baseUrl}/api/anchor/status`
      );

      if (!response.ok) {
        return null;
      }

      return await response.json();
    } catch (error) {
      console.error('[Anchor] Status error:', error);
      return null;
    }
  }

  // ==================== HELPERS ====================

  /**
   * Get the backend base URL
   */
  getBaseUrl(): string {
    return ANCHOR_CONFIG.baseUrl;
  }

  /**
   * Set custom backend URL (for testing)
   */
  setBaseUrl(url: string): void {
    (ANCHOR_CONFIG as any).baseUrl = url;
  }
}

// Export singleton instance
export const anchorStellarService = AnchorStellarService.getInstance();

/**
 * Stellar Service
 * Handles Stellar/Horizon interactions
 */

import {
  Keypair,
  Horizon,
  Asset,
  TransactionBuilder,
  Operation,
  Memo,
} from '@stellar/stellar-sdk';
import { STELLAR_CONFIG, EURC_CONFIG, stroopsToXlm } from '../config/index.js';

const horizon = new Horizon.Server(STELLAR_CONFIG.horizonUrl);

class StellarService {
  private sponsorKeypair: Keypair;

  constructor() {
    this.sponsorKeypair = Keypair.fromSecret(STELLAR_CONFIG.sponsorSecret);
  }

  /**
   * Get sponsor public key
   */
  getSponsorPublicKey(): string {
    return this.sponsorKeypair.publicKey();
  }

  /**
   * Get sponsor keypair (for signing)
   */
  getSponsorKeypair(): Keypair {
    return this.sponsorKeypair;
  }

  /**
   * Get account balances
   */
  async getAccountBalances(publicKey: string): Promise<{
    xlm: number;
    eurc: number;
  }> {
    try {
      const account = await horizon.loadAccount(publicKey);

      const xlmBalance = account.balances.find(b => b.asset_type === 'native');
      const eurcBalance = account.balances.find(
        b => b.asset_type !== 'native' &&
             'asset_code' in b &&
             b.asset_code === EURC_CONFIG.code &&
             b.asset_issuer === EURC_CONFIG.issuer
      );

      return {
        xlm: parseFloat(xlmBalance?.balance || '0'),
        eurc: eurcBalance && 'balance' in eurcBalance ? parseFloat(eurcBalance.balance) : 0,
      };
    } catch (error: any) {
      if (error.response?.status === 404) {
        // Account doesn't exist yet
        return { xlm: 0, eurc: 0 };
      }
      throw error;
    }
  }

  /**
   * Get sponsor wallet balances
   */
  async getSponsorBalances(): Promise<{ xlm: number; eurc: number }> {
    return this.getAccountBalances(this.sponsorKeypair.publicKey());
  }

  /**
   * Check if account exists
   */
  async accountExists(publicKey: string): Promise<boolean> {
    try {
      await horizon.loadAccount(publicKey);
      return true;
    } catch (error: any) {
      if (error.response?.status === 404) {
        return false;
      }
      throw error;
    }
  }

  /**
   * Check if account has EURC trustline
   */
  async hasEurcTrustline(publicKey: string): Promise<boolean> {
    try {
      const account = await horizon.loadAccount(publicKey);
      return account.balances.some(
        b => b.asset_type !== 'native' &&
             'asset_code' in b &&
             b.asset_code === EURC_CONFIG.code &&
             b.asset_issuer === EURC_CONFIG.issuer
      );
    } catch {
      return false;
    }
  }

  /**
   * Get EURC asset
   */
  getEurcAsset(): Asset {
    return new Asset(EURC_CONFIG.code, EURC_CONFIG.issuer);
  }

  /**
   * Get Horizon server
   */
  getHorizon(): Horizon.Server {
    return horizon;
  }

  /**
   * Get network passphrase
   */
  getNetworkPassphrase(): string {
    return STELLAR_CONFIG.networkPassphrase;
  }

  /**
   * Submit a transaction
   */
  async submitTransaction(txXdr: string): Promise<Horizon.HorizonApi.SubmitTransactionResponse> {
    const tx = TransactionBuilder.fromXDR(txXdr, STELLAR_CONFIG.networkPassphrase);
    return horizon.submitTransaction(tx);
  }

  /**
   * Get recent transactions for an account
   */
  async getRecentTransactions(publicKey: string, limit = 10): Promise<any[]> {
    try {
      const transactions = await horizon
        .transactions()
        .forAccount(publicKey)
        .order('desc')
        .limit(limit)
        .call();
      return transactions.records;
    } catch {
      return [];
    }
  }

  // ==================== ACCOUNT ACTIVATION ====================

  /**
   * Stellar minimum reserves (as of 2024):
   * - Base reserve: 0.5 XLM (account to exist)
   * - Per entry (trustline, offer, etc.): 0.5 XLM
   *
   * We use 1 XLM = 0.5 base + 0.5 for one trustline (EURC)
   */
  private readonly MIN_ACCOUNT_BALANCE = '1';

  /**
   * Activate a new user account on Stellar
   * Creates the account with minimum XLM (1 XLM = base + 1 trustline reserve)
   *
   * @param userPublicKey - The user's Stellar public key
   * @returns Transaction result with hash
   */
  async activateAccount(userPublicKey: string): Promise<{
    success: boolean;
    txHash?: string;
    error?: string;
    alreadyActive?: boolean;
  }> {
    try {
      console.log(`[Stellar] Activating account: ${userPublicKey.slice(0, 8)}...`);

      // Check if account already exists
      const exists = await this.accountExists(userPublicKey);
      if (exists) {
        console.log('[Stellar] Account already exists');

        // Check if trustline exists
        const hasTrustline = await this.hasEurcTrustline(userPublicKey);
        if (hasTrustline) {
          return { success: true, alreadyActive: true };
        }

        // Account exists but no trustline - we can still create it
        console.log('[Stellar] Account exists, creating trustline...');
        return this.createSponsoredTrustline(userPublicKey);
      }

      // Load sponsor account for sequence number
      const sponsorAccount = await horizon.loadAccount(this.sponsorKeypair.publicKey());

      // Create account with minimum balance (1 XLM)
      // This covers base reserve (0.5) + trustline reserve (0.5)
      const createAccountTx = new TransactionBuilder(sponsorAccount, {
        fee: '100000', // 0.01 XLM max fee
        networkPassphrase: STELLAR_CONFIG.networkPassphrase,
      })
        .addOperation(Operation.createAccount({
          destination: userPublicKey,
          startingBalance: this.MIN_ACCOUNT_BALANCE,
        }))
        .setTimeout(30)
        .build();

      createAccountTx.sign(this.sponsorKeypair);

      // Submit account creation
      const createResult = await horizon.submitTransaction(createAccountTx);
      console.log(`[Stellar] Account created! Hash: ${createResult.hash}`);

      // Now create the trustline (user account now exists)
      // We'll build a transaction that the user would need to sign
      // But since we just created the account, we can use a workaround:
      // Send the trustline XDR for the user to sign later, or
      // If user has provided a pre-signed tx, use that

      return {
        success: true,
        txHash: createResult.hash,
      };
    } catch (error: any) {
      console.error('[Stellar] Error activating account:', error);

      let errorMessage = error.message || 'Unknown error';
      if (error.response?.data?.extras?.result_codes) {
        errorMessage = JSON.stringify(error.response.data.extras.result_codes);
      }

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Build a trustline transaction for user to sign
   * Returns the XDR that the user needs to sign
   */
  async buildTrustlineTransaction(userPublicKey: string): Promise<{
    success: boolean;
    txXdr?: string;
    error?: string;
  }> {
    try {
      // Load user account for sequence number
      const userAccount = await horizon.loadAccount(userPublicKey);

      // Build changeTrust transaction
      const trustlineTx = new TransactionBuilder(userAccount, {
        fee: '100', // Minimal fee, will be fee-bumped by sponsor
        networkPassphrase: STELLAR_CONFIG.networkPassphrase,
      })
        .addOperation(Operation.changeTrust({
          asset: this.getEurcAsset(),
        }))
        .setTimeout(300) // 5 minutes for user to sign
        .build();

      return {
        success: true,
        txXdr: trustlineTx.toXDR(),
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Create EURC trustline for an existing account
   * This builds a tx for the user to sign, then sponsors it
   */
  async createSponsoredTrustline(userPublicKey: string): Promise<{
    success: boolean;
    txHash?: string;
    txXdr?: string;
    error?: string;
    alreadyActive?: boolean;
  }> {
    try {
      // Check if trustline already exists
      const hasTrustline = await this.hasEurcTrustline(userPublicKey);
      if (hasTrustline) {
        return { success: true, alreadyActive: true };
      }

      // Build the transaction for user to sign
      const buildResult = await this.buildTrustlineTransaction(userPublicKey);
      if (!buildResult.success) {
        return { success: false, error: buildResult.error };
      }

      // Return XDR for user to sign
      // The user will sign this and send it back for fee-bump sponsorship
      return {
        success: true,
        txXdr: buildResult.txXdr,
        error: 'User signature required - return signed XDR to /api/sponsor/tx',
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Check if an account needs activation
   */
  async needsActivation(publicKey: string): Promise<boolean> {
    return !(await this.accountExists(publicKey));
  }
}

export const stellarService = new StellarService();

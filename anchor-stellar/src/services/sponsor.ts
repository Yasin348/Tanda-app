/**
 * Sponsor Service
 * Handles fee-bump transactions for gasless user experience
 */

import {
  Keypair,
  TransactionBuilder,
  Transaction,
  FeeBumpTransaction,
} from '@stellar/stellar-sdk';
import { STELLAR_CONFIG, GAS_CONFIG, stroopsToXlm } from '../config/index.js';
import { stellarService } from './stellar.js';
import { statsService } from './stats.js';
import type { SponsorResult, SponsorInfo } from '../types/index.js';

class SponsorService {
  /**
   * Sponsor a user's transaction using fee-bump
   */
  async sponsorTransaction(
    userTxXdr: string,
    userPublicKey: string,
    operation: string
  ): Promise<SponsorResult> {
    try {
      console.log(`[Sponsor] Sponsoring ${operation} for ${userPublicKey.slice(0, 8)}...`);

      // Decode user's transaction
      const userTx = TransactionBuilder.fromXDR(
        userTxXdr,
        STELLAR_CONFIG.networkPassphrase
      );

      // Verify it's a Transaction (not FeeBumpTransaction)
      if (!(userTx instanceof Transaction)) {
        return {
          success: false,
          error: 'Expected a regular transaction, not a fee-bump transaction',
        };
      }

      // Verify source matches claimed user
      if (userTx.source !== userPublicKey) {
        return {
          success: false,
          error: 'Transaction source does not match user',
        };
      }

      // Create fee-bump transaction
      const sponsorKeypair = stellarService.getSponsorKeypair();
      const feeBumpTx = TransactionBuilder.buildFeeBumpTransaction(
        sponsorKeypair,
        GAS_CONFIG.maxFeeStroops.toString(),
        userTx,
        STELLAR_CONFIG.networkPassphrase
      );

      // Sign with sponsor key
      feeBumpTx.sign(sponsorKeypair);

      // Submit to network
      const horizon = stellarService.getHorizon();
      const result = await horizon.submitTransaction(feeBumpTx);

      // Get fee from result (handle different response types)
      const resultAny = result as any;
      const feePaidStroops = parseInt(resultAny.fee_charged || resultAny.feeCharged || '0');
      const feePaidXlm = stroopsToXlm(feePaidStroops);

      // Track stats
      statsService.recordSponsoredTx(userPublicKey, operation, feePaidXlm);

      console.log(`[Sponsor] Success! Fee: ${feePaidXlm.toFixed(7)} XLM, Hash: ${result.hash}`);

      return {
        success: true,
        txHash: result.hash,
        feePaidXlm,
      };
    } catch (error: any) {
      console.error('[Sponsor] Error:', error);

      // Parse Horizon error
      let errorMessage = error.message || 'Unknown error';
      if (error.response?.data?.extras?.result_codes) {
        const codes = error.response.data.extras.result_codes;
        errorMessage = `Transaction failed: ${JSON.stringify(codes)}`;
      }

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Get sponsor wallet info
   */
  async getSponsorInfo(): Promise<SponsorInfo | null> {
    try {
      const balances = await stellarService.getSponsorBalances();

      return {
        publicKey: stellarService.getSponsorPublicKey(),
        xlmBalance: balances.xlm,
        eurcBalance: balances.eurc,
        isLowBalance: balances.xlm < GAS_CONFIG.minSponsorBalance,
      };
    } catch (error) {
      console.error('[Sponsor] Error getting info:', error);
      return null;
    }
  }

  /**
   * Get sponsor public key
   */
  getSponsorPublicKey(): string {
    return stellarService.getSponsorPublicKey();
  }

  /**
   * Check if sponsor has enough balance
   */
  async hasEnoughBalance(): Promise<boolean> {
    const info = await this.getSponsorInfo();
    return info ? !info.isLowBalance : false;
  }
}

export const sponsorService = new SponsorService();

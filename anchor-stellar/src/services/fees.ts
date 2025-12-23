/**
 * Fees Service
 * Commission model for tanda operations
 *
 * === TWO PERSPECTIVES ===
 * 1. USER COST: Commission in EURC (what users pay)
 * 2. SPONSOR COST: Gas in XLM (what we pay for fee-bump)
 *
 * === GAS HANDLING ===
 * - Gas (XLM) is handled via fee-bump sponsorship
 * - User never needs XLM
 * - Sponsor pays all transaction fees
 */

import { GAS_CONFIG } from '../config/index.js';
import { priceService } from './price.js';
import type { GasOperation, OperationFee } from '../types/index.js';

// Fee configuration per operation (simplified model)
// gasXlm = Real Soroban gas cost (what sponsor pays)
// commissionEurc = What user pays (your revenue)
const OPERATION_CONFIG: Record<GasOperation, {
  gasXlm: number;         // REAL sponsor cost in XLM
  commissionEurc: number; // User cost (commission)
  nameEs: string;
}> = {
  // === OFF-CHAIN (Backend only) ===
  kyc: {
    gasXlm: 0,            // Mykobo handles externally
    commissionEurc: 0,
    nameEs: 'Verificación KYC',
  },

  // === ON-CHAIN: TANDA LIFECYCLE ===
  // Values measured from REAL testnet transactions (Dec 2024)
  create_tanda: {
    gasXlm: 0.02,         // Real: 191,367 stroops = 0.0191 XLM
    commissionEurc: GAS_CONFIG.commissionEurc,
    nameEs: 'Crear tanda',
  },
  deposit: {
    gasXlm: 0.02,         // Real: 188,069 stroops = 0.0188 XLM
    commissionEurc: GAS_CONFIG.commissionEurc,
    nameEs: 'Depósito',
  },
  advance: {
    gasXlm: 0.01,         // Real: 77,991 stroops = 0.0078 XLM (payout only)
    commissionEurc: 0,    // GRATIS - incentiva que alguien avance la tanda
    nameEs: 'Avanzar tanda',
  },
};

class FeesService {
  /**
   * Get fee info for a specific operation
   */
  async getOperationFee(operation: GasOperation): Promise<OperationFee> {
    const config = OPERATION_CONFIG[operation];
    if (!config) {
      throw new Error(`Unknown operation: ${operation}`);
    }

    const xlmPrice = await priceService.getXlmPriceInEur();
    const sponsorCostEur = config.gasXlm * xlmPrice;

    return {
      operation,
      nameEs: config.nameEs,
      // User perspective (what they pay you)
      userCostEurc: config.commissionEurc,
      isFreeForUser: config.commissionEurc === 0,
      // Sponsor perspective (what it costs you)
      sponsorCostXlm: config.gasXlm,
      sponsorCostEur: sponsorCostEur,
    };
  }

  /**
   * Get all operation fees
   */
  async getAllFees(): Promise<OperationFee[]> {
    const operations = Object.keys(OPERATION_CONFIG) as GasOperation[];
    return Promise.all(operations.map(op => this.getOperationFee(op)));
  }

  /**
   * Check if operation has fee for user
   */
  operationHasFee(operation: GasOperation): boolean {
    return (OPERATION_CONFIG[operation]?.commissionEurc ?? 0) > 0;
  }

  /**
   * Get fees summary for dashboard - separated by perspective
   */
  async getFeesSummary(): Promise<{
    userView: { operation: string; cost: string }[];
    sponsorView: { operation: string; costXlm: number; costEur: number }[];
    totals: {
      xlmPriceEur: number;
      totalSponsorCostXlm: number;
      totalSponsorCostEur: number;
      avgCostPerTxXlm: number;
      avgCostPerTxEur: number;
    };
  }> {
    const xlmPrice = await priceService.getXlmPriceInEur();
    const allFees = await this.getAllFees();

    // User view: What users pay (your revenue)
    const userView = allFees.map(fee => ({
      operation: fee.nameEs,
      cost: fee.isFreeForUser ? 'GRATIS' : `€${fee.userCostEurc.toFixed(2)}`,
    }));

    // Sponsor view: What it costs you in gas
    const sponsorView = allFees
      .filter(fee => fee.sponsorCostXlm > 0)
      .map(fee => ({
        operation: fee.nameEs,
        costXlm: fee.sponsorCostXlm,
        costEur: fee.sponsorCostEur,
      }));

    // Calculate totals (your real costs)
    const totalXlm = Object.values(OPERATION_CONFIG)
      .reduce((sum, op) => sum + op.gasXlm, 0);
    const operationsWithGas = Object.values(OPERATION_CONFIG)
      .filter(op => op.gasXlm > 0).length;
    const avgXlm = operationsWithGas > 0 ? totalXlm / operationsWithGas : 0;

    return {
      userView,
      sponsorView,
      totals: {
        xlmPriceEur: xlmPrice,
        totalSponsorCostXlm: totalXlm,
        totalSponsorCostEur: totalXlm * xlmPrice,
        avgCostPerTxXlm: avgXlm,
        avgCostPerTxEur: avgXlm * xlmPrice,
      },
    };
  }
}

export const feesService = new FeesService();

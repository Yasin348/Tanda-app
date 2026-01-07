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

import { priceService } from './price.js';
import type { GasOperation, OperationFee } from '../types/index.js';

// Fee configuration per operation (simplified model)
// gasXlm = Real Soroban gas cost (what sponsor pays)
// commissionEurc = What user pays (charged by smart contract)
// commissionPercent = Percentage commission (for deposits)
const OPERATION_CONFIG: Record<GasOperation, {
  gasXlm: number;           // REAL sponsor cost in XLM
  commissionEurc: number;   // Fixed user cost in EURC (for create_tanda)
  commissionPercent: number; // Percentage cost (for deposits, 0.5 = 0.5%)
  nameEs: string;
}> = {
  // === OFF-CHAIN (Backend only) ===
  kyc: {
    gasXlm: 0,              // Mykobo handles externally
    commissionEurc: 0,
    commissionPercent: 0,
    nameEs: 'Verificación KYC',
  },

  // === ON-CHAIN: TANDA LIFECYCLE ===
  // Commissions are charged by the smart contract, not the backend
  create_tanda: {
    gasXlm: 0.02,           // Real: 191,367 stroops = 0.0191 XLM
    commissionEurc: 0.10,   // Fixed 0.10 EURC charged by smart contract
    commissionPercent: 0,
    nameEs: 'Crear tanda',
  },
  deposit: {
    gasXlm: 0.02,           // Real: 188,069 stroops = 0.0188 XLM
    commissionEurc: 0,      // No fixed fee
    commissionPercent: 0.5, // 0.5% charged by smart contract
    nameEs: 'Depósito',
  },
  advance: {
    gasXlm: 0.01,           // Real: 77,991 stroops = 0.0078 XLM (payout only)
    commissionEurc: 0,      // GRATIS - incentiva que alguien avance la tanda
    commissionPercent: 0,
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
    const hasFee = config.commissionEurc > 0 || config.commissionPercent > 0;

    return {
      operation,
      nameEs: config.nameEs,
      // User perspective (what they pay - charged by smart contract)
      userCostEurc: config.commissionEurc,
      userCostPercent: config.commissionPercent,
      isFreeForUser: !hasFee,
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
    const config = OPERATION_CONFIG[operation];
    return (config?.commissionEurc ?? 0) > 0 || (config?.commissionPercent ?? 0) > 0;
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

    // User view: What users pay (charged by smart contract)
    const userView = allFees.map(fee => {
      if (fee.isFreeForUser) {
        return { operation: fee.nameEs, cost: 'GRATIS' };
      }
      if (fee.userCostPercent && fee.userCostPercent > 0) {
        return { operation: fee.nameEs, cost: `${fee.userCostPercent}%` };
      }
      return { operation: fee.nameEs, cost: `€${fee.userCostEurc.toFixed(2)}` };
    });

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

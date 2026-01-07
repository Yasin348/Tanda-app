/**
 * Stats Service
 * Tracks all metrics similar to current backend
 */

import * as fs from 'fs';
import * as path from 'path';
import type { PersistentStats } from '../types/index.js';

// Use DATA_DIR env var (Fly Volume) or local data folder
const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');
const STATS_FILE = path.join(DATA_DIR, 'stats.json');

function loadStats(): PersistentStats {
  try {
    if (fs.existsSync(STATS_FILE)) {
      const content = fs.readFileSync(STATS_FILE, 'utf-8');
      const stats = JSON.parse(content);
      console.log(`[Stats] Loaded: ${stats.totalTxSponsored} tx, €${stats.totalEurcCommissions.toFixed(2)} commissions`);
      return stats;
    }
  } catch (error) {
    console.error('[Stats] Error loading:', error);
  }
  return {
    totalXlmSpent: 0,
    totalEurcCommissions: 0,
    totalTxSponsored: 0,
    operationCount: {},
    registeredUsers: 0,
    kycVerifiedUsers: 0,
    usersByCountry: {},
    lastUpdated: Date.now(),
  };
}

function saveStats(stats: PersistentStats): void {
  try {
    const dataDir = path.dirname(STATS_FILE);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    stats.lastUpdated = Date.now();
    fs.writeFileSync(STATS_FILE, JSON.stringify(stats, null, 2));
  } catch (error) {
    console.error('[Stats] Error saving:', error);
  }
}

class StatsService {
  private stats: PersistentStats;

  constructor() {
    this.stats = loadStats();
  }

  /**
   * Record a sponsored transaction
   */
  recordSponsoredTx(userPublicKey: string, operation: string, xlmFee: number): void {
    this.stats.totalXlmSpent += xlmFee;
    this.stats.totalTxSponsored++;
    this.stats.operationCount[operation] = (this.stats.operationCount[operation] || 0) + 1;
    saveStats(this.stats);
    console.log(`[Stats] Sponsored ${operation} for ${userPublicKey.slice(0, 8)}... Fee: ${xlmFee.toFixed(7)} XLM`);
  }

  /**
   * Record commission collected
   */
  recordCommission(amount: number): void {
    this.stats.totalEurcCommissions += amount;
    saveStats(this.stats);
    console.log(`[Stats] Commission: €${amount.toFixed(2)}. Total: €${this.stats.totalEurcCommissions.toFixed(2)}`);
  }

  /**
   * Record new user registration
   */
  recordNewUser(): void {
    this.stats.registeredUsers++;
    saveStats(this.stats);
    console.log(`[Stats] New user registered. Total: ${this.stats.registeredUsers}`);
  }

  /**
   * Record KYC verified user
   */
  recordKYCVerified(country: string): void {
    this.stats.kycVerifiedUsers++;
    this.stats.usersByCountry[country] = (this.stats.usersByCountry[country] || 0) + 1;
    saveStats(this.stats);
    console.log(`[Stats] KYC verified (${country}). Total: ${this.stats.kycVerifiedUsers}`);
  }

  /**
   * Get all stats
   */
  getStats(): PersistentStats {
    return { ...this.stats };
  }

  /**
   * Get KYC stats
   */
  getKYCStats(): { totalVerified: number; byCountry: Record<string, number> } {
    return {
      totalVerified: this.stats.kycVerifiedUsers,
      byCountry: { ...this.stats.usersByCountry },
    };
  }

  /**
   * Get operation counts
   */
  getOperationCounts(): Record<string, number> {
    return { ...this.stats.operationCount };
  }
}

export const statsService = new StatsService();

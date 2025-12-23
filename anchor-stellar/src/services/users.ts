/**
 * Users Service
 * Manages user records and KYC status
 */

import * as fs from 'fs';
import * as path from 'path';
import { statsService } from './stats.js';
import type { UserRecord, KYCReport } from '../types/index.js';

// Use DATA_DIR env var (Fly Volume) or local data folder
const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');

function loadUsers(): Map<string, UserRecord> {
  try {
    if (fs.existsSync(USERS_FILE)) {
      const content = fs.readFileSync(USERS_FILE, 'utf-8');
      const data = JSON.parse(content);
      console.log(`[Users] Loaded ${Object.keys(data).length} users`);
      return new Map(Object.entries(data));
    }
  } catch (error) {
    console.error('[Users] Error loading:', error);
  }
  return new Map();
}

function saveUsers(users: Map<string, UserRecord>): void {
  try {
    const dataDir = path.dirname(USERS_FILE);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    const data = Object.fromEntries(users);
    fs.writeFileSync(USERS_FILE, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('[Users] Error saving:', error);
  }
}

class UsersService {
  private users: Map<string, UserRecord>;

  constructor() {
    this.users = loadUsers();
  }

  /**
   * Get or create user record
   */
  getOrCreateUser(publicKey: string): UserRecord {
    let user = this.users.get(publicKey);

    if (!user) {
      user = {
        publicKey,
        kycVerified: false,
        registeredAt: Date.now(),
        totalTxSponsored: 0,
        totalXlmSpent: 0,
      };
      this.users.set(publicKey, user);
      saveUsers(this.users);
      statsService.recordNewUser();
    }

    return user;
  }

  /**
   * Get user record
   */
  getUser(publicKey: string): UserRecord | undefined {
    return this.users.get(publicKey);
  }

  /**
   * Check if user exists
   */
  userExists(publicKey: string): boolean {
    return this.users.has(publicKey);
  }

  /**
   * Update user record
   */
  updateUser(publicKey: string, updates: Partial<UserRecord>): UserRecord | null {
    const user = this.users.get(publicKey);
    if (!user) return null;

    const updated = { ...user, ...updates };
    this.users.set(publicKey, updated);
    saveUsers(this.users);
    return updated;
  }

  /**
   * Record KYC verification from Mykobo
   */
  recordKYCVerified(report: KYCReport): UserRecord {
    const user = this.getOrCreateUser(report.publicKey);

    if (!user.kycVerified) {
      user.kycVerified = true;
      user.kycVerifiedAt = report.verifiedAt;
      user.country = report.country;
      this.users.set(report.publicKey, user);
      saveUsers(this.users);
      statsService.recordKYCVerified(report.country);
    }

    return user;
  }

  /**
   * Check if user is KYC verified
   */
  isKYCVerified(publicKey: string): boolean {
    return this.users.get(publicKey)?.kycVerified ?? false;
  }

  /**
   * Get KYC status
   */
  getKYCStatus(publicKey: string): {
    isVerified: boolean;
    country?: string;
    verifiedAt?: number;
  } {
    const user = this.users.get(publicKey);
    return {
      isVerified: user?.kycVerified ?? false,
      country: user?.country,
      verifiedAt: user?.kycVerifiedAt,
    };
  }

  /**
   * Update user after sponsored transaction
   */
  recordSponsoredTx(publicKey: string, xlmFee: number): void {
    const user = this.getOrCreateUser(publicKey);
    user.totalTxSponsored++;
    user.totalXlmSpent += xlmFee;
    this.users.set(publicKey, user);
    saveUsers(this.users);
  }

  /**
   * Set push notification token
   */
  setPushToken(publicKey: string, pushToken: string): void {
    const user = this.getOrCreateUser(publicKey);
    user.pushToken = pushToken;
    this.users.set(publicKey, user);
    saveUsers(this.users);
  }

  /**
   * Get all users count
   */
  getUsersCount(): number {
    return this.users.size;
  }

  /**
   * Get all KYC verified users
   */
  getKYCVerifiedUsers(): UserRecord[] {
    return Array.from(this.users.values()).filter(u => u.kycVerified);
  }

  // ==================== ACTIVATION FEE ====================

  /**
   * Record account activation and pending fee
   * @param publicKey User's public key
   * @param xlmSpent XLM spent to activate (typically 1 XLM)
   * @param xlmPriceEur Current XLM price in EUR (for calculating fee)
   */
  recordAccountActivation(publicKey: string, xlmSpent: number, xlmPriceEur: number = 0.35): void {
    const user = this.getOrCreateUser(publicKey);

    // Calculate EURC fee to recover (add small margin for price fluctuation)
    const feeEurc = Math.ceil(xlmSpent * xlmPriceEur * 100) / 100; // Round up to 2 decimals

    user.accountActivated = true;
    user.activationXlmSpent = xlmSpent;
    user.activationFeeEurc = feeEurc;
    user.activationFeePaid = false;

    this.users.set(publicKey, user);
    saveUsers(this.users);

    console.log(`[Users] Recorded activation for ${publicKey.slice(0, 8)}: ${xlmSpent} XLM = ${feeEurc} EURC pending`);
  }

  /**
   * Check if user has pending activation fee
   */
  hasActivationFeePending(publicKey: string): boolean {
    const user = this.users.get(publicKey);
    return user?.accountActivated === true && user?.activationFeePaid !== true;
  }

  /**
   * Get pending activation fee amount
   */
  getActivationFee(publicKey: string): number {
    const user = this.users.get(publicKey);
    if (!user || user.activationFeePaid) return 0;
    return user.activationFeeEurc || 0;
  }

  /**
   * Mark activation fee as paid
   */
  markActivationFeePaid(publicKey: string): void {
    const user = this.users.get(publicKey);
    if (!user) return;

    user.activationFeePaid = true;
    user.activationFeePaidAt = Date.now();

    this.users.set(publicKey, user);
    saveUsers(this.users);

    console.log(`[Users] Activation fee paid for ${publicKey.slice(0, 8)}: ${user.activationFeeEurc} EURC`);
  }

  /**
   * Get activation fee status for user
   */
  getActivationFeeStatus(publicKey: string): {
    accountActivated: boolean;
    feePending: boolean;
    feeAmount: number;
    feePaidAt?: number;
  } {
    const user = this.users.get(publicKey);
    return {
      accountActivated: user?.accountActivated ?? false,
      feePending: this.hasActivationFeePending(publicKey),
      feeAmount: user?.activationFeeEurc ?? 0,
      feePaidAt: user?.activationFeePaidAt,
    };
  }
}

export const usersService = new UsersService();

// Gas operation types - matching Soroban contract functions
export type GasOperation =
  // Off-chain (backend only)
  | 'kyc'              // FREE (Mykobo handles externally)
  // On-chain - Tanda lifecycle (simplified model)
  | 'create_tanda'     // Create new tanda
  | 'deposit'          // Make deposit for cycle
  | 'advance';         // Expel delinquents + trigger payout

// Operation fee info - dual perspective
export interface OperationFee {
  operation: GasOperation;
  nameEs: string;
  // User perspective (what they pay)
  userCostEurc: number;
  isFreeForUser: boolean;
  // Sponsor perspective (what we pay in gas)
  sponsorCostXlm: number;
  sponsorCostEur: number;
}

// Sponsor transaction result
export interface SponsorResult {
  success: boolean;
  txHash?: string;
  feePaidXlm?: number;
  feePaidEur?: number;
  error?: string;
}

// User record
export interface UserRecord {
  publicKey: string;
  displayName?: string;
  country?: string;
  kycVerified: boolean;
  kycVerifiedAt?: number;
  registeredAt: number;
  totalTxSponsored: number;
  totalXlmSpent: number;
  pushToken?: string;
  // Activation fee tracking
  accountActivated?: boolean;
  activationXlmSpent?: number;      // XLM spent to activate account
  activationFeeEurc?: number;        // Equivalent in EURC to recover
  activationFeePaid?: boolean;       // True when fee has been collected
  activationFeePaidAt?: number;      // Timestamp when fee was collected
}

// KYC report from frontend
export interface KYCReport {
  publicKey: string;
  country: string;
  verifiedAt: number;
  provider: 'mykobo';
}

// Stats
export interface PersistentStats {
  totalXlmSpent: number;
  totalEurcCommissions: number;
  totalTxSponsored: number;
  operationCount: Record<string, number>;
  registeredUsers: number;
  kycVerifiedUsers: number;
  usersByCountry: Record<string, number>;
  lastUpdated: number;
}

// Sponsor wallet info
export interface SponsorInfo {
  publicKey: string;
  xlmBalance: number;
  eurcBalance: number;
  isLowBalance: boolean;
}

// API responses
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Tanda types (for reference, actual data is on-chain)
export interface TandaInfo {
  id: string;
  name: string;
  creator: string;
  amountPerCycle: number;
  maxParticipants: number;
  currentParticipants: number;
  totalCycles: number;
  currentCycle: number;
  cycleDays: number;
  status: 'waiting' | 'active' | 'completed' | 'cancelled';
  createdAt: number;
}


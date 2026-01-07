/**
 * Zod Validators
 * Schema validation for API requests
 */

import { z } from 'zod';

// Stellar public key validation
export const stellarPublicKey = z.string()
  .length(56, 'Stellar public key must be 56 characters')
  .regex(/^G[A-Z2-7]{55}$/, 'Invalid Stellar public key format');

// Create Tanda schema
export const createTandaSchema = z.object({
  creatorWallet: stellarPublicKey,
  name: z.string().min(1).max(50).optional(),
  amount: z.number().positive('Amount must be positive').min(10, 'Minimum amount is 10').max(10000, 'Maximum amount is 10000'),
  maxParticipants: z.number().int().min(2, 'Minimum 2 participants').max(12, 'Maximum 12 participants'),
  totalCycles: z.number().int().min(1).max(12).optional(),
  minScore: z.number().int().min(0).max(100).optional(),
});

// Join Tanda schema
export const joinTandaSchema = z.object({
  tandaId: z.string().min(1, 'tandaId is required'),
  walletAddress: stellarPublicKey,
});

// Deposit schema
export const depositSchema = z.object({
  walletAddress: stellarPublicKey,
  txHash: z.string().optional(),
});

// Start tanda schema
export const startTandaSchema = z.object({
  walletAddress: stellarPublicKey,
});

// Leave tanda schema
export const leaveTandaSchema = z.object({
  walletAddress: stellarPublicKey,
});

// Sponsor TX schema
export const sponsorTxSchema = z.object({
  txXdr: z.string().min(1, 'txXdr is required'),
  userPublicKey: stellarPublicKey.optional(),
  operation: z.enum(['kyc', 'create_tanda', 'deposit', 'advance', 'unknown']).optional(),
});

// KYC schema
export const kycReportSchema = z.object({
  publicKey: stellarPublicKey,
  country: z.string().length(2, 'Country must be 2-letter ISO code').toUpperCase(),
});

// User profile schema
export const userProfileSchema = z.object({
  displayName: z.string().max(50).optional(),
  avatar: z.string().url().optional(),
});

// Tanda ID param schema
export const tandaIdParamSchema = z.object({
  id: z.string().min(1, 'Tanda ID is required'),
});

// Wallet param schema
export const walletParamSchema = z.object({
  wallet: stellarPublicKey,
});

// Public key param schema
export const publicKeyParamSchema = z.object({
  pk: stellarPublicKey,
});

// Validate helper function
export function validate<T>(schema: z.ZodSchema<T>, data: unknown): { success: true; data: T } | { success: false; error: string } {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  const errorMessage = result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
  return { success: false, error: errorMessage };
}

// Type exports for use in routes
export type CreateTandaInput = z.infer<typeof createTandaSchema>;
export type JoinTandaInput = z.infer<typeof joinTandaSchema>;
export type DepositInput = z.infer<typeof depositSchema>;
export type SponsorTxInput = z.infer<typeof sponsorTxSchema>;
export type KycReportInput = z.infer<typeof kycReportSchema>;

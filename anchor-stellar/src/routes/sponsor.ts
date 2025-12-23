/**
 * Sponsor Routes
 * Handles fee-bump transaction sponsorship
 */

import { Router } from 'express';
import { sponsorService } from '../services/sponsor.js';
import { feesService } from '../services/fees.js';
import { usersService } from '../services/users.js';
import type { GasOperation } from '../types/index.js';

const router = Router();

// Rate limiting map (simple in-memory)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 60000; // 1 minute
const RATE_LIMIT_MAX = 10; // 10 requests per minute

function checkRateLimit(publicKey: string): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(publicKey);

  if (!record || now > record.resetAt) {
    rateLimitMap.set(publicKey, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }

  if (record.count >= RATE_LIMIT_MAX) {
    return false;
  }

  record.count++;
  return true;
}

/**
 * POST /api/sponsor/tx
 * Sponsor a user's transaction
 */
router.post('/tx', async (req, res) => {
  try {
    // Accept both parameter names for backwards compatibility
    const txXdr = req.body.txXdr || req.body.unsignedTx;
    const userPublicKey = req.body.userPublicKey;
    const { operation } = req.body;

    // Validate required fields
    if (!txXdr) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: txXdr',
      });
    }

    // Extract source public key from transaction if not provided
    let sourcePublicKey = userPublicKey;
    if (!sourcePublicKey) {
      try {
        const { TransactionBuilder, Transaction } = await import('@stellar/stellar-sdk');
        const { STELLAR_CONFIG } = await import('../config/index.js');
        const tx = TransactionBuilder.fromXDR(txXdr, STELLAR_CONFIG.networkPassphrase);
        // Get source from regular transaction (not fee-bump)
        if (tx instanceof Transaction) {
          sourcePublicKey = tx.source;
        } else {
          // For FeeBumpTransaction, get inner tx source
          sourcePublicKey = tx.innerTransaction.source;
        }
      } catch (e: any) {
        return res.status(400).json({
          success: false,
          error: 'Invalid transaction XDR or missing userPublicKey',
        });
      }
    }

    // Rate limit check
    if (!checkRateLimit(sourcePublicKey)) {
      return res.status(429).json({
        success: false,
        error: 'Too many requests. Please wait a minute.',
      });
    }

    // Ensure user exists
    usersService.getOrCreateUser(sourcePublicKey);

    // Sponsor the transaction
    const result = await sponsorService.sponsorTransaction(
      txXdr,
      sourcePublicKey,
      operation || 'unknown'
    );

    if (result.success) {
      // Update user stats
      usersService.recordSponsoredTx(sourcePublicKey, result.feePaidXlm || 0);
    }

    res.json(result);
  } catch (error: any) {
    console.error('[Route] Error sponsoring tx:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to sponsor transaction',
    });
  }
});

/**
 * GET /api/sponsor/status
 * Get sponsor wallet status
 */
router.get('/status', async (_req, res) => {
  try {
    const info = await sponsorService.getSponsorInfo();

    if (!info) {
      return res.status(500).json({
        success: false,
        error: 'Failed to get sponsor info',
      });
    }

    res.json({
      success: true,
      sponsor: info,
      estimatedTxRemaining: Math.floor(info.xlmBalance / 0.0001),
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/sponsor/fees
 * Get fee information for all operations
 */
router.get('/fees', async (_req, res) => {
  try {
    const feesSummary = await feesService.getFeesSummary();

    res.json({
      success: true,
      ...feesSummary,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/sponsor/fee/:operation
 * Get fee for specific operation
 */
router.get('/fee/:operation', async (req, res) => {
  try {
    const operation = req.params.operation as GasOperation;
    const fee = await feesService.getOperationFee(operation);

    res.json({
      success: true,
      fee,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error.message,
    });
  }
});

export default router;

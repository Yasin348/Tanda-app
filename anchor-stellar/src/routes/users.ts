/**
 * Users Routes
 * Handles user profiles and KYC status
 */

import { Router } from 'express';
import { usersService } from '../services/users.js';
import { statsService } from '../services/stats.js';
import { stellarService } from '../services/stellar.js';
import type { KYCReport } from '../types/index.js';

const router = Router();

/**
 * POST /api/users/kyc
 * Report KYC completion from frontend (after Mykobo verification)
 * Also activates the user's Stellar account if not already active
 */
router.post('/kyc', async (req, res) => {
  try {
    const { publicKey, country } = req.body;

    if (!publicKey || !country) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: publicKey, country',
      });
    }

    // Record KYC verification
    const report: KYCReport = {
      publicKey,
      country,
      verifiedAt: Date.now(),
      provider: 'mykobo',
    };

    const user = usersService.recordKYCVerified(report);

    // Activate Stellar account if needed
    let accountActivation = null;
    const needsActivation = await stellarService.needsActivation(publicKey);

    if (needsActivation) {
      console.log(`[Route] Activating Stellar account for ${publicKey.slice(0, 8)}...`);
      accountActivation = await stellarService.activateAccount(publicKey);

      if (!accountActivation.success) {
        console.error('[Route] Account activation failed:', accountActivation.error);
        // Don't fail the KYC recording, just log the error
      } else {
        console.log('[Route] Account activated successfully');
      }
    } else {
      console.log('[Route] Account already active');
      accountActivation = { success: true, alreadyActive: true };
    }

    res.json({
      success: true,
      message: 'KYC verification recorded',
      user: {
        publicKey: user.publicKey,
        kycVerified: user.kycVerified,
        country: user.country,
        verifiedAt: user.kycVerifiedAt,
      },
      accountActivation: {
        activated: accountActivation?.success && !accountActivation?.alreadyActive,
        alreadyActive: accountActivation?.alreadyActive || false,
        txHash: accountActivation?.txHash,
        error: accountActivation?.error,
      },
    });
  } catch (error: any) {
    console.error('[Route] Error recording KYC:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to record KYC',
    });
  }
});

/**
 * GET /api/users/kyc/status/:publicKey
 * Get KYC status for a user
 */
router.get('/kyc/status/:publicKey', async (req, res) => {
  try {
    const { publicKey } = req.params;

    const status = usersService.getKYCStatus(publicKey);

    res.json({
      success: true,
      publicKey,
      ...status,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/users/kyc/stats
 * Get KYC statistics
 */
router.get('/kyc/stats', async (_req, res) => {
  try {
    const kycStats = statsService.getKYCStats();

    res.json({
      success: true,
      ...kycStats,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/users/batch
 * Get multiple user profiles at once (for participant lists)
 */
router.post('/batch', async (req, res) => {
  try {
    const { publicKeys } = req.body;

    if (!publicKeys || !Array.isArray(publicKeys)) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: publicKeys (array)',
      });
    }

    // Limit to 50 users per request
    const keys = publicKeys.slice(0, 50);

    const users: Record<string, { displayName: string | null; kycVerified: boolean }> = {};

    for (const pk of keys) {
      const user = usersService.getUser(pk);
      users[pk] = {
        displayName: user?.displayName || null,
        kycVerified: user?.kycVerified || false,
      };
    }

    res.json({
      success: true,
      users,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// ==================== ACCOUNT ROUTES ====================
// These must come BEFORE the catch-all /:publicKey routes

/**
 * GET /api/users/account/status/:publicKey
 * Check Stellar account status (exists, has trustline, etc.)
 */
router.get('/account/status/:publicKey', async (req, res) => {
  try {
    const { publicKey } = req.params;

    const exists = await stellarService.accountExists(publicKey);
    let hasTrustline = false;
    let balances = { xlm: 0, eurc: 0 };

    if (exists) {
      hasTrustline = await stellarService.hasEurcTrustline(publicKey);
      balances = await stellarService.getAccountBalances(publicKey);
    }

    res.json({
      success: true,
      publicKey,
      accountExists: exists,
      hasTrustline,
      balances,
      needsActivation: !exists,
      needsTrustline: exists && !hasTrustline,
      readyForDeposit: exists && hasTrustline,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/users/account/activate
 * Activate a Stellar account (create if not exists)
 * Records pending activation fee to be collected later
 */
router.post('/account/activate', async (req, res) => {
  try {
    const { publicKey } = req.body;

    if (!publicKey) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: publicKey',
      });
    }

    const result = await stellarService.activateAccount(publicKey);

    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: result.error,
      });
    }

    // Record activation fee if account was newly activated
    let activationFee = 0;
    if (!result.alreadyActive) {
      const xlmSpent = 2; // We send 2 XLM for activation (MIN_ACCOUNT_BALANCE)
      const xlmPriceEur = 0.35; // TODO: Get real-time price
      usersService.recordAccountActivation(publicKey, xlmSpent, xlmPriceEur);
      activationFee = usersService.getActivationFee(publicKey);
    }

    res.json({
      success: true,
      message: result.alreadyActive ? 'Account already active' : 'Account activated',
      alreadyActive: result.alreadyActive || false,
      txHash: result.txHash,
      activationFee: {
        pending: !result.alreadyActive,
        amountEurc: activationFee,
        note: activationFee > 0 ? 'Fee will be collected on first tanda operation' : undefined,
      },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/users/account/activation-fee/:publicKey
 * Check activation fee status for a user
 */
router.get('/account/activation-fee/:publicKey', async (req, res) => {
  try {
    const { publicKey } = req.params;
    const status = usersService.getActivationFeeStatus(publicKey);

    res.json({
      success: true,
      publicKey,
      ...status,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/users/account/trustline
 * Get a trustline transaction for user to sign
 */
router.post('/account/trustline', async (req, res) => {
  try {
    const { publicKey } = req.body;

    if (!publicKey) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: publicKey',
      });
    }

    // Check if account exists
    const exists = await stellarService.accountExists(publicKey);
    if (!exists) {
      return res.status(400).json({
        success: false,
        error: 'Account does not exist. Activate account first.',
        needsActivation: true,
      });
    }

    // Check if trustline already exists
    const hasTrustline = await stellarService.hasEurcTrustline(publicKey);
    if (hasTrustline) {
      return res.json({
        success: true,
        alreadyExists: true,
        message: 'EURC trustline already exists',
      });
    }

    // Build trustline transaction for user to sign
    const result = await stellarService.buildTrustlineTransaction(publicKey);

    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: result.error,
      });
    }

    res.json({
      success: true,
      message: 'Sign this transaction and submit to /api/sponsor/tx',
      txXdr: result.txXdr,
      instructions: {
        step1: 'Sign this XDR with your private key',
        step2: 'POST signed XDR to /api/sponsor/tx with operation: "trustline"',
        step3: 'Sponsor will fee-bump and submit the transaction',
      },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// ==================== CATCH-ALL ROUTES ====================
// These must come LAST because they match any path

/**
 * GET /api/users/:publicKey
 * Get user profile
 */
router.get('/:publicKey', async (req, res) => {
  try {
    const { publicKey } = req.params;

    const user = usersService.getUser(publicKey);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      });
    }

    res.json({
      success: true,
      user: {
        publicKey: user.publicKey,
        displayName: user.displayName,
        country: user.country,
        kycVerified: user.kycVerified,
        kycVerifiedAt: user.kycVerifiedAt,
        registeredAt: user.registeredAt,
        totalTxSponsored: user.totalTxSponsored,
      },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * PUT /api/users/:publicKey
 * Update user profile
 */
router.put('/:publicKey', async (req, res) => {
  try {
    const { publicKey } = req.params;
    const { displayName, pushToken } = req.body;

    // Ensure user exists
    usersService.getOrCreateUser(publicKey);

    // Update allowed fields
    const updates: any = {};
    if (displayName !== undefined) updates.displayName = displayName;
    if (pushToken !== undefined) updates.pushToken = pushToken;

    const user = usersService.updateUser(publicKey, updates);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      });
    }

    res.json({
      success: true,
      message: 'User updated',
      user: {
        publicKey: user.publicKey,
        displayName: user.displayName,
      },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

export default router;

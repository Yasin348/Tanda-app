/**
 * Health Routes
 * Health checks and status endpoints
 */

import { Router } from 'express';
import { STELLAR_CONFIG } from '../config/index.js';
import { sponsorService } from '../services/sponsor.js';
import { statsService } from '../services/stats.js';

const router = Router();

/**
 * GET /health
 * Basic health check
 */
router.get('/', async (_req, res) => {
  try {
    const sponsorInfo = await sponsorService.getSponsorInfo();

    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      network: STELLAR_CONFIG.network,
      contractDeployed: !!STELLAR_CONFIG.contractId,
      sponsorHealthy: sponsorInfo ? !sponsorInfo.isLowBalance : false,
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * GET /api/anchor/status
 * Detailed anchor status
 */
router.get('/anchor/status', async (_req, res) => {
  try {
    const sponsorInfo = await sponsorService.getSponsorInfo();
    const stats = statsService.getStats();

    res.json({
      success: true,
      anchor: {
        publicKey: sponsorInfo?.publicKey,
        xlmBalance: sponsorInfo?.xlmBalance,
        eurcBalance: sponsorInfo?.eurcBalance,
        isLowBalance: sponsorInfo?.isLowBalance,
      },
      stats: {
        totalXlmSpent: stats.totalXlmSpent,
        totalEurcCommissions: stats.totalEurcCommissions,
        totalTxSponsored: stats.totalTxSponsored,
        registeredUsers: stats.registeredUsers,
        kycVerifiedUsers: stats.kycVerifiedUsers,
      },
      network: STELLAR_CONFIG.network,
      contractId: STELLAR_CONFIG.contractId || null,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

export default router;

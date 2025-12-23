/**
 * Tanda Routes
 * API endpoints for tanda operations via Soroban smart contract
 */

import { Router, Request, Response } from 'express';
import { sorobanService } from '../services/soroban.js';

const router = Router();

// ==================== CREATE TANDA ====================

/**
 * POST /api/tanda/create
 * Create a new tanda
 */
router.post('/create', async (req: Request, res: Response) => {
  try {
    const { name, amount, maxParticipants, totalCycles, minScore, creatorWallet } = req.body;

    if (!creatorWallet) {
      return res.status(400).json({
        success: false,
        error: 'creatorWallet is required',
      });
    }

    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        error: 'amount must be positive',
      });
    }

    if (!maxParticipants || maxParticipants < 2 || maxParticipants > 12) {
      return res.status(400).json({
        success: false,
        error: 'maxParticipants must be between 2 and 12',
      });
    }

    if (!sorobanService.isConfigured()) {
      return res.status(503).json({
        success: false,
        error: 'Soroban contract not configured',
      });
    }

    console.log('[Tanda] Creating tanda:', { name, amount, maxParticipants, creatorWallet });

    const result = await sorobanService.createTanda(
      creatorWallet,
      name || `Tanda ${Date.now()}`,
      amount,
      maxParticipants
    );

    if (result.success) {
      return res.json({
        success: true,
        tanda: result.tanda,
      });
    }

    return res.status(400).json({
      success: false,
      error: result.error,
    });
  } catch (error: any) {
    console.error('[Tanda] Create error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error',
    });
  }
});

// ==================== JOIN TANDA ====================

/**
 * POST /api/tanda/join
 * Join an existing tanda
 */
router.post('/join', async (req: Request, res: Response) => {
  try {
    const { tandaId, walletAddress } = req.body;

    if (!tandaId || !walletAddress) {
      return res.status(400).json({
        success: false,
        error: 'tandaId and walletAddress are required',
      });
    }

    if (!sorobanService.isConfigured()) {
      return res.status(503).json({
        success: false,
        error: 'Soroban contract not configured',
      });
    }

    console.log('[Tanda] Joining tanda:', { tandaId, walletAddress });

    const result = await sorobanService.joinTanda(tandaId, walletAddress);

    if (result.success) {
      return res.json({
        success: true,
        tanda: result.tanda,
      });
    }

    return res.status(400).json({
      success: false,
      error: result.error,
    });
  } catch (error: any) {
    console.error('[Tanda] Join error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error',
    });
  }
});

// ==================== LIST TANDAS ====================

/**
 * GET /api/tanda/list
 * Get all tandas (optionally filtered by status)
 */
router.get('/list', async (req: Request, res: Response) => {
  try {
    const { status } = req.query;

    if (!sorobanService.isConfigured()) {
      return res.status(503).json({
        success: false,
        error: 'Soroban contract not configured',
      });
    }

    const result = await sorobanService.getAllTandas(status as string | undefined);

    return res.json({
      success: true,
      tandas: result.tandas,
    });
  } catch (error: any) {
    console.error('[Tanda] List error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error',
    });
  }
});

// ==================== GET TANDA ====================

/**
 * GET /api/tanda/:id
 * Get a specific tanda by ID
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (!sorobanService.isConfigured()) {
      return res.status(503).json({
        success: false,
        error: 'Soroban contract not configured',
      });
    }

    const result = await sorobanService.getTanda(id);

    if (result.success) {
      return res.json({
        success: true,
        tanda: result.tanda,
      });
    }

    return res.status(404).json({
      success: false,
      error: result.error || 'Tanda not found',
    });
  } catch (error: any) {
    console.error('[Tanda] Get error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error',
    });
  }
});

// ==================== CONFIRM DEPOSIT ====================

/**
 * POST /api/tanda/:id/confirm-deposit
 * Confirm a deposit (after user transfers EURC)
 *
 * Note: In the new model, the contract handles the deposit directly.
 * This endpoint is for the case where the user has already sent EURC
 * and we need to call the contract's deposit function.
 */
router.post('/:id/confirm-deposit', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { walletAddress, txHash } = req.body;

    if (!walletAddress) {
      return res.status(400).json({
        success: false,
        error: 'walletAddress is required',
      });
    }

    if (!sorobanService.isConfigured()) {
      return res.status(503).json({
        success: false,
        error: 'Soroban contract not configured',
      });
    }

    console.log('[Tanda] Confirming deposit:', { tandaId: id, walletAddress, txHash });

    // The contract's deposit function handles the EURC transfer
    const result = await sorobanService.deposit(id, walletAddress);

    if (result.success) {
      return res.json({
        success: true,
        message: 'Deposit confirmed',
        tanda: result.tanda,
      });
    }

    return res.status(400).json({
      success: false,
      error: result.error,
    });
  } catch (error: any) {
    console.error('[Tanda] Confirm deposit error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error',
    });
  }
});

// ==================== PROCESS PAYOUT / ADVANCE ====================

/**
 * POST /api/tanda/:id/payout
 * Advance the tanda (expel delinquents and/or trigger payout)
 */
router.post('/:id/payout', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (!sorobanService.isConfigured()) {
      return res.status(503).json({
        success: false,
        error: 'Soroban contract not configured',
      });
    }

    console.log('[Tanda] Processing advance/payout:', { tandaId: id });

    const result = await sorobanService.advance(id);

    if (result.success) {
      return res.json({
        success: true,
        message: result.advanced ? 'Tanda advanced' : 'No action needed',
        tanda: result.tanda,
      });
    }

    return res.status(400).json({
      success: false,
      error: result.error,
    });
  } catch (error: any) {
    console.error('[Tanda] Payout error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error',
    });
  }
});

// ==================== LEAVE TANDA ====================

/**
 * POST /api/tanda/:id/leave
 * Leave a tanda (only while in waiting status)
 */
router.post('/:id/leave', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { walletAddress } = req.body;

    if (!walletAddress) {
      return res.status(400).json({
        success: false,
        error: 'walletAddress is required',
      });
    }

    if (!sorobanService.isConfigured()) {
      return res.status(503).json({
        success: false,
        error: 'Soroban contract not configured',
      });
    }

    console.log('[Tanda] Leaving tanda:', { tandaId: id, walletAddress });

    const result = await sorobanService.leaveTanda(id, walletAddress);

    if (result.success) {
      return res.json({
        success: true,
        tanda: result.tanda,
      });
    }

    return res.status(400).json({
      success: false,
      error: result.error,
    });
  } catch (error: any) {
    console.error('[Tanda] Leave error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error',
    });
  }
});

// ==================== PAYMENT SCHEDULE ====================

/**
 * GET /api/tanda/:id/schedule
 * Get the payment schedule for a tanda
 */
router.get('/:id/schedule', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (!sorobanService.isConfigured()) {
      return res.status(503).json({
        success: false,
        error: 'Soroban contract not configured',
      });
    }

    // Get tanda details
    const tandaResult = await sorobanService.getTanda(id);
    if (!tandaResult.success || !tandaResult.tanda) {
      return res.status(404).json({
        success: false,
        error: 'Tanda not found',
      });
    }

    const tanda = tandaResult.tanda;

    // Build schedule based on participants
    // In the new model, there's no fixed schedule - payments happen when all deposit
    const schedule = tanda.beneficiaryOrder.map((beneficiary, index) => ({
      cycle: index + 1,
      dueDate: 0, // No fixed due date in new model
      beneficiary,
      status: index + 1 < tanda.currentCycle
        ? 'completed'
        : index + 1 === tanda.currentCycle
        ? 'pending'
        : 'upcoming',
    }));

    return res.json({
      success: true,
      tandaId: id,
      schedule,
    });
  } catch (error: any) {
    console.error('[Tanda] Schedule error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error',
    });
  }
});

// ==================== NEXT PAYMENT ====================

/**
 * GET /api/tanda/:id/next-payment/:wallet
 * Get the next payment due for a user
 */
router.get('/:id/next-payment/:wallet', async (req: Request, res: Response) => {
  try {
    const { id, wallet } = req.params;

    if (!sorobanService.isConfigured()) {
      return res.status(503).json({
        success: false,
        error: 'Soroban contract not configured',
      });
    }

    const tandaResult = await sorobanService.getTanda(id);
    if (!tandaResult.success || !tandaResult.tanda) {
      return res.status(404).json({
        success: false,
        error: 'Tanda not found',
      });
    }

    const tanda = tandaResult.tanda;

    // Check if user is participant
    const participant = tanda.participants.find(p => p.walletAddress === wallet);
    if (!participant) {
      return res.status(404).json({
        success: false,
        error: 'User is not a participant in this tanda',
      });
    }

    // If already deposited, no next payment
    if (participant.hasDeposited) {
      return res.json({
        success: true,
        tandaId: id,
        walletAddress: wallet,
        nextPayment: null,
        message: 'Already deposited for current cycle',
      });
    }

    // Get time to deadline
    const timeToDeadline = await sorobanService.getTimeToDeadline(id);
    const beneficiary = tanda.beneficiaryOrder[tanda.currentCycle - 1] || null;

    return res.json({
      success: true,
      tandaId: id,
      walletAddress: wallet,
      nextPayment: {
        cycle: tanda.currentCycle,
        dueDate: Date.now() + (timeToDeadline * 1000), // Convert seconds to ms
        amount: tanda.amount,
        beneficiary,
        daysRemaining: Math.ceil(timeToDeadline / 86400),
        isOverdue: timeToDeadline === 0,
      },
    });
  } catch (error: any) {
    console.error('[Tanda] Next payment error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error',
    });
  }
});

// ==================== TANDA BALANCE ====================

/**
 * GET /api/tanda/:id/balance
 * Get the EURC balance of a tanda (held in contract)
 */
router.get('/:id/balance', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (!sorobanService.isConfigured()) {
      return res.status(503).json({
        success: false,
        error: 'Soroban contract not configured',
      });
    }

    const tandaResult = await sorobanService.getTanda(id);
    if (!tandaResult.success || !tandaResult.tanda) {
      return res.status(404).json({
        success: false,
        error: 'Tanda not found',
      });
    }

    const tanda = tandaResult.tanda;

    // Calculate expected balance based on deposits
    const depositedCount = tanda.participants.filter(p => p.hasDeposited).length;
    const expectedBalance = depositedCount * tanda.amount;

    return res.json({
      success: true,
      balance: expectedBalance,
    });
  } catch (error: any) {
    console.error('[Tanda] Balance error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error',
    });
  }
});

// ==================== ADVANCE STATUS ====================

/**
 * GET /api/tanda/:id/advance-status
 * Get what will happen if advance is called
 */
router.get('/:id/advance-status', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (!sorobanService.isConfigured()) {
      return res.status(503).json({
        success: false,
        error: 'Soroban contract not configured',
      });
    }

    const status = await sorobanService.getAdvanceStatus(id);

    return res.json({
      success: true,
      tandaId: id,
      ...status,
    });
  } catch (error: any) {
    console.error('[Tanda] Advance status error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error',
    });
  }
});

// ==================== START TANDA ====================

/**
 * POST /api/tanda/:id/start
 * Start a tanda (creator only, requires at least 2 members)
 */
router.post('/:id/start', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { walletAddress } = req.body;

    if (!walletAddress) {
      return res.status(400).json({
        success: false,
        error: 'walletAddress is required',
      });
    }

    if (!sorobanService.isConfigured()) {
      return res.status(503).json({
        success: false,
        error: 'Soroban contract not configured',
      });
    }

    console.log('[Tanda] Starting tanda:', { tandaId: id, walletAddress });

    const result = await sorobanService.startTanda(id, walletAddress);

    if (result.success) {
      return res.json({
        success: true,
        tanda: result.tanda,
      });
    }

    return res.status(400).json({
      success: false,
      error: result.error,
    });
  } catch (error: any) {
    console.error('[Tanda] Start error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error',
    });
  }
});

export default router;

/**
 * Tanda Routes
 * API endpoints for tanda operations via Soroban smart contract
 */

import { Router, Request, Response, NextFunction } from 'express';
import { sorobanService } from '../services/soroban.js';
import {
  validate,
  createTandaSchema,
  joinTandaSchema,
  depositSchema,
  startTandaSchema,
  leaveTandaSchema,
  tandaIdParamSchema,
} from '../validators/index.js';
import { Errors } from '../types/errors.js';

const router = Router();

// Error handler middleware for this router
const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// Check Soroban configuration middleware
const requireSoroban = (_req: Request, _res: Response, next: NextFunction) => {
  if (!sorobanService.isConfigured()) {
    throw Errors.sorobanNotConfigured();
  }
  next();
};

// ==================== CREATE TANDA ====================

/**
 * POST /api/tanda/create
 * Create a new tanda
 */
router.post('/create', requireSoroban, asyncHandler(async (req: Request, res: Response) => {
  const validation = validate(createTandaSchema, req.body);

  if (!validation.success) {
    throw Errors.validation(validation.error);
  }

  const { creatorWallet, name, amount, maxParticipants } = validation.data;

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

  throw Errors.sorobanError(result.error || 'Failed to create tanda');
}));

// ==================== JOIN TANDA ====================

/**
 * POST /api/tanda/join
 * Join an existing tanda
 */
router.post('/join', requireSoroban, asyncHandler(async (req: Request, res: Response) => {
  const validation = validate(joinTandaSchema, req.body);

  if (!validation.success) {
    throw Errors.validation(validation.error);
  }

  const { tandaId, walletAddress } = validation.data;

  console.log('[Tanda] Joining tanda:', { tandaId, walletAddress });

  const result = await sorobanService.joinTanda(tandaId, walletAddress);

  if (result.success) {
    return res.json({
      success: true,
      tanda: result.tanda,
    });
  }

  throw Errors.sorobanError(result.error || 'Failed to join tanda');
}));

// ==================== LIST TANDAS ====================

/**
 * GET /api/tanda/list
 * Get all tandas (optionally filtered by status)
 */
router.get('/list', requireSoroban, asyncHandler(async (req: Request, res: Response) => {
  const { status } = req.query;

  const result = await sorobanService.getAllTandas(status as string | undefined);

  return res.json({
    success: true,
    tandas: result.tandas,
  });
}));

// ==================== GET TANDA ====================

/**
 * GET /api/tanda/:id
 * Get a specific tanda by ID
 */
router.get('/:id', requireSoroban, asyncHandler(async (req: Request, res: Response) => {
  const paramValidation = validate(tandaIdParamSchema, req.params);
  if (!paramValidation.success) {
    throw Errors.validation(paramValidation.error);
  }

  const { id } = paramValidation.data;
  const result = await sorobanService.getTanda(id);

  if (result.success) {
    return res.json({
      success: true,
      tanda: result.tanda,
    });
  }

  throw Errors.tandaNotFound(id);
}));

// ==================== CONFIRM DEPOSIT ====================

/**
 * POST /api/tanda/:id/confirm-deposit
 * Confirm a deposit (after user transfers EURC)
 */
router.post('/:id/confirm-deposit', requireSoroban, asyncHandler(async (req: Request, res: Response) => {
  const paramValidation = validate(tandaIdParamSchema, req.params);
  if (!paramValidation.success) {
    throw Errors.validation(paramValidation.error);
  }

  const bodyValidation = validate(depositSchema, req.body);
  if (!bodyValidation.success) {
    throw Errors.validation(bodyValidation.error);
  }

  const { id } = paramValidation.data;
  const { walletAddress, txHash } = bodyValidation.data;

  console.log('[Tanda] Confirming deposit:', { tandaId: id, walletAddress, txHash });

  const result = await sorobanService.deposit(id, walletAddress);

  if (result.success) {
    return res.json({
      success: true,
      message: 'Deposit confirmed',
      tanda: result.tanda,
    });
  }

  throw Errors.sorobanError(result.error || 'Failed to confirm deposit');
}));

// ==================== PROCESS PAYOUT / ADVANCE ====================

/**
 * POST /api/tanda/:id/payout
 * Advance the tanda (expel delinquents and/or trigger payout)
 */
router.post('/:id/payout', requireSoroban, asyncHandler(async (req: Request, res: Response) => {
  const paramValidation = validate(tandaIdParamSchema, req.params);
  if (!paramValidation.success) {
    throw Errors.validation(paramValidation.error);
  }

  const { id } = paramValidation.data;

  console.log('[Tanda] Processing advance/payout:', { tandaId: id });

  const result = await sorobanService.advance(id);

  if (result.success) {
    return res.json({
      success: true,
      message: result.advanced ? 'Tanda advanced' : 'No action needed',
      tanda: result.tanda,
    });
  }

  throw Errors.sorobanError(result.error || 'Failed to advance tanda');
}));

// ==================== LEAVE TANDA ====================

/**
 * POST /api/tanda/:id/leave
 * Leave a tanda (only while in forming status)
 */
router.post('/:id/leave', requireSoroban, asyncHandler(async (req: Request, res: Response) => {
  const paramValidation = validate(tandaIdParamSchema, req.params);
  if (!paramValidation.success) {
    throw Errors.validation(paramValidation.error);
  }

  const bodyValidation = validate(leaveTandaSchema, req.body);
  if (!bodyValidation.success) {
    throw Errors.validation(bodyValidation.error);
  }

  const { id } = paramValidation.data;
  const { walletAddress } = bodyValidation.data;

  console.log('[Tanda] Leaving tanda:', { tandaId: id, walletAddress });

  const result = await sorobanService.leaveTanda(id, walletAddress);

  if (result.success) {
    return res.json({
      success: true,
      tanda: result.tanda,
    });
  }

  throw Errors.sorobanError(result.error || 'Failed to leave tanda');
}));

// ==================== PAYMENT SCHEDULE ====================

/**
 * GET /api/tanda/:id/schedule
 * Get the payment schedule for a tanda
 */
router.get('/:id/schedule', requireSoroban, asyncHandler(async (req: Request, res: Response) => {
  const paramValidation = validate(tandaIdParamSchema, req.params);
  if (!paramValidation.success) {
    throw Errors.validation(paramValidation.error);
  }

  const { id } = paramValidation.data;
  const tandaResult = await sorobanService.getTanda(id);

  if (!tandaResult.success || !tandaResult.tanda) {
    throw Errors.tandaNotFound(id);
  }

  const tanda = tandaResult.tanda;

  const schedule = tanda.beneficiaryOrder.map((beneficiary: string, index: number) => ({
    cycle: index + 1,
    dueDate: 0,
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
}));

// ==================== NEXT PAYMENT ====================

/**
 * GET /api/tanda/:id/next-payment/:wallet
 * Get the next payment due for a user
 */
router.get('/:id/next-payment/:wallet', requireSoroban, asyncHandler(async (req: Request, res: Response) => {
  const { id, wallet } = req.params;

  const tandaResult = await sorobanService.getTanda(id);
  if (!tandaResult.success || !tandaResult.tanda) {
    throw Errors.tandaNotFound(id);
  }

  const tanda = tandaResult.tanda;

  const participant = tanda.participants.find((p: any) => p.walletAddress === wallet);
  if (!participant) {
    throw Errors.memberNotFound();
  }

  if (participant.hasDeposited) {
    return res.json({
      success: true,
      tandaId: id,
      walletAddress: wallet,
      nextPayment: null,
      message: 'Already deposited for current cycle',
    });
  }

  const timeToDeadline = await sorobanService.getTimeToDeadline(id);
  const beneficiary = tanda.beneficiaryOrder[tanda.currentCycle - 1] || null;

  return res.json({
    success: true,
    tandaId: id,
    walletAddress: wallet,
    nextPayment: {
      cycle: tanda.currentCycle,
      dueDate: Date.now() + (timeToDeadline * 1000),
      amount: tanda.amount,
      beneficiary,
      daysRemaining: Math.ceil(timeToDeadline / 86400),
      isOverdue: timeToDeadline === 0,
    },
  });
}));

// ==================== TANDA BALANCE ====================

/**
 * GET /api/tanda/:id/balance
 * Get the EURC balance of a tanda (held in contract)
 */
router.get('/:id/balance', requireSoroban, asyncHandler(async (req: Request, res: Response) => {
  const paramValidation = validate(tandaIdParamSchema, req.params);
  if (!paramValidation.success) {
    throw Errors.validation(paramValidation.error);
  }

  const { id } = paramValidation.data;
  const tandaResult = await sorobanService.getTanda(id);

  if (!tandaResult.success || !tandaResult.tanda) {
    throw Errors.tandaNotFound(id);
  }

  const tanda = tandaResult.tanda;
  const depositedCount = tanda.participants.filter((p: any) => p.hasDeposited).length;
  const expectedBalance = depositedCount * tanda.amount;

  return res.json({
    success: true,
    balance: expectedBalance,
  });
}));

// ==================== ADVANCE STATUS ====================

/**
 * GET /api/tanda/:id/advance-status
 * Get what will happen if advance is called
 */
router.get('/:id/advance-status', requireSoroban, asyncHandler(async (req: Request, res: Response) => {
  const paramValidation = validate(tandaIdParamSchema, req.params);
  if (!paramValidation.success) {
    throw Errors.validation(paramValidation.error);
  }

  const { id } = paramValidation.data;
  const status = await sorobanService.getAdvanceStatus(id);

  return res.json({
    success: true,
    tandaId: id,
    ...status,
  });
}));

// ==================== START TANDA ====================

/**
 * POST /api/tanda/:id/start
 * Start a tanda (creator only, requires at least 2 members)
 */
router.post('/:id/start', requireSoroban, asyncHandler(async (req: Request, res: Response) => {
  const paramValidation = validate(tandaIdParamSchema, req.params);
  if (!paramValidation.success) {
    throw Errors.validation(paramValidation.error);
  }

  const bodyValidation = validate(startTandaSchema, req.body);
  if (!bodyValidation.success) {
    throw Errors.validation(bodyValidation.error);
  }

  const { id } = paramValidation.data;
  const { walletAddress } = bodyValidation.data;

  console.log('[Tanda] Starting tanda:', { tandaId: id, walletAddress });

  const result = await sorobanService.startTanda(id, walletAddress);

  if (result.success) {
    return res.json({
      success: true,
      tanda: result.tanda,
    });
  }

  throw Errors.sorobanError(result.error || 'Failed to start tanda');
}));

export default router;

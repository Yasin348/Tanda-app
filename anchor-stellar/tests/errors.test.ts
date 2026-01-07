/**
 * Error System Tests
 */

import { describe, it, expect } from 'vitest';
import { AppError, ErrorCode, Errors, isAppError } from '../src/types/errors.js';

describe('Error System', () => {
  describe('AppError', () => {
    it('should create error with correct properties', () => {
      const error = new AppError(ErrorCode.TANDA_NOT_FOUND, 'Tanda not found', 404);
      expect(error.code).toBe(ErrorCode.TANDA_NOT_FOUND);
      expect(error.message).toBe('Tanda not found');
      expect(error.statusCode).toBe(404);
      expect(error.name).toBe('AppError');
    });

    it('should default to status 400', () => {
      const error = new AppError(ErrorCode.VALIDATION_ERROR, 'Invalid input');
      expect(error.statusCode).toBe(400);
    });

    it('should include details when provided', () => {
      const error = new AppError(
        ErrorCode.INSUFFICIENT_BALANCE,
        'Not enough balance',
        400,
        { required: 100, available: 50 }
      );
      expect(error.details).toEqual({ required: 100, available: 50 });
    });

    it('should serialize to JSON correctly', () => {
      const error = new AppError(ErrorCode.TANDA_FULL, 'Tanda is full', 400);
      const json = error.toJSON();
      expect(json).toEqual({
        success: false,
        error: {
          code: ErrorCode.TANDA_FULL,
          message: 'Tanda is full',
        },
      });
    });

    it('should include details in JSON when present', () => {
      const error = new AppError(
        ErrorCode.MINIMUM_MEMBERS_REQUIRED,
        'Need 2 members',
        400,
        { required: 2, current: 1 }
      );
      const json = error.toJSON();
      expect(json.error.details).toEqual({ required: 2, current: 1 });
    });
  });

  describe('isAppError', () => {
    it('should return true for AppError instances', () => {
      const error = new AppError(ErrorCode.INTERNAL_ERROR, 'Error');
      expect(isAppError(error)).toBe(true);
    });

    it('should return false for regular Error', () => {
      const error = new Error('Regular error');
      expect(isAppError(error)).toBe(false);
    });

    it('should return false for null', () => {
      expect(isAppError(null)).toBe(false);
    });

    it('should return false for undefined', () => {
      expect(isAppError(undefined)).toBe(false);
    });

    it('should return false for plain objects', () => {
      expect(isAppError({ code: 'ERROR', message: 'test' })).toBe(false);
    });
  });

  describe('Error Factory Functions', () => {
    it('should create validation error', () => {
      const error = Errors.validation('Invalid email format');
      expect(error.code).toBe(ErrorCode.VALIDATION_ERROR);
      expect(error.statusCode).toBe(400);
    });

    it('should create tanda not found error', () => {
      const error = Errors.tandaNotFound('123');
      expect(error.code).toBe(ErrorCode.TANDA_NOT_FOUND);
      expect(error.message).toContain('123');
      expect(error.statusCode).toBe(404);
    });

    it('should create tanda full error', () => {
      const error = Errors.tandaFull();
      expect(error.code).toBe(ErrorCode.TANDA_FULL);
      expect(error.statusCode).toBe(400);
    });

    it('should create KYC required error', () => {
      const error = Errors.kycRequired();
      expect(error.code).toBe(ErrorCode.KYC_REQUIRED);
      expect(error.statusCode).toBe(403);
    });

    it('should create insufficient balance error with details', () => {
      const error = Errors.insufficientBalance(100, 50);
      expect(error.code).toBe(ErrorCode.INSUFFICIENT_BALANCE);
      expect(error.details).toEqual({ required: 100, available: 50 });
    });

    it('should create minimum members error', () => {
      const error = Errors.minimumMembers(2, 1);
      expect(error.code).toBe(ErrorCode.MINIMUM_MEMBERS_REQUIRED);
      expect(error.message).toContain('2');
      expect(error.message).toContain('1');
    });

    it('should create soroban not configured error', () => {
      const error = Errors.sorobanNotConfigured();
      expect(error.code).toBe(ErrorCode.SOROBAN_NOT_CONFIGURED);
      expect(error.statusCode).toBe(503);
    });

    it('should create unauthorized error', () => {
      const error = Errors.unauthorized();
      expect(error.code).toBe(ErrorCode.UNAUTHORIZED);
      expect(error.statusCode).toBe(401);
    });

    it('should create forbidden error', () => {
      const error = Errors.forbidden();
      expect(error.code).toBe(ErrorCode.FORBIDDEN);
      expect(error.statusCode).toBe(403);
    });

    it('should create internal error', () => {
      const error = Errors.internal();
      expect(error.code).toBe(ErrorCode.INTERNAL_ERROR);
      expect(error.statusCode).toBe(500);
    });
  });
});

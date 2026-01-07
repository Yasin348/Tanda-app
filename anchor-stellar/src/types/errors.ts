/**
 * Typed Error System
 * Standardized error handling for the API
 */

export enum ErrorCode {
  // Validation errors (400)
  INVALID_PUBLIC_KEY = 'INVALID_PUBLIC_KEY',
  INVALID_AMOUNT = 'INVALID_AMOUNT',
  INVALID_PARTICIPANTS = 'INVALID_PARTICIPANTS',
  MISSING_REQUIRED_FIELD = 'MISSING_REQUIRED_FIELD',
  VALIDATION_ERROR = 'VALIDATION_ERROR',

  // Auth errors (401/403)
  UNAUTHORIZED = 'UNAUTHORIZED',
  KYC_REQUIRED = 'KYC_REQUIRED',
  FORBIDDEN = 'FORBIDDEN',

  // Not found (404)
  TANDA_NOT_FOUND = 'TANDA_NOT_FOUND',
  USER_NOT_FOUND = 'USER_NOT_FOUND',
  MEMBER_NOT_FOUND = 'MEMBER_NOT_FOUND',

  // Business logic errors (400)
  TANDA_FULL = 'TANDA_FULL',
  TANDA_ALREADY_STARTED = 'TANDA_ALREADY_STARTED',
  TANDA_NOT_ACTIVE = 'TANDA_NOT_ACTIVE',
  TANDA_NOT_FORMING = 'TANDA_NOT_FORMING',
  ALREADY_PARTICIPANT = 'ALREADY_PARTICIPANT',
  NOT_PARTICIPANT = 'NOT_PARTICIPANT',
  ALREADY_DEPOSITED = 'ALREADY_DEPOSITED',
  INSUFFICIENT_BALANCE = 'INSUFFICIENT_BALANCE',
  NOT_CREATOR = 'NOT_CREATOR',
  MINIMUM_MEMBERS_REQUIRED = 'MINIMUM_MEMBERS_REQUIRED',

  // Service unavailable (503)
  SOROBAN_NOT_CONFIGURED = 'SOROBAN_NOT_CONFIGURED',

  // Server errors (500)
  SOROBAN_ERROR = 'SOROBAN_ERROR',
  SPONSOR_ERROR = 'SPONSOR_ERROR',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
}

export class AppError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
    public statusCode: number = 400,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'AppError';
  }

  toJSON() {
    return {
      success: false,
      error: {
        code: this.code,
        message: this.message,
        ...(this.details && { details: this.details }),
      },
    };
  }
}

// Factory functions for common errors
export const Errors = {
  // Validation
  validation: (message: string, details?: Record<string, unknown>) =>
    new AppError(ErrorCode.VALIDATION_ERROR, message, 400, details),

  invalidPublicKey: (key?: string) =>
    new AppError(ErrorCode.INVALID_PUBLIC_KEY, `Invalid Stellar public key${key ? `: ${key}` : ''}`, 400),

  missingField: (field: string) =>
    new AppError(ErrorCode.MISSING_REQUIRED_FIELD, `${field} is required`, 400),

  // Not found
  tandaNotFound: (id: string) =>
    new AppError(ErrorCode.TANDA_NOT_FOUND, `Tanda not found: ${id}`, 404),

  userNotFound: (pk: string) =>
    new AppError(ErrorCode.USER_NOT_FOUND, `User not found: ${pk}`, 404),

  memberNotFound: () =>
    new AppError(ErrorCode.MEMBER_NOT_FOUND, 'User is not a member of this tanda', 404),

  // Business logic
  tandaFull: () =>
    new AppError(ErrorCode.TANDA_FULL, 'Tanda has reached maximum participants', 400),

  tandaNotActive: () =>
    new AppError(ErrorCode.TANDA_NOT_ACTIVE, 'Tanda is not active', 400),

  tandaNotForming: () =>
    new AppError(ErrorCode.TANDA_NOT_FORMING, 'Tanda is not accepting new members', 400),

  tandaAlreadyStarted: () =>
    new AppError(ErrorCode.TANDA_ALREADY_STARTED, 'Tanda has already started', 400),

  alreadyParticipant: () =>
    new AppError(ErrorCode.ALREADY_PARTICIPANT, 'Already a participant in this tanda', 400),

  notParticipant: () =>
    new AppError(ErrorCode.NOT_PARTICIPANT, 'Not a participant in this tanda', 400),

  alreadyDeposited: () =>
    new AppError(ErrorCode.ALREADY_DEPOSITED, 'Already deposited for this cycle', 400),

  insufficientBalance: (required?: number, available?: number) =>
    new AppError(ErrorCode.INSUFFICIENT_BALANCE, 'Insufficient balance', 400,
      required !== undefined ? { required, available } : undefined),

  notCreator: () =>
    new AppError(ErrorCode.NOT_CREATOR, 'Only the creator can perform this action', 403),

  minimumMembers: (required: number, current: number) =>
    new AppError(ErrorCode.MINIMUM_MEMBERS_REQUIRED, `Minimum ${required} members required, currently ${current}`, 400),

  // Auth
  kycRequired: () =>
    new AppError(ErrorCode.KYC_REQUIRED, 'KYC verification required', 403),

  unauthorized: (message = 'Unauthorized') =>
    new AppError(ErrorCode.UNAUTHORIZED, message, 401),

  forbidden: (message = 'Forbidden') =>
    new AppError(ErrorCode.FORBIDDEN, message, 403),

  // Service
  sorobanNotConfigured: () =>
    new AppError(ErrorCode.SOROBAN_NOT_CONFIGURED, 'Soroban contract not configured', 503),

  sorobanError: (message: string) =>
    new AppError(ErrorCode.SOROBAN_ERROR, message, 500),

  sponsorError: (message: string) =>
    new AppError(ErrorCode.SPONSOR_ERROR, message, 500),

  internal: (message = 'Internal server error') =>
    new AppError(ErrorCode.INTERNAL_ERROR, message, 500),
};

// Type guard for AppError
export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

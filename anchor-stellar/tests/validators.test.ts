/**
 * Validator Tests
 */

import { describe, it, expect } from 'vitest';
import {
  validate,
  createTandaSchema,
  joinTandaSchema,
  depositSchema,
  stellarPublicKey,
  kycReportSchema,
} from '../src/validators/index.js';

describe('Validators', () => {
  describe('stellarPublicKey', () => {
    it('should accept valid Stellar public key', () => {
      const validKey = 'GAQRF3UGHBT6JYQZ7YSUYCIYWAF4T2SAA5237Q5LIQYJOHHFAWDXZ7NM';
      const result = stellarPublicKey.safeParse(validKey);
      expect(result.success).toBe(true);
    });

    it('should reject invalid Stellar public key - too short', () => {
      const invalidKey = 'GAQRF3UGHBT6JYQZ7YSUY';
      const result = stellarPublicKey.safeParse(invalidKey);
      expect(result.success).toBe(false);
    });

    it('should reject key not starting with G', () => {
      const invalidKey = 'SAQRF3UGHBT6JYQZ7YSUYCIYWAF4T2SAA5237Q5LIQYJOHHFAWDXZ7NM';
      const result = stellarPublicKey.safeParse(invalidKey);
      expect(result.success).toBe(false);
    });

    it('should reject key with invalid characters', () => {
      const invalidKey = 'GAQRF3UGHBT6JYQZ7YSUYCIYWAF4T2SAA5237Q5LIQYJOHHFAWDXZ70M';
      const result = stellarPublicKey.safeParse(invalidKey);
      expect(result.success).toBe(false);
    });

    it('should reject empty string', () => {
      const result = stellarPublicKey.safeParse('');
      expect(result.success).toBe(false);
    });
  });

  describe('createTandaSchema', () => {
    const validWallet = 'GAQRF3UGHBT6JYQZ7YSUYCIYWAF4T2SAA5237Q5LIQYJOHHFAWDXZ7NM';

    it('should validate correct tanda creation', () => {
      const data = {
        creatorWallet: validWallet,
        amount: 100,
        maxParticipants: 5,
      };
      const result = validate(createTandaSchema, data);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.amount).toBe(100);
        expect(result.data.maxParticipants).toBe(5);
      }
    });

    it('should accept optional name', () => {
      const data = {
        creatorWallet: validWallet,
        name: 'Vacation Fund',
        amount: 100,
        maxParticipants: 5,
      };
      const result = validate(createTandaSchema, data);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe('Vacation Fund');
      }
    });

    it('should reject amount below minimum', () => {
      const data = {
        creatorWallet: validWallet,
        amount: 5,
        maxParticipants: 5,
      };
      const result = validate(createTandaSchema, data);
      expect(result.success).toBe(false);
    });

    it('should reject amount above maximum', () => {
      const data = {
        creatorWallet: validWallet,
        amount: 15000,
        maxParticipants: 5,
      };
      const result = validate(createTandaSchema, data);
      expect(result.success).toBe(false);
    });

    it('should reject negative amount', () => {
      const data = {
        creatorWallet: validWallet,
        amount: -100,
        maxParticipants: 5,
      };
      const result = validate(createTandaSchema, data);
      expect(result.success).toBe(false);
    });

    it('should reject too few participants', () => {
      const data = {
        creatorWallet: validWallet,
        amount: 100,
        maxParticipants: 1,
      };
      const result = validate(createTandaSchema, data);
      expect(result.success).toBe(false);
    });

    it('should reject too many participants', () => {
      const data = {
        creatorWallet: validWallet,
        amount: 100,
        maxParticipants: 15,
      };
      const result = validate(createTandaSchema, data);
      expect(result.success).toBe(false);
    });

    it('should reject missing creatorWallet', () => {
      const data = {
        amount: 100,
        maxParticipants: 5,
      };
      const result = validate(createTandaSchema, data);
      expect(result.success).toBe(false);
    });

    it('should accept boundary values', () => {
      const data = {
        creatorWallet: validWallet,
        amount: 10,
        maxParticipants: 2,
      };
      const result = validate(createTandaSchema, data);
      expect(result.success).toBe(true);
    });

    it('should accept maximum boundary values', () => {
      const data = {
        creatorWallet: validWallet,
        amount: 10000,
        maxParticipants: 12,
      };
      const result = validate(createTandaSchema, data);
      expect(result.success).toBe(true);
    });
  });

  describe('joinTandaSchema', () => {
    const validWallet = 'GAQRF3UGHBT6JYQZ7YSUYCIYWAF4T2SAA5237Q5LIQYJOHHFAWDXZ7NM';

    it('should validate correct join request', () => {
      const data = {
        tandaId: '00000001',
        walletAddress: validWallet,
      };
      const result = validate(joinTandaSchema, data);
      expect(result.success).toBe(true);
    });

    it('should reject missing tandaId', () => {
      const data = {
        walletAddress: validWallet,
      };
      const result = validate(joinTandaSchema, data);
      expect(result.success).toBe(false);
    });

    it('should reject missing walletAddress', () => {
      const data = {
        tandaId: '00000001',
      };
      const result = validate(joinTandaSchema, data);
      expect(result.success).toBe(false);
    });
  });

  describe('depositSchema', () => {
    const validWallet = 'GAQRF3UGHBT6JYQZ7YSUYCIYWAF4T2SAA5237Q5LIQYJOHHFAWDXZ7NM';

    it('should validate deposit with wallet only', () => {
      const data = {
        walletAddress: validWallet,
      };
      const result = validate(depositSchema, data);
      expect(result.success).toBe(true);
    });

    it('should accept optional txHash', () => {
      const data = {
        walletAddress: validWallet,
        txHash: 'abc123xyz',
      };
      const result = validate(depositSchema, data);
      expect(result.success).toBe(true);
    });

    it('should reject invalid wallet', () => {
      const data = {
        walletAddress: 'invalid',
      };
      const result = validate(depositSchema, data);
      expect(result.success).toBe(false);
    });
  });

  describe('kycReportSchema', () => {
    const validWallet = 'GAQRF3UGHBT6JYQZ7YSUYCIYWAF4T2SAA5237Q5LIQYJOHHFAWDXZ7NM';

    it('should validate correct KYC report', () => {
      const data = {
        publicKey: validWallet,
        country: 'ES',
      };
      const result = validate(kycReportSchema, data);
      expect(result.success).toBe(true);
    });

    it('should convert country to uppercase', () => {
      const data = {
        publicKey: validWallet,
        country: 'es',
      };
      const result = validate(kycReportSchema, data);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.country).toBe('ES');
      }
    });

    it('should reject invalid country code length', () => {
      const data = {
        publicKey: validWallet,
        country: 'ESP',
      };
      const result = validate(kycReportSchema, data);
      expect(result.success).toBe(false);
    });
  });
});

/**
 * Security Service
 * Secure PIN handling with proper hashing and salt
 */

import { Platform } from 'react-native';
import { secureStorage } from './storage';

const PIN_HASH_KEY = 'tanda_pin_hash_v2';
const PIN_SALT_KEY = 'tanda_pin_salt_v2';
const PIN_ATTEMPTS_KEY = 'tanda_pin_attempts';
const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

// Import expo-crypto only for native platforms
let Crypto: typeof import('expo-crypto') | null = null;
if (Platform.OS !== 'web') {
  Crypto = require('expo-crypto');
}

interface AttemptData {
  count: number;
  lastAttempt: number;
  lockedUntil: number | null;
}

class SecurityService {
  private static instance: SecurityService;

  private constructor() {}

  static getInstance(): SecurityService {
    if (!SecurityService.instance) {
      SecurityService.instance = new SecurityService();
    }
    return SecurityService.instance;
  }

  /**
   * Generate a random salt
   */
  private async generateSalt(): Promise<string> {
    if (Platform.OS === 'web') {
      // Use Web Crypto API
      const array = new Uint8Array(16);
      crypto.getRandomValues(array);
      return this.bytesToHex(array);
    } else if (Crypto) {
      const randomBytes = await Crypto.getRandomBytesAsync(16);
      return this.bytesToHex(randomBytes);
    }
    // Fallback (not secure, but works)
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
  }

  /**
   * Convert bytes to hex string
   */
  private bytesToHex(bytes: Uint8Array): string {
    return Array.from(bytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  /**
   * Hash PIN with salt using SHA-256
   */
  private async hashPin(pin: string, salt: string): Promise<string> {
    const data = `${salt}:${pin}:tanda_secure_2024`;

    if (Platform.OS === 'web') {
      // Use Web Crypto API
      const encoder = new TextEncoder();
      const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(data));
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    } else if (Crypto) {
      return await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        data
      );
    }

    // Fallback (less secure)
    return this.simplehash(data);
  }

  /**
   * Simple hash fallback (not cryptographically secure)
   */
  private simplehash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16).padStart(8, '0');
  }

  /**
   * Set a new PIN (hashed with salt)
   */
  async setPin(pin: string): Promise<boolean> {
    try {
      // Validate PIN format (6 digits)
      if (!/^\d{6}$/.test(pin)) {
        console.error('[Security] PIN must be 6 digits');
        return false;
      }

      // Generate new salt
      const salt = await this.generateSalt();

      // Hash the PIN
      const hash = await this.hashPin(pin, salt);

      // Store salt and hash
      await secureStorage.set(PIN_SALT_KEY, salt);
      await secureStorage.set(PIN_HASH_KEY, hash);

      // Reset attempts
      await this.resetAttempts();

      console.log('[Security] PIN set successfully');
      return true;
    } catch (error) {
      console.error('[Security] Error setting PIN:', error);
      return false;
    }
  }

  /**
   * Verify PIN against stored hash
   */
  async verifyPin(pin: string): Promise<{ success: boolean; locked?: boolean; attemptsRemaining?: number; lockoutMinutes?: number }> {
    try {
      // Check if locked out
      const attempts = await this.getAttempts();
      if (attempts.lockedUntil && Date.now() < attempts.lockedUntil) {
        const minutesRemaining = Math.ceil((attempts.lockedUntil - Date.now()) / 60000);
        return { success: false, locked: true, lockoutMinutes: minutesRemaining };
      }

      // Get stored salt and hash
      const salt = await secureStorage.get(PIN_SALT_KEY);
      const storedHash = await secureStorage.get(PIN_HASH_KEY);

      if (!salt || !storedHash) {
        console.log('[Security] No PIN configured');
        return { success: false };
      }

      // Hash the provided PIN
      const hash = await this.hashPin(pin, salt);

      if (hash === storedHash) {
        // Success - reset attempts
        await this.resetAttempts();
        return { success: true };
      }

      // Failed attempt - increment counter
      const newAttempts = await this.incrementAttempts();
      const remaining = MAX_ATTEMPTS - newAttempts.count;

      if (remaining <= 0) {
        // Lock out the user
        const lockedUntil = Date.now() + LOCKOUT_DURATION_MS;
        await this.setLockout(lockedUntil);
        return { success: false, locked: true, lockoutMinutes: 15, attemptsRemaining: 0 };
      }

      return { success: false, attemptsRemaining: remaining };
    } catch (error) {
      console.error('[Security] Error verifying PIN:', error);
      return { success: false };
    }
  }

  /**
   * Check if PIN is configured
   */
  async hasPin(): Promise<boolean> {
    const hash = await secureStorage.get(PIN_HASH_KEY);
    return !!hash;
  }

  /**
   * Remove PIN
   */
  async removePin(): Promise<void> {
    await secureStorage.delete(PIN_SALT_KEY);
    await secureStorage.delete(PIN_HASH_KEY);
    await this.resetAttempts();
    console.log('[Security] PIN removed');
  }

  /**
   * Change PIN (requires current PIN verification)
   */
  async changePin(currentPin: string, newPin: string): Promise<{ success: boolean; error?: string }> {
    const verification = await this.verifyPin(currentPin);

    if (!verification.success) {
      if (verification.locked) {
        return { success: false, error: `Cuenta bloqueada por ${verification.lockoutMinutes} minutos` };
      }
      return { success: false, error: `PIN incorrecto. Intentos restantes: ${verification.attemptsRemaining}` };
    }

    const result = await this.setPin(newPin);
    if (!result) {
      return { success: false, error: 'Error al cambiar el PIN' };
    }

    return { success: true };
  }

  /**
   * Get attempt tracking data
   */
  private async getAttempts(): Promise<AttemptData> {
    try {
      const data = await secureStorage.get(PIN_ATTEMPTS_KEY);
      if (data) {
        return JSON.parse(data);
      }
    } catch {
      // Ignore parse errors
    }
    return { count: 0, lastAttempt: 0, lockedUntil: null };
  }

  /**
   * Increment failed attempt counter
   */
  private async incrementAttempts(): Promise<AttemptData> {
    const attempts = await this.getAttempts();
    attempts.count += 1;
    attempts.lastAttempt = Date.now();
    await secureStorage.set(PIN_ATTEMPTS_KEY, JSON.stringify(attempts));
    return attempts;
  }

  /**
   * Set lockout time
   */
  private async setLockout(lockedUntil: number): Promise<void> {
    const attempts = await this.getAttempts();
    attempts.lockedUntil = lockedUntil;
    await secureStorage.set(PIN_ATTEMPTS_KEY, JSON.stringify(attempts));
  }

  /**
   * Reset attempt counter
   */
  private async resetAttempts(): Promise<void> {
    await secureStorage.set(PIN_ATTEMPTS_KEY, JSON.stringify({
      count: 0,
      lastAttempt: 0,
      lockedUntil: null,
    }));
  }

  /**
   * Get lockout status
   */
  async getLockoutStatus(): Promise<{ locked: boolean; minutesRemaining?: number }> {
    const attempts = await this.getAttempts();
    if (attempts.lockedUntil && Date.now() < attempts.lockedUntil) {
      const minutesRemaining = Math.ceil((attempts.lockedUntil - Date.now()) / 60000);
      return { locked: true, minutesRemaining };
    }
    return { locked: false };
  }
}

export const securityService = SecurityService.getInstance();

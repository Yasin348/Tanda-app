/**
 * Servicio de reintentos para depósitos fallidos
 *
 * Gestiona el sistema de reintentos automáticos cuando un depósito falla
 * por fondos insuficientes u otros errores.
 *
 * Reglas:
 * - Máximo 7 intentos (1 inicial + 6 reintentos)
 * - Reintento cada 24 horas
 * - Si falla tras 7 intentos: expulsar usuario y aplicar -25 scoring
 */

import { secureStorage } from './storage';
import {
  FailedDeposit,
  FailedDepositStatus,
  DEPOSIT_RETRY_CONFIG
} from '../types';

const STORAGE_KEY = 'tanda_failed_deposits';

class DepositRetryService {
  private static instance: DepositRetryService;
  private failedDeposits: Map<string, FailedDeposit> = new Map();
  private retryTimer: NodeJS.Timeout | null = null;
  private onRetryCallback: ((deposit: FailedDeposit) => Promise<boolean>) | null = null;
  private onExpelCallback: ((deposit: FailedDeposit) => Promise<void>) | null = null;

  private constructor() {}

  static getInstance(): DepositRetryService {
    if (!DepositRetryService.instance) {
      DepositRetryService.instance = new DepositRetryService();
    }
    return DepositRetryService.instance;
  }

  /**
   * Inicializar el servicio y cargar depósitos fallidos desde storage
   */
  async initialize(): Promise<void> {
    await this.loadFromStorage();
    this.startRetryScheduler();
    console.log('[DepositRetry] Initialized with', this.failedDeposits.size, 'pending retries');
  }

  /**
   * Registrar callbacks para reintentos y expulsiones
   */
  setCallbacks(
    onRetry: (deposit: FailedDeposit) => Promise<boolean>,
    onExpel: (deposit: FailedDeposit) => Promise<void>
  ): void {
    this.onRetryCallback = onRetry;
    this.onExpelCallback = onExpel;
  }

  /**
   * Registrar un depósito fallido para reintentos
   */
  async registerFailedDeposit(
    tandaId: string,
    walletAddress: string,
    amount: number,
    cycle: number,
    errorMessage: string
  ): Promise<FailedDeposit> {
    const id = `${tandaId}_${walletAddress}_${cycle}`;
    const now = Date.now();

    // Verificar si ya existe un registro para este depósito
    const existing = this.failedDeposits.get(id);

    if (existing && existing.status === 'pending_retry') {
      // Ya existe, incrementar contador
      console.log('[DepositRetry] Updating existing failed deposit:', id);
      existing.attemptCount += 1;
      existing.lastAttemptAt = now;
      existing.errorMessage = errorMessage;
      existing.nextRetryAt = now + DEPOSIT_RETRY_CONFIG.retryIntervalMs;

      // Verificar si alcanzó el máximo de intentos
      if (existing.attemptCount >= DEPOSIT_RETRY_CONFIG.maxAttempts) {
        existing.status = 'failed_permanent';
        console.log('[DepositRetry] Max attempts reached for:', id);
        await this.handlePermanentFailure(existing);
      }

      await this.saveToStorage();
      return existing;
    }

    // Crear nuevo registro
    const failedDeposit: FailedDeposit = {
      id,
      tandaId,
      walletAddress,
      amount,
      cycle,
      firstFailedAt: now,
      lastAttemptAt: now,
      attemptCount: 1,
      errorMessage,
      status: 'pending_retry',
      nextRetryAt: now + DEPOSIT_RETRY_CONFIG.gracePeriodMs,
    };

    this.failedDeposits.set(id, failedDeposit);
    await this.saveToStorage();

    console.log('[DepositRetry] Registered failed deposit:', id, 'Next retry at:', new Date(failedDeposit.nextRetryAt).toISOString());

    return failedDeposit;
  }

  /**
   * Marcar un depósito como resuelto (éxito en reintento)
   */
  async markAsResolved(tandaId: string, walletAddress: string, cycle: number): Promise<void> {
    const id = `${tandaId}_${walletAddress}_${cycle}`;
    const deposit = this.failedDeposits.get(id);

    if (deposit) {
      deposit.status = 'resolved';
      deposit.lastAttemptAt = Date.now();
      await this.saveToStorage();
      console.log('[DepositRetry] Deposit resolved successfully:', id);
    }
  }

  /**
   * Obtener depósitos fallidos pendientes para un usuario
   */
  getPendingDepositsForUser(walletAddress: string): FailedDeposit[] {
    return Array.from(this.failedDeposits.values())
      .filter(d =>
        d.walletAddress === walletAddress &&
        d.status === 'pending_retry'
      );
  }

  /**
   * Obtener todos los depósitos fallidos pendientes
   */
  getAllPendingDeposits(): FailedDeposit[] {
    return Array.from(this.failedDeposits.values())
      .filter(d => d.status === 'pending_retry');
  }

  /**
   * Obtener un depósito fallido específico
   */
  getFailedDeposit(tandaId: string, walletAddress: string, cycle: number): FailedDeposit | undefined {
    const id = `${tandaId}_${walletAddress}_${cycle}`;
    return this.failedDeposits.get(id);
  }

  /**
   * Verificar si hay un depósito pendiente para una tanda/ciclo
   */
  hasPendingDeposit(tandaId: string, walletAddress: string, cycle: number): boolean {
    const id = `${tandaId}_${walletAddress}_${cycle}`;
    const deposit = this.failedDeposits.get(id);
    return deposit?.status === 'pending_retry';
  }

  /**
   * Obtener información de reintentos para mostrar al usuario
   */
  getRetryInfo(tandaId: string, walletAddress: string, cycle: number): {
    hasPending: boolean;
    attemptCount: number;
    maxAttempts: number;
    nextRetryAt: Date | null;
    daysRemaining: number;
  } | null {
    const deposit = this.getFailedDeposit(tandaId, walletAddress, cycle);

    if (!deposit || deposit.status !== 'pending_retry') {
      return null;
    }

    const now = Date.now();
    const msRemaining = (deposit.firstFailedAt + (6 * 24 * 60 * 60 * 1000)) - now;
    const daysRemaining = Math.max(0, Math.ceil(msRemaining / (24 * 60 * 60 * 1000)));

    return {
      hasPending: true,
      attemptCount: deposit.attemptCount,
      maxAttempts: DEPOSIT_RETRY_CONFIG.maxAttempts,
      nextRetryAt: new Date(deposit.nextRetryAt),
      daysRemaining,
    };
  }

  /**
   * Ejecutar reintentos pendientes
   */
  async processRetries(): Promise<void> {
    if (!this.onRetryCallback) {
      console.warn('[DepositRetry] No retry callback set');
      return;
    }

    const now = Date.now();
    const pendingRetries = Array.from(this.failedDeposits.values())
      .filter(d => d.status === 'pending_retry' && d.nextRetryAt <= now);

    console.log('[DepositRetry] Processing', pendingRetries.length, 'pending retries');

    for (const deposit of pendingRetries) {
      await this.processRetry(deposit);
    }
  }

  /**
   * Procesar un reintento individual
   */
  private async processRetry(deposit: FailedDeposit): Promise<void> {
    console.log('[DepositRetry] Retrying deposit:', deposit.id, 'Attempt:', deposit.attemptCount + 1);

    deposit.status = 'retrying';
    deposit.attemptCount += 1;
    deposit.lastAttemptAt = Date.now();

    try {
      const success = await this.onRetryCallback!(deposit);

      if (success) {
        deposit.status = 'resolved';
        console.log('[DepositRetry] Retry successful for:', deposit.id);
      } else {
        // Falló el reintento
        if (deposit.attemptCount >= DEPOSIT_RETRY_CONFIG.maxAttempts) {
          deposit.status = 'failed_permanent';
          console.log('[DepositRetry] Max attempts reached after retry for:', deposit.id);
          await this.handlePermanentFailure(deposit);
        } else {
          deposit.status = 'pending_retry';
          deposit.nextRetryAt = Date.now() + DEPOSIT_RETRY_CONFIG.retryIntervalMs;
          console.log('[DepositRetry] Retry failed, next at:', new Date(deposit.nextRetryAt).toISOString());
        }
      }
    } catch (error: any) {
      console.error('[DepositRetry] Retry error:', error);
      deposit.errorMessage = error?.message || 'Retry failed';

      if (deposit.attemptCount >= DEPOSIT_RETRY_CONFIG.maxAttempts) {
        deposit.status = 'failed_permanent';
        await this.handlePermanentFailure(deposit);
      } else {
        deposit.status = 'pending_retry';
        deposit.nextRetryAt = Date.now() + DEPOSIT_RETRY_CONFIG.retryIntervalMs;
      }
    }

    await this.saveToStorage();
  }

  /**
   * Manejar fallo permanente (expulsar usuario)
   */
  private async handlePermanentFailure(deposit: FailedDeposit): Promise<void> {
    console.log('[DepositRetry] Handling permanent failure for:', deposit.id);

    if (this.onExpelCallback) {
      try {
        await this.onExpelCallback(deposit);
        deposit.status = 'user_expelled';
        console.log('[DepositRetry] User expelled from tanda:', deposit.tandaId);
      } catch (error) {
        console.error('[DepositRetry] Error expelling user:', error);
      }
    }

    await this.saveToStorage();
  }

  /**
   * Forzar un reintento manual (si el usuario añade fondos)
   */
  async forceRetry(tandaId: string, walletAddress: string, cycle: number): Promise<boolean> {
    const id = `${tandaId}_${walletAddress}_${cycle}`;
    const deposit = this.failedDeposits.get(id);

    if (!deposit || deposit.status !== 'pending_retry') {
      console.log('[DepositRetry] No pending deposit to retry:', id);
      return false;
    }

    if (!this.onRetryCallback) {
      console.warn('[DepositRetry] No retry callback set');
      return false;
    }

    console.log('[DepositRetry] Forcing retry for:', id);
    await this.processRetry(deposit);

    return deposit.status === 'resolved';
  }

  /**
   * Cancelar reintentos (si el usuario es expulsado por votación, etc.)
   */
  async cancelRetries(tandaId: string, walletAddress: string): Promise<void> {
    const toCancel = Array.from(this.failedDeposits.values())
      .filter(d =>
        d.tandaId === tandaId &&
        d.walletAddress === walletAddress &&
        d.status === 'pending_retry'
      );

    for (const deposit of toCancel) {
      deposit.status = 'user_expelled';
    }

    if (toCancel.length > 0) {
      await this.saveToStorage();
      console.log('[DepositRetry] Cancelled', toCancel.length, 'pending retries for user');
    }
  }

  /**
   * Iniciar el scheduler de reintentos
   */
  private startRetryScheduler(): void {
    // Verificar cada hora si hay reintentos pendientes
    const checkInterval = 60 * 60 * 1000; // 1 hora

    if (this.retryTimer) {
      clearInterval(this.retryTimer);
    }

    this.retryTimer = setInterval(async () => {
      await this.processRetries();
    }, checkInterval);

    // También ejecutar inmediatamente al iniciar
    this.processRetries();
  }

  /**
   * Detener el scheduler
   */
  stopRetryScheduler(): void {
    if (this.retryTimer) {
      clearInterval(this.retryTimer);
      this.retryTimer = null;
    }
  }

  /**
   * Cargar depósitos fallidos desde storage
   */
  private async loadFromStorage(): Promise<void> {
    try {
      const data = await secureStorage.get(STORAGE_KEY);
      if (data) {
        const deposits: FailedDeposit[] = JSON.parse(data);
        this.failedDeposits.clear();
        deposits.forEach(d => this.failedDeposits.set(d.id, d));
      }
    } catch (error) {
      console.error('[DepositRetry] Error loading from storage:', error);
    }
  }

  /**
   * Guardar depósitos fallidos en storage
   */
  private async saveToStorage(): Promise<void> {
    try {
      const deposits = Array.from(this.failedDeposits.values());
      await secureStorage.set(STORAGE_KEY, JSON.stringify(deposits));
    } catch (error) {
      console.error('[DepositRetry] Error saving to storage:', error);
    }
  }

  /**
   * Limpiar depósitos resueltos/antiguos
   */
  async cleanup(): Promise<void> {
    const now = Date.now();
    const maxAge = 30 * 24 * 60 * 60 * 1000; // 30 días

    const toRemove: string[] = [];

    this.failedDeposits.forEach((deposit, id) => {
      // Eliminar resueltos o expulsados después de 30 días
      if (
        (deposit.status === 'resolved' || deposit.status === 'user_expelled') &&
        (now - deposit.lastAttemptAt) > maxAge
      ) {
        toRemove.push(id);
      }
    });

    toRemove.forEach(id => this.failedDeposits.delete(id));

    if (toRemove.length > 0) {
      await this.saveToStorage();
      console.log('[DepositRetry] Cleaned up', toRemove.length, 'old records');
    }
  }

  /**
   * Obtener estadísticas del sistema de reintentos
   */
  getStats(): {
    total: number;
    pending: number;
    resolved: number;
    failed: number;
    expelled: number;
  } {
    const deposits = Array.from(this.failedDeposits.values());
    return {
      total: deposits.length,
      pending: deposits.filter(d => d.status === 'pending_retry' || d.status === 'retrying').length,
      resolved: deposits.filter(d => d.status === 'resolved').length,
      failed: deposits.filter(d => d.status === 'failed_permanent').length,
      expelled: deposits.filter(d => d.status === 'user_expelled').length,
    };
  }
}

export const depositRetryService = DepositRetryService.getInstance();

// Tipos principales de la aplicación

export interface User {
  publicKey: string;
  score: number;
  createdAt: number;
  totalTandas: number;
  completedTandas: number;
  activeDebt: boolean;
}

export interface TandaParticipant {
  publicKey: string;
  alias?: string;
  joinedAt: number;
  hasDeposited: boolean;
  hasWithdrawn: boolean;
  score: number;
}

export interface Tanda {
  id: string;
  creatorPublicKey: string;
  name: string; // Opcional - puede estar vacío
  amount: number; // Monto por ciclo en euros
  maxParticipants: number;
  minScore: number;
  participants: TandaParticipant[];
  currentCycle: number;
  totalCycles: number; // Igual al número de participantes
  status: TandaStatus;
  createdAt: number;
  lastPayoutAt?: number; // Timestamp del último pago (para calcular morosidad)
  beneficiaryIndex: number; // Índice del participante que recibe en este ciclo
  beneficiaryOrder: number[]; // Orden de los participantes para cobrar
}

export type TandaStatus = 'waiting' | 'active' | 'completed' | 'cancelled';

export interface SecuritySettings {
  biometricEnabled: boolean;
  biometricType: 'fingerprint' | 'faceId' | null;
  pinEnabled: boolean;
  pinHash?: string;
  noProtection: boolean;
}

export interface Transaction {
  id: string;
  type: 'deposit' | 'withdrawal' | 'receive';
  amount: number;
  tandaId: string;
  tandaName: string;
  timestamp: number;
  status: 'pending' | 'confirmed' | 'failed';
}

export interface OnboardingState {
  step: number;
  seed: string | null;
  seedConfirmed: boolean;
  securityConfigured: boolean;
  backupLocation: string | null;
}

// Sistema de reintentos para depósitos fallidos
export interface FailedDeposit {
  id: string;                    // ID único del intento fallido
  tandaId: string;               // ID de la tanda
  walletAddress: string;         // Wallet del usuario
  amount: number;                // Monto que debía depositar
  cycle: number;                 // Ciclo en que falló
  firstFailedAt: number;         // Timestamp del primer fallo
  lastAttemptAt: number;         // Timestamp del último intento
  attemptCount: number;          // Número de intentos (max 7)
  errorMessage: string;          // Último mensaje de error
  status: FailedDepositStatus;   // Estado actual
  nextRetryAt: number;           // Cuándo reintentar (timestamp)
}

export type FailedDepositStatus =
  | 'pending_retry'              // Esperando próximo reintento
  | 'retrying'                   // Reintentando ahora
  | 'resolved'                   // Depósito completado exitosamente
  | 'failed_permanent'           // Falló definitivamente (7 intentos)
  | 'user_expelled';             // Usuario expulsado de la tanda

export interface DepositRetryConfig {
  maxAttempts: number;           // 7 intentos total
  retryIntervalMs: number;       // 24 horas en ms
  gracePeriodMs: number;         // Período de gracia antes de primer reintento
}

// Constantes de configuración de reintentos
export const DEPOSIT_RETRY_CONFIG: DepositRetryConfig = {
  maxAttempts: 7,
  retryIntervalMs: 24 * 60 * 60 * 1000,  // 24 horas
  gracePeriodMs: 1 * 60 * 60 * 1000,      // 1 hora de gracia inicial
};

/**
 * Network Configuration for Tanda App
 *
 * Architecture:
 * - Stellar Network for all blockchain operations
 * - Anchor server for fee sponsorship (XLM fee-bump)
 * - EURC stablecoin on Stellar (Mykobo issuer)
 * - Mykobo for EUR <-> EURC on/off ramp (SEP-24)
 */

import { Platform } from 'react-native';

// ==================== ANCHOR SERVER ====================

/**
 * Get the correct localhost URL based on platform
 */
const getDevServerUrl = () => {
  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:3001';
  }
  return 'http://localhost:3001';
};

/**
 * Anchor server configuration
 * The Anchor handles fee sponsorship (XLM fee-bump) and user tracking
 */
export const ANCHOR_CONFIG = {
  testnet: {
    url: __DEV__
      ? getDevServerUrl()
      : 'https://tanda-anchor.fly.dev',
  },
  mainnet: {
    url: 'https://tanda-anchor.fly.dev',
  },
};

// ==================== STELLAR NETWORK ====================

/**
 * Stellar Network configuration
 * Stellar provides:
 * - Native Stellar wallet (Ed25519)
 * - EURC stablecoin (Mykobo issuer)
 * - Fee-bump sponsorship (gasless for users)
 * - Soroban smart contracts
 */
export const STELLAR_CONFIG = {
  // Network: 'testnet' or 'mainnet'
  network: 'mainnet' as 'testnet' | 'mainnet',

  get horizonUrl(): string {
    return this.network === 'mainnet'
      ? 'https://horizon.stellar.org'
      : 'https://horizon-testnet.stellar.org';
  },

  // EURC issuer (Mykobo)
  eurcIssuer: 'GAQRF3UGHBT6JYQZ7YSUYCIYWAF4T2SAA5237Q5LIQYJOHHFAWDXZ7NM',

  // Always enabled (primary network)
  enabled: true,
};

// ==================== MYKOBO ====================

/**
 * Mykobo configuration for EUR <-> EURC
 * Handles on/off ramp via SEP-24
 */
export const MYKOBO_CONFIG = {
  anchorDomain: 'eurc.mykobo.co',

  // Fees for display (actual fees come from Mykobo)
  fees: {
    onramp: 0.5,      // ~0.5% EUR -> EURC
    offramp: 0.5,     // ~0.5% EURC -> EUR
    minAmount: 10,    // Minimum 10 EUR
    maxAmount: 10000, // Maximum 10,000 EUR
  },
};

// ==================== TOKENS ====================

/**
 * EURC Token configuration on Stellar Network
 */
export const EURC_TOKEN = {
  testnet: {
    code: 'EURC',
    issuer: STELLAR_CONFIG.eurcIssuer,
    decimals: 7, // Stellar uses 7 decimals
    name: 'Euro Coin (Test)',
    displayName: 'Euro',
    displaySymbol: '€',
  },
  mainnet: {
    code: 'EURC',
    issuer: STELLAR_CONFIG.eurcIssuer,
    decimals: 7,
    name: 'Euro Coin',
    displayName: 'Euro',
    displaySymbol: '€',
  },
};

/**
 * XLM (Stellar Lumens) for gas
 * Note: Users don't need XLM - fees are sponsored by Anchor
 */
export const XLM_TOKEN = {
  code: 'XLM',
  name: 'Stellar Lumens',
  decimals: 7,
  displayName: 'XLM',
  displaySymbol: 'XLM',
};

// ==================== FEE CONFIGURATION ====================

/**
 * Fee configuration
 * All fees are sponsored by Anchor via fee-bump
 * Users pay a small EURC commission per operation
 */
export const FEE_CONFIG = {
  // Commission per operation in EURC
  // Deducted from user's transaction
  commissionEurc: 0.05,

  // Operations that are free (no commission)
  freeOperations: ['kyc', 'trustline'],
};

// ==================== TANDA CONFIGURATION ====================

/**
 * Tanda operations configuration
 *
 * Commission model:
 * - User includes commission in their transfer
 * - E.g., for €50 deposit, user sends €50.05 (deposit + commission)
 * - Anchor receives commission separately
 */
export const TANDA_CONFIG = {
  // Commission per operation in EURC
  commission: 0.05,

  // Safety fund percentage
  safetyFundPercent: 5,
};

// ==================== KYC CONFIGURATION ====================

/**
 * KYC configuration
 * KYC is handled by Mykobo via SEP-24
 */
export const KYC_CONFIG = {
  // KYC fee (in EURC) - usually free with Mykobo
  fee: 0,
  feeEnabled: false,

  // Provider
  provider: 'mykobo',
};

// ==================== ENVIRONMENT ====================

/**
 * Current environment configuration
 */
export const ENV = {
  current: 'mainnet' as 'testnet' | 'mainnet',
  debug: __DEV__ || false,
};

// ==================== HELPERS ====================

/**
 * Get current token configuration
 */
export const getCurrentToken = () => EURC_TOKEN[ENV.current];

/**
 * Get current Anchor URL
 */
export const getAnchorUrl = () => ANCHOR_CONFIG[ENV.current].url;

/**
 * Get Stellar network identifier
 */
export const getStellarNetwork = () => STELLAR_CONFIG.network;

/**
 * Format amount with Euro symbol
 */
export const formatEuro = (amount: number | string, showSymbol: boolean = true): string => {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  const token = getCurrentToken();
  const symbol = token.displaySymbol;

  if (isNaN(num)) return showSymbol ? `${symbol}0.00` : '0.00';

  const formatted = num.toLocaleString('es-ES', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return showSymbol ? `${symbol}${formatted}` : formatted;
};

/**
 * Format XLM amount
 */
export const formatXlm = (amount: number | string): string => {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(num)) return '0.0000 XLM';

  return `${num.toFixed(4)} XLM`;
};

/**
 * Parse Euro amount from string
 */
export const parseEuroAmount = (input: string): number => {
  const cleaned = input.replace(/[€$\s]/g, '').replace(',', '.');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
};

// ==================== CONVERSION HELPERS ====================

const STELLAR_DECIMALS = 7;

/**
 * Convert Stellar token units to display value
 */
export const tokenToEuro = (units: bigint | string | number): number => {
  const value = typeof units === 'bigint' ? units : BigInt(Math.floor(Number(units)));
  return Number(value) / Math.pow(10, STELLAR_DECIMALS);
};

/**
 * Convert Euro to Stellar token units
 */
export const euroToToken = (euro: number): bigint => {
  const tokenValue = Math.floor(euro * Math.pow(10, STELLAR_DECIMALS));
  return BigInt(tokenValue);
};

/**
 * Convert stroops to XLM
 */
export const stroopsToXlm = (stroops: number | bigint): number => {
  const value = typeof stroops === 'bigint' ? Number(stroops) : stroops;
  return value / 10000000;
};

/**
 * Convert XLM to stroops
 */
export const xlmToStroops = (xlm: number): bigint => {
  return BigInt(Math.floor(xlm * 10000000));
};

// Legacy aliases for compatibility
export const weiToEuro = tokenToEuro;
export const euroToWei = euroToToken;

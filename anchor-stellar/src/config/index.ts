import 'dotenv/config';

// Validate required environment variables
function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

// Server configuration
export const SERVER_CONFIG = {
  port: parseInt(process.env.PORT || '3001', 10),
};

// Stellar Network configuration
export const STELLAR_CONFIG = {
  // 'testnet' or 'mainnet'
  network: (process.env.STELLAR_NETWORK || 'testnet') as 'testnet' | 'mainnet',

  // Horizon URL
  get horizonUrl(): string {
    return this.network === 'mainnet'
      ? 'https://horizon.stellar.org'
      : 'https://horizon-testnet.stellar.org';
  },

  // Soroban RPC URL
  get sorobanRpcUrl(): string {
    return process.env.SOROBAN_RPC_URL ||
      (this.network === 'mainnet'
        ? 'https://soroban.stellar.org'
        : 'https://soroban-testnet.stellar.org');
  },

  // Network passphrase
  get networkPassphrase(): string {
    return this.network === 'mainnet'
      ? 'Public Global Stellar Network ; September 2015'
      : 'Test SDF Network ; September 2015';
  },

  // Sponsor wallet secret key
  sponsorSecret: requireEnv('SPONSOR_SECRET_KEY'),

  // Smart contract ID (optional, for when contract is deployed)
  contractId: process.env.CONTRACT_ID || '',
};

// EURC Configuration
export const EURC_CONFIG = {
  code: 'EURC',
  // Mykobo EURC issuer on Stellar
  issuer: process.env.EURC_ISSUER || 'GAQRF3UGHBT6JYQZ7YSUYCIYWAF4T2SAA5237Q5LIQYJOHHFAWDXZ7NM',
  decimals: 7, // Stellar standard
};

// Gas configuration (commissions are now charged by smart contract)
export const GAS_CONFIG = {
  // Max fee for sponsored transactions (in stroops, 1 XLM = 10^7 stroops)
  maxFeeStroops: parseInt(process.env.MAX_FEE_STROOPS || '100000', 10),

  // Minimum XLM balance warning threshold
  minSponsorBalance: parseFloat(process.env.MIN_SPONSOR_BALANCE || '10'),

  // Commission info (for reference - actual charging is done by smart contract)
  // Create tanda: 0.10 EURC (fixed)
  // Deposit: 0.5% of amount
  // Advance: FREE
};

// XLM decimals (Stellar uses 7 decimals)
export const XLM_DECIMALS = 7;

// Convert XLM to stroops
export function xlmToStroops(xlm: number): number {
  return Math.floor(xlm * 10_000_000);
}

// Convert stroops to XLM
export function stroopsToXlm(stroops: number): number {
  return stroops / 10_000_000;
}

// Convert EURC to smallest unit
export function eurcToUnits(eurc: number): bigint {
  return BigInt(Math.floor(eurc * Math.pow(10, EURC_CONFIG.decimals)));
}

// Convert smallest unit to EURC
export function unitsToEurc(units: bigint): number {
  return Number(units) / Math.pow(10, EURC_CONFIG.decimals);
}

// Log configuration on startup (without sensitive data)
export function logConfig(): void {
  console.log('[Config] Server port:', SERVER_CONFIG.port);
  console.log('[Config] Stellar network:', STELLAR_CONFIG.network);
  console.log('[Config] Horizon URL:', STELLAR_CONFIG.horizonUrl);
  console.log('[Config] Soroban RPC:', STELLAR_CONFIG.sorobanRpcUrl);
  console.log('[Config] Commissions (charged by smart contract):');
  console.log('[Config]   - Create tanda: €0.10 EURC (fixed)');
  console.log('[Config]   - Deposit: 0.5% of amount');
  console.log('[Config]   - Advance: FREE');
  console.log('[Config] KYC: FREE (Mykobo handles it)');
  console.log('[Config] Gas: Fee-bump sponsorship');
  if (STELLAR_CONFIG.contractId) {
    console.log('[Config] Contract ID:', STELLAR_CONFIG.contractId);
  } else {
    console.log('[Config] Contract ID: Not deployed yet');
  }
}

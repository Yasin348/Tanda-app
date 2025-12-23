/**
 * Stellar Service
 *
 * Wallet and blockchain service for Tanda on Stellar Network.
 * Main wallet and blockchain service for Tanda.
 *
 * Features:
 * - Wallet creation from BIP39 seed
 * - EURC balance and transfers
 * - XLM (gas) balance
 * - Transaction building (unsigned, for sponsorship)
 */

import {
  Keypair,
  Horizon,
  Asset,
  TransactionBuilder,
  Operation,
  Networks,
  Memo,
} from '@stellar/stellar-sdk';
import { generateMnemonic, mnemonicToSeedSync, validateMnemonic } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english.js';
import { hmac } from '@noble/hashes/hmac';
import { sha512 } from '@noble/hashes/sha512';

// ==================== CONFIGURATION ====================

const STELLAR_CONFIG = {
  network: 'testnet' as 'testnet' | 'mainnet',

  get horizonUrl(): string {
    return this.network === 'mainnet'
      ? 'https://horizon.stellar.org'
      : 'https://horizon-testnet.stellar.org';
  },

  get networkPassphrase(): string {
    return this.network === 'mainnet'
      ? Networks.PUBLIC
      : Networks.TESTNET;
  },
};

// Mykobo EURC on Stellar
const EURC_CONFIG = {
  code: 'EURC',
  issuer: 'GAQRF3UGHBT6JYQZ7YSUYCIYWAF4T2SAA5237Q5LIQYJOHHFAWDXZ7NM',
  decimals: 7,
};

// ==================== TYPES ====================

export interface StellarAccount {
  publicKey: string;
  secretKey: string;
}

export interface StellarBalance {
  xlm: number;
  eurc: number;
}

export interface TransferResult {
  success: boolean;
  txXdr?: string;  // Unsigned transaction XDR (for sponsorship)
  txHash?: string;
  error?: string;
}

// ==================== SERVICE ====================

class StellarService {
  private static instance: StellarService;
  private keypair: Keypair | null = null;
  private horizon: Horizon.Server;
  private initialized: boolean = false;

  private constructor() {
    this.horizon = new Horizon.Server(STELLAR_CONFIG.horizonUrl);
  }

  static getInstance(): StellarService {
    if (!StellarService.instance) {
      StellarService.instance = new StellarService();
    }
    return StellarService.instance;
  }

  // ==================== MNEMONIC GENERATION ====================

  /**
   * Generate a new BIP39 mnemonic (12 words)
   * Uses standard BIP39 word list
   */
  generateMnemonic(): string {
    // Generate 128 bits of entropy for 12 words
    return generateMnemonic(wordlist, 128);
  }

  /**
   * Validate a BIP39 mnemonic phrase
   */
  validateMnemonic(mnemonic: string): boolean {
    return validateMnemonic(mnemonic, wordlist);
  }

  // ==================== INITIALIZATION ====================

  /**
   * Initialize Stellar wallet from BIP39 seed
   * Derives a Stellar keypair from the mnemonic using SEP-5 standard
   */
  initializeFromSeed(mnemonic: string): string {
    try {
      console.log('[Stellar] Initializing from seed...');

      // Validate mnemonic first
      if (!this.validateMnemonic(mnemonic)) {
        throw new Error('Invalid mnemonic phrase');
      }

      // Derive Stellar secret key from mnemonic (SEP-5 standard)
      const secretKey = this.mnemonicToStellarSecret(mnemonic);
      this.keypair = Keypair.fromSecret(secretKey);

      this.initialized = true;

      console.log('[Stellar] Initialized with public key:', this.keypair.publicKey());

      return this.keypair.publicKey();
    } catch (error) {
      console.error('[Stellar] Error initializing:', error);
      throw error;
    }
  }

  /**
   * Convert BIP39 mnemonic to Stellar secret key
   * Uses SEP-5 standard: BIP39 → SLIP-0010 → m/44'/148'/0'
   * This produces the same address as Lobstr, Solar, Freighter, etc.
   */
  private mnemonicToStellarSecret(mnemonic: string): string {
    // Step 1: BIP39 mnemonic to seed (512-bit)
    const seed = mnemonicToSeedSync(mnemonic);

    // Step 2: SLIP-0010 derivation with Stellar path
    // SEP-5 standard path: m/44'/148'/accountIndex'
    // Using account 0 for the primary wallet
    const derivedKey = this.slip0010Derive(seed, [44, 148, 0]);

    // Step 3: Create Stellar keypair from derived 32-byte seed
    const stellarKeypair = Keypair.fromRawEd25519Seed(Buffer.from(derivedKey));

    return stellarKeypair.secret();
  }

  /**
   * SLIP-0010 key derivation for ed25519
   * Implements the standard used by Stellar wallets (Lobstr, Freighter, etc.)
   */
  private slip0010Derive(seed: Uint8Array, path: number[]): Uint8Array {
    // Master key derivation (SLIP-0010)
    const masterKey = hmac(sha512, 'ed25519 seed', seed);
    let key = masterKey.slice(0, 32);
    let chainCode = masterKey.slice(32);

    // Derive each path component (all hardened for ed25519)
    for (const index of path) {
      const hardenedIndex = 0x80000000 + index;
      const data = new Uint8Array(37);
      data[0] = 0x00;
      data.set(key, 1);
      data[33] = (hardenedIndex >>> 24) & 0xff;
      data[34] = (hardenedIndex >>> 16) & 0xff;
      data[35] = (hardenedIndex >>> 8) & 0xff;
      data[36] = hardenedIndex & 0xff;

      const derived = hmac(sha512, chainCode, data);
      key = derived.slice(0, 32);
      chainCode = derived.slice(32);
    }

    return key;
  }

  /**
   * Check if service is initialized
   */
  isInitialized(): boolean {
    return this.initialized && this.keypair !== null;
  }

  // ==================== WALLET ====================

  /**
   * Get the wallet's public key (address)
   */
  getPublicKey(): string {
    if (!this.keypair) {
      throw new Error('Stellar not initialized');
    }
    return this.keypair.publicKey();
  }

  /**
   * Get the keypair (for signing)
   */
  getKeypair(): Keypair {
    if (!this.keypair) {
      throw new Error('Stellar not initialized');
    }
    return this.keypair;
  }

  /**
   * Alias for getPublicKey
   */
  getWalletAddress(): string {
    return this.getPublicKey();
  }

  // ==================== BALANCES ====================

  /**
   * Get all balances (XLM and EURC)
   */
  async getBalances(): Promise<StellarBalance> {
    if (!this.keypair) {
      throw new Error('Stellar not initialized');
    }

    try {
      const account = await this.horizon.loadAccount(this.keypair.publicKey());

      let xlm = 0;
      let eurc = 0;

      for (const balance of account.balances) {
        if (balance.asset_type === 'native') {
          xlm = parseFloat(balance.balance);
        } else if (
          'asset_code' in balance &&
          balance.asset_code === EURC_CONFIG.code &&
          balance.asset_issuer === EURC_CONFIG.issuer
        ) {
          eurc = parseFloat(balance.balance);
        }
      }

      console.log('[Stellar] Balances:', { xlm, eurc });
      return { xlm, eurc };
    } catch (error: any) {
      if (error.response?.status === 404) {
        // Account doesn't exist yet
        console.log('[Stellar] Account not found (not funded yet)');
        return { xlm: 0, eurc: 0 };
      }
      console.error('[Stellar] Error getting balances:', error);
      return { xlm: 0, eurc: 0 };
    }
  }

  /**
   * Get EURC balance only
   */
  async getEurcBalance(): Promise<number> {
    const balances = await this.getBalances();
    return balances.eurc;
  }

  /**
   * Get XLM balance only
   */
  async getXlmBalance(): Promise<number> {
    const balances = await this.getBalances();
    return balances.xlm;
  }

  // ==================== TRANSFERS ====================

  /**
   * Build an unsigned EURC transfer transaction
   * Returns XDR for backend sponsorship
   */
  async buildEurcTransfer(
    toAddress: string,
    amount: number,
    memo?: string
  ): Promise<TransferResult> {
    if (!this.keypair) {
      return { success: false, error: 'Stellar not initialized' };
    }

    try {
      console.log(`[Stellar] Building EURC transfer: ${amount} to ${toAddress}`);

      // Load source account
      const sourceAccount = await this.horizon.loadAccount(this.keypair.publicKey());

      // Build transaction
      const txBuilder = new TransactionBuilder(sourceAccount, {
        fee: '100', // Will be replaced by fee-bump
        networkPassphrase: STELLAR_CONFIG.networkPassphrase,
      });

      // Add payment operation
      txBuilder.addOperation(
        Operation.payment({
          destination: toAddress,
          asset: new Asset(EURC_CONFIG.code, EURC_CONFIG.issuer),
          amount: amount.toFixed(7),
        })
      );

      // Add memo if provided
      if (memo) {
        txBuilder.addMemo(Memo.text(memo.slice(0, 28)));
      }

      // Set timeout
      txBuilder.setTimeout(180);

      // Build transaction
      const tx = txBuilder.build();

      // Sign with user's key
      tx.sign(this.keypair);

      // Return signed XDR for sponsorship
      return {
        success: true,
        txXdr: tx.toXDR(),
      };
    } catch (error: any) {
      console.error('[Stellar] Error building transfer:', error);
      return {
        success: false,
        error: error?.message || 'Failed to build transfer',
      };
    }
  }

  /**
   * Check if account exists on network
   */
  async accountExists(publicKey?: string): Promise<boolean> {
    const pk = publicKey || this.keypair?.publicKey();
    if (!pk) return false;

    try {
      await this.horizon.loadAccount(pk);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if account has EURC trustline
   */
  async hasEurcTrustline(publicKey?: string): Promise<boolean> {
    const pk = publicKey || this.keypair?.publicKey();
    if (!pk) return false;

    try {
      const account = await this.horizon.loadAccount(pk);
      return account.balances.some(
        b => 'asset_code' in b &&
             b.asset_code === EURC_CONFIG.code &&
             b.asset_issuer === EURC_CONFIG.issuer
      );
    } catch {
      return false;
    }
  }

  /**
   * Build trustline transaction for EURC
   */
  async buildEurcTrustline(): Promise<TransferResult> {
    if (!this.keypair) {
      return { success: false, error: 'Stellar not initialized' };
    }

    try {
      const sourceAccount = await this.horizon.loadAccount(this.keypair.publicKey());

      const tx = new TransactionBuilder(sourceAccount, {
        fee: '100',
        networkPassphrase: STELLAR_CONFIG.networkPassphrase,
      })
        .addOperation(
          Operation.changeTrust({
            asset: new Asset(EURC_CONFIG.code, EURC_CONFIG.issuer),
          })
        )
        .setTimeout(180)
        .build();

      tx.sign(this.keypair);

      return {
        success: true,
        txXdr: tx.toXDR(),
      };
    } catch (error: any) {
      console.error('[Stellar] Error building trustline:', error);
      return {
        success: false,
        error: error?.message || 'Failed to build trustline',
      };
    }
  }

  // ==================== HELPERS ====================

  /**
   * Get EURC asset
   */
  getEurcAsset(): Asset {
    return new Asset(EURC_CONFIG.code, EURC_CONFIG.issuer);
  }

  /**
   * Get network passphrase
   */
  getNetworkPassphrase(): string {
    return STELLAR_CONFIG.networkPassphrase;
  }

  /**
   * Get horizon server
   */
  getHorizon(): Horizon.Server {
    return this.horizon;
  }

  // ==================== CLEANUP ====================

  /**
   * Disconnect and cleanup
   */
  disconnect(): void {
    this.keypair = null;
    this.initialized = false;
    console.log('[Stellar] Disconnected');
  }
}

// Export singleton instance
export const stellarService = StellarService.getInstance();

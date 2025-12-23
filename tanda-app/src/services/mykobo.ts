/**
 * Mykobo Service
 *
 * SEP-24 integration for EUR ↔ EURC on/off ramp
 * Handles deposits, withdrawals, and KYC via WebView
 */

import { stellarService } from './stellar';

// ==================== CONFIGURATION ====================

const MYKOBO_CONFIG = {
  // Mykobo SEP-24 server (mainnet only - no testnet available)
  anchorDomain: 'mykobo.co',

  // Direct endpoints (from stellar.toml)
  webAuthEndpoint: 'https://stellar.mykobo.co/auth',
  transferServerSep24: 'https://stellar.mykobo.co/sep24',
  kycServer: 'https://stellar.mykobo.co/kyc',
  signingKey: 'GAHNDAOJ7IB6KKMGKBGI5JWJHCTFXOVGY4U2N57C2CUZPK3SPEPCLU76',

  // EURC issuer on mainnet
  eurcIssuer: 'GAQRF3UGHBT6JYQZ7YSUYCIYWAF4T2SAA5237Q5LIQYJOHHFAWDXZ7NM',

  get tomlUrl(): string {
    return `https://${this.anchorDomain}/.well-known/stellar.toml`;
  },
};

// ==================== TYPES ====================

export interface MykoboToml {
  TRANSFER_SERVER_SEP0024?: string;
  WEB_AUTH_ENDPOINT?: string;
  SIGNING_KEY?: string;
}

export interface Sep24InteractiveResponse {
  type: 'interactive_customer_info_needed';
  url: string;
  id: string;
}

export interface Sep24Transaction {
  id: string;
  kind: 'deposit' | 'withdrawal';
  status: string;
  status_eta?: number;
  amount_in?: string;
  amount_out?: string;
  amount_fee?: string;
  started_at?: string;
  completed_at?: string;
  stellar_transaction_id?: string;
  external_transaction_id?: string;
  message?: string;
  more_info_url?: string;
}

export interface MykoboSession {
  token: string;
  expiresAt: number;
}

// ==================== SERVICE ====================

class MykoboService {
  private static instance: MykoboService;
  private tomlData: MykoboToml | null = null;
  private session: MykoboSession | null = null;

  private constructor() {}

  static getInstance(): MykoboService {
    if (!MykoboService.instance) {
      MykoboService.instance = new MykoboService();
    }
    return MykoboService.instance;
  }

  // ==================== TOML DISCOVERY ====================

  /**
   * Fetch and parse Mykobo's stellar.toml
   * Uses cached config when available for faster startup
   */
  async fetchToml(): Promise<MykoboToml> {
    if (this.tomlData) {
      return this.tomlData;
    }

    // Use cached endpoints from config for faster initialization
    this.tomlData = {
      TRANSFER_SERVER_SEP0024: MYKOBO_CONFIG.transferServerSep24,
      WEB_AUTH_ENDPOINT: MYKOBO_CONFIG.webAuthEndpoint,
      SIGNING_KEY: MYKOBO_CONFIG.signingKey,
    };

    console.log('[Mykobo] Using cached endpoints:', this.tomlData);
    return this.tomlData;
  }

  /**
   * Force refresh TOML from network
   */
  async refreshToml(): Promise<MykoboToml> {
    try {
      console.log('[Mykobo] Fetching stellar.toml...');
      const response = await fetch(MYKOBO_CONFIG.tomlUrl);

      if (!response.ok) {
        throw new Error(`Failed to fetch TOML: ${response.status}`);
      }

      const tomlText = await response.text();
      this.tomlData = this.parseToml(tomlText);

      console.log('[Mykobo] TOML parsed:', this.tomlData);
      return this.tomlData;
    } catch (error) {
      console.error('[Mykobo] Error fetching TOML:', error);
      throw error;
    }
  }

  /**
   * Simple TOML parser for stellar.toml
   */
  private parseToml(tomlText: string): MykoboToml {
    const result: MykoboToml = {};
    const lines = tomlText.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('#') || !trimmed.includes('=')) continue;

      const [key, ...valueParts] = trimmed.split('=');
      const value = valueParts.join('=').trim().replace(/^["']|["']$/g, '');

      if (key.trim() === 'TRANSFER_SERVER_SEP0024') {
        result.TRANSFER_SERVER_SEP0024 = value;
      } else if (key.trim() === 'WEB_AUTH_ENDPOINT') {
        result.WEB_AUTH_ENDPOINT = value;
      } else if (key.trim() === 'SIGNING_KEY') {
        result.SIGNING_KEY = value;
      }
    }

    return result;
  }

  // ==================== SEP-10 AUTHENTICATION ====================

  /**
   * Authenticate with Mykobo using SEP-10
   * Returns a JWT token for subsequent requests
   */
  async authenticate(): Promise<string> {
    // Check if we have a valid session
    if (this.session && Date.now() < this.session.expiresAt) {
      return this.session.token;
    }

    const toml = await this.fetchToml();
    const authEndpoint = toml.WEB_AUTH_ENDPOINT;

    if (!authEndpoint) {
      throw new Error('WEB_AUTH_ENDPOINT not found in stellar.toml');
    }

    const publicKey = stellarService.getPublicKey();
    const keypair = stellarService.getKeypair();

    try {
      console.log('[Mykobo] Starting SEP-10 authentication...');

      // Step 1: Get challenge transaction
      const challengeResponse = await fetch(
        `${authEndpoint}?account=${publicKey}`
      );

      if (!challengeResponse.ok) {
        throw new Error(`Challenge request failed: ${challengeResponse.status}`);
      }

      const challengeData = await challengeResponse.json() as {
        transaction: string;
        network_passphrase: string;
      };

      // Step 2: Sign the challenge
      const { TransactionBuilder } = await import('@stellar/stellar-sdk');
      const tx = TransactionBuilder.fromXDR(
        challengeData.transaction,
        challengeData.network_passphrase
      );

      // Sign with user's key
      if ('sign' in tx) {
        tx.sign(keypair);
      }

      // Step 3: Submit signed challenge
      const tokenResponse = await fetch(authEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transaction: tx.toXDR(),
        }),
      });

      if (!tokenResponse.ok) {
        throw new Error(`Token request failed: ${tokenResponse.status}`);
      }

      const tokenData = await tokenResponse.json() as { token: string };

      // Store session (tokens typically valid for 24 hours)
      this.session = {
        token: tokenData.token,
        expiresAt: Date.now() + 23 * 60 * 60 * 1000, // 23 hours
      };

      console.log('[Mykobo] Authentication successful');
      return this.session.token;
    } catch (error) {
      console.error('[Mykobo] Authentication error:', error);
      throw error;
    }
  }

  // ==================== SEP-24 DEPOSIT (EUR → EURC) ====================

  /**
   * Initiate a deposit (EUR → EURC)
   * Returns a URL to open in WebView for user to complete deposit
   */
  async initiateDeposit(amount?: number): Promise<Sep24InteractiveResponse> {
    const toml = await this.fetchToml();
    const transferServer = toml.TRANSFER_SERVER_SEP0024;

    if (!transferServer) {
      throw new Error('TRANSFER_SERVER_SEP0024 not found in stellar.toml');
    }

    const token = await this.authenticate();
    const publicKey = stellarService.getPublicKey();

    try {
      console.log('[Mykobo] Initiating deposit...');

      const body: Record<string, string> = {
        asset_code: 'EURC',
        account: publicKey,
      };

      if (amount) {
        body.amount = amount.toString();
      }

      const response = await fetch(
        `${transferServer}/transactions/deposit/interactive`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        }
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Deposit initiation failed: ${error}`);
      }

      const data = await response.json() as Sep24InteractiveResponse;
      console.log('[Mykobo] Deposit initiated, URL:', data.url);

      return data;
    } catch (error) {
      console.error('[Mykobo] Deposit error:', error);
      throw error;
    }
  }

  // ==================== SEP-24 WITHDRAW (EURC → EUR) ====================

  /**
   * Initiate a withdrawal (EURC → EUR)
   * Returns a URL to open in WebView for user to complete withdrawal
   */
  async initiateWithdrawal(amount?: number): Promise<Sep24InteractiveResponse> {
    const toml = await this.fetchToml();
    const transferServer = toml.TRANSFER_SERVER_SEP0024;

    if (!transferServer) {
      throw new Error('TRANSFER_SERVER_SEP0024 not found in stellar.toml');
    }

    const token = await this.authenticate();
    const publicKey = stellarService.getPublicKey();

    try {
      console.log('[Mykobo] Initiating withdrawal...');

      const body: Record<string, string> = {
        asset_code: 'EURC',
        account: publicKey,
      };

      if (amount) {
        body.amount = amount.toString();
      }

      const response = await fetch(
        `${transferServer}/transactions/withdraw/interactive`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        }
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Withdrawal initiation failed: ${error}`);
      }

      const data = await response.json() as Sep24InteractiveResponse;
      console.log('[Mykobo] Withdrawal initiated, URL:', data.url);

      return data;
    } catch (error) {
      console.error('[Mykobo] Withdrawal error:', error);
      throw error;
    }
  }

  // ==================== TRANSACTION STATUS ====================

  /**
   * Get status of a SEP-24 transaction
   */
  async getTransactionStatus(transactionId: string): Promise<Sep24Transaction> {
    const toml = await this.fetchToml();
    const transferServer = toml.TRANSFER_SERVER_SEP0024;

    if (!transferServer) {
      throw new Error('TRANSFER_SERVER_SEP0024 not found in stellar.toml');
    }

    const token = await this.authenticate();

    try {
      const response = await fetch(
        `${transferServer}/transaction?id=${transactionId}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Transaction status request failed: ${response.status}`);
      }

      const data = await response.json() as { transaction: Sep24Transaction };
      return data.transaction;
    } catch (error) {
      console.error('[Mykobo] Transaction status error:', error);
      throw error;
    }
  }

  /**
   * Get all transactions for current user
   */
  async getTransactions(
    kind?: 'deposit' | 'withdrawal'
  ): Promise<Sep24Transaction[]> {
    const toml = await this.fetchToml();
    const transferServer = toml.TRANSFER_SERVER_SEP0024;

    if (!transferServer) {
      throw new Error('TRANSFER_SERVER_SEP0024 not found in stellar.toml');
    }

    const token = await this.authenticate();

    try {
      const params = new URLSearchParams({
        asset_code: 'EURC',
      });

      if (kind) {
        params.append('kind', kind);
      }

      const response = await fetch(
        `${transferServer}/transactions?${params.toString()}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Transactions request failed: ${response.status}`);
      }

      const data = await response.json() as { transactions: Sep24Transaction[] };
      return data.transactions;
    } catch (error) {
      console.error('[Mykobo] Transactions error:', error);
      throw error;
    }
  }

  // ==================== KYC STATUS ====================

  /**
   * Check if user has completed KYC with Mykobo
   * This is inferred from being able to make deposits
   */
  async checkKycStatus(): Promise<{
    verified: boolean;
    canDeposit: boolean;
    canWithdraw: boolean;
  }> {
    try {
      // If we can authenticate, user has some level of verification
      await this.authenticate();

      // Try to get transactions - if we can, KYC is likely complete
      const transactions = await this.getTransactions();

      // Check if any transaction completed successfully
      const hasCompletedTx = transactions.some(
        tx => tx.status === 'completed'
      );

      return {
        verified: hasCompletedTx || transactions.length > 0,
        canDeposit: true,
        canWithdraw: hasCompletedTx,
      };
    } catch (error) {
      console.log('[Mykobo] KYC check failed, user likely not verified');
      return {
        verified: false,
        canDeposit: false,
        canWithdraw: false,
      };
    }
  }

  // ==================== HELPERS ====================

  /**
   * Get the Mykobo anchor domain
   */
  getAnchorDomain(): string {
    return MYKOBO_CONFIG.anchorDomain;
  }

  /**
   * Clear session (for logout)
   */
  clearSession(): void {
    this.session = null;
    this.tomlData = null;
    console.log('[Mykobo] Session cleared');
  }
}

// Export singleton instance
export const mykoboService = MykoboService.getInstance();

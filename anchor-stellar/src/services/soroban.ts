/**
 * Soroban Service
 * Interacts with the Tanda smart contract on Soroban
 */

import {
  Keypair,
  Contract,
  TransactionBuilder,
  Networks,
  xdr,
  scValToNative,
  nativeToScVal,
  Address,
  rpc as SorobanRpc,
} from '@stellar/stellar-sdk';
import { STELLAR_CONFIG, EURC_CONFIG, GAS_CONFIG } from '../config/index.js';
import { stellarService } from './stellar.js';

// Contract types matching lib.rs
export interface SorobanMember {
  address: string;
  status: 'Active' | 'Received' | 'Expelled';
  position: number;
  has_deposited: boolean;
  joined_at: number;
}

export interface SorobanTanda {
  id: string;
  name: string;
  creator: string;
  amount: bigint;
  max_members: number;
  status: 'Forming' | 'Active' | 'Completed' | 'Cancelled';
  current_cycle: number;
  total_cycles: number;
  created_at: number;
  started_at: number;
  last_payout_at: number;
}

// Response type for API
export interface TandaResponse {
  id: string;
  name: string;
  creator: string;
  amount: number;
  maxParticipants: number;
  currentParticipants: number;
  totalCycles: number;
  currentCycle: number;
  cycleDays: number;
  status: 'waiting' | 'active' | 'completed' | 'cancelled';
  storageAccount: string;
  participants: {
    walletAddress: string;
    joinedAt: number;
    hasDeposited: boolean;
    hasWithdrawn: boolean;
  }[];
  beneficiaryOrder: string[];
  createdAt: number;
}

// Local storage for tanda tracking (since we can't list all tandas from contract)
interface TandaRegistry {
  tandas: Map<string, {
    id: string;
    creator: string;
    createdAt: number;
    participants: string[];
  }>;
}

class SorobanService {
  private sorobanServer: SorobanRpc.Server;
  private contract: Contract | null = null;
  private registry: TandaRegistry = { tandas: new Map() };

  constructor() {
    this.sorobanServer = new SorobanRpc.Server(STELLAR_CONFIG.sorobanRpcUrl);

    if (STELLAR_CONFIG.contractId) {
      this.contract = new Contract(STELLAR_CONFIG.contractId);
      console.log('[Soroban] Contract initialized:', STELLAR_CONFIG.contractId);
    } else {
      console.warn('[Soroban] No CONTRACT_ID configured');
    }
  }

  /**
   * Check if contract is configured
   */
  isConfigured(): boolean {
    return this.contract !== null;
  }

  /**
   * Get network passphrase
   */
  private getNetworkPassphrase(): string {
    return STELLAR_CONFIG.network === 'mainnet'
      ? Networks.PUBLIC
      : Networks.TESTNET;
  }

  /**
   * Convert contract status to API status
   */
  private convertStatus(status: string): 'waiting' | 'active' | 'completed' | 'cancelled' {
    switch (status) {
      case 'Forming': return 'waiting';
      case 'Active': return 'active';
      case 'Completed': return 'completed';
      case 'Cancelled': return 'cancelled';
      default: return 'waiting';
    }
  }

  /**
   * Build and submit a contract call transaction
   */
  private async callContract(
    method: string,
    params: xdr.ScVal[],
    signerSecret?: string
  ): Promise<{ success: boolean; result?: any; txHash?: string; error?: string }> {
    if (!this.contract) {
      return { success: false, error: 'Contract not configured' };
    }

    try {
      const sponsorKeypair = stellarService.getSponsorKeypair();
      const sourceAccount = await this.sorobanServer.getAccount(sponsorKeypair.publicKey());

      // Build the contract call
      const tx = new TransactionBuilder(sourceAccount, {
        fee: GAS_CONFIG.maxFeeStroops.toString(),
        networkPassphrase: this.getNetworkPassphrase(),
      })
        .addOperation(this.contract.call(method, ...params))
        .setTimeout(30)
        .build();

      // Simulate first
      const simResult = await this.sorobanServer.simulateTransaction(tx);

      if (SorobanRpc.Api.isSimulationError(simResult)) {
        console.error('[Soroban] Simulation error:', simResult.error);
        return { success: false, error: simResult.error };
      }

      // Prepare the transaction with the simulation result
      const preparedTx = SorobanRpc.assembleTransaction(tx, simResult).build();

      // Sign with sponsor (and additional signer if provided)
      preparedTx.sign(sponsorKeypair);
      if (signerSecret) {
        preparedTx.sign(Keypair.fromSecret(signerSecret));
      }

      // Submit
      const submitResult = await this.sorobanServer.sendTransaction(preparedTx);

      if (submitResult.status === 'ERROR') {
        return { success: false, error: 'Transaction submission failed' };
      }

      // Wait for confirmation
      let getResult = await this.sorobanServer.getTransaction(submitResult.hash);
      while (getResult.status === 'NOT_FOUND') {
        await new Promise(resolve => setTimeout(resolve, 1000));
        getResult = await this.sorobanServer.getTransaction(submitResult.hash);
      }

      if (getResult.status === 'SUCCESS') {
        let result = undefined;
        if (getResult.returnValue) {
          result = scValToNative(getResult.returnValue);
        }
        return { success: true, result, txHash: submitResult.hash };
      }

      return { success: false, error: 'Transaction failed', txHash: submitResult.hash };
    } catch (error: any) {
      console.error('[Soroban] Contract call error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Read-only contract call (no transaction needed)
   */
  private async readContract(
    method: string,
    params: xdr.ScVal[]
  ): Promise<{ success: boolean; result?: any; error?: string }> {
    if (!this.contract) {
      return { success: false, error: 'Contract not configured' };
    }

    try {
      const sponsorKeypair = stellarService.getSponsorKeypair();
      const sourceAccount = await this.sorobanServer.getAccount(sponsorKeypair.publicKey());

      const tx = new TransactionBuilder(sourceAccount, {
        fee: '100',
        networkPassphrase: this.getNetworkPassphrase(),
      })
        .addOperation(this.contract.call(method, ...params))
        .setTimeout(30)
        .build();

      const simResult = await this.sorobanServer.simulateTransaction(tx);

      if (SorobanRpc.Api.isSimulationError(simResult)) {
        return { success: false, error: simResult.error };
      }

      if (SorobanRpc.Api.isSimulationSuccess(simResult) && simResult.result) {
        const result = scValToNative(simResult.result.retval);
        return { success: true, result };
      }

      return { success: false, error: 'No result from simulation' };
    } catch (error: any) {
      console.error('[Soroban] Read contract error:', error);
      return { success: false, error: error.message };
    }
  }

  // ==================== TANDA OPERATIONS ====================

  /**
   * Create a new tanda
   */
  async createTanda(
    creatorWallet: string,
    name: string,
    amount: number,
    maxParticipants: number
  ): Promise<{ success: boolean; tanda?: TandaResponse; error?: string }> {
    console.log('[Soroban] Creating tanda:', { name, amount, maxParticipants });

    // Convert amount to contract units (7 decimals)
    const amountUnits = BigInt(Math.floor(amount * 10_000_000));

    const params = [
      new Address(creatorWallet).toScVal(),
      nativeToScVal(name, { type: 'string' }),
      nativeToScVal(amountUnits, { type: 'i128' }),
      nativeToScVal(maxParticipants, { type: 'u32' }),
    ];

    const result = await this.callContract('create_tanda', params);

    if (result.success && result.result) {
      const tandaId = result.result as string;
      console.log('[Soroban] Tanda created with ID:', tandaId);

      // Register in local registry
      this.registry.tandas.set(tandaId, {
        id: tandaId,
        creator: creatorWallet,
        createdAt: Date.now(),
        participants: [creatorWallet],
      });

      // Fetch and return full tanda data
      return this.getTanda(tandaId);
    }

    return { success: false, error: result.error };
  }

  /**
   * Join a tanda
   */
  async joinTanda(
    tandaId: string,
    walletAddress: string
  ): Promise<{ success: boolean; tanda?: TandaResponse; error?: string }> {
    console.log('[Soroban] Joining tanda:', tandaId, walletAddress);

    const params = [
      new Address(walletAddress).toScVal(),
      nativeToScVal(tandaId, { type: 'string' }),
    ];

    const result = await this.callContract('join_tanda', params);

    if (result.success) {
      // Update registry
      const entry = this.registry.tandas.get(tandaId);
      if (entry && !entry.participants.includes(walletAddress)) {
        entry.participants.push(walletAddress);
      }

      return this.getTanda(tandaId);
    }

    return { success: false, error: result.error };
  }

  /**
   * Start a tanda (creator only)
   */
  async startTanda(
    tandaId: string,
    callerWallet: string
  ): Promise<{ success: boolean; tanda?: TandaResponse; error?: string }> {
    console.log('[Soroban] Starting tanda:', tandaId);

    const params = [
      new Address(callerWallet).toScVal(),
      nativeToScVal(tandaId, { type: 'string' }),
    ];

    const result = await this.callContract('start_tanda', params);

    if (result.success) {
      return this.getTanda(tandaId);
    }

    return { success: false, error: result.error };
  }

  /**
   * Deposit for current cycle
   */
  async deposit(
    tandaId: string,
    walletAddress: string
  ): Promise<{ success: boolean; tanda?: TandaResponse; txHash?: string; error?: string }> {
    console.log('[Soroban] Depositing to tanda:', tandaId, walletAddress);

    const params = [
      new Address(walletAddress).toScVal(),
      nativeToScVal(tandaId, { type: 'string' }),
    ];

    const result = await this.callContract('deposit', params);

    if (result.success) {
      const tandaResult = await this.getTanda(tandaId);
      return { ...tandaResult, txHash: result.txHash };
    }

    return { success: false, error: result.error };
  }

  /**
   * Advance the tanda (expel delinquents + trigger payout if all deposited)
   */
  async advance(
    tandaId: string
  ): Promise<{ success: boolean; tanda?: TandaResponse; advanced: boolean; error?: string }> {
    console.log('[Soroban] Advancing tanda:', tandaId);

    const params = [
      nativeToScVal(tandaId, { type: 'string' }),
    ];

    const result = await this.callContract('advance', params);

    if (result.success) {
      const tandaResult = await this.getTanda(tandaId);
      return { ...tandaResult, advanced: result.result as boolean };
    }

    return { success: false, advanced: false, error: result.error };
  }

  /**
   * Leave a tanda (only while forming)
   */
  async leaveTanda(
    tandaId: string,
    walletAddress: string
  ): Promise<{ success: boolean; tanda?: TandaResponse; error?: string }> {
    // Note: The contract doesn't have a leave function,
    // but we can remove from local registry if still forming
    console.log('[Soroban] Leave tanda:', tandaId, walletAddress);

    // Check if tanda is still forming
    const tandaResult = await this.getTanda(tandaId);
    if (!tandaResult.success || !tandaResult.tanda) {
      return { success: false, error: 'Tanda not found' };
    }

    if (tandaResult.tanda.status !== 'waiting') {
      return { success: false, error: 'Cannot leave after tanda has started' };
    }

    // Update local registry
    const entry = this.registry.tandas.get(tandaId);
    if (entry) {
      entry.participants = entry.participants.filter(p => p !== walletAddress);
    }

    return this.getTanda(tandaId);
  }

  /**
   * Get tanda details
   */
  async getTanda(tandaId: string): Promise<{ success: boolean; tanda?: TandaResponse; error?: string }> {
    console.log('[Soroban] Getting tanda:', tandaId);

    const tandaParams = [nativeToScVal(tandaId, { type: 'string' })];

    // Get tanda data
    const tandaResult = await this.readContract('get_tanda', tandaParams);
    if (!tandaResult.success) {
      return { success: false, error: tandaResult.error };
    }

    // Get members
    const membersResult = await this.readContract('get_members', tandaParams);
    if (!membersResult.success) {
      return { success: false, error: membersResult.error };
    }

    const rawTanda = tandaResult.result as any;
    const rawMembers = membersResult.result as any[];

    // Convert to API format
    const tanda: TandaResponse = {
      id: rawTanda.id,
      name: rawTanda.name,
      creator: rawTanda.creator,
      amount: Number(rawTanda.amount) / 10_000_000, // Convert from units to EURC
      maxParticipants: rawTanda.max_members,
      currentParticipants: rawMembers.filter((m: any) => m.status !== 'Expelled').length,
      totalCycles: rawTanda.total_cycles,
      currentCycle: rawTanda.current_cycle,
      cycleDays: 0, // Not used in new model
      status: this.convertStatus(rawTanda.status),
      storageAccount: STELLAR_CONFIG.contractId, // Contract holds funds
      participants: rawMembers.map((m: any) => ({
        walletAddress: m.address,
        joinedAt: Number(m.joined_at) * 1000, // Convert to ms
        hasDeposited: m.has_deposited,
        hasWithdrawn: m.status === 'Received',
      })),
      beneficiaryOrder: rawMembers
        .filter((m: any) => m.status !== 'Expelled')
        .sort((a: any, b: any) => a.position - b.position)
        .map((m: any) => m.address),
      createdAt: Number(rawTanda.created_at) * 1000, // Convert to ms
    };

    return { success: true, tanda };
  }

  /**
   * Get all tandas (from local registry + chain validation)
   */
  async getAllTandas(status?: string): Promise<{ success: boolean; tandas: TandaResponse[]; error?: string }> {
    console.log('[Soroban] Getting all tandas, status filter:', status);

    const tandas: TandaResponse[] = [];

    for (const [tandaId] of this.registry.tandas) {
      try {
        const result = await this.getTanda(tandaId);
        if (result.success && result.tanda) {
          if (!status || result.tanda.status === status) {
            tandas.push(result.tanda);
          }
        }
      } catch (error) {
        console.warn('[Soroban] Error fetching tanda:', tandaId, error);
      }
    }

    return { success: true, tandas };
  }

  /**
   * Get tandas for a specific user
   */
  async getTandasForUser(walletAddress: string): Promise<{ success: boolean; tandas: TandaResponse[]; error?: string }> {
    console.log('[Soroban] Getting tandas for user:', walletAddress);

    const tandas: TandaResponse[] = [];

    for (const [tandaId, entry] of this.registry.tandas) {
      if (entry.participants.includes(walletAddress)) {
        try {
          const result = await this.getTanda(tandaId);
          if (result.success && result.tanda) {
            tandas.push(result.tanda);
          }
        } catch (error) {
          console.warn('[Soroban] Error fetching tanda:', tandaId, error);
        }
      }
    }

    return { success: true, tandas };
  }

  /**
   * Register an existing tanda (for migration/sync)
   */
  registerTanda(tandaId: string, creator: string, participants: string[]): void {
    this.registry.tandas.set(tandaId, {
      id: tandaId,
      creator,
      createdAt: Date.now(),
      participants,
    });
  }

  /**
   * Check if all members have deposited
   */
  async allDeposited(tandaId: string): Promise<boolean> {
    const result = await this.readContract('all_deposited', [
      nativeToScVal(tandaId, { type: 'string' }),
    ]);
    return result.success && result.result === true;
  }

  /**
   * Get current beneficiary
   */
  async getBeneficiary(tandaId: string): Promise<string | null> {
    const result = await this.readContract('get_beneficiary', [
      nativeToScVal(tandaId, { type: 'string' }),
    ]);
    return result.success ? result.result as string : null;
  }

  /**
   * Get time to deadline
   */
  async getTimeToDeadline(tandaId: string): Promise<number> {
    const result = await this.readContract('time_to_deadline', [
      nativeToScVal(tandaId, { type: 'string' }),
    ]);
    return result.success ? Number(result.result) : 0;
  }

  /**
   * Get advance status (for UI feedback)
   */
  async getAdvanceStatus(tandaId: string): Promise<{
    canAdvance: boolean;
    willExpelCount: number;
    willPayout: boolean;
    beneficiary: string | null;
  }> {
    const result = await this.readContract('get_advance_status', [
      nativeToScVal(tandaId, { type: 'string' }),
    ]);

    if (result.success && Array.isArray(result.result)) {
      const [canAdvance, willExpelCount, willPayout, beneficiary] = result.result;
      return {
        canAdvance: canAdvance as boolean,
        willExpelCount: willExpelCount as number,
        willPayout: willPayout as boolean,
        beneficiary: beneficiary as string | null,
      };
    }

    return { canAdvance: false, willExpelCount: 0, willPayout: false, beneficiary: null };
  }
}

export const sorobanService = new SorobanService();

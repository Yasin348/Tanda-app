/**
 * Simulate Full Tanda Flow
 *
 * This script simulates:
 * 1. KYC verification
 * 2. Create a tanda
 * 3. Users join the tanda
 * 4. Make deposits
 * 5. Process payout
 *
 * Run: npx tsx scripts/simulate-flow.ts
 */

import { Keypair, Horizon, Asset, TransactionBuilder, Operation, Networks } from '@stellar/stellar-sdk';

const HORIZON_URL = 'https://horizon-testnet.stellar.org';
const FRIENDBOT_URL = 'https://friendbot.stellar.org';
const BACKEND_URL = 'http://localhost:3001';

// Simulated users
interface SimUser {
  name: string;
  keypair: Keypair;
  publicKey: string;
}

async function fundAccount(publicKey: string): Promise<void> {
  console.log(`  Funding ${publicKey.slice(0, 8)}...`);
  const response = await fetch(`${FRIENDBOT_URL}?addr=${publicKey}`);
  if (!response.ok) {
    throw new Error(`Failed to fund account: ${response.statusText}`);
  }
  await new Promise(r => setTimeout(r, 1000)); // Wait for ledger
}

async function getBalance(publicKey: string): Promise<{ xlm: number; eurc: number }> {
  const horizon = new Horizon.Server(HORIZON_URL);
  try {
    const account = await horizon.loadAccount(publicKey);
    let xlm = 0;
    let eurc = 0;

    for (const balance of account.balances) {
      if (balance.asset_type === 'native') {
        xlm = parseFloat(balance.balance);
      }
      // Check for EURC (Mykobo testnet)
      if (balance.asset_type === 'credit_alphanum4' && balance.asset_code === 'EURC') {
        eurc = parseFloat(balance.balance);
      }
    }

    return { xlm, eurc };
  } catch (e) {
    return { xlm: 0, eurc: 0 };
  }
}

async function reportKYC(user: SimUser): Promise<boolean> {
  console.log(`  Reporting KYC for ${user.name}...`);

  try {
    const response = await fetch(`${BACKEND_URL}/api/users/kyc`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        publicKey: user.publicKey,
        country: 'ES',
      }),
    });

    const data = await response.json();
    return data.success === true;
  } catch (e) {
    console.error(`    Error: ${e}`);
    return false;
  }
}

async function checkKYCStatus(publicKey: string): Promise<boolean> {
  try {
    const response = await fetch(`${BACKEND_URL}/api/users/kyc/status/${publicKey}`);
    const data = await response.json();
    // Response is { success, publicKey, isVerified, ... }
    return data.isVerified === true;
  } catch (e) {
    return false;
  }
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  console.log('='.repeat(60));
  console.log('  TANDA FLOW SIMULATION');
  console.log('='.repeat(60));

  // Check backend is running
  try {
    const healthCheck = await fetch(`${BACKEND_URL}/health`);
    if (!healthCheck.ok) throw new Error('Backend not responding');
    console.log('\n✅ Backend is running\n');
  } catch (e) {
    console.error('\n❌ Backend not running! Start it with: npm run dev\n');
    process.exit(1);
  }

  // ==================== STEP 1: Create Users ====================
  console.log('\n📋 STEP 1: Creating test users...\n');

  const users: SimUser[] = [
    { name: 'Alice (Creator)', keypair: Keypair.random(), publicKey: '' },
    { name: 'Bob', keypair: Keypair.random(), publicKey: '' },
    { name: 'Carol', keypair: Keypair.random(), publicKey: '' },
  ];

  for (const user of users) {
    user.publicKey = user.keypair.publicKey();
    console.log(`  ${user.name}: ${user.publicKey.slice(0, 12)}...`);
  }

  // ==================== STEP 2: Fund Accounts ====================
  console.log('\n💰 STEP 2: Funding accounts on testnet...\n');

  for (const user of users) {
    await fundAccount(user.publicKey);
  }

  console.log('  ✅ All accounts funded\n');

  // ==================== STEP 3: KYC Verification ====================
  console.log('\n🪪 STEP 3: KYC Verification (simulated via Mykobo)...\n');

  for (const user of users) {
    const success = await reportKYC(user);
    const status = await checkKYCStatus(user.publicKey);
    console.log(`  ${user.name}: ${status ? '✅ Verified' : '❌ Failed'}`);
  }

  // ==================== STEP 4: Check Balances ====================
  console.log('\n💵 STEP 4: Checking balances...\n');

  for (const user of users) {
    const balance = await getBalance(user.publicKey);
    console.log(`  ${user.name}: ${balance.xlm.toFixed(2)} XLM, ${balance.eurc.toFixed(2)} EURC`);
  }

  // ==================== STEP 5: Simulate Tanda Creation ====================
  console.log('\n🎯 STEP 5: Simulating Tanda Creation...\n');
  console.log('  ⚠️  Note: Smart contract not deployed yet');
  console.log('  📝 This would call: contract.create_tanda()');
  console.log('');
  console.log('  Tanda Details (simulated):');
  console.log('  - Name: "Tanda Test"');
  console.log('  - Contribution: 100 EURC');
  console.log('  - Frequency: 7 days');
  console.log('  - Max members: 3');
  console.log('  - Creator: Alice');

  const simulatedTandaId = 'tanda_' + Date.now();
  console.log(`  - ID: ${simulatedTandaId}`);

  // ==================== STEP 6: Simulate Join ====================
  console.log('\n👥 STEP 6: Simulating Users Join...\n');
  console.log('  📝 This would call: contract.join_tanda()');
  console.log('');
  console.log('  - Bob requests to join... ✅');
  console.log('  - Carol requests to join... ✅');
  console.log('');
  console.log('  📝 This would call: contract.approve_member()');
  console.log('');
  console.log('  - Alice approves Bob... ✅');
  console.log('  - Alice approves Carol... ✅');

  // ==================== STEP 7: Simulate Start ====================
  console.log('\n🚀 STEP 7: Simulating Tanda Start...\n');
  console.log('  📝 This would call: contract.start_tanda()');
  console.log('');
  console.log('  - Tanda started! Cycle 1 begins.');
  console.log('  - First beneficiary: Alice (position 0)');
  console.log('  - Deadline: 7 days from now');

  // ==================== STEP 8: Simulate Deposits ====================
  console.log('\n💳 STEP 8: Simulating Deposits for Cycle 1...\n');
  console.log('  📝 This would call: contract.deposit() for each user');
  console.log('');

  const contribution = 100;
  const commission = 0.05;

  for (const user of users) {
    const total = contribution + commission;
    console.log(`  - ${user.name} deposits ${contribution} EURC + ${commission} EURC commission = ${total} EURC ✅`);
  }

  // ==================== STEP 9: Simulate Payout ====================
  console.log('\n🎁 STEP 9: Simulating Payout...\n');
  console.log('  📝 This would call: contract.process_payout()');
  console.log('');

  const payout = contribution * users.length;
  console.log(`  - All deposits received (${users.length} members)`);
  console.log(`  - Payout to Alice: ${payout} EURC ✅`);
  console.log('  - Cycle 2 begins...');
  console.log('  - Next beneficiary: Bob (position 1)');

  // ==================== SUMMARY ====================
  console.log('\n' + '='.repeat(60));
  console.log('  SIMULATION SUMMARY');
  console.log('='.repeat(60));
  console.log('');
  console.log('  Flow completed (simulated):');
  console.log('  1. ✅ Users created and funded on Stellar testnet');
  console.log('  2. ✅ KYC verified via backend');
  console.log('  3. ⏸️  Tanda creation (needs contract deployment)');
  console.log('  4. ⏸️  Join/approve (needs contract deployment)');
  console.log('  5. ⏸️  Deposits (needs contract deployment)');
  console.log('  6. ⏸️  Payouts (needs contract deployment)');
  console.log('');
  console.log('  To enable full flow:');
  console.log('  1. Install Rust + Soroban CLI');
  console.log('  2. Build contract: cargo build --target wasm32-unknown-unknown --release');
  console.log('  3. Deploy: soroban contract deploy ...');
  console.log('  4. Add CONTRACT_ID to .env');
  console.log('');
  console.log('  Test accounts created:');
  for (const user of users) {
    console.log(`  - ${user.name}: ${user.publicKey}`);
  }
  console.log('');
}

main().catch(console.error);

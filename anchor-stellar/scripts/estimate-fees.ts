/**
 * Script to estimate real Soroban transaction fees
 *
 * Run: npx tsx scripts/estimate-fees.ts
 */

import { Horizon } from '@stellar/stellar-sdk';

const HORIZON_URL = 'https://horizon-testnet.stellar.org';

async function main() {
  console.log('='.repeat(60));
  console.log('  STELLAR/SOROBAN FEE ESTIMATES');
  console.log('='.repeat(60));

  const horizon = new Horizon.Server(HORIZON_URL);

  // Get current network fees
  const feeStats = await horizon.feeStats();

  console.log('\n=== STELLAR CLASSIC FEES ===\n');
  console.log(`Base fee (min):     ${feeStats.last_ledger_base_fee} stroops (${Number(feeStats.last_ledger_base_fee) / 10000000} XLM)`);
  console.log(`Fee charged (p50):  ${feeStats.fee_charged.p50} stroops`);
  console.log(`Fee charged (p90):  ${feeStats.fee_charged.p90} stroops`);
  console.log(`Fee charged (p99):  ${feeStats.fee_charged.p99} stroops`);
  console.log(`Max fee (p99):      ${feeStats.max_fee.p99} stroops`);

  console.log('\n=== SOROBAN TYPICAL COSTS ===\n');
  console.log('These are estimates based on typical Soroban operations:\n');

  // Typical Soroban costs (based on network data)
  const sorobanEstimates = [
    { operation: 'Simple token transfer', xlm: 0.0001, stroops: 1000 },
    { operation: 'Contract invocation (simple)', xlm: 0.001, stroops: 10000 },
    { operation: 'Contract invocation (medium)', xlm: 0.005, stroops: 50000 },
    { operation: 'Contract invocation (complex)', xlm: 0.01, stroops: 100000 },
    { operation: 'Contract deployment', xlm: 0.1, stroops: 1000000 },
  ];

  console.log('Operation                        | XLM        | Stroops');
  console.log('-'.repeat(60));
  sorobanEstimates.forEach(e => {
    console.log(`${e.operation.padEnd(32)} | ${e.xlm.toFixed(4).padStart(10)} | ${e.stroops.toString().padStart(10)}`);
  });

  console.log('\n=== TANDA CONTRACT ESTIMATES ===\n');
  console.log('For your specific contract operations:\n');

  // Estimates for tanda operations
  const tandaEstimates = [
    { operation: 'create_tanda', xlm: 0.01, reason: 'Creates storage, initializes struct' },
    { operation: 'join_tanda', xlm: 0.005, reason: 'Updates members array' },
    { operation: 'deposit', xlm: 0.008, reason: 'Token transfer + storage update' },
    { operation: 'process_payout', xlm: 0.01, reason: 'Token transfer + multiple updates' },
    { operation: 'vote', xlm: 0.003, reason: 'Simple storage update' },
    { operation: 'approve_member', xlm: 0.003, reason: 'Update member status' },
    { operation: 'start_tanda', xlm: 0.005, reason: 'Update tanda status + timestamp' },
  ];

  // Get XLM price
  let xlmPriceEur = 0.19; // fallback
  try {
    const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=stellar&vs_currencies=eur');
    const data = await response.json();
    xlmPriceEur = data.stellar?.eur || 0.19;
  } catch (e) {
    console.log('(Using fallback XLM price)');
  }

  console.log(`XLM Price: €${xlmPriceEur.toFixed(4)}\n`);
  console.log('Operation        | XLM Est.   | EUR Est.   | Reason');
  console.log('-'.repeat(80));
  tandaEstimates.forEach(e => {
    const eurCost = e.xlm * xlmPriceEur;
    console.log(`${e.operation.padEnd(16)} | ${e.xlm.toFixed(4).padStart(10)} | €${eurCost.toFixed(5).padStart(8)} | ${e.reason}`);
  });

  console.log('\n=== IMPORTANT NOTES ===\n');
  console.log('1. These are ESTIMATES. Actual costs depend on contract complexity.');
  console.log('2. Soroban fees can vary based on network congestion.');
  console.log('3. To get exact costs, deploy the contract and simulate transactions.');
  console.log('4. Fee-bump adds ~10-20% buffer for safety.');
  console.log('\n');
}

main().catch(console.error);

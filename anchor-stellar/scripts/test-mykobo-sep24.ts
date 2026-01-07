/**
 * Test Mykobo SEP-24 Flow
 *
 * This script demonstrates the full SEP-24 integration with Mykobo:
 * 1. Fetch stellar.toml
 * 2. SEP-10 Authentication
 * 3. Initiate deposit (EUR → EURC)
 * 4. Check transaction status
 *
 * NOTE: Mykobo only operates on MAINNET (no testnet available)
 * This script tests against mainnet but doesn't complete transactions
 *
 * Run: npx tsx scripts/test-mykobo-sep24.ts
 */

import { Keypair, TransactionBuilder, Networks, Transaction } from '@stellar/stellar-sdk';

// ==================== CONFIGURATION ====================

const MYKOBO_CONFIG = {
  domain: 'mykobo.co',
  tomlUrl: 'https://mykobo.co/.well-known/stellar.toml',
  webAuthEndpoint: 'https://stellar.mykobo.co/auth',
  transferServerSep24: 'https://stellar.mykobo.co/sep24',
  kycServer: 'https://stellar.mykobo.co/kyc',
  signingKey: 'GAHNDAOJ7IB6KKMGKBGI5JWJHCTFXOVGY4U2N57C2CUZPK3SPEPCLU76',
  eurcIssuer: 'GAQRF3UGHBT6JYQZ7YSUYCIYWAF4T2SAA5237Q5LIQYJOHHFAWDXZ7NM',
};

// Test keypair (for demonstration only - not funded)
const testKeypair = Keypair.random();

// ==================== TOML PARSING ====================

interface StellarToml {
  WEB_AUTH_ENDPOINT?: string;
  TRANSFER_SERVER_SEP0024?: string;
  SIGNING_KEY?: string;
  NETWORK_PASSPHRASE?: string;
}

function parseToml(tomlText: string): StellarToml {
  const result: StellarToml = {};
  const lines = tomlText.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('#') || !trimmed.includes('=')) continue;

    const [key, ...valueParts] = trimmed.split('=');
    const value = valueParts.join('=').trim().replace(/^["']|["']$/g, '');

    const keyName = key.trim();
    if (keyName === 'WEB_AUTH_ENDPOINT') result.WEB_AUTH_ENDPOINT = value;
    if (keyName === 'TRANSFER_SERVER_SEP0024') result.TRANSFER_SERVER_SEP0024 = value;
    if (keyName === 'SIGNING_KEY') result.SIGNING_KEY = value;
    if (keyName === 'NETWORK_PASSPHRASE') result.NETWORK_PASSPHRASE = value;
  }

  return result;
}

// ==================== SEP-10 AUTHENTICATION ====================

async function authenticateSep10(
  authEndpoint: string,
  publicKey: string,
  keypair: Keypair
): Promise<string | null> {
  console.log('\n--- SEP-10 Authentication ---');
  console.log(`  Auth endpoint: ${authEndpoint}`);
  console.log(`  Public key: ${publicKey.slice(0, 12)}...`);

  try {
    // Step 1: Request challenge
    console.log('\n  Step 1: Requesting challenge...');
    const challengeUrl = `${authEndpoint}?account=${publicKey}`;
    const challengeResponse = await fetch(challengeUrl);

    if (!challengeResponse.ok) {
      const errorText = await challengeResponse.text();
      console.log(`  ❌ Challenge failed: ${challengeResponse.status}`);
      console.log(`     ${errorText}`);
      return null;
    }

    const challengeData = await challengeResponse.json() as {
      transaction: string;
      network_passphrase: string;
    };

    console.log(`  ✅ Challenge received`);
    console.log(`     Network: ${challengeData.network_passphrase}`);

    // Step 2: Parse and sign the challenge
    console.log('\n  Step 2: Signing challenge...');
    const tx = TransactionBuilder.fromXDR(
      challengeData.transaction,
      challengeData.network_passphrase
    );

    if (tx instanceof Transaction) {
      tx.sign(keypair);
      console.log(`  ✅ Challenge signed`);

      // Step 3: Submit signed challenge
      console.log('\n  Step 3: Submitting signed challenge...');
      const tokenResponse = await fetch(authEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transaction: tx.toXDR(),
        }),
      });

      if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text();
        console.log(`  ❌ Token request failed: ${tokenResponse.status}`);
        console.log(`     ${errorText}`);
        return null;
      }

      const tokenData = await tokenResponse.json() as { token: string };
      console.log(`  ✅ JWT Token received!`);
      console.log(`     Token preview: ${tokenData.token.slice(0, 50)}...`);

      return tokenData.token;
    }

    return null;
  } catch (error: any) {
    console.log(`  ❌ Error: ${error.message}`);
    return null;
  }
}

// ==================== SEP-24 DEPOSIT ====================

interface Sep24Response {
  type: string;
  url: string;
  id: string;
}

async function initiateDeposit(
  transferServer: string,
  token: string,
  publicKey: string,
  amount?: number
): Promise<Sep24Response | null> {
  console.log('\n--- SEP-24 Deposit Initiation ---');
  console.log(`  Transfer server: ${transferServer}`);

  try {
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
      const errorText = await response.text();
      console.log(`  ❌ Deposit initiation failed: ${response.status}`);
      console.log(`     ${errorText}`);
      return null;
    }

    const data = await response.json() as Sep24Response;
    console.log(`  ✅ Deposit initiated!`);
    console.log(`     Type: ${data.type}`);
    console.log(`     Transaction ID: ${data.id}`);
    console.log(`     WebView URL: ${data.url}`);

    return data;
  } catch (error: any) {
    console.log(`  ❌ Error: ${error.message}`);
    return null;
  }
}

// ==================== SEP-24 WITHDRAWAL ====================

async function initiateWithdrawal(
  transferServer: string,
  token: string,
  publicKey: string,
  amount?: number
): Promise<Sep24Response | null> {
  console.log('\n--- SEP-24 Withdrawal Initiation ---');
  console.log(`  Transfer server: ${transferServer}`);

  try {
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
      const errorText = await response.text();
      console.log(`  ❌ Withdrawal initiation failed: ${response.status}`);
      console.log(`     ${errorText}`);
      return null;
    }

    const data = await response.json() as Sep24Response;
    console.log(`  ✅ Withdrawal initiated!`);
    console.log(`     Type: ${data.type}`);
    console.log(`     Transaction ID: ${data.id}`);
    console.log(`     WebView URL: ${data.url}`);

    return data;
  } catch (error: any) {
    console.log(`  ❌ Error: ${error.message}`);
    return null;
  }
}

// ==================== MAIN ====================

async function main() {
  console.log('='.repeat(60));
  console.log('  MYKOBO SEP-24 FLOW TEST');
  console.log('='.repeat(60));
  console.log('');
  console.log('  This demonstrates the real Mykobo SEP-24 integration.');
  console.log('  Mykobo operates on MAINNET only (no testnet available).');
  console.log('');

  // ========== Step 1: Fetch stellar.toml ==========
  console.log('\n' + '='.repeat(60));
  console.log('  STEP 1: Fetch stellar.toml');
  console.log('='.repeat(60));

  console.log(`\n  Fetching: ${MYKOBO_CONFIG.tomlUrl}`);

  try {
    const tomlResponse = await fetch(MYKOBO_CONFIG.tomlUrl);
    if (!tomlResponse.ok) {
      throw new Error(`Failed to fetch TOML: ${tomlResponse.status}`);
    }

    const tomlText = await tomlResponse.text();
    const toml = parseToml(tomlText);

    console.log('\n  ✅ stellar.toml fetched and parsed:');
    console.log(`     WEB_AUTH_ENDPOINT: ${toml.WEB_AUTH_ENDPOINT}`);
    console.log(`     TRANSFER_SERVER_SEP0024: ${toml.TRANSFER_SERVER_SEP0024}`);
    console.log(`     SIGNING_KEY: ${toml.SIGNING_KEY?.slice(0, 12)}...`);

    // ========== Step 2: SEP-10 Authentication ==========
    console.log('\n' + '='.repeat(60));
    console.log('  STEP 2: SEP-10 Authentication');
    console.log('='.repeat(60));

    console.log('\n  Testing with a random keypair (not funded on mainnet)');
    console.log(`  Test public key: ${testKeypair.publicKey().slice(0, 12)}...`);

    const token = await authenticateSep10(
      toml.WEB_AUTH_ENDPOINT || MYKOBO_CONFIG.webAuthEndpoint,
      testKeypair.publicKey(),
      testKeypair
    );

    if (token) {
      // ========== Step 3: SEP-24 Deposit ==========
      console.log('\n' + '='.repeat(60));
      console.log('  STEP 3: SEP-24 Deposit (EUR → EURC)');
      console.log('='.repeat(60));

      const depositResult = await initiateDeposit(
        toml.TRANSFER_SERVER_SEP0024 || MYKOBO_CONFIG.transferServerSep24,
        token,
        testKeypair.publicKey(),
        100 // 100 EUR
      );

      // ========== Step 4: SEP-24 Withdrawal ==========
      console.log('\n' + '='.repeat(60));
      console.log('  STEP 4: SEP-24 Withdrawal (EURC → EUR)');
      console.log('='.repeat(60));

      const withdrawResult = await initiateWithdrawal(
        toml.TRANSFER_SERVER_SEP0024 || MYKOBO_CONFIG.transferServerSep24,
        token,
        testKeypair.publicKey(),
        50 // 50 EURC
      );

      // ========== Summary ==========
      console.log('\n' + '='.repeat(60));
      console.log('  FLOW SUMMARY');
      console.log('='.repeat(60));
      console.log('');
      console.log('  The SEP-24 flow works as follows:');
      console.log('');
      console.log('  1. USER OPENS APP');
      console.log('     └─ App fetches stellar.toml from mykobo.co');
      console.log('');
      console.log('  2. USER WANTS TO DEPOSIT EUR');
      console.log('     ├─ App requests SEP-10 challenge');
      console.log('     ├─ User signs challenge with their Stellar key');
      console.log('     ├─ App receives JWT token');
      console.log('     └─ App initiates SEP-24 deposit');
      console.log('');
      console.log('  3. WEBVIEW OPENS');
      console.log('     ├─ User completes KYC (first time only)');
      console.log('     ├─ User enters bank details / card info');
      console.log('     ├─ User confirms deposit amount');
      console.log('     └─ Mykobo processes payment');
      console.log('');
      console.log('  4. EURC ARRIVES');
      console.log('     ├─ Mykobo sends EURC to user\'s Stellar address');
      console.log('     ├─ App can poll transaction status');
      console.log('     └─ User sees EURC balance in app');
      console.log('');
      console.log('  WITHDRAWAL FLOW is similar but reversed:');
      console.log('     User sends EURC → Mykobo sends EUR to bank');
      console.log('');

      if (depositResult) {
        console.log('  ✅ Deposit WebView URL would be:');
        console.log(`     ${depositResult.url}`);
      }
      if (withdrawResult) {
        console.log('  ✅ Withdrawal WebView URL would be:');
        console.log(`     ${withdrawResult.url}`);
      }
    } else {
      console.log('\n  ⚠️  Could not complete authentication.');
      console.log('      This is expected for a random test keypair.');
    }

  } catch (error: any) {
    console.error(`\n  ❌ Error: ${error.message}`);
  }

  // ========== Integration Notes ==========
  console.log('\n' + '='.repeat(60));
  console.log('  INTEGRATION IN TANDA APP');
  console.log('='.repeat(60));
  console.log('');
  console.log('  The mykoboService in tanda-app provides:');
  console.log('');
  console.log('  • mykoboService.authenticate()');
  console.log('    → Get JWT token via SEP-10');
  console.log('');
  console.log('  • mykoboService.initiateDeposit(amount?)');
  console.log('    → Get WebView URL for EUR deposit');
  console.log('');
  console.log('  • mykoboService.initiateWithdrawal(amount?)');
  console.log('    → Get WebView URL for EURC withdrawal');
  console.log('');
  console.log('  • mykoboService.getTransactionStatus(txId)');
  console.log('    → Poll transaction status');
  console.log('');
  console.log('  KYC is handled inside Mykobo\'s WebView - no extra work!');
  console.log('');

  // ========== Testnet Note ==========
  console.log('\n' + '='.repeat(60));
  console.log('  NOTE: NO TESTNET AVAILABLE');
  console.log('='.repeat(60));
  console.log('');
  console.log('  Mykobo only operates on Stellar mainnet.');
  console.log('');
  console.log('  For testing without real EUR:');
  console.log('  1. Use the testnet with simulated KYC (backend reports KYC)');
  console.log('  2. Skip Mykobo WebView flow');
  console.log('  3. Test tanda logic with mock EURC trustline');
  console.log('');
  console.log('  For production:');
  console.log('  1. User opens WebView → completes KYC with Mykobo');
  console.log('  2. User deposits real EUR → receives real EURC');
  console.log('  3. User participates in tanda with real EURC');
  console.log('  4. User withdraws EURC → receives real EUR');
  console.log('');
}

main().catch(console.error);

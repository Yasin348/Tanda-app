/**
 * Open Mykobo WebView in browser
 * Run: npx tsx scripts/open-mykobo.ts
 */

import { Keypair, TransactionBuilder, Transaction } from '@stellar/stellar-sdk';
import { exec } from 'child_process';

async function main() {
  const keypair = Keypair.random();
  const publicKey = keypair.publicKey();

  console.log('Generando URL de depósito para Mykobo mainnet...');
  console.log('Public Key:', publicKey);

  // SEP-10 Auth
  console.log('\n1. Autenticando con SEP-10...');
  const challengeRes = await fetch(`https://stellar.mykobo.co/auth?account=${publicKey}`);
  const challengeData = await challengeRes.json() as { transaction: string; network_passphrase: string };

  const tx = TransactionBuilder.fromXDR(challengeData.transaction, challengeData.network_passphrase);
  if (tx instanceof Transaction) {
    tx.sign(keypair);
  }

  const tokenRes = await fetch('https://stellar.mykobo.co/auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ transaction: (tx as Transaction).toXDR() })
  });
  const { token } = await tokenRes.json() as { token: string };
  console.log('   ✅ Token obtenido');

  // SEP-24 Deposit
  console.log('\n2. Iniciando depósito SEP-24...');
  const depositRes = await fetch('https://stellar.mykobo.co/sep24/transactions/deposit/interactive', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ asset_code: 'EURC', account: publicKey, amount: '50' })
  });

  const data = await depositRes.json();
  console.log('   Response:', JSON.stringify(data, null, 2));

  if (!data.url) {
    console.log('   ❌ No se obtuvo URL');
    process.exit(1);
  }

  console.log('   ✅ Depósito iniciado');
  console.log('   Transaction ID:', data.id);

  console.log('\n3. Abriendo WebView en navegador...');
  console.log('\n   URL:', data.url);

  // Open in browser
  const command = process.platform === 'win32'
    ? `start "" "${data.url}"`
    : process.platform === 'darwin'
    ? `open "${data.url}"`
    : `xdg-open "${data.url}"`;

  exec(command, (error) => {
    if (error) {
      console.log('\n   ⚠️  No se pudo abrir el navegador automáticamente.');
      console.log('   Copia y pega esta URL en tu navegador:');
      console.log(`\n   ${data.url}\n`);
    } else {
      console.log('   ✅ Navegador abierto');
    }
  });

  console.log('\n' + '='.repeat(60));
  console.log('  PROCESO DE MYKOBO');
  console.log('='.repeat(60));
  console.log(`
  En el WebView verás:

  1. SELECCIÓN DE MÉTODO
     - Tarjeta de crédito/débito
     - Transferencia bancaria (SEPA)

  2. KYC (primera vez)
     - Verificación de identidad
     - Documento de identidad
     - Selfie

  3. DATOS DE PAGO
     - Introduce datos de tarjeta/banco
     - Confirma el monto (10 EUR en este caso)

  4. CONFIRMACIÓN
     - Mykobo procesa el pago
     - EURC se envía a tu wallet Stellar

  NOTA: Como es mainnet, necesitarías EUR real para completar.
        Pero puedes ver todo el flujo de UI/UX.
`);
}

main().catch(console.error);

import { mnemonicToSeedSync } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english.js';
import { Keypair } from '@stellar/stellar-sdk';

// SLIP-0010 derivation using SubtleCrypto
async function hmacSha512(key, data) {
  const keyBytes = typeof key === 'string' ? new TextEncoder().encode(key) : key;
  const cryptoKey = await crypto.subtle.importKey(
    'raw', keyBytes, { name: 'HMAC', hash: 'SHA-512' }, false, ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, data);
  return new Uint8Array(signature);
}

async function slip0010Derive(path, seed) {
  const masterKey = await hmacSha512('ed25519 seed', seed);
  let key = masterKey.slice(0, 32);
  let chainCode = masterKey.slice(32);

  const segments = path.replace('m/', '').split('/').map(s => {
    const hardened = s.endsWith("'");
    const index = parseInt(s.replace("'", ''), 10);
    return hardened ? index + 0x80000000 : index;
  });

  for (const index of segments) {
    const indexBuffer = new Uint8Array(4);
    new DataView(indexBuffer.buffer).setUint32(0, index, false);
    const data = new Uint8Array(1 + 32 + 4);
    data[0] = 0x00;
    data.set(key, 1);
    data.set(indexBuffer, 33);
    const derived = await hmacSha512(chainCode, data);
    key = derived.slice(0, 32);
    chainCode = derived.slice(32);
  }
  return key;
}

// SEP-5 test vector (12 words)
const testMnemonic = "illness spike exact argue year ramp mobile phone rich myself holiday crew";
const expectedAddress = "GDRXE2BQUC3AZNPVFSCEZ76NJ3WWL25FYFK6RGZGIEKWE4SOOHSUJUJ6";

const seed = mnemonicToSeedSync(testMnemonic);
const derivedKey = await slip0010Derive("m/44'/148'/0'", seed);
const keypair = Keypair.fromRawEd25519Seed(Buffer.from(derivedKey));

console.log("Test mnemonic:", testMnemonic);
console.log("Expected:", expectedAddress);
console.log("Got:     ", keypair.publicKey());
console.log("Match:", keypair.publicKey() === expectedAddress ? "✅ PASS" : "❌ FAIL");

import * as bip39Old from 'bip39';
import { derivePath } from 'ed25519-hd-key';
import { mnemonicToSeedSync } from '@scure/bip39';
import { Keypair } from '@stellar/stellar-sdk';

// SEP-5 test vector
const testMnemonic = "illness spike exact argue year ramp mobile phone rich myself holiday crew";

console.log("=== OLD METHOD (bip39 + ed25519-hd-key) ===");
const seedOld = bip39Old.mnemonicToSeedSync(testMnemonic);
console.log("Seed (hex):", seedOld.toString('hex').slice(0, 64) + "...");
const { key: keyOld } = derivePath("m/44'/148'/0'", seedOld.toString('hex'));
const keypairOld = Keypair.fromRawEd25519Seed(keyOld);
console.log("Public Key:", keypairOld.publicKey());

console.log("\n=== NEW METHOD (@scure/bip39) ===");
const seedNew = mnemonicToSeedSync(testMnemonic);
console.log("Seed (hex):", Buffer.from(seedNew).toString('hex').slice(0, 64) + "...");

// Use old derivePath with new seed
const { key: keyNew } = derivePath("m/44'/148'/0'", Buffer.from(seedNew).toString('hex'));
const keypairNew = Keypair.fromRawEd25519Seed(keyNew);
console.log("Public Key:", keypairNew.publicKey());

console.log("\n=== COMPARISON ===");
console.log("Seeds match:", seedOld.toString('hex') === Buffer.from(seedNew).toString('hex'));
console.log("Keys match:", keypairOld.publicKey() === keypairNew.publicKey());

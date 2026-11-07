/** Self-custodial wallet derivation (open-source @scure/@noble libraries, workerd-safe). */
import { generateMnemonic, mnemonicToSeedSync, validateMnemonic } from "@scure/bip39";
import { wordlist } from "@scure/bip39/wordlists/english.js";
import { HDKey } from "@scure/bip32";
import { HDKey as EdHDKey } from "micro-key-producer/slip10.js";
import { secp256k1 } from "@noble/curves/secp256k1.js";
import { keccak_256 } from "@noble/hashes/sha3.js";
import { base58, createBase58check } from "@scure/base";
import { sha256 } from "@noble/hashes/sha2.js";
import { p2wpkh } from "@scure/btc-signer";
import { WalletContractV4 } from "@ton/ton";
import { Buffer } from "node:buffer";

export type WalletAddresses = { evm: string; solana: string; bitcoin: string; ton: string; tron?: string };

/** Tron uses the same secp256k1 account as EVM: 0x41 + the 20 address bytes, base58check. */
export function tronFromEvm(evm: string) {
  const b = new Uint8Array(21); b[0] = 0x41;
  for (let i = 0; i < 20; i++) b[i + 1] = parseInt(evm.slice(2 + i * 2, 4 + i * 2), 16);
  return createBase58check(sha256).encode(b);
}
export function tronToHex(addr: string) { return Array.from(createBase58check(sha256).decode(addr), (x) => x.toString(16).padStart(2, "0")).join(""); }

export function newMnemonic() { return generateMnemonic(wordlist, 128); }

function checksum(hex: string) {
  const hash = Array.from(keccak_256(new TextEncoder().encode(hex)), (b) => b.toString(16).padStart(2, "0")).join("");
  return "0x" + [...hex].map((c, i) => (parseInt(hash[i], 16) >= 8 ? c.toUpperCase() : c)).join("");
}

export function deriveAddresses(mnemonic: string): WalletAddresses {
  if (!validateMnemonic(mnemonic, wordlist)) throw new Error("Invalid wallet phrase");
  const seed = mnemonicToSeedSync(mnemonic);
  const root = HDKey.fromMasterSeed(seed);
  const eth = root.derive("m/44'/60'/0'/0/0");
  const uncompressed = secp256k1.getPublicKey(eth.privateKey!, false).slice(1);
  const evmHex = Array.from(keccak_256(uncompressed).slice(-20), (b) => b.toString(16).padStart(2, "0")).join("");
  const btc = root.derive("m/84'/0'/0'/0/0");
  const sol = EdHDKey.fromMasterSeed(seed).derive("m/44'/501'/0'/0'");
  // TON: BIP39 seed on Trust Wallet's path, standard v4R2 wallet, non-bounceable user-friendly form.
  const tonKey = EdHDKey.fromMasterSeed(seed).derive("m/44'/607'/0'");
  const ton = WalletContractV4.create({ workchain: 0, publicKey: Buffer.from(tonKey.publicKeyRaw) }).address.toString({ bounceable: false, urlSafe: true });
  const evm = checksum(evmHex);
  return { evm, tron: tronFromEvm(evm), solana: base58.encode(sol.publicKeyRaw), bitcoin: p2wpkh(btc.publicKey!).address!, ton };
}

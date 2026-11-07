/** Server-only real transfers on every wallet network, plus Solana swaps through Jupiter (free, keyless). */
import { createWalletClient, encodeFunctionData, http, parseUnits, erc20Abi, type Chain } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { mainnet, bsc, polygon, base, arbitrum } from "viem/chains";
import { ed25519 } from "@noble/curves/ed25519.js";
import { base58 } from "@scure/base";
import * as btc from "@scure/btc-signer";
import { Buffer } from "node:buffer";
import { feeAddress, loadKeys, type WalletKeys } from "./keys.server";

export const FEE_BPS = 50; // 0.5%, charged only when a fee address is configured for that network
const hex = (u: Uint8Array) => ("0x" + Array.from(u, (b) => b.toString(16).padStart(2, "0")).join("")) as `0x${string}`;
const SOL_RPC = "https://solana-rpc.publicnode.com";

type EvmToken = { kind: "evm"; chain: Chain; rpc: string; decimals: number; contract?: `0x${string}` };
const SENDABLE: Record<string, EvmToken | { kind: "solana" | "ton" | "bitcoin" }> = {
  ethereum: { kind: "evm", chain: mainnet, rpc: "https://ethereum-rpc.publicnode.com", decimals: 18 },
  binancecoin: { kind: "evm", chain: bsc, rpc: "https://bsc-rpc.publicnode.com", decimals: 18 },
  "polygon-ecosystem-token": { kind: "evm", chain: polygon, rpc: "https://polygon-bor-rpc.publicnode.com", decimals: 18 },
  tether: { kind: "evm", chain: mainnet, rpc: "https://ethereum-rpc.publicnode.com", decimals: 6, contract: "0xdAC17F958D2ee523a2206206994597C13D831ec7" },
  "usd-coin": { kind: "evm", chain: base, rpc: "https://base-rpc.publicnode.com", decimals: 6, contract: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" },
  arbitrum: { kind: "evm", chain: arbitrum, rpc: "https://arbitrum-one-rpc.publicnode.com", decimals: 18, contract: "0x912CE59144191C1204E64559FE8253a0e49E6548" },
  solana: { kind: "solana" },
  "the-open-network": { kind: "ton" },
  bitcoin: { kind: "bitcoin" },
};

const split = (amount: bigint, fee: string | null) => { const f = fee ? (amount * BigInt(FEE_BPS)) / 10000n : 0n; return { send: amount - f, fee: f }; };

async function sendEvm(t: EvmToken, k: WalletKeys, to: string, amount: string) {
  if (!/^0x[0-9a-fA-F]{40}$/.test(to)) throw new Error("Invalid address");
  const client = createWalletClient({ account: privateKeyToAccount(hex(k.evm)), chain: t.chain, transport: http(t.rpc) });
  const feeTo = await feeAddress("evm");
  const { send, fee } = split(parseUnits(amount, t.decimals), feeTo);
  const go = (dest: string, v: bigint) => t.contract
    ? client.sendTransaction({ to: t.contract, data: encodeFunctionData({ abi: erc20Abi, functionName: "transfer", args: [dest as `0x${string}`, v] }) } as any)
    : client.sendTransaction({ to: dest as `0x${string}`, value: v } as any);
  const tx = await go(to, send);
  if (fee > 0n && feeTo) await go(feeTo, fee).catch(() => {});
  return tx;
}

async function solRpc(method: string, params: unknown[]) {
  const r = await fetch(SOL_RPC, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) });
  const j = (await r.json()) as { result?: any; error?: { message: string } };
  if (j.error) throw new Error(j.error.message);
  return j.result;
}
const u64 = (n: bigint) => { const b = new Uint8Array(8); new DataView(b.buffer).setBigUint64(0, n, true); return b; };
const cat = (...a: Uint8Array[]) => { const o = new Uint8Array(a.reduce((s, x) => s + x.length, 0)); let i = 0; for (const x of a) { o.set(x, i); i += x.length; } return o; };

async function sendSol(k: WalletKeys, to: string, amount: string) {
  const dest = base58.decode(to); if (dest.length !== 32) throw new Error("Invalid address");
  const feeTo = await feeAddress("solana");
  const { send, fee } = split(BigInt(Math.round(Number(amount) * 1e9)), feeTo);
  const { value } = await solRpc("getLatestBlockhash", [{ commitment: "finalized" }]);
  const keys = [k.solPub, dest, ...(fee > 0n && feeTo ? [base58.decode(feeTo)] : []), new Uint8Array(32)];
  const sys = keys.length - 1;
  const ix = (toIdx: number, lamports: bigint) => cat(Uint8Array.of(sys, 2, 0, toIdx, 12), Uint8Array.of(2, 0, 0, 0), u64(lamports));
  const ixs = [ix(1, send), ...(keys.length === 4 ? [ix(2, fee)] : [])];
  const msg = cat(Uint8Array.of(1, 0, 1, keys.length), ...keys, base58.decode(value.blockhash), Uint8Array.of(ixs.length), ...ixs);
  const tx = cat(Uint8Array.of(1), ed25519.sign(msg, k.sol), msg);
  return solRpc("sendTransaction", [Buffer.from(tx).toString("base64"), { encoding: "base64" }]);
}

async function sendTon(k: WalletKeys, to: string, amount: string) {
  const { WalletContractV4, TonClient, internal, toNano, SendMode, Address } = await import("@ton/ton");
  const { keyPairFromSeed } = await import("@ton/crypto");
  Address.parse(to);
  const kp = keyPairFromSeed(Buffer.from(k.ton));
  const wallet = new TonClient({ endpoint: "https://toncenter.com/api/v2/jsonRPC" }).open(WalletContractV4.create({ workchain: 0, publicKey: kp.publicKey }));
  const feeTo = await feeAddress("ton");
  const { send, fee } = split(toNano(amount), feeTo);
  const seqno = await wallet.getSeqno();
  await wallet.sendTransfer({ seqno, secretKey: kp.secretKey, sendMode: SendMode.PAY_GAS_SEPARATELY,
    messages: [internal({ to, value: send, bounce: false }), ...(fee > 0n && feeTo ? [internal({ to: feeTo, value: fee, bounce: false })] : [])] });
  return `seqno:${seqno}`;
}

async function sendBtc(k: WalletKeys, to: string, amount: string) {
  const pay = btc.p2wpkh(k.btcPub);
  const utxos = (await (await fetch(`https://mempool.space/api/address/${pay.address}/utxo`)).json()) as { txid: string; vout: number; value: number }[];
  const rate = ((await (await fetch("https://mempool.space/api/v1/fees/recommended")).json()) as { halfHourFee: number }).halfHourFee;
  const feeTo = await feeAddress("bitcoin");
  const { send, fee } = split(BigInt(Math.round(Number(amount) * 1e8)), feeTo);
  const tx = new btc.Transaction();
  let total = 0n;
  for (const u of utxos) { tx.addInput({ txid: u.txid, index: u.vout, witnessUtxo: { script: pay.script, amount: BigInt(u.value) } }); total += BigInt(u.value); }
  const outs = 2 + (fee > 0n ? 1 : 0);
  const network = BigInt(Math.ceil((11 + 68 * utxos.length + 31 * outs) * rate));
  const change = total - send - fee - network;
  if (change < 0n) throw new Error("Not enough BTC to cover the amount and network fee");
  tx.addOutputAddress(to, send);
  if (fee > 0n && feeTo) tx.addOutputAddress(feeTo, fee);
  if (change > 546n) tx.addOutputAddress(pay.address!, change);
  tx.sign(k.btc); tx.finalize();
  const r = await fetch("https://mempool.space/api/tx", { method: "POST", body: tx.hex });
  if (!r.ok) throw new Error(await r.text());
  return r.text();
}

export async function sendToken(userId: string, tokenId: string, to: string, amount: string) {
  const t = SENDABLE[tokenId];
  if (!t) throw new Error("This coin can't be sent yet");
  if (!(Number(amount) > 0)) throw new Error("Enter an amount");
  const k = await loadKeys(userId);
  if (t.kind === "evm") return sendEvm(t, k, to.trim(), amount);
  if (t.kind === "solana") return sendSol(k, to.trim(), amount);
  if (t.kind === "ton") return sendTon(k, to.trim(), amount);
  return sendBtc(k, to.trim(), amount);
}

/* ---------- Solana trading (Jupiter) ---------- */
export const SOL_MINT = "So11111111111111111111111111111111111111112";
const JUP = "https://lite-api.jup.ag/swap/v1";

export async function splBalance(owner: string, mint: string) {
  if (mint === SOL_MINT) return ((await solRpc("getBalance", [owner]))?.value ?? 0) / 1e9;
  const r = await solRpc("getTokenAccountsByOwner", [owner, { mint }, { encoding: "jsonParsed" }]);
  return (r?.value ?? []).reduce((s: number, a: any) => s + Number(a.account.data.parsed.info.tokenAmount.uiAmount || 0), 0);
}
async function decimalsOf(mint: string) {
  if (mint === SOL_MINT) return 9;
  const r = await solRpc("getAccountInfo", [mint, { encoding: "jsonParsed" }]);
  return Number(r?.value?.data?.parsed?.info?.decimals ?? 6);
}

export async function quote(inputMint: string, outputMint: string, uiAmount: number) {
  const dec = await decimalsOf(inputMint);
  const amount = BigInt(Math.floor(uiAmount * 10 ** dec));
  if (amount <= 0n) throw new Error("Enter an amount");
  const r = await fetch(`${JUP}/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amount}&slippageBps=100`);
  const q = await r.json() as any;
  if (!r.ok || q.error) throw new Error(q.error || "No route for this trade");
  const outDec = await decimalsOf(outputMint);
  return { raw: q, out: Number(q.outAmount) / 10 ** outDec, impact: Number(q.priceImpactPct || 0) * 100 };
}

export async function executeSwap(userId: string, owner: string, inputMint: string, outputMint: string, uiAmount: number) {
  const { raw } = await quote(inputMint, outputMint, uiAmount);
  const k = await loadKeys(userId);
  if (base58.encode(k.solPub) !== owner) throw new Error("Wallet mismatch");
  const r = await fetch(`${JUP}/swap`, { method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ quoteResponse: raw, userPublicKey: owner, wrapAndUnwrapSol: true, dynamicComputeUnitLimit: true, prioritizationFeeLamports: "auto" }) });
  const j = await r.json() as { swapTransaction?: string; error?: string };
  if (!j.swapTransaction) throw new Error(j.error || "Trade could not be prepared");
  const tx = Uint8Array.from(Buffer.from(j.swapTransaction, "base64"));
  const n = tx[0]; const msg = tx.slice(1 + 64 * n);
  tx.set(ed25519.sign(msg, k.sol), 1);
  return solRpc("sendTransaction", [Buffer.from(tx).toString("base64"), { encoding: "base64", skipPreflight: false, maxRetries: 3 }]);
}

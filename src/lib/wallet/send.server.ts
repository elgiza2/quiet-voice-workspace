/** Server-only real transfers on every wallet network, plus Solana swaps through Jupiter (free, keyless). */
import { createWalletClient, createPublicClient, encodeFunctionData, http, parseUnits, erc20Abi, type Chain } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { mainnet, bsc, polygon, base, arbitrum, avalanche } from "viem/chains";
import { secp256k1 } from "@noble/curves/secp256k1.js";
import { tronFromEvm, tronToHex } from "./derive";
import { ed25519 } from "@noble/curves/ed25519.js";
import { base58 } from "@scure/base";
import * as btc from "@scure/btc-signer";
import { Buffer } from "node:buffer";
import { feeAddress, loadKeys, type WalletKeys } from "./keys.server";

export const FEE_BPS = 50; // 0.5%, charged only when a fee address is configured for that network
const hex = (u: Uint8Array) => ("0x" + Array.from(u, (b) => b.toString(16).padStart(2, "0")).join("")) as `0x${string}`;
const SOL_RPC = "https://solana-rpc.publicnode.com";

type EvmToken = { kind: "evm"; chain: Chain; rpc: string; decimals: number; contract?: `0x${string}` };
const SENDABLE: Record<string, EvmToken | { kind: "solana" | "ton" | "bitcoin" } | { kind: "tron"; contract?: string }> = {
  "avalanche-2": { kind: "evm", chain: avalanche, rpc: "https://avalanche-c-chain-rpc.publicnode.com", decimals: 18 },
  tron: { kind: "tron" },
  "tether-tron": { kind: "tron", contract: "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t" },
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

async function solTransfer(k: WalletKeys, outs: [Uint8Array, bigint][]) {
  const { value } = await solRpc("getLatestBlockhash", [{ commitment: "finalized" }]);
  const keys = [k.solPub, ...outs.map((o) => o[0]), new Uint8Array(32)];
  const sys = keys.length - 1;
  const ixs = outs.map(([, lamports], i) => cat(Uint8Array.of(sys, 2, 0, i + 1, 12), Uint8Array.of(2, 0, 0, 0), u64(lamports)));
  const msg = cat(Uint8Array.of(1, 0, 1, keys.length), ...keys, base58.decode(value.blockhash), Uint8Array.of(ixs.length), ...ixs);
  const tx = cat(Uint8Array.of(1), ed25519.sign(msg, k.sol), msg);
  return solRpc("sendTransaction", [Buffer.from(tx).toString("base64"), { encoding: "base64" }]);
}

async function sendSol(k: WalletKeys, to: string, amount: string) {
  const dest = base58.decode(to); if (dest.length !== 32) throw new Error("Invalid address");
  const feeTo = await feeAddress("solana");
  const { send, fee } = split(BigInt(Math.round(Number(amount) * 1e9)), feeTo);
  return solTransfer(k, [[dest, send], ...(fee > 0n && feeTo ? [[base58.decode(feeTo), fee] as [Uint8Array, bigint]] : [])]);
}

/* ---------- Tron (TronGrid public API) ---------- */
const TRON = "https://api.trongrid.io";
const tpost = async (path: string, body: unknown) => { const r = await fetch(TRON + path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); return r.json() as Promise<any>; };
async function tronSign(k: WalletKeys, tx: any) {
  if (!tx?.txID) throw new Error(tx?.Error || tx?.result?.message || "Tron transaction could not be built");
  const rec = secp256k1.sign(Uint8Array.from(Buffer.from(tx.txID, "hex")), k.evm, { prehash: false, format: "recovered" });
  const sig = cat(rec.slice(1), Uint8Array.of(rec[0] + 27));
  const r = await tpost("/wallet/broadcasttransaction", { ...tx, signature: [Buffer.from(sig).toString("hex")] });
  if (!r.result) throw new Error(r.message ? Buffer.from(r.message, "hex").toString() || r.message : "Tron broadcast failed");
  return tx.txID as string;
}
async function tronTransfer(k: WalletKeys, from: string, to: string, units: bigint, contract?: string) {
  if (!contract) return tronSign(k, await tpost("/wallet/createtransaction", { owner_address: from, to_address: to, amount: Number(units), visible: true }));
  const param = tronToHex(to).slice(2).padStart(64, "0") + units.toString(16).padStart(64, "0");
  const r = await tpost("/wallet/triggersmartcontract", { owner_address: from, contract_address: contract, function_selector: "transfer(address,uint256)", parameter: param, fee_limit: 40_000_000, call_value: 0, visible: true });
  return tronSign(k, r.transaction);
}
async function sendTron(k: WalletKeys, to: string, amount: string, contract?: string) {
  if (!/^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(to)) throw new Error("Invalid address");
  const from = tronFromEvm(privateKeyToAccount(hex(k.evm)).address);
  const feeTo = await feeAddress("tron");
  const { send, fee } = split(BigInt(Math.round(Number(amount) * 1e6)), feeTo);
  const tx = await tronTransfer(k, from, to, send, contract);
  if (fee > 0n && feeTo) await tronTransfer(k, from, feeTo, fee, contract).catch(() => {});
  return tx;
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
  if (t.kind === "tron") return sendTron(k, to.trim(), amount, t.contract);
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
  const sig = await solRpc("sendTransaction", [Buffer.from(tx).toString("base64"), { encoding: "base64", skipPreflight: false, maxRetries: 3 }]);
  // Platform fee: 0.5% of the trade value, paid in SOL to the configured receiver.
  const feeTo = await feeAddress("solana");
  if (feeTo) {
    const part = (uiAmount * FEE_BPS) / 10000;
    const sol = inputMint === SOL_MINT ? part : await quote(inputMint, SOL_MINT, part).then((q) => q.out).catch(() => 0);
    const lamports = BigInt(Math.floor(sol * 1e9));
    if (lamports > 5000n) await new Promise((r) => setTimeout(r, 2500)).then(() => solTransfer(k, [[base58.decode(feeTo), lamports]])).catch(() => {});
  }
  return sig;
}

/* ---------- EVM trading (KyberSwap aggregator, free & keyless, fee charged in the input token) ---------- */
export const NATIVE = "0xEeeeeEeeeEeEeEeEeEeEEEeeeeEeeeeeeeEEeEeE";
export const EVM_NETS = {
  ethereum: { slug: "ethereum", chain: mainnet, rpc: "https://ethereum-rpc.publicnode.com" },
  "binance-smart-chain": { slug: "bsc", chain: bsc, rpc: "https://bsc-rpc.publicnode.com" },
  "polygon-pos": { slug: "polygon", chain: polygon, rpc: "https://polygon-bor-rpc.publicnode.com" },
  base: { slug: "base", chain: base, rpc: "https://base-rpc.publicnode.com" },
  "arbitrum-one": { slug: "arbitrum", chain: arbitrum, rpc: "https://arbitrum-one-rpc.publicnode.com" },
  avalanche: { slug: "avalanche", chain: avalanche, rpc: "https://avalanche-c-chain-rpc.publicnode.com" },
} as const;
export type EvmNet = keyof typeof EVM_NETS;
const KYBER = "https://aggregator-api.kyberswap.com";
const KH = { "x-client-id": "megsy-wallet", "Content-Type": "application/json" };
const pub = (n: EvmNet) => createPublicClient({ chain: EVM_NETS[n].chain, transport: http(EVM_NETS[n].rpc) });
async function evmDecimals(n: EvmNet, token: string) {
  if (token.toLowerCase() === NATIVE.toLowerCase()) return 18;
  return Number(await (pub(n).readContract as any)({ address: token as `0x${string}`, abi: erc20Abi, functionName: "decimals" }));
}
export async function evmBalance(n: EvmNet, owner: string, token: string) {
  const c = pub(n);
  const raw = token.toLowerCase() === NATIVE.toLowerCase() ? await c.getBalance({ address: owner as `0x${string}` })
    : await (c.readContract as any)({ address: token as `0x${string}`, abi: erc20Abi, functionName: "balanceOf", args: [owner as `0x${string}`] });
  return Number(raw) / 10 ** (await evmDecimals(n, token));
}
async function kyberRoute(n: EvmNet, tokenIn: string, tokenOut: string, ui: number) {
  const dec = await evmDecimals(n, tokenIn);
  const amountIn = parseUnits(ui.toFixed(Math.min(dec, 12)), dec);
  if (amountIn <= 0n) throw new Error("Enter an amount");
  const feeTo = await feeAddress("evm");
  const qs = new URLSearchParams({ tokenIn, tokenOut, amountIn: amountIn.toString(), ...(feeTo ? { feeAmount: String(FEE_BPS), chargeFeeBy: "currency_in", isInBps: "true", feeReceiver: feeTo } : {}) });
  const r = await fetch(`${KYBER}/${EVM_NETS[n].slug}/api/v1/routes?${qs}`, { headers: KH });
  const j = await r.json() as any;
  if (!r.ok || !j.data?.routeSummary) throw new Error(j.message || "No route for this trade");
  return { summary: j.data.routeSummary, router: j.data.routerAddress as `0x${string}`, amountIn, outDec: await evmDecimals(n, tokenOut) };
}
export async function evmQuote(n: EvmNet, tokenIn: string, tokenOut: string, ui: number) {
  const q = await kyberRoute(n, tokenIn, tokenOut, ui);
  const usdIn = Number(q.summary.amountInUsd || 0), usdOut = Number(q.summary.amountOutUsd || 0);
  return { out: Number(q.summary.amountOut) / 10 ** q.outDec, impact: usdIn ? Math.max(0, ((usdIn - usdOut) / usdIn) * 100) : 0 };
}
export async function evmSwap(userId: string, n: EvmNet, tokenIn: string, tokenOut: string, ui: number) {
  const k = await loadKeys(userId);
  const account = privateKeyToAccount(hex(k.evm));
  const { summary, router, amountIn } = await kyberRoute(n, tokenIn, tokenOut, ui);
  const b = await fetch(`${KYBER}/${EVM_NETS[n].slug}/api/v1/route/build`, { method: "POST", headers: KH, body: JSON.stringify({ routeSummary: summary, sender: account.address, recipient: account.address, slippageTolerance: 100 }) });
  const built = await b.json() as any;
  if (!b.ok || !built.data?.data) throw new Error(built.message || "Trade could not be prepared");
  const net = EVM_NETS[n];
  const wallet = createWalletClient({ account, chain: net.chain, transport: http(net.rpc) });
  const c = pub(n);
  const native = tokenIn.toLowerCase() === NATIVE.toLowerCase();
  if (!native) {
    const allowance: bigint = await (c.readContract as any)({ address: tokenIn as `0x${string}`, abi: erc20Abi, functionName: "allowance", args: [account.address, router] });
    if (allowance < amountIn) {
      const h = await wallet.writeContract({ address: tokenIn as `0x${string}`, abi: erc20Abi, functionName: "approve", args: [router, amountIn] } as any);
      await c.waitForTransactionReceipt({ hash: h, timeout: 90_000 });
    }
  }
  return wallet.sendTransaction({ to: (built.data.routerAddress || router) as `0x${string}`, data: built.data.data, value: native ? BigInt(built.data.amountIn || amountIn) : 0n } as any);
}

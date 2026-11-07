/** Server-only trading on TON (STON.fi, keyless) and Bitcoin (THORChain native swaps BTC <-> ETH, keyless). */
import { createPublicClient, createWalletClient, http, parseAbi } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { mainnet } from "viem/chains";
import * as btc from "@scure/btc-signer";
import { Buffer } from "node:buffer";
import { feeAddress, loadKeys } from "./keys.server";

const FEE_BPS = 50;
export const TON_NATIVE = "EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAM9c";
const STON = "https://api.ston.fi/v1";
const TONCENTER = "https://toncenter.com/api";
const THOR = "https://gateway.liquify.com/chain/thorchain_api/thorchain";
const ETH_RPC = "https://ethereum-rpc.publicnode.com";
const hex = (u: Uint8Array) => ("0x" + Buffer.from(u).toString("hex")) as `0x${string}`;

/* ---------- TON ---------- */
const decCache = new Map<string, number>();
async function tonDecimals(addr: string) {
  if (addr === TON_NATIVE) return 9;
  if (decCache.has(addr)) return decCache.get(addr)!;
  const j = await (await fetch(`${STON}/assets/${addr}`)).json() as any;
  const d = Number(j.asset?.decimals ?? 9); decCache.set(addr, d); return d;
}
export async function tonBalance(owner: string, asset: string) {
  if (asset === TON_NATIVE) { const j = await (await fetch(`${TONCENTER}/v2/getAddressBalance?address=${owner}`)).json() as any; return Number(j.result || 0) / 1e9; }
  const j = await (await fetch(`${TONCENTER}/v3/jetton/wallets?owner_address=${owner}&jetton_address=${asset}&limit=1`)).json() as any;
  return Number(j.jetton_wallets?.[0]?.balance || 0) / 10 ** (await tonDecimals(asset));
}
async function simulate(offer: string, ask: string, ui: number) {
  const d = await tonDecimals(offer);
  const units = BigInt(Math.floor(ui * 10 ** d));
  if (units <= 0n) throw new Error("Enter an amount");
  const r = await fetch(`${STON}/swap/simulate?offer_address=${offer}&ask_address=${ask}&units=${units}&slippage_tolerance=0.01&dex_v2=true`, { method: "POST" });
  const j = await r.json() as any;
  if (!r.ok || !j.ask_units) throw new Error(typeof j === "string" ? j : j.message || "No route for this trade");
  return { sim: j, units, outDec: await tonDecimals(ask) };
}
export async function tonQuote(offer: string, ask: string, ui: number) {
  const { sim, outDec } = await simulate(offer, ask, ui);
  return { out: Number(sim.ask_units) / 10 ** outDec, impact: Number(sim.price_impact || 0) * 100 };
}
async function tonWallet(userId: string) {
  const { WalletContractV4, TonClient } = await import("@ton/ton");
  const { keyPairFromSeed } = await import("@ton/crypto");
  const k = await loadKeys(userId);
  const kp = keyPairFromSeed(Buffer.from(k.ton));
  const client = new TonClient({ endpoint: `${TONCENTER}/v2/jsonRPC` });
  const wallet = client.open(WalletContractV4.create({ workchain: 0, publicKey: kp.publicKey }));
  return { client, wallet, kp };
}
export async function tonSwap(userId: string, offer: string, ask: string, ui: number) {
  const { internal, SendMode, toNano } = await import("@ton/ton");
  const { dexFactory } = await import("@ston-fi/sdk");
  const { client, wallet, kp } = await tonWallet(userId);
  const { sim, units } = await simulate(offer, ask, ui);
  const info = sim.router;
  const dex = dexFactory({ majorVersion: info.major_version, minorVersion: info.minor_version, routerType: String(info.router_type || "").replace(/([a-z])([A-Z])/g, "$1_$2").toLowerCase() as any });
  const router = client.open((dex.Router as any).create(info.address));
  const proxyTon = (dex.pTON as any).create(info.pton_master_address);
  const user = wallet.address.toString();
  const base = { userWalletAddress: user, proxyTon, offerAmount: units, minAskAmount: sim.min_ask_units, queryId: Date.now() };
  const p = offer === TON_NATIVE ? await router.getSwapTonToJettonTxParams({ ...base, askJettonAddress: ask })
    : ask === TON_NATIVE ? await router.getSwapJettonToTonTxParams({ ...base, offerJettonAddress: offer })
    : await router.getSwapJettonToJettonTxParams({ ...base, offerJettonAddress: offer, askJettonAddress: ask });
  // Platform fee: 0.5% of the trade value, paid in TON.
  const feeTo = await feeAddress("ton");
  let fee = 0n;
  if (feeTo) {
    const part = (ui * FEE_BPS) / 10000;
    const tonAmt = offer === TON_NATIVE ? part : await tonQuote(offer, TON_NATIVE, part).then((q) => q.out).catch(() => 0);
    fee = toNano(tonAmt.toFixed(9));
  }
  const seqno = await wallet.getSeqno();
  await wallet.sendTransfer({ seqno, secretKey: kp.secretKey, sendMode: SendMode.PAY_GAS_SEPARATELY,
    messages: [internal({ to: p.to, value: p.value, body: p.body }), ...(fee > 10_000_000n && feeTo ? [internal({ to: feeTo, value: fee, bounce: false })] : [])] });
  return `seqno:${seqno}`;
}

/* ---------- Bitcoin via THORChain (BTC.BTC <-> ETH.ETH) ---------- */
export const BTC_ASSET = "BTC.BTC", ETH_ASSET = "ETH.ETH";
async function thorQuote(from: string, to: string, ui: number, destination: string) {
  const amount = Math.floor(ui * 1e8);
  if (amount <= 0) throw new Error("Enter an amount");
  const r = await fetch(`${THOR}/quote/swap?from_asset=${from}&to_asset=${to}&amount=${amount}&destination=${destination}&streaming_interval=1`);
  const j = await r.json() as any;
  if (!r.ok || !j.inbound_address) throw new Error(j.message || j.error || "No route for this trade");
  return j;
}
export async function btcQuote(from: string, to: string, ui: number, dest: string) {
  const q = await thorQuote(from, to, ui, dest);
  return { out: Number(q.expected_amount_out) / 1e8, impact: Number(q.fees?.total_bps || 0) / 100 };
}
export async function btcSwap(userId: string, from: string, to: string, ui: number, addrs: { evm: string; bitcoin: string }) {
  const k = await loadKeys(userId);
  if (from === BTC_ASSET) {
    const q = await thorQuote(from, to, ui, addrs.evm);
    const pay = btc.p2wpkh(k.btcPub);
    const utxos = (await (await fetch(`https://mempool.space/api/address/${pay.address}/utxo`)).json()) as { txid: string; vout: number; value: number }[];
    const rate = ((await (await fetch("https://mempool.space/api/v1/fees/recommended")).json()) as { fastestFee: number }).fastestFee;
    const feeTo = await feeAddress("bitcoin");
    const amount = BigInt(Math.floor(ui * 1e8));
    const fee = feeTo ? (amount * BigInt(FEE_BPS)) / 10000n : 0n;
    const swapAmt = amount - fee;
    const tx = new btc.Transaction({ allowUnknownOutputs: true });
    let total = 0n;
    for (const u of utxos) { tx.addInput({ txid: u.txid, index: u.vout, witnessUtxo: { script: pay.script, amount: BigInt(u.value) } }); total += BigInt(u.value); }
    const network = BigInt(Math.ceil((11 + 68 * utxos.length + 31 * 4 + 90) * rate));
    const change = total - amount - network;
    if (change < 0n) throw new Error("Not enough BTC to cover the amount and network fee");
    tx.addOutputAddress(q.inbound_address, swapAmt);
    tx.addOutput({ script: btc.Script.encode(["RETURN", new TextEncoder().encode(q.memo)]), amount: 0n });
    if (fee > 546n && feeTo) tx.addOutputAddress(feeTo, fee);
    if (change > 546n) tx.addOutputAddress(pay.address!, change);
    tx.sign(k.btc); tx.finalize();
    const r = await fetch("https://mempool.space/api/tx", { method: "POST", body: tx.hex });
    if (!r.ok) throw new Error(await r.text());
    return r.text();
  }
  // ETH -> BTC through the THORChain router.
  const feeTo = await feeAddress("evm");
  const wei = BigInt(Math.floor(ui * 1e18));
  const fee = feeTo ? (wei * BigInt(FEE_BPS)) / 10000n : 0n;
  const swapUi = Number(wei - fee) / 1e18;
  const q = await thorQuote(from, to, swapUi, addrs.bitcoin);
  if (!q.router) throw new Error("Swap router unavailable");
  const account = privateKeyToAccount(hex(k.evm));
  const wallet = createWalletClient({ account, chain: mainnet, transport: http(ETH_RPC) });
  const value = BigInt(Math.floor(swapUi * 1e8)) * 10n ** 10n;
  const abi = parseAbi(["function depositWithExpiry(address vault, address asset, uint256 amount, string memo, uint256 expiration) payable"]);
  const h = await wallet.writeContract({ address: q.router, abi, functionName: "depositWithExpiry", args: [q.inbound_address, "0x0000000000000000000000000000000000000000", value, q.memo, BigInt(Math.floor(Date.now() / 1000) + 3600)], value } as any);
  if (fee > 0n && feeTo) await wallet.sendTransaction({ to: feeTo as `0x${string}`, value: fee } as any).catch(() => {});
  return h;
}
export async function ethBalance(owner: string) {
  return Number(await createPublicClient({ chain: mainnet, transport: http(ETH_RPC) }).getBalance({ address: owner as `0x${string}` })) / 1e18;
}
export async function btcBalance(address: string) {
  const j = await (await fetch(`https://mempool.space/api/address/${address}`)).json() as any;
  return (j.chain_stats.funded_txo_sum - j.chain_stats.spent_txo_sum) / 1e8;
}

/**
 * Evolved — on-chain payments on OKX X Layer (TESTNET ONLY).
 *
 * Design principle: Evolved NEVER holds keys and NEVER signs or broadcasts
 * transactions. It issues EIP-681 payment requests against X Layer testnet
 * and verifies settlement with read-only JSON-RPC calls. Funds can only move
 * from the payer's own wallet — this service cannot move money, by
 * construction.
 *
 * Network: X Layer testnet "Terigon", chainId 1952 (0x7a0),
 * RPC https://testrpc.xlayer.tech, native gas token OKB (18 decimals).
 *
 * The same machinery powers the x402 paid-ASP tier: POST /mcp-paid answers
 * 402 Payment Required with an `accepts` envelope (scheme "exact", network
 * eip155:1952) until the caller presents payment proof.
 */

import { round2 } from "../store.js";

export const XLAYER_TESTNET = {
  name: "X Layer testnet (Terigon)",
  chainId: 1952,
  caip2: "eip155:1952",
  rpc: process.env.EVOLVED_XLAYER_RPC ?? "https://testrpc.xlayer.tech",
  explorer: "https://www.oklink.com/x-layer-testnet",
  native: { symbol: "OKB", decimals: 18 },
};

/** Demo receiving address — a fixed, documented TESTNET demo address. */
export const DEMO_PAYTO =
  process.env.EVOLVED_PAYTO ?? "0x000000000000000000000000000000000000e0e1";

/** Demo conversion: CAD → testnet OKB at a fixed, clearly-synthetic rate. */
export const CAD_PER_OKB_DEMO = 100;

export function isAddress(a: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(a);
}

/** Convert human units to base-unit integer string without float drift. */
export function toBaseUnits(amount: string | number, decimals: number): string {
  const s = String(amount);
  const [whole, frac = ""] = s.split(".");
  const fracPadded = (frac + "0".repeat(decimals)).slice(0, decimals);
  const combined = `${whole}${fracPadded}`.replace(/^0+(?=\d)/, "");
  return BigInt(combined).toString();
}

export function cadToOkb(amountCad: number): string {
  // Fixed synthetic demo rate; 6 decimal places of OKB precision.
  return (Math.round((amountCad / CAD_PER_OKB_DEMO) * 1e6) / 1e6).toFixed(6);
}

/** EIP-681 payment URI (native transfer). */
export function paymentUri(payTo: string, baseUnits: string, chainId: number): string {
  return `ethereum:${payTo}@${chainId}?value=${baseUnits}`;
}

/** x402 "Payment Required" envelope for a fixed-price resource. */
export function x402Envelope(opts: {
  resource: string;
  description: string;
  amountAsset: string;
  baseUnits: string;
  payTo: string;
}): Record<string, unknown> {
  return {
    x402Version: 1,
    error: "Payment required",
    accepts: [
      {
        scheme: "exact",
        network: XLAYER_TESTNET.caip2,
        maxAmountRequired: opts.baseUnits,
        asset: null, // native OKB on X Layer testnet
        assetSymbol: XLAYER_TESTNET.native.symbol,
        payTo: opts.payTo,
        resource: opts.resource,
        description: opts.description,
        mimeType: "application/json",
        maxTimeoutSeconds: 300,
        extra: {
          rpc: XLAYER_TESTNET.rpc,
          explorer: XLAYER_TESTNET.explorer,
          testnet: true,
          note: "TESTNET ONLY — demo funds. Present {\"txHash\":\"0x…\"} (live) or {\"simulated\":true} (demo mode) in the X-PAYMENT header, base64 or raw JSON.",
        },
      },
    ],
  };
}

async function rpc(method: string, params: unknown[]): Promise<unknown> {
  const res = await fetch(XLAYER_TESTNET.rpc, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`RPC HTTP ${res.status}`);
  const body = (await res.json()) as { result?: unknown; error?: { message: string } };
  if (body.error) throw new Error(`RPC error: ${body.error.message}`);
  return body.result;
}

export async function chainStatus(): Promise<{
  reachable: boolean;
  chainId?: number;
  blockNumber?: number;
  error?: string;
}> {
  try {
    const [cid, bn] = await Promise.all([
      rpc("eth_chainId", []),
      rpc("eth_blockNumber", []),
    ]);
    return {
      reachable: true,
      chainId: Number.parseInt(String(cid), 16),
      blockNumber: Number.parseInt(String(bn), 16),
    };
  } catch (err) {
    return { reachable: false, error: String(err) };
  }
}

export interface VerifyResult {
  verified: boolean;
  mode: "live" | "simulated";
  detail: string;
  txHash?: string;
  from?: string;
  valueBaseUnits?: string;
}

/**
 * Verify a native-transfer payment on X Layer testnet: the transaction must
 * exist, be successful, pay the expected address, and carry at least the
 * requested value. Read-only — no keys, no signing.
 */
export async function verifyOnChain(
  txHash: string,
  payTo: string,
  minBaseUnits: string,
): Promise<VerifyResult> {
  if (!/^0x[0-9a-fA-F]{64}$/.test(txHash)) {
    return { verified: false, mode: "live", detail: "Malformed transaction hash." };
  }
  try {
    const [tx, receipt] = (await Promise.all([
      rpc("eth_getTransactionByHash", [txHash]),
      rpc("eth_getTransactionReceipt", [txHash]),
    ])) as [
      { to?: string; from?: string; value?: string } | null,
      { status?: string } | null,
    ];
    if (!tx) return { verified: false, mode: "live", detail: "Transaction not found on X Layer testnet." };
    if (!receipt) return { verified: false, mode: "live", detail: "Transaction not yet mined — try again shortly.", txHash };
    if (receipt.status !== "0x1") return { verified: false, mode: "live", detail: "Transaction reverted.", txHash };
    if ((tx.to ?? "").toLowerCase() !== payTo.toLowerCase()) {
      return { verified: false, mode: "live", detail: `Transaction pays ${tx.to}, expected ${payTo}.`, txHash };
    }
    const value = BigInt(tx.value ?? "0x0");
    if (value < BigInt(minBaseUnits)) {
      return {
        verified: false, mode: "live", txHash,
        detail: `Underpaid: ${value.toString()} base units, expected ≥ ${minBaseUnits}.`,
      };
    }
    return {
      verified: true, mode: "live", txHash, from: tx.from,
      valueBaseUnits: value.toString(),
      detail: `Confirmed on ${XLAYER_TESTNET.name}: ${value.toString()} base units to ${payTo}.`,
    };
  } catch (err) {
    return { verified: false, mode: "live", detail: `RPC unavailable: ${String(err)}` };
  }
}

/** Simulated settlement — allowed only when not in live mode. */
export function simulatedSettlement(reference: string): VerifyResult {
  return {
    verified: true,
    mode: "simulated",
    detail: `Simulated settlement accepted (demo mode) for ${reference}. Set EVOLVED_X402_MODE=live to require real X Layer testnet transactions.`,
  };
}

export function paymentsMode(): "live" | "simulated" {
  return process.env.EVOLVED_X402_MODE === "live" ? "live" : "simulated";
}

export function demoOkbPricePerCall(): { amountAsset: string; baseUnits: string } {
  const amountAsset = "0.000100"; // 0.0001 OKB per paid call — testnet demo price
  return { amountAsset, baseUnits: toBaseUnits(amountAsset, XLAYER_TESTNET.native.decimals) };
}

export function buildPaymentAmounts(amountCad: number): {
  amountAsset: string;
  baseUnits: string;
} {
  const amountAsset = cadToOkb(round2(amountCad));
  return { amountAsset, baseUnits: toBaseUnits(amountAsset, XLAYER_TESTNET.native.decimals) };
}

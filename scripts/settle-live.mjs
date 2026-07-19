#!/usr/bin/env node
/**
 * settle-live.mjs — make a REAL X Layer testnet settlement, the easy way.
 *
 * Evolved never holds keys and never sends funds. YOU send the transaction
 * from your own wallet; this script only (a) tells you exactly what to send
 * and where, and (b) verifies the hash you paste back via read-only RPC.
 *
 * Setup (once):
 *   set EVOLVED_PAYTO=0xYourTestnetReceivingAddress   (PowerShell: $env:EVOLVED_PAYTO="0x...")
 *   npm run build
 *
 * Usage:
 *   node scripts/settle-live.mjs list
 *   node scripts/settle-live.mjs request <invoiceId> [deposit|balance|full]
 *   node scripts/settle-live.mjs check   <paymentId> <txHash>
 */
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createServer } from "../dist/server.js";

const PAYTO = process.env.EVOLVED_PAYTO;
const [cmd, a, b] = process.argv.slice(2);

const server = createServer();
const client = new Client({ name: "settle-live", version: "1" });
const [ct, st] = InMemoryTransport.createLinkedPair();
await server.connect(st);
await client.connect(ct);
const call = async (name, args = {}) => {
  const r = await client.callTool({ name, arguments: args });
  const text = r.content?.find((c) => c.type === "text")?.text ?? "{}";
  try { return JSON.parse(text); } catch { return text; }
};

const line = "-".repeat(60);
if (cmd === "list") {
  const pnl = await call("pnl_report");
  const inv = (pnl.invoices ?? pnl.rows ?? []);
  console.log("Invoices in the books:");
  console.log(JSON.stringify(inv, null, 2));
  console.log("\nPick one and run:  node scripts/settle-live.mjs request <invoiceId>");
} else if (cmd === "request") {
  if (!PAYTO) { console.error("Set EVOLVED_PAYTO to your 0x testnet receiving address first."); process.exit(1); }
  if (!a) { console.error("Usage: request <invoiceId> [deposit|balance|full]"); process.exit(1); }
  const res = await call("invoice_payment_request", { invoiceId: a, split: b ?? "deposit", payTo: PAYTO });
  if (res.error || !res.payment) { console.error("Could not create request:", JSON.stringify(res, null, 2)); process.exit(1); }
  const p = res.payment;
  console.log(line);
  console.log("SEND THIS PAYMENT FROM YOUR OWN WALLET (X Layer testnet, chainId 1952):");
  console.log(`  Amount : ${p.amountAsset} test OKB   (${p.amountBaseUnits} wei)`);
  console.log(`  To     : ${p.payTo}`);
  console.log(`  EIP-681: ${p.uri}`);
  console.log(`  Explorer for the address: https://www.oklink.com/x-layer-testnet/address/${p.payTo}`);
  console.log(line);
  console.log(`After it confirms, verify it for real:`);
  console.log(`  node scripts/settle-live.mjs check ${p.id} <txHash>`);
} else if (cmd === "check") {
  if (!a || !b) { console.error("Usage: check <paymentId> <txHash>"); process.exit(1); }
  const res = await call("invoice_payment_check", { paymentId: a, txHash: b });
  console.log(JSON.stringify(res, null, 2));
  if (res.verification?.verified) {
    console.log(line);
    console.log("✅ REAL settlement verified on X Layer testnet.");
    console.log(`   tx: https://www.oklink.com/x-layer-testnet/tx/${b}`);
    console.log("   Send this hash + the explorer link to pin as proof.");
  }
} else {
  console.log("Commands: list | request <invoiceId> [split] | check <paymentId> <txHash>");
}
process.exit(0);

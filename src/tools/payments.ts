/**
 * Evolved tools — on-chain payments (OKX X Layer, TESTNET ONLY).
 *
 * Real SMB invoices, payable on-chain: an invoice becomes an EIP-681
 * payment request on X Layer testnet; settlement is verified with read-only
 * RPC. Evolved never holds keys and never signs — money only moves from the
 * payer's own wallet. Simulated mode keeps the demo runnable offline;
 * EVOLVED_X402_MODE=live requires a real testnet transaction hash.
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  buildPaymentAmounts, chainStatus, DEMO_PAYTO, demoOkbPricePerCall,
  paymentsMode, paymentUri, simulatedSettlement, verifyOnChain, whyOnChain,
  x402Envelope, XLAYER_TESTNET, CAD_PER_OKB_DEMO,
} from "../engine/payments.js";
import { addDays, loadDb, logActivity, nowIso, round2, shortId, today, withDb } from "../store.js";

function ok(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

export function registerPaymentTools(server: McpServer): void {
  server.registerTool(
    "invoice_payment_request",
    {
      title: "Create on-chain payment request (X Layer testnet)",
      description:
        "Turn an invoice into an on-chain payment request on OKX X Layer TESTNET: EIP-681 payment URI, recipient, amount in test OKB (fixed synthetic FX rate), chain details, and explorer link. `split` chooses the deposit (25% of the GST-inclusive total, programmable — funds the job before the crew mobilizes), the remaining balance, or the full amount. Testnet and demo funds only — Evolved never signs or moves assets.",
      inputSchema: {
        invoiceId: z.string(),
        split: z.enum(["deposit", "balance", "full"]).optional().describe("deposit = 25% up front (default when nothing is paid yet); balance = the rest; full = the whole invoice"),
        payTo: z.string().optional().describe("Override recipient address (0x…); default is the documented demo address"),
      },
    },
    async ({ invoiceId, split, payTo }) => {
      return ok(
        withDb((db) => {
          const invoice = db.invoices.find((i) => i.id === invoiceId);
          if (!invoice) throw new Error(`Unknown invoice ${invoiceId}`);
          const recipient = payTo ?? DEMO_PAYTO;
          if (!/^0x[0-9a-fA-F]{40}$/.test(recipient)) throw new Error("payTo must be a 0x-prefixed 20-byte address");

          // Programmable deposit: 25% of the GST-inclusive total, enforced here.
          const depositDue = round2(invoice.total * 0.25);
          const kind: "deposit" | "balance" | "full" =
            split ?? (invoice.depositApplied > 0 ? "balance" : "deposit");
          const amountCad =
            kind === "deposit" ? depositDue
            : kind === "balance" ? invoice.balanceDue
            : invoice.total;
          if (amountCad <= 0) throw new Error(`Nothing to request for ${invoiceId} on the '${kind}' split (amount is $${amountCad}).`);

          const { amountAsset, baseUnits } = buildPaymentAmounts(amountCad);
          const payment = {
            id: shortId("PAY"),
            invoiceId,
            network: XLAYER_TESTNET.caip2,
            chainId: XLAYER_TESTNET.chainId,
            payTo: recipient,
            asset: { symbol: XLAYER_TESTNET.native.symbol, address: null, decimals: XLAYER_TESTNET.native.decimals },
            amountCad,
            amountAsset,
            amountBaseUnits: baseUnits,
            uri: paymentUri(recipient, baseUnits, XLAYER_TESTNET.chainId),
            status: "pending" as const,
            mode: paymentsMode(),
            createdAt: nowIso(),
            expiresAt: addDays(today(), 7),
          };
          db.payments.push(payment);
          logActivity(db, "payments", `On-chain ${kind} request ${payment.id} for ${invoiceId}: ${amountAsset} OKB on X Layer testnet.`);
          return {
            payment,
            split: { kind, amountCad, depositDue, balanceDue: invoice.balanceDue, invoiceTotal: invoice.total },
            whyOnChain: whyOnChain(amountCad, kind),
            instructions: [
              `Pay ${amountAsset} test OKB (${kind}) on ${XLAYER_TESTNET.name} (chainId ${XLAYER_TESTNET.chainId}) to ${recipient}.`,
              `Wallet URI: ${payment.uri}`,
              `Explorer: ${XLAYER_TESTNET.explorer}`,
              `Demo FX: $${CAD_PER_OKB_DEMO} CAD = 1 OKB (synthetic rate, testnet only).`,
              "Confirm with invoice_payment_check once the transaction is sent.",
            ],
          };
        }),
      );
    },
  );

  server.registerTool(
    "invoice_payment_check",
    {
      title: "Verify on-chain payment",
      description:
        "Confirm settlement of a payment request. Live mode verifies the transaction hash on X Layer testnet via read-only RPC (exists, succeeded, correct recipient, sufficient value); simulated mode (default demo) accepts a simulated settlement and labels it clearly. On confirmation the invoice flips to Paid and the job to Paid.",
      inputSchema: {
        paymentId: z.string(),
        txHash: z.string().optional().describe("X Layer testnet transaction hash (required in live mode)"),
        simulate: z.boolean().optional().describe("Demo-mode settlement without a real transaction"),
      },
    },
    async ({ paymentId, txHash, simulate }) => {
      const db = loadDb();
      const payment = db.payments.find((p) => p.id === paymentId);
      if (!payment) throw new Error(`Unknown payment ${paymentId}`);
      if (payment.status === "paid") return ok({ payment, note: "Already settled." });

      const mode = paymentsMode();
      let result;
      if (txHash) {
        // Replay protection: a transaction hash settles exactly one payment.
        const alreadyUsed =
          db.usedTxHashes.includes(txHash) ||
          db.payments.some((p) => p.txHash === txHash && p.id !== paymentId);
        if (alreadyUsed) {
          return ok({
            verified: false,
            detail: `Transaction ${txHash} already settled a different payment — replay rejected.`,
          });
        }
        result = await verifyOnChain(txHash, payment.payTo, payment.amountBaseUnits);
      } else if (simulate && mode !== "live") {
        result = simulatedSettlement(paymentId);
      } else {
        return ok({
          verified: false,
          detail: mode === "live"
            ? "Live mode requires txHash — send the payment on X Layer testnet first."
            : "Provide txHash for real testnet verification, or simulate:true for a demo settlement.",
        });
      }

      return ok(
        withDb((d) => {
          const p = d.payments.find((x) => x.id === paymentId)!;
          if (result.verified) {
            p.status = "paid";
            p.txHash = result.txHash ?? (result.mode === "simulated" ? "simulated" : undefined);
            if (result.txHash) d.usedTxHashes.push(result.txHash);
            p.paidAt = nowIso();
            const invoice = d.invoices.find((i) => i.id === p.invoiceId);
            if (invoice) {
              invoice.status = "Paid";
              const job = d.jobs.find((j) => j.id === invoice.jobId);
              if (job) { job.status = "Paid"; job.updatedAt = nowIso(); }
            }
            logActivity(d, "payments", `Payment ${p.id} settled (${result.mode}).`);
          }
          return { verification: result, payment: p };
        }),
      );
    },
  );

  server.registerTool(
    "xlayer_status",
    {
      title: "X Layer testnet status",
      description:
        "Live read-only connectivity check against the X Layer testnet RPC: chain id and latest block. Proof the on-chain rail is real, not a mock.",
      inputSchema: {},
    },
    async () => {
      const status = await chainStatus();
      return ok({
        network: XLAYER_TESTNET,
        rpcProbe: status,
        note: status.reachable
          ? `Connected — chainId ${status.chainId}, block ${status.blockNumber}.`
          : "RPC unreachable from this environment — payment verification will fail closed (never open).",
      });
    },
  );

  server.registerTool(
    "x402_info",
    {
      title: "x402 paid-ASP tier",
      description:
        "How Evolved monetizes as an ASP: the HTTP endpoint exposes POST /mcp (free) and POST /mcp-paid (x402). The paid route answers 402 Payment Required with an accepts envelope (scheme exact, network eip155:1952) until the caller presents payment proof in the X-PAYMENT header. Returns the exact envelope and a curl walkthrough.",
      inputSchema: {},
    },
    async () => {
      const price = demoOkbPricePerCall();
      const envelope = x402Envelope({
        resource: "/mcp-paid",
        description: "Evolved MCP tool call (per-request)",
        amountAsset: price.amountAsset,
        baseUnits: price.baseUnits,
        payTo: DEMO_PAYTO,
      });
      return ok({
        mode: paymentsMode(),
        pricePerCall: `${price.amountAsset} test OKB`,
        envelope,
        walkthrough: [
          "1. POST /mcp-paid with an MCP request → HTTP 402 + this envelope (also base64 in the PAYMENT-REQUIRED header).",
          "2. Pay on X Layer testnet (or use demo mode).",
          `3. Retry with header X-PAYMENT: {"txHash":"0x…"} (live) or {"simulated":true} (demo mode).`,
          "4. Server verifies via read-only RPC and serves the MCP response with X-PAYMENT-RESPONSE.",
        ],
      });
    },
  );
}

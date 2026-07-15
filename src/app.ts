/**
 * Evolved — transport-agnostic HTTP request handler.
 *
 * Exported separately from the listener so both the ESM entry (http.ts) and
 * the CommonJS hosting shim (server.cjs) can serve the same app.
 */

import type { IncomingMessage, ServerResponse } from "node:http";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createServer, SERVER_INFO, TOOL_COUNT } from "./server.js";
import {
  DEMO_PAYTO, demoOkbPricePerCall, paymentsMode, simulatedSettlement,
  verifyOnChain, x402Envelope,
} from "./engine/payments.js";

export async function handleRequest(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const url = new URL(req.url ?? "/", "http://localhost");

  if (url.pathname === "/" || url.pathname === "/health") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(
      JSON.stringify({
        ok: true,
        service: SERVER_INFO.name,
        version: SERVER_INFO.version,
        protocol: "MCP Streamable HTTP",
        endpoints: {
          "/mcp": "free (A2MCP free endpoint — results returned directly)",
          "/mcp-paid": "x402 pay-per-call (X Layer TESTNET, scheme exact)",
        },
        tools: TOOL_COUNT,
      }),
    );
    return;
  }

  // x402 paid tier: identical MCP surface, gated by a payment challenge.
  if (url.pathname === "/mcp-paid") {
    const price = demoOkbPricePerCall();
    const envelope = x402Envelope({
      resource: "/mcp-paid",
      description: "Evolved MCP tool call (per-request)",
      amountAsset: price.amountAsset,
      baseUnits: price.baseUnits,
      payTo: DEMO_PAYTO,
    });
    const proofHeader =
      req.headers["x-payment"] ?? req.headers["payment-signature"];
    if (!proofHeader) {
      res.writeHead(402, {
        "content-type": "application/json",
        "payment-required": Buffer.from(JSON.stringify(envelope)).toString("base64"),
      });
      res.end(JSON.stringify(envelope));
      return;
    }
    let proof: { txHash?: string; simulated?: boolean };
    try {
      const raw = String(proofHeader);
      const text = raw.trim().startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf8");
      proof = JSON.parse(text);
    } catch {
      res.writeHead(400, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: false, error: "Malformed payment proof header — expected JSON (raw or base64)." }));
      return;
    }
    let result;
    if (proof.txHash) {
      // Replay protection: a tx hash buys exactly one paid call.
      const { loadDb, withDb } = await import("./store.js");
      const db = loadDb();
      if (db.usedTxHashes.includes(proof.txHash) || db.payments.some((p) => p.txHash === proof.txHash)) {
        result = { verified: false, mode: paymentsMode(), detail: "Transaction already spent on a previous call or payment — replay rejected." };
      } else {
        result = await verifyOnChain(proof.txHash, DEMO_PAYTO, price.baseUnits);
        if (result.verified) withDb((d) => d.usedTxHashes.push(proof.txHash!));
      }
    } else if (proof.simulated && paymentsMode() !== "live") {
      result = simulatedSettlement("/mcp-paid call");
    } else {
      result = { verified: false, mode: paymentsMode(), detail: "Payment proof required: txHash (live) or simulated:true (demo mode)." };
    }
    if (!result.verified) {
      res.writeHead(402, {
        "content-type": "application/json",
        "payment-required": Buffer.from(JSON.stringify(envelope)).toString("base64"),
      });
      res.end(JSON.stringify({ ...envelope, verification: result }));
      return;
    }
    res.setHeader(
      "x-payment-response",
      Buffer.from(JSON.stringify({ settled: true, mode: result.mode, detail: result.detail })).toString("base64"),
    );
    // fall through to MCP handling below
  }

  if (url.pathname === "/mcp" || url.pathname === "/mcp-paid") {
    // Stateless mode: a fresh server+transport per request keeps the
    // endpoint horizontally scalable and session-free.
    const server = createServer();
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });
    res.on("close", () => {
      void transport.close();
      void server.close();
    });
    try {
      await server.connect(transport);
      await transport.handleRequest(req, res);
    } catch (err) {
      if (!res.headersSent) {
        res.writeHead(500, { "content-type": "application/json" });
        res.end(JSON.stringify({ ok: false, error: String(err) }));
      }
    }
    return;
  }

  res.writeHead(404, { "content-type": "application/json" });
  res.end(JSON.stringify({ ok: false, error: "Not found. MCP endpoint is POST /mcp" }));
}

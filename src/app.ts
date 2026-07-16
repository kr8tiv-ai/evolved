/**
 * Evolved — transport-agnostic HTTP request handler.
 *
 * Exported separately from the listener so both the ESM entry (http.ts) and
 * the CommonJS hosting shim (server.cjs) can serve the same app.
 */

import type { IncomingMessage, ServerResponse } from "node:http";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createServer, SERVER_INFO, TOOL_COUNT } from "./server.js";
import { PLAYGROUND_HTML } from "./playground.js";
import {
  DEMO_PAYTO, demoOkbPricePerCall, paymentsMode, simulatedSettlement,
  verifyOnChain, x402Envelope,
} from "./engine/payments.js";

// ---------------------------------------------------------------------------
// Abuse protection: a small per-IP sliding-window rate limit on every
// state-touching route. Generous for a human clicking a demo, hostile to
// scripts hammering shared demo state.
const RATE_LIMIT = Number(process.env.EVOLVED_RATE_LIMIT ?? 40); // req/min/ip
const rateBook = new Map<string, { n: number; t: number }>();
function rateLimited(req: IncomingMessage): boolean {
  const ip = (String(req.headers["x-forwarded-for"] ?? "").split(",")[0].trim()) ||
    req.socket.remoteAddress || "unknown";
  const now = Date.now();
  const slot = rateBook.get(ip);
  if (!slot || now - slot.t > 60_000) {
    rateBook.set(ip, { n: 1, t: now });
    if (rateBook.size > 5000) rateBook.clear(); // bounded memory
    return false;
  }
  slot.n += 1;
  return slot.n > RATE_LIMIT;
}

// ---------------------------------------------------------------------------
// The playground's demo executor: a persistent in-process MCP client with a
// strict tool whitelist. Real tool calls, demo scope — nothing destructive
// beyond what the hourly auto-reseed heals, and franchise_spinup/backups
// stay off the browser surface entirely.
const DEMO_TOOLS = new Set([
  "business_snapshot", "morning_digest", "weather_check", "xlayer_status",
  "x402_info", "pricing_rates", "quote_price", "quote_from_photo",
  "market_benchmark", "pricing_learning_status",
  "pipeline_view", "flha_open", "flha_signoff", "safety_log",
  "lifecycle_start", "lifecycle_advance", "lifecycle_status",
  "invoice_payment_request", "invoice_payment_check",
  "cfo_forecast", "cfo_health", "voice_command", "demo_reset",
  "workbook_export", "workbook_status", "franchise_preview",
  "reputation_report", "job_pnl_report", "dispatch_board",
]);

let demoClient: Client | null = null;
async function getDemoClient(): Promise<Client> {
  if (demoClient) return demoClient;
  const server = createServer();
  const client = new Client({ name: "evolved-playground", version: SERVER_INFO.version });
  const [ct, st] = InMemoryTransport.createLinkedPair();
  await server.connect(st);
  await client.connect(ct);
  demoClient = client;
  return client;
}

function readBody(req: IncomingMessage, maxBytes = 64_000): Promise<string> {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => {
      size += c.length;
      if (size > maxBytes) { reject(new Error("Body too large")); req.destroy(); return; }
      chunks.push(c);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

export async function handleRequest(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const url = new URL(req.url ?? "/", "http://localhost");

  // Security headers on every response. The CSP permits exactly what the
  // playground needs: same-origin calls, Google Fonts, the repo's logo,
  // and its own inline script/styles — nothing else loads or frames us.
  res.setHeader("x-content-type-options", "nosniff");
  res.setHeader("x-frame-options", "DENY");
  res.setHeader("referrer-policy", "strict-origin-when-cross-origin");
  res.setHeader("permissions-policy", "camera=(), microphone=(), geolocation=(), payment=()");
  res.setHeader("strict-transport-security", "max-age=31536000; includeSubDomains");
  res.setHeader(
    "content-security-policy",
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
    "font-src https://fonts.gstatic.com; img-src 'self' data: https://github.com https://raw.githubusercontent.com; " +
    "media-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
  );

  // Oversized payloads are refused before any route reads the stream.
  const contentLength = Number(req.headers["content-length"] ?? 0);
  if (req.method === "POST" && contentLength > 262_144) {
    res.writeHead(413, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: false, error: "Payload too large (256 KB cap)." }));
    return;
  }

  // The hosted playground — the zero-install judge experience.
  if ((url.pathname === "/" || url.pathname === "/playground" || url.pathname === "/demo") && req.method === "GET") {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
    res.end(PLAYGROUND_HTML);
    return;
  }

  // The demo video, served from our own origin with a real video/mp4 type —
  // GitHub raw sends X-Content-Type-Options: nosniff, which blocks <video>
  // playback, so submission platforms embed this URL instead.
  if (url.pathname === "/demo.mp4" && (req.method === "GET" || req.method === "HEAD")) {
    const { createReadStream, statSync, existsSync } = await import("node:fs");
    const { join } = await import("node:path");
    const file = [
      join(process.cwd(), "demo.mp4"),
      join(process.cwd(), "submission", "evolved-demo.mp4"),
    ].find((p) => existsSync(p));
    if (!file) {
      res.writeHead(404, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: false, error: "Demo video not bundled on this deployment." }));
      return;
    }
    const size = statSync(file).size;
    const range = /^bytes=(\d*)-(\d*)$/.exec(String(req.headers.range ?? ""));
    const headers: Record<string, string> = {
      "content-type": "video/mp4",
      "accept-ranges": "bytes",
      "cache-control": "public, max-age=3600",
    };
    if (range && (range[1] || range[2])) {
      const start = range[1] ? Number(range[1]) : Math.max(0, size - Number(range[2]));
      const end = range[1] && range[2] ? Math.min(Number(range[2]), size - 1) : size - 1;
      if (start >= size || start > end) {
        res.writeHead(416, { "content-range": `bytes */${size}` });
        res.end();
        return;
      }
      headers["content-range"] = `bytes ${start}-${end}/${size}`;
      headers["content-length"] = String(end - start + 1);
      res.writeHead(206, headers);
      if (req.method === "HEAD") { res.end(); return; }
      createReadStream(file, { start, end }).pipe(res);
    } else {
      headers["content-length"] = String(size);
      res.writeHead(200, headers);
      if (req.method === "HEAD") { res.end(); return; }
      createReadStream(file).pipe(res);
    }
    return;
  }

  // Self-hosted brand media (the real Evolve site's optimized assets) — the
  // playground's hero video and card imagery, served same-origin so the CSP
  // stays closed to external hosts.
  // Friendly root aliases (favicons, share card, manifest) that must live at
  // the site root, all served from media/.
  const ROOT_ALIAS = new Set([
    "/og.png", "/favicon.ico", "/icon-16.png", "/icon-32.png", "/icon-192.png",
    "/icon-512.png", "/apple-touch-icon.png", "/site.webmanifest",
  ]);
  if ((url.pathname.startsWith("/media/") || ROOT_ALIAS.has(url.pathname)) && (req.method === "GET" || req.method === "HEAD")) {
    const MEDIA_TYPES: Record<string, string> = {
      "hero.webm": "video/webm", "hero-poster.webp": "image/webp",
      "decks.webp": "image/webp", "cornerlog.webp": "image/webp",
      "motors.webp": "image/webp", "industrial.webp": "image/webp",
      "og.png": "image/png",
      "favicon.ico": "image/x-icon", "icon-16.png": "image/png", "icon-32.png": "image/png",
      "icon-192.png": "image/png", "icon-512.png": "image/png",
      "apple-touch-icon.png": "image/png", "site.webmanifest": "application/manifest+json",
    };
    const name = ROOT_ALIAS.has(url.pathname) ? url.pathname.slice(1) : url.pathname.slice("/media/".length);
    const type = MEDIA_TYPES[name];
    const { existsSync, statSync, createReadStream } = await import("node:fs");
    const { join } = await import("node:path");
    const file = type ? join(process.cwd(), "media", name) : undefined;
    if (!file || !existsSync(file)) {
      res.writeHead(404, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: false, error: "No such media." }));
      return;
    }
    res.writeHead(200, {
      "content-type": type,
      "content-length": String(statSync(file).size),
      "cache-control": "public, max-age=86400",
    });
    if (req.method === "HEAD") { res.end(); return; }
    createReadStream(file).pipe(res);
    return;
  }

  // SEO + AI-SEO: robots (search + AI crawlers welcome), sitemap, and an
  // llms.txt manifest so LLM crawlers get a clean, accurate description.
  if (url.pathname === "/robots.txt" && (req.method === "GET" || req.method === "HEAD")) {
    const aiBots = ["GPTBot", "OAI-SearchBot", "ChatGPT-User", "ClaudeBot", "Claude-Web",
      "anthropic-ai", "PerplexityBot", "Google-Extended", "Applebot-Extended", "CCBot", "Bytespider"];
    const body = [
      "# Evolved — https://www.evolvedmcp.cloud (open source, MIT)",
      "User-agent: *", "Allow: /", "",
      "# AI crawlers are welcome — this is an open reference Agentic Service Provider.",
      ...aiBots.flatMap((b) => [`User-agent: ${b}`, "Allow: /"]), "",
      "Sitemap: https://www.evolvedmcp.cloud/sitemap.xml", "",
    ].join("\n");
    res.writeHead(200, { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=86400" });
    res.end(req.method === "HEAD" ? undefined : body);
    return;
  }

  if (url.pathname === "/sitemap.xml" && (req.method === "GET" || req.method === "HEAD")) {
    const base = "https://www.evolvedmcp.cloud";
    const pages: Array<[string, string]> = [[`${base}/`, "1.0"], [`${base}/playground`, "0.7"]];
    const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`
      + pages.map(([loc, pr]) => `  <url><loc>${loc}</loc><changefreq>weekly</changefreq><priority>${pr}</priority></url>`).join("\n")
      + `\n</urlset>\n`;
    res.writeHead(200, { "content-type": "application/xml; charset=utf-8", "cache-control": "public, max-age=86400" });
    res.end(req.method === "HEAD" ? undefined : body);
    return;
  }

  if (url.pathname === "/llms.txt" && (req.method === "GET" || req.method === "HEAD")) {
    const body = [
      "# Evolved",
      "",
      "> Evolved is a business-in-a-box for the agent economy: a real Alberta service company's operations brain, published as an open-source MCP (Model Context Protocol) Agentic Service Provider. One agent runs a service business end to end — photo-to-quote, e-sign, weather-gated scheduling, FLHA safety, receipts-to-books, invoicing, and on-chain settlement — and any trade can spin up its own copy in one call.",
      "",
      "Evolved is live and free to try. It exposes 83 tools across 16 domains over MCP, monetizes itself per-call via the x402 payment protocol, and settles invoices in OKB on the OKX X Layer testnet (chainId 1952). It never holds keys and cannot move funds; humans approve only the two money gates. Demo data is synthetic; the math and the trade are real.",
      "",
      "## Links",
      "- [Live playground (zero install)](https://www.evolvedmcp.cloud/)",
      "- [Free MCP endpoint (Streamable HTTP)](https://www.evolvedmcp.cloud/mcp)",
      "- [Paid MCP endpoint (x402: 402 → proof → receipt)](https://www.evolvedmcp.cloud/mcp-paid)",
      "- [Health / status JSON](https://www.evolvedmcp.cloud/health)",
      "- [Revenue scoreboard JSON](https://www.evolvedmcp.cloud/stats)",
      "- [Source (MIT)](https://github.com/kr8tiv-ai/evolved)",
      "- [90-second film](https://www.evolvedmcp.cloud/demo.mp4)",
      "",
      "## What it does",
      "- Learning quote engine: prices a photo as a confidence-banded range grounded in comparable jobs already in the books, with a profitability check on every price.",
      "- Autonomous lifecycle: lead → priced quote → e-sign → weather-gated booking → FLHA safety → work + receipts → invoice → on-chain settlement → review, holding at two human money gates.",
      "- On-chain: EIP-681 payment requests verified by read-only RPC on X Layer testnet, replay-protected; plus an x402 pay-per-call tier so other agents pay Evolved per call.",
      "- Back office: tiered-OCR receipts, inventory burn-down, dispatch, CRM, a live Google Sheets workbook spine (20 tabs), a CFO forecaster, and a Job P&L scorecard.",
      "- Adaptable: franchise_spinup installs a trade pack (pressure-washing, line-painting, mobile-detailing ship today) to re-seed the whole operating system for any service business.",
      "",
      "## Built by",
      "Matt Haynes (KR8TIV AI), from the live operations system of Evolve Eco Blasting — a real Alberta abrasive-blasting company. Built for the OKX AI Genesis Hackathon, 2026.",
      "",
    ].join("\n");
    res.writeHead(200, { "content-type": "text/markdown; charset=utf-8", "cache-control": "public, max-age=86400" });
    res.end(req.method === "HEAD" ? undefined : body);
    return;
  }

  if (url.pathname === "/demo/call" && req.method === "POST") {
    if (rateLimited(req)) {
      res.writeHead(429, { "content-type": "application/json", "retry-after": "60" });
      res.end(JSON.stringify({ error: "Rate limit: this shared demo allows " + RATE_LIMIT + " calls/minute per IP. Take a breath and try again." }));
      return;
    }
    try {
      const body = JSON.parse(await readBody(req)) as { tool?: string; args?: Record<string, unknown> };
      const tool = String(body.tool ?? "");
      if (!DEMO_TOOLS.has(tool)) {
        res.writeHead(403, { "content-type": "application/json" });
        res.end(JSON.stringify({ error: `Tool "${tool}" is not on the playground whitelist. Clone the repo or point an MCP client at /mcp for the full 83-tool surface.` }));
        return;
      }
      const client = await getDemoClient();
      const result = await client.callTool({ name: tool, arguments: body.args ?? {} });
      const text = (result as { content?: { type: string; text?: string }[] }).content?.find((c) => c.type === "text")?.text ?? "{}";
      let parsed: unknown;
      try { parsed = JSON.parse(text); } catch { parsed = text; }
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ tool, result: parsed }));
    } catch (err) {
      res.writeHead(400, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: String(err instanceof Error ? err.message : err) }));
    }
    return;
  }

  // Deployment revenue/settlement counters — the honest x402 scoreboard.
  if (url.pathname === "/stats" && req.method === "GET") {
    const { loadDb } = await import("./store.js");
    const db = loadDb();
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({
      paidApiCalls: db.meta.paidCalls ?? 0,
      invoicePaymentsSettled: db.payments.filter((p) => p.status === "paid").length,
      txHashesConsumed: db.usedTxHashes.length,
      mode: process.env.EVOLVED_X402_MODE === "live" ? "live (fails closed)" : "simulated (demo, always labeled)",
      note: "Counters survive demo resets. Shared synthetic dataset; books reseed hourly.",
    }));
    return;
  }

  if (url.pathname === "/health") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(
      JSON.stringify({
        ok: true,
        service: SERVER_INFO.name,
        version: SERVER_INFO.version,
        protocol: "MCP Streamable HTTP",
        endpoints: {
          "/": "interactive playground (browser, zero install)",
          "/mcp": "free (A2MCP free endpoint — results returned directly)",
          "/mcp-paid": "x402 pay-per-call (X Layer TESTNET, scheme exact)",
        },
        tools: TOOL_COUNT,
      }),
    );
    return;
  }

  if ((url.pathname === "/mcp" || url.pathname === "/mcp-paid") && rateLimited(req)) {
    res.writeHead(429, { "content-type": "application/json", "retry-after": "60" });
    res.end(JSON.stringify({ ok: false, error: `Rate limit: ${RATE_LIMIT} requests/minute per IP on this shared demo endpoint.` }));
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
    // Paid calls are revenue: count them in the books (survives demo resets).
    {
      const { withDb: w, logActivity: la } = await import("./store.js");
      w((d) => {
        d.meta.paidCalls = (d.meta.paidCalls ?? 0) + 1;
        la(d, "x402", `Paid API call settled (${result.mode}).`);
      });
    }
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

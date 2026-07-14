#!/usr/bin/env node
/**
 * Evolved — Streamable HTTP entry point (A2MCP-compliant free endpoint).
 *
 * Exposes the MCP server over Streamable HTTP at POST /mcp, suitable for
 * listing on OKX.AI as a free A2MCP service: callers get results directly,
 * no payment challenge. A paid tier can later wrap this endpoint with an
 * x402 handler (OKX Payment SDK) without touching the tool layer.
 *
 *   npm run start:http     # default port 8788, override with PORT
 */

import { createServer as createHttpServer } from "node:http";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createServer, SERVER_INFO } from "./server.js";

const PORT = Number(process.env.PORT ?? 8788);

const httpServer = createHttpServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);

  if (url.pathname === "/" || url.pathname === "/health") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(
      JSON.stringify({
        ok: true,
        service: SERVER_INFO.name,
        version: SERVER_INFO.version,
        protocol: "MCP Streamable HTTP",
        endpoint: "/mcp",
        pricing: "free (A2MCP free endpoint — results returned directly)",
        tools: 27,
      }),
    );
    return;
  }

  if (url.pathname === "/mcp") {
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
});

httpServer.listen(PORT, () => {
  console.log(`Evolved MCP server listening on http://localhost:${PORT}/mcp (Streamable HTTP, free A2MCP endpoint)`);
});

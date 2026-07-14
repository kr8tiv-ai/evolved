#!/usr/bin/env node
/**
 * Evolved — Streamable HTTP entry point (A2MCP-compliant free endpoint).
 *
 * Exposes the MCP server over Streamable HTTP at POST /mcp, suitable for
 * listing on OKX.AI as a free A2MCP service: callers get results directly,
 * no payment challenge. A paid tier can later wrap this endpoint with an
 * x402 handler (OKX Payment SDK) without touching the tool layer.
 *
 *   npm run start:http     # default port 3000, override with PORT
 */

import { createServer as createHttpServer } from "node:http";
import { handleRequest } from "./app.js";

// Default 3000: managed hosts (Hostinger et al.) proxy to 3000 without
// setting PORT. Override with PORT for local dev or the VPS compose file.
const PORT = Number(process.env.PORT ?? 3000);

createHttpServer((req, res) => {
  void handleRequest(req, res);
}).listen(PORT, () => {
  console.log(`Evolved MCP server listening on http://localhost:${PORT}/mcp (Streamable HTTP, free A2MCP endpoint)`);
});

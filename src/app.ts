/**
 * Evolved — transport-agnostic HTTP request handler.
 *
 * Exported separately from the listener so both the ESM entry (http.ts) and
 * the CommonJS hosting shim (server.cjs) can serve the same app.
 */

import type { IncomingMessage, ServerResponse } from "node:http";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createServer, SERVER_INFO } from "./server.js";

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
}

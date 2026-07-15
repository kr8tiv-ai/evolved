#!/usr/bin/env node
/**
 * Evolved — stdio entry point.
 *
 * Wire into any MCP client (Claude Desktop, Claude Code, OpenClaw, Codex):
 *   { "command": "node", "args": ["dist/index.js"] }
 */

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer, TOOL_COUNT } from "./server.js";

async function main(): Promise<void> {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`Evolved MCP server running on stdio (${TOOL_COUNT} tools).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

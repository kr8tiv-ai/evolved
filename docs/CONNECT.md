# Connect your own agent to Evolved — in about 30 seconds

Evolved is a live MCP server. Point any MCP client at it and you're running a
whole service business from your own agent. Two ways in: the **hosted endpoint**
(nothing to install) or a **local clone** (fully offline, zero credentials).

---

## Option A — hosted, nothing to install

The live server speaks MCP Streamable HTTP at `https://www.evolvedmcp.cloud/mcp`
(free tier). Most desktop MCP clients connect to a remote URL through the
`mcp-remote` bridge:

**Claude Desktop / Claude Code** — add to your MCP config
(`claude_desktop_config.json`, or `.mcp.json` in a project):

```json
{
  "mcpServers": {
    "evolved": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "https://www.evolvedmcp.cloud/mcp"]
    }
  }
}
```

**Cursor / Windsurf / any client that accepts a raw URL:** use
`https://www.evolvedmcp.cloud/mcp` as a Streamable HTTP server.

Confirm it's alive from a terminal first:

```bash
curl https://www.evolvedmcp.cloud/health
```

Then ask your agent:

> "Run the morning digest — what am I about to drop?"
> "Price a 600 sqft exposed-aggregate driveway, tight access, and if the margin is healthy, create the quote."
> "Spin this whole system up for a pressure-washing company called Glacier."

## Option B — local, fully offline (zero keys, zero accounts)

```bash
git clone https://github.com/kr8tiv-ai/evolved.git && cd evolved
npm install && npm run build
```

Then wire the stdio binary into any MCP client:

```json
{
  "mcpServers": {
    "evolved": {
      "command": "node",
      "args": ["<absolute-path-to>/evolved/dist/index.js"]
    }
  }
}
```

That's it — the full 83-tool surface, running on synthetic demo data with no
credentials. `npm run demo` narrates the business loop in your terminal if you
want to see it move first.

---

## What your client will see

- **83 tools** across 16 domains, each carrying MCP `annotations` so your client
  knows which are read-only and which write or are destructive
  (`readOnlyHint` / `destructiveHint` / `openWorldHint`).
- **3 resources** — `evolved://rate-table`, `evolved://hazard-library`,
  `evolved://trade-packs` (reference data your agent can read, not just act on).
- **3 prompts** — `morning-briefing`, `quote-a-job`, `run-the-lifecycle`
  (one-line entry points).

## Optional live upgrades (env vars, all optional)

| Env var | Effect |
|---|---|
| `ANTHROPIC_API_KEY` | Real Claude vision for photo-to-quote + OCR escalation |
| `EVOLVED_LIVE_WEATHER=1` | Real forecasts for weather-gated booking |
| `EVOLVED_X402_MODE=live` | Require a real X Layer testnet transaction (fails closed) |
| `EVOLVED_PAYTO=0x…` | Your own testnet receiving address |
| `EVOLVED_GOOGLE_SA=…` | Service-account JSON → live Google Sheets workbook |
| `EVOLVED_TRUST_PROXY=1` | Trusted reverse-proxy hops for rate-limit IP resolution |

Nothing is required. The demo runs end to end with none of them set.

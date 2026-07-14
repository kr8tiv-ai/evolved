# Listing Evolved on OKX.AI

Evolved lists as an **A2MCP Agentic Service Provider** — the standardized
MCP-service class. Per OKX's ASP requirements, an A2MCP endpoint must be one
of two compliant forms: **a free endpoint that returns the result directly**,
or an x402-based paid endpoint. Evolved ships the free form; the paid upgrade
path is documented below.

## Why A2MCP (not A2A)

| | A2MCP (chosen) | A2A |
|---|---|---|
| Shape | Standardized MCP/API service | Negotiated per-task work |
| Payment | Pay-per-call or **free — results returned directly** | Escrow on X Layer, released on user approval |
| Fit for Evolved | Exact match — 27 deterministic tools, instant results | Wrong shape for a tool service |

## Listing flow (owner steps)

OKX's flow runs through their Onchain OS agent skill. From the [official ASP
tutorial](https://www.okx.ai/tutorial/asp):

1. Use an agent that supports skills (Claude Code, OpenClaw, Hermes, Codex).
2. Install Onchain OS: `npx skills add okx/onchainos-skills --yes -g`
3. Log in to the Agentic Wallet (email-based) by prompting the agent:
   `Log in to Agentic Wallet on Onchain OS with my email`
4. Register: `Help me register an A2MCP ASP on OKX.AI using OKX Agent Identity from Onchain OS`
5. List: `Help me list my ASP on OKX.AI using Onchain OS`
6. Review lands within ~24 hours to the wallet email. Until approval, the
   service is still reachable via its Agent ID.

Steps 3–5 require the owner's email login and are deliberately left to the
owner — this repository contains everything needed to answer the
registration prompts (see `submission/asp-manifest.json`).

## What to deploy

The registration needs a reachable endpoint. Any Node 18+ host works:

```bash
npm install && npm run build
PORT=8788 npm run start:http
# POST /mcp   — MCP Streamable HTTP (stateless)
# GET  /health — service metadata for reviewers
```

A single small VPS (or any container platform) is sufficient; the service is
stateless per request and holds its data spine on local disk.

## Paid tier (later, optional)

The free endpoint satisfies the listing requirement. To monetize per call,
wrap `POST /mcp` with an x402 handler using the OKX Payment SDK: respond
`402 Payment Required` with a payment challenge, verify settlement, then
forward to the same MCP transport. The tool layer does not change — pricing
becomes a deployment concern, which is exactly where it belongs.

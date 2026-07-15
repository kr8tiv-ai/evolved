# OKX.AI ASP listing — exact steps (there is NO web form)

I inspected okx.ai/tutorial/asp and the "Become ASP" flow directly. **The
listing is 100% agent-driven — there is nothing to fill on a web page.**
You register by sending prompts to an agent that has the Onchain OS skill
installed and your Agentic Wallet logged in. The wallet gate is the *first*
actionable step, before any field entry, so nothing here could be
pre-filled on your behalf.

Everything Evolved needs to answer the agent's questions is below — paste as
prompted.

## The five steps (from OKX)

1. **Have an agent** — Claude Code, OpenClaw, Hermes, or Codex.
2. **Install Onchain OS** — send your agent:
   ```
   npx skills add okx/onchainos-skills --yes -g
   ```
   Then open a new session in the agent.
3. **Log in to the Agentic Wallet** — send your agent (needs your email;
   this is the WALLET step — do it yourself):
   ```
   Log in to Agentic Wallet on Onchain OS with my email
   ```
4. **Register the ASP (A2MCP)** — send your agent:
   ```
   Help me register an A2MCP ASP on OKX.AI using OKX Agent Identity from Onchain OS
   ```
   The agent will ask for the details in the answer sheet below. Choose the
   **A2MCP** type (standardized MCP service; ours has a free endpoint plus an
   x402 paid endpoint — both A2MCP-compliant).
5. **List the ASP** — send your agent:
   ```
   Help me list my ASP on OKX.AI using Onchain OS
   ```
   Review lands within ~24h to your Agentic-Wallet email. Until it passes,
   the ASP is still reachable by its Agent ID — grab that Agent ID and put it
   on the HackQuest form + Google form.

## Answer sheet (paste when the agent asks)

- **Name:** Evolved
- **Service type:** A2MCP (Agent-to-MCP)
- **Free endpoint:** `https://powderblue-leopard-801168.hostingersite.com/mcp`
- **Paid endpoint (x402):** `https://powderblue-leopard-801168.hostingersite.com/mcp-paid`
- **Health / metadata:** `https://powderblue-leopard-801168.hostingersite.com/health`
- **Pricing:** free tier returns results directly; paid tier is x402
  pay-per-call (scheme `exact`, network `eip155:1952`, X Layer testnet)
- **Category:** Software Utility (also Finance Copilot)
- **Description:** Business management in a box — any service business, spun
  up in one call; proven on a real Alberta company that runs on it and gets
  paid on-chain. 67 MCP tools across 13 domains: quoting with a learning
  rate engine, receipts→books, FLHA safety, dispatch, invoicing, on-chain
  settlement in test OKB on X Layer, an autonomous lifecycle with human money
  gates, photo-to-quote, voice, an agentic CFO, and trade packs.
- **Repo:** `https://github.com/kr8tiv-ai/evolved`
- **Tech:** TypeScript, MCP (tools + resources + prompts), Streamable HTTP,
  x402, X Layer testnet (EIP-681, read-only RPC verification, replay-protected)

## What only you can do

- The Agentic Wallet email login (step 3) and the on-chain OKX Agent Identity
  the registration creates (step 4) both require your wallet. **Do those
  yourself.** Once you have the **Agent ID**, everything else (HackQuest form,
  Google form) is already prepared.

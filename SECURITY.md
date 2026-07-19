# Security

## Threat model, stated plainly

Evolved is a business-operations MCP server with an on-chain settlement
rail. Its security posture is built on refusing to hold anything worth
stealing:

- **No key custody, ever.** There is no wallet, no private key, no signing
  code in this repository. Payments are *requests* (EIP-681 URIs); the payer
  signs in their own wallet. Evolved verifies settlement with **read-only**
  JSON-RPC and can, by construction, never move funds.
- **Fail closed.** Live mode (`EVOLVED_X402_MODE=live`) rejects any payment
  it cannot positively verify on X Layer testnet — RPC unreachable means
  *not settled*, never *assumed settled*.
- **Replay protection.** Every accepted transaction hash goes into a
  persistent ledger (`usedTxHashes`) checked by the x402 route,
  `invoice_payment_check`, and the lifecycle. One transaction settles
  exactly one thing. The ledger deliberately **survives demo resets and
  franchise re-seeds**.
- **Testnet only.** ChainId 1952 (X Layer Terigon), valueless test OKB, a
  clearly synthetic FX rate. Nothing in this repo touches mainnet.

## The hosted demo's guardrails

The public deployment is a shared, synthetic demo — one dataset for all
visitors, reseeded hourly, and it says so on the page. It is protected by:

| Control | Detail |
|---|---|
| Tool whitelist | The browser `/demo/call` route exposes 29 read/demo-safe tools; the full 83-tool surface (including franchise_spinup, backups, and workbook writes) is reachable only by pointing an MCP client at `/mcp` |
| Rate limiting | Per-IP sliding window (default 40 req/min) on `/demo/call`, `/mcp`, and `/mcp-paid` |
| Body caps | 256 KB request cap before any route reads the stream; 64 KB on demo calls |
| Auto-reseed | The synthetic books restore hourly; replay ledger and revenue counters survive |
| Backup rotation | Snapshot count capped at 25 — no disk-fill loop |
| Security headers | CSP (no external script origins), `X-Frame-Options: DENY`, `nosniff`, HSTS, restrictive Permissions-Policy. Note: on the hosted demo, Hostinger's edge replaces the app's CSP with its platform default — the full CSP applies on self-hosted deployments and is asserted by the test suite |
| E-sign integrity | HMAC tokens; no committed default secret (per-process random unless `EVOLVED_ESIGN_SECRET` is set); recorded declines are final and cannot be overwritten |

## Secrets policy

No secrets exist in this repository — enforced by `.gitignore` patterns for
env files, keys, and tokens, and verified by scan before every publish. The
demo runs with zero credentials; optional integrations read
`ANTHROPIC_API_KEY`, `EVOLVED_PAYTO`, `EVOLVED_ESIGN_SECRET`, and
`EVOLVED_X402_MODE` from the environment only.

## Data

All demo data is synthetic — invented names, phone numbers, addresses, and
dollar figures. Production deployments own their data spine per tenant
(`EVOLVED_DATA_DIR`); nothing is shared across deployments.

## Reporting

Found something? Open a GitHub issue on kr8tiv-ai/evolved marked
`[security]`, or email the maintainer listed in package.json. Testnet-only
scope means no funds are at risk, but reports are welcome and acted on.

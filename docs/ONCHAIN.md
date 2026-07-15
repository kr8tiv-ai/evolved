# On-chain payments — OKX X Layer (TESTNET ONLY)

## Security model, stated first

- **Evolved never holds private keys.** There is no wallet in this codebase.
- **Evolved never signs or broadcasts transactions.** It builds payment
  *requests* (EIP-681 URIs) and *verifies* settlement with read-only
  JSON-RPC. Funds can only move from the payer's own wallet, initiated by
  the payer.
- **Testnet only.** ChainId 1952 (X Layer testnet "Terigon"), test OKB with
  no real value, a fixed clearly-synthetic FX rate ($100 CAD = 1 OKB demo).
- **Fail closed.** Live verification that cannot reach the RPC rejects the
  payment; nothing is ever assumed settled.
- **Simulated mode is loud.** The default demo mode accepts simulated
  settlements and labels every one of them `mode: "simulated"`. Set
  `EVOLVED_X402_MODE=live` to require real testnet transactions.

## Network

| | |
|---|---|
| Network | X Layer testnet (Terigon) |
| Chain id | 1952 (`0x7a0`) — CAIP-2 `eip155:1952` |
| RPC | `https://testrpc.xlayer.tech` (override: `EVOLVED_XLAYER_RPC`) |
| Explorer | `https://www.oklink.com/x-layer-testnet` |
| Gas token | OKB (18 decimals) |
| Receiving address | `EVOLVED_PAYTO` env, or a documented demo address |

## Rail 1 — invoices settle on-chain

1. `invoice_payment_request { invoiceId }` → payment record with the CAD
   balance converted at the demo rate, base units computed with integer
   math (no float drift), and an EIP-681 URI:
   `ethereum:0x…@1952?value=<baseUnits>`
2. The customer pays from their own wallet (any EVM wallet pointed at the
   testnet).
3. `invoice_payment_check { paymentId, txHash }` → read-only verification:
   transaction exists, receipt status `0x1`, `to` matches, `value ≥`
   requested. On success the invoice and job flip to Paid.
   In demo mode, `{ simulate: true }` settles with an explicit
   `mode: "simulated"` label.

## Rail 2 — Evolved as a paid ASP (x402)

`POST /mcp-paid` is the same MCP surface as `/mcp`, gated by an x402
payment challenge:

- **No proof** → `402 Payment Required`, JSON envelope
  `{ x402Version: 1, accepts: [{ scheme: "exact", network: "eip155:1952", maxAmountRequired, payTo, … }] }`,
  also base64-encoded in the `PAYMENT-REQUIRED` header (v2-style).
- **Proof** → `X-PAYMENT` (or `PAYMENT-SIGNATURE`) header, raw JSON or
  base64: `{"txHash":"0x…"}` for live testnet verification, or
  `{"simulated":true}` in demo mode.
- **Settled** → the MCP response is served with an `X-PAYMENT-RESPONSE`
  header carrying a base64 settlement receipt.

Price per call is a fixed testnet demo amount (0.0001 OKB). The free
`/mcp` endpoint is unaffected — that is the A2MCP free tier required for
OKX.AI listing; `/mcp-paid` is the monetization story on top.

## Honest scope notes

- **Shared demo instance.** The hosted deployment runs one synthetic data
  spine shared by all callers, guarded by a tool whitelist on the browser
  playground, per-IP rate limiting, and an hourly automatic reseed.
  Replay-protection hashes and the paid-call counter survive resets by
  design. Production multi-tenancy (per-customer spines) is a deployment
  concern, not a code rewrite — every tool already works against an
  injected store path (`EVOLVED_DATA_DIR`).
- **x402 proof profile.** This implementation accepts a transaction-hash
  proof (`{"txHash":"0x…"}`) verified by read-only RPC, or a labeled
  simulated proof in demo mode. The full x402 specification's
  signed-payload flow (`PAYMENT-SIGNATURE` with facilitator settlement,
  e.g. the OKX Payment SDK) is the planned upgrade; the 402 challenge
  envelope and settlement receipt headers already follow the spec shape,
  so the swap is confined to proof verification.

## Tests that keep this honest

- Base-unit conversion (incl. the classic `0.1 × 10^18` float trap)
- EIP-681 URI shape and CAIP-2 network id
- x402 envelope shape (`accepts` / `exact` / testnet flag)
- Full 402 → proof → 200 handshake over a real HTTP server
- Live read-only RPC probe asserting chainId 1952 (skips cleanly offline)
- Lifecycle settlement flipping invoice and job to Paid

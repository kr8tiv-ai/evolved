# Going live on-chain — pinning REAL X Layer testnet settlements

The public playground stays in **simulated** mode on purpose, so judges can run
everything offline. This runbook is how the owner produces a handful of **real**
X Layer testnet settlements to pin as proof — turning "it can settle on-chain"
into "here are the transactions, click them."

> **Evolved never holds keys and never sends funds.** Every transaction below is
> sent by *you*, from *your own wallet*. The software only tells you what to send
> and verifies the hash you paste back with read-only RPC.

## What you need (5 minutes, all free)

1. Any EVM wallet (OKX Wallet or MetaMask) added to **X Layer testnet**:
   - Network: X Layer testnet "Terigon" · Chain ID **1952** · RPC `https://testrpc.xlayer.tech`
   - Explorer: `https://www.oklink.com/x-layer-testnet`
2. Some **test OKB** from the X Layer testnet faucet (valueless demo funds).
3. Your **receiving address** — can be the same wallet or a second one.

## The steps (your only real action is step 4)

```powershell
# one-time
$env:EVOLVED_PAYTO = "0xYourTestnetReceivingAddress"
npm run build
```

```powershell
# 1. See the invoices in the books
node scripts/settle-live.mjs list

# 2. Create a real payment request for one of them
node scripts/settle-live.mjs request <invoiceId> deposit
#    -> prints the exact amount, the receiving address, and an EIP-681 URI
```

```
# 3. Open the EIP-681 URI in your wallet (or type the amount + address in by hand)
# 4. SEND IT.  <-- the only wallet action; you do this yourself
```

```powershell
# 5. Verify it for real (read-only RPC checks exists / succeeded / right payee / enough value)
node scripts/settle-live.mjs check <paymentId> <txHash>
#    -> "REAL settlement verified on X Layer testnet" + the explorer link
```

Repeat steps 2–5 three to five times (different invoices / splits) to build a
small set of real hashes.

## For the x402 paid-ASP rail (optional, same idea)

Send `0.0001` test OKB to your `EVOLVED_PAYTO`, then call `/mcp-paid` with
`X-PAYMENT: {"txHash":"0x…"}` — the server verifies it on-chain and serves the
tool call with an `X-PAYMENT-RESPONSE` receipt. That bumps the real
`txHashesConsumed` counter on `/stats`.

## Then hand the hashes back

Send the 3–5 transaction hashes (and their explorer links). They get pinned in
the README and the on-chain section, `/stats` will show real
`txHashesConsumed`, and the present-tense "settles on-chain" wording becomes
literally, checkably true.

## What is already wired for you

- `EVOLVED_PAYTO` flows through `invoice_payment_request` and the x402 envelope.
- `EVOLVED_X402_MODE=live` makes the whole thing **fail closed** — it refuses any
  settlement it can't positively verify on-chain.
- `scripts/settle-live.mjs` reduces the whole flow to two commands around your
  one wallet action.
- Replay protection means each hash settles exactly one thing (now atomic under
  concurrency), so pinned hashes can't be reused.

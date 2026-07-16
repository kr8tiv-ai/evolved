# Deploying Evolved on Hostinger

**The endpoint is LIVE:**

- `https://evolvedmcp.cloud/mcp` — MCP Streamable HTTP (the free A2MCP endpoint)
- `https://evolvedmcp.cloud/health` — service metadata for reviewers

Deployed on Hostinger managed hosting as a Node.js application on its own
free subdomain site — fully isolated from every other site on the account,
TLS handled by the platform, zero secrets.

## How it is put together

| Concern | Choice | Why |
|---|---|---|
| Runtime | Hostinger managed hosting, Node.js app on a dedicated free-subdomain site | Platform TLS and process supervision; isolated from all other sites on the account |
| Entry | `server.cjs` (CommonJS shim) → dynamic-imports the ESM app (`dist/app.js`) | The platform's runner loads the entry with `require()`; the shim binds the port synchronously and surfaces boot errors over `/health` instead of a blank 503 |
| Port | Listens on 3000 by default | The platform proxies to 3000 and does not inject `PORT` |
| Node version | 20 (`engines.node >= 20`) | **Hard-won:** identical code 503s on the platform's Node 18 runtime; Node 20 works |
| Secrets | None | The free A2MCP tier needs no keys |

## Redeploying (after code changes)

Build the archive from the **committed tree** so nothing the app serves at
runtime is left out. Beyond the obvious source, the app streams `media/`
(the hero `hero.webm` + poster, the trade-tile `*.webp` images, and the
`og.png` link-preview card) and `submission/evolved-demo.mp4` (served at
`/demo.mp4`) — a hand-picked file list drops these and silently breaks the
hero video and the demo player. `git archive` avoids that:

```powershell
git archive HEAD -o evolved-src.zip
```

`git archive` emits only tracked files, so `node_modules/` and `dist/` (both
git-ignored) are excluded automatically and the platform rebuilds them; the
media and demo assets are tracked, so they ride along.

Then upload via the Hostinger API's JS-deployment endpoint (or hPanel →
Websites → the subdomain site → Node.js deploy). The platform runs
`npm ci`, `npm run build`, and restarts the app. **Deploy to both live sites
separately** — `evolvedmcp.cloud` and the `powderblue-…hostingersite.com`
fallback. Verify with:

```bash
curl https://evolvedmcp.cloud/health
```

And a real MCP handshake:

```bash
curl -s -X POST https://evolvedmcp.cloud/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"probe","version":"0"}}}'
```

## Custom domain later

Point a subdomain (e.g. `evolved.evolveecoblasting.com`) at the hosting
account in hPanel and attach it to the site; platform TLS follows
automatically. Update the URL in the OKX listing afterward.

## Alternative: VPS with Docker + Caddy

`deploy/hostinger/docker-compose.yml` contains a self-contained VPS
deployment (app built from this GitHub repo + Caddy with automatic HTTPS on
the VPS hostname, Docker restart policies as the process manager). Use it on
a VPS whose ports 80/443 are free.

Note for this account: the existing VPS (`srv1277677.hstgr.cloud`) is a
hardened private machine — sshd occupies port 443, a firewall drops public
inbound, and private services run on localhost. It is not a suitable public
web host without deliberate owner decisions, which is why the managed-hosting
path above is the live one.

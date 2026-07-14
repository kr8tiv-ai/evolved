# Deploying Evolved on a Hostinger VPS

Goal: the stateless MCP endpoint live at a public HTTPS URL, isolated from
everything else on the VPS, surviving reboots, with no secrets anywhere.

**Resulting public URL (this VPS):**

- `https://srv1277677.hstgr.cloud/mcp` — MCP Streamable HTTP (the A2MCP endpoint)
- `https://srv1277677.hstgr.cloud/health` — service metadata for reviewers

## How it is put together

| Concern | Choice | Why |
|---|---|---|
| Runtime | Docker Compose project named `evolved` | Fully isolated — cannot touch other sites or projects on the VPS |
| Build | Straight from the public GitHub repo (`build.context` = repo URL) | No code copied to the server by hand; redeploy = pull latest `main` |
| TLS / reverse proxy | Caddy 2, automatic HTTPS on the VPS hostname `srv1277677.hstgr.cloud` | Zero-config certificates via Let's Encrypt; hostname ships with the VPS |
| Process manager | Docker `restart: unless-stopped` on both containers | Survives crashes and VPS reboots; no pm2/systemd needed inside containers |
| Secrets | None | The free A2MCP tier needs no keys; nothing to leak |

The compose file lives at [`deploy/hostinger/docker-compose.yml`](../deploy/hostinger/docker-compose.yml).

## Option A — one command from any machine with the Hostinger API (recommended)

Requires a Hostinger API token in the `HOSTINGER_API_TOKEN` environment
variable (create one in hPanel → Account → API). Never hardcode or commit it.

```bash
curl -X POST "https://developers.hostinger.com/api/vps/v1/virtual-machines/1277677/docker" \
  -H "Authorization: Bearer $HOSTINGER_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "project_name": "evolved",
    "content": "https://raw.githubusercontent.com/kr8tiv-ai/evolved/main/deploy/hostinger/docker-compose.yml"
  }'
```

Hostinger pulls the compose file, builds the image from GitHub, and starts
both containers. First build takes 2–4 minutes; TLS certificate issuance
adds ~30 seconds on first request.

The same call **redeploys** a new version (same `project_name` replaces the
project; Caddy's certificate volume persists).

## Option B — SSH, if you prefer hands-on

```bash
ssh root@srv1277677.hstgr.cloud
mkdir -p /opt/evolved && cd /opt/evolved
curl -fsSLO https://raw.githubusercontent.com/kr8tiv-ai/evolved/main/deploy/hostinger/docker-compose.yml
docker compose up -d --build
```

## Verify

```bash
curl https://srv1277677.hstgr.cloud/health
# {"ok":true,"service":"evolved","version":"1.0.0","protocol":"MCP Streamable HTTP", ...}
```

Then a real MCP handshake:

```bash
curl -s -X POST https://srv1277677.hstgr.cloud/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"probe","version":"0"}}}'
```

## Operations

- **Logs:** hPanel → VPS → Docker Manager → `evolved` → logs, or `docker compose logs -f` over SSH, or the API `GET .../docker/evolved/logs`.
- **Update to latest main:** re-run the Option A command (or `docker compose up -d --build` over SSH).
- **Stop without removing:** hPanel Docker Manager, or the API project stop endpoint. The project is self-contained — removing it removes every trace.
- **Custom domain later:** point an A record (e.g. `evolved.yourdomain.com`) at `72.61.7.126`, then set `EVOLVED_PUBLIC_HOST=evolved.yourdomain.com` in the project environment and redeploy. Caddy fetches the certificate automatically.

## Hardening (optional, recommended once stable)

The VPS currently has no Hostinger firewall attached. When convenient,
create one allowing inbound `22` (SSH), `80`, and `443` only, and attach it
to the VPS — in hPanel or via the firewall API. Left as a manual step so it
never conflicts with other services you run on this machine.

## Non-goals / guardrails honored

- Nothing outside the `evolved` Docker project is created, modified, or
  removed; existing sites, files, and projects on the VPS are untouched.
- No secrets in the repo, the compose file, or the container environment.
- The endpoint is stateless per request; the demo data spine lives inside
  the container and reseeds itself — `demo_reset` restores it any time.

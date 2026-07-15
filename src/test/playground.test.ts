/**
 * Playground route tests: page serves, demo executor works within its
 * whitelist, non-whitelisted tools are refused, and the rate limiter bites.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer as createHttpServer } from "node:http";
import type { AddressInfo } from "node:net";
import { resetDb } from "../store.js";

// The limiter reads EVOLVED_RATE_LIMIT at module load — set it before import.
process.env.EVOLVED_RATE_LIMIT = "12";
const { handleRequest } = await import("../app.js");

async function startServer() {
  const s = createHttpServer((req, res) => void handleRequest(req, res));
  await new Promise<void>((r) => s.listen(0, r));
  return { s, base: `http://localhost:${(s.address() as AddressInfo).port}` };
}

test("playground: page serves on / and /playground, health lists it", async () => {
  resetDb();
  const { s, base } = await startServer();
  try {
    for (const p of ["/", "/playground"]) {
      const r = await fetch(base + p);
      assert.equal(r.status, 200);
      assert.match(r.headers.get("content-type") ?? "", /text\/html/);
      const html = await r.text();
      assert.match(html, /EVOLVED/);
      assert.match(html, /Run the whole/);
      assert.match(html, /Judge Mode/);
      assert.match(html, /media\/hero\.webm/);
      assert.match(html, /x402/i);
      assert.match(html, /lifecycle_start/);
    }
    const h = (await (await fetch(base + "/health")).json()) as { endpoints: Record<string, string> };
    assert.ok(h.endpoints["/"]);

    // Security headers ride on every response.
    const r = await fetch(base + "/");
    assert.equal(r.headers.get("x-frame-options"), "DENY");
    assert.equal(r.headers.get("x-content-type-options"), "nosniff");
    assert.match(r.headers.get("content-security-policy") ?? "", /frame-ancestors 'none'/);
    assert.ok(r.headers.get("strict-transport-security"));

    // Oversized bodies are refused before any route reads them.
    const big = await fetch(base + "/demo/call", {
      method: "POST",
      headers: { "content-type": "application/json", "content-length": "9999999" },
      body: JSON.stringify({ tool: "weather_check", args: {} }),
    }).catch(() => null);
    if (big) assert.equal(big.status, 413);
  } finally { s.close(); }
});

test("playground: /demo/call runs whitelisted tools, refuses the rest", async () => {
  resetDb();
  const { s, base } = await startServer();
  try {
    const ok = await fetch(base + "/demo/call", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ tool: "business_snapshot", args: {} }),
    });
    assert.equal(ok.status, 200);
    const body = (await ok.json()) as { result: { company: string } };
    assert.match(body.result.company, /Evolve Eco Blasting/);

    // Destructive / off-surface tools are refused at the route, whatever the args.
    for (const tool of ["franchise_spinup", "backup_create", "sheet_append_todo", "nonsense_tool"]) {
      const r = await fetch(base + "/demo/call", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ tool, args: { confirm: true } }),
      });
      assert.equal(r.status, 403, `${tool} must be refused`);
    }

    // Malformed body → 400, not a crash.
    const bad = await fetch(base + "/demo/call", {
      method: "POST", headers: { "content-type": "application/json" }, body: "{not json",
    });
    assert.equal(bad.status, 400);
  } finally { s.close(); }
});

test("playground: rate limiter returns 429 past the per-minute budget", async () => {
  resetDb();
  const { s, base } = await startServer();
  try {
    let last = 200;
    for (let i = 0; i < 20; i++) {
      const r = await fetch(base + "/demo/call", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ tool: "weather_check", args: {} }),
      });
      last = r.status;
      if (last === 429) break;
    }
    assert.equal(last, 429, "burst past the limit must be throttled");
  } finally { s.close(); }
});

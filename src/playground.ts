/**
 * Evolved — the hosted interactive playground.
 *
 * A single self-contained page (served at / and /playground) that lets
 * anyone run the live service from a browser: voice commands, photo-to-quote,
 * the full autonomous lifecycle with its two human money gates, and the
 * x402 402 → proof → receipt flow — all against the real endpoint,
 * synthetic data and testnet only.
 */

export const PLAYGROUND_HTML = `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Evolved — live playground</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&display=swap" rel="stylesheet">
<style>
  :root { --void:#0a0a0a; --deep:#050505; --panel:#101110; --line:#1f2937;
          --silver:#f3f4f6; --dim:#9ca3af; --aurora:#4ade80; --lime:#39ff14; --ice:#22d3ee; }
  * { box-sizing:border-box; margin:0; }
  body { background:var(--void); color:var(--silver);
         font:15px/1.55 "Segoe UI",system-ui,sans-serif; min-height:100vh; }
  body::before { content:""; position:fixed; inset:0; z-index:-1; background:
    radial-gradient(60% 40% at 20% 0%, rgba(74,222,128,.14), transparent 60%),
    radial-gradient(50% 35% at 80% 10%, rgba(34,211,238,.10), transparent 60%),
    linear-gradient(180deg,#0a0a0a 0%,#050505 100%); }
  .mono { font-family:"JetBrains Mono",Consolas,monospace; }
  header { max-width:1080px; margin:0 auto; padding:42px 20px 10px; text-align:center; }
  header img.logo { height:110px; filter:drop-shadow(0 0 24px rgba(74,222,128,.35)); }
  h1 { font-size:44px; letter-spacing:.14em; margin-top:12px; font-weight:800;
       background:linear-gradient(180deg,#f8fafc 0%,#cbd5e1 38%,#64748b 50%,#e2e8f0 60%,#94a3b8 100%);
       -webkit-background-clip:text; background-clip:text; color:transparent; }
  .rule { width:180px; height:4px; background:var(--lime); margin:10px auto; border-radius:2px; }
  .sub { color:var(--silver); letter-spacing:.28em; font-size:13px; }
  .tag { color:var(--aurora); letter-spacing:.14em; font-size:12px; margin-top:8px; }
  .chips { display:flex; gap:10px; justify-content:center; flex-wrap:wrap; margin:18px 0 6px; }
  .chip { border:1px solid var(--line); border-radius:999px; padding:5px 14px; font-size:12px;
          color:var(--dim); background:rgba(16,17,16,.7); }
  .chip b { color:var(--aurora); font-weight:600; }
  main { max-width:1080px; margin:0 auto; padding:16px 20px 60px; }
  .grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(480px,1fr)); gap:18px; }
  @media (max-width:1040px){ .grid{grid-template-columns:1fr} }
  .card { background:rgba(16,17,16,.85); border:1px solid var(--line); border-radius:14px; padding:20px; }
  .card h2 { font-size:15px; letter-spacing:.14em; color:var(--aurora); text-transform:uppercase; margin-bottom:4px; }
  .card p.hint { color:var(--dim); font-size:13px; margin-bottom:12px; }
  button { font-family:"JetBrains Mono",monospace; font-size:13px; font-weight:700; letter-spacing:.06em;
           background:var(--lime); color:#000; border:0; border-radius:8px; padding:9px 16px;
           cursor:pointer; margin:3px 6px 3px 0; transition:filter .15s, transform .05s; }
  button:hover { filter:brightness(1.12); } button:active { transform:translateY(1px); }
  button.ghost { background:transparent; color:var(--aurora); border:1px solid var(--aurora); }
  button:disabled { background:#1f2937; color:#6b7280; cursor:not-allowed; border:0; }
  select,input[type=number],input[type=text] { background:#0d0f0e; color:var(--silver); border:1px solid var(--line);
           border-radius:8px; padding:8px 10px; font-family:"JetBrains Mono",monospace; font-size:13px; margin:3px 6px 3px 0; }
  input[type=text] { width:100%; }
  .out { background:#070808; border:1px solid var(--line); border-radius:10px; margin-top:12px;
         padding:12px 14px; max-height:340px; overflow:auto; font-family:"JetBrains Mono",monospace;
         font-size:12.5px; white-space:pre-wrap; word-break:break-word; color:#cbd5e1; }
  .out:empty { display:none; }
  .out .k { color:var(--aurora); } .out .lit { color:var(--lime); } .out .err { color:#f87171; }
  .out .step { color:var(--silver); font-weight:700; }
  .gate { color:var(--lime); font-weight:700; }
  .wide { grid-column:1 / -1; }
  .cfg { display:grid; grid-template-columns:1fr 1fr; gap:14px; }
  @media (max-width:900px){ .cfg{grid-template-columns:1fr} }
  pre.copy { background:#070808; border:1px solid var(--line); border-radius:10px; padding:12px;
             font-size:12px; overflow:auto; color:#cbd5e1; }
  footer { text-align:center; color:var(--dim); font-size:11.5px; letter-spacing:.14em;
           padding:26px 16px 40px; text-transform:uppercase; }
  footer a { color:var(--aurora); text-decoration:none; }
  a.repo { color:var(--aurora); text-decoration:none; }
</style></head><body>

<header>
  <img class="logo" src="https://github.com/kr8tiv-ai/evolved/raw/main/assets/evolve-logo.png" alt="Evolve">
  <h1>EVOLVED</h1>
  <div class="rule"></div>
  <div class="sub mono">LIVE PLAYGROUND — RUN A REAL COMPANY'S AI FROM YOUR BROWSER</div>
  <div class="tag mono">SYNTHETIC DATA · X LAYER TESTNET · NO INSTALL · NO KEYS · DATA AUTO-RESTORES HOURLY</div>
  <div class="chips mono" id="chips">
    <span class="chip">service: <b id="c-status">checking…</b></span>
    <span class="chip">tools: <b id="c-tools">—</b></span>
    <span class="chip">X Layer testnet: <b id="c-chain">probing…</b></span>
    <span class="chip"><a class="repo" href="https://github.com/kr8tiv-ai/evolved">github.com/kr8tiv-ai/evolved</a></span>
  </div>
</header>

<main><div class="grid">

<div class="card">
  <h2>🎙️ Talk to the crew radio</h2>
  <p class="hint">Voice field commands, parsed deterministically. Try: “used two bags of crushed glass on the Jasper Ave job” · “open the FLHA” · “next stop?” · “remind me to grab couplers today”.</p>
  <input type="text" id="voice-in" value="used two bags of crushed glass on the Jasper Ave job">
  <div><button onclick="voice()">Send voice command</button></div>
  <div class="out" id="voice-out"></div>
</div>

<div class="card">
  <h2>📸 Photo-to-quote in seconds</h2>
  <p class="hint">A customer texts a driveway photo. The estimator sizes it, the learning rate engine prices it, and a branded draft quote lands in the books with a measure-to-confirm clause.</p>
  <select id="pq-surface"><option>driveway</option><option>sidewalk</option><option>patio</option><option>garage-pad</option><option>exposed-aggregate</option></select>
  <input type="number" id="pq-w" value="20" min="4" max="200" style="width:90px"> ×
  <input type="number" id="pq-l" value="30" min="4" max="400" style="width:90px"> ft
  <div><button onclick="photoQuote()">Price it & draft the quote</button></div>
  <div class="out" id="pq-out"></div>
</div>

<div class="card wide">
  <h2>🔄 The autonomous lifecycle — with human money gates</h2>
  <p class="hint">One agent runs lead → quote → e-sign → weather-gated booking → FLHA → work → invoice → on-chain payment → review. It stops twice, both times about money. You are the human — clear the gates.</p>
  <div>
    <button id="lc-start" onclick="lcStart()">1 · Start engagement</button>
    <button id="lc-approve" onclick="lcApprove()" disabled>2 · 🔒 Approve quote & e-sign (human gate)</button>
    <button id="lc-settle" onclick="lcSettle()" disabled>3 · 🔒 Settle on-chain (human gate)</button>
  </div>
  <div class="out" id="lc-out"></div>
</div>

<div class="card">
  <h2>⛓️ Invoice → X Layer testnet</h2>
  <p class="hint">Turn a real invoice balance into an EIP-681 payment request in test OKB on chainId 1952, then confirm settlement. Evolved never holds keys — it only verifies.</p>
  <div>
    <button onclick="payRequest()">Create payment request</button>
    <button class="ghost" onclick="payCheck()" id="pay-check" disabled>Verify settlement (simulated)</button>
  </div>
  <div class="out" id="pay-out"></div>
</div>

<div class="card">
  <h2>🧾 x402 — pay-per-call, live</h2>
  <p class="hint">Evolved is a paid ASP. Watch the raw protocol: a call without payment gets HTTP 402 and an <span class="mono">accepts</span> envelope; present proof and the same call returns the service plus a settlement receipt header.</p>
  <div>
    <button onclick="x402()">Run the 402 → pay → 200 flow</button>
  </div>
  <div class="out" id="x-out"></div>
</div>

<div class="card wide">
  <h2>⚡ One-click business questions</h2>
  <p class="hint">The tools an owner actually reaches for.</p>
  <div>
    <button class="ghost" onclick="quick('morning_digest',{},'q-out')">Morning digest</button>
    <button class="ghost" onclick="quick('business_snapshot',{},'q-out')">Business snapshot</button>
    <button class="ghost" onclick="quick('cfo_forecast',{scenario:'add-truck'},'q-out')">CFO: should I buy a truck?</button>
    <button class="ghost" onclick="quick('weather_check',{},'q-out')">Blast-day weather</button>
    <button class="ghost" onclick="quick('demo_reset',{},'q-out')">Reset demo data</button>
  </div>
  <div class="out" id="q-out"></div>
</div>

<div class="card wide"><div class="cfg">
  <div>
    <h2>Point your own agent at it</h2>
    <p class="hint">Claude Desktop / Claude Code / any MCP client — the live Streamable HTTP endpoint:</p>
<pre class="copy mono">{ "mcpServers": { "evolved": {
    "type": "http",
    "url": "https://powderblue-leopard-801168.hostingersite.com/mcp"
} } }</pre>
  </div>
  <div>
    <h2>Or run it locally</h2>
    <p class="hint">65 tools, 31 tests, zero credentials:</p>
<pre class="copy mono">git clone https://github.com/kr8tiv-ai/evolved.git
cd evolved && npm install && npm run build
npm test && npm run demo</pre>
  </div>
</div></div>

</div></main>

<footer>
  OKX AI GENESIS HACKATHON · MCP AGENTIC SERVICE PROVIDER · X LAYER TESTNET 1952 ·
  <a href="https://github.com/kr8tiv-ai/evolved">SOURCE</a> ·
  <a href="/health">HEALTH</a> ·
  BUILT FROM THE LIVE OPS SYSTEM OF <a href="https://www.evolveecoblasting.com">EVOLVE ECO BLASTING</a>
</footer>

<script>
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;");
function show(id, obj, label) {
  const el = $(id);
  const body = typeof obj === "string" ? esc(obj) : esc(JSON.stringify(obj, null, 2));
  el.innerHTML += (label ? '<span class="step">' + esc(label) + '</span>\\n' : '') + body + '\\n\\n';
  el.scrollTop = el.scrollHeight;
}
function clearOut(id){ $(id).innerHTML = ""; }
async function call(tool, args) {
  const r = await fetch("/demo/call", { method:"POST",
    headers:{ "content-type":"application/json" },
    body: JSON.stringify({ tool, args: args || {} }) });
  const j = await r.json();
  if (!r.ok) throw new Error(j.error || ("HTTP " + r.status));
  return j.result;
}
async function quick(tool, args, out) {
  clearOut(out); show(out, "→ " + tool + " …");
  try { show(out, await call(tool, args), "✔ " + tool); }
  catch (e) { show(out, "✖ " + e.message); }
}
async function voice() {
  clearOut("voice-out");
  const u = $("voice-in").value;
  show("voice-out", "→ voice_command: “" + u + "”");
  try {
    const r = await call("voice_command", { utterance: u, speaker: "Playground" });
    show("voice-out", "🗣 " + (r.reply || ""), "reply");
    show("voice-out", r.intent, "parsed intent");
    if (r.action) show("voice-out", r.action, "action taken");
  } catch (e) { show("voice-out", "✖ " + e.message); }
}
async function photoQuote() {
  clearOut("pq-out");
  const args = { surface: $("pq-surface").value,
    approxWidthFt: Number($("pq-w").value), approxLengthFt: Number($("pq-l").value),
    customerName: "Playground Lead " + new Date().toISOString().slice(11,19),
    siteAddress: "Playground demo site" };
  show("pq-out", "→ quote_from_photo " + JSON.stringify({surface:args.surface,ft:args.approxWidthFt+"×"+args.approxLengthFt}));
  try {
    const r = await call("quote_from_photo", args);
    show("pq-out", r.estimate, "estimate");
    show("pq-out", { id: r.quote.id, subtotal: r.quote.subtotal, gst: r.quote.gst,
      total: r.quote.total, deposit: r.quote.depositRequired, validUntil: r.quote.validUntil }, "quote (in the books)");
    show("pq-out", r.advisory || r.quote.profitability?.advisory || "", "margin verdict");
  } catch (e) { show("pq-out", "✖ " + e.message); }
}
let LC = null, LC_PAY = null;
async function lcStart() {
  clearOut("lc-out"); $("lc-start").disabled = true;
  show("lc-out", "→ lifecycle_start { Aurora Ridge Dental, 520 sqft sidewalk, light blast }");
  try {
    const r = await call("lifecycle_start", { customerName: "Playground Client " + Date.now()%10000,
      siteAddress: "9922 82 Ave, Edmonton", summary: "Entrance concrete refresh",
      surface: "sidewalk", sqft: 520, depth: "light", access: "moderate" });
    LC = r.lifecycle.id;
    show("lc-out", { quote: r.quote.id, total: r.quote.total, margin: r.quote.profitability.marginPct + "%" }, "quoted");
    show("lc-out", "🔒 GATE — " + r.lifecycle.gates[0].reason);
    $("lc-approve").disabled = false;
  } catch (e) { show("lc-out", "✖ " + e.message); $("lc-start").disabled = false; }
}
async function lcApprove() {
  $("lc-approve").disabled = true;
  show("lc-out", "→ lifecycle_advance { approveQuote: true, esignSigner: 'Playground Judge' }");
  try {
    const r = await call("lifecycle_advance", { lifecycleId: LC, approveQuote: true, esignSigner: "Playground Judge" });
    for (const l of r.log) show("lc-out", "◆ " + l.step + " — " + l.detail);
    LC_PAY = r.refs.payment;
    show("lc-out", "🔒 GATE — settlement must be confirmed (txHash on X Layer testnet, or simulated here).");
    $("lc-settle").disabled = false;
  } catch (e) { show("lc-out", "✖ " + e.message); $("lc-approve").disabled = false; }
}
async function lcSettle() {
  $("lc-settle").disabled = true;
  show("lc-out", "→ lifecycle_advance { simulatePayment: true }");
  try {
    const r = await call("lifecycle_advance", { lifecycleId: LC, simulatePayment: true });
    for (const l of r.log.slice(-3)) show("lc-out", "◆ " + l.step + " — " + l.detail);
    show("lc-out", "✔ CLOSED — lead to paid, one agent, two human money gates. The rate engine just got smarter.");
    $("lc-start").disabled = false;
  } catch (e) { show("lc-out", "✖ " + e.message); $("lc-settle").disabled = false; }
}
let PAY = null;
async function payRequest() {
  clearOut("pay-out");
  show("pay-out", "→ invoice_payment_request { invoiceId: 'ECO-INV-9002' }");
  try {
    const r = await call("invoice_payment_request", { invoiceId: "ECO-INV-9002" });
    PAY = r.payment.id; $("pay-check").disabled = false;
    show("pay-out", { network: r.payment.network, chainId: r.payment.chainId,
      amount: r.payment.amountAsset + " " + r.payment.asset.symbol + "  (= $" + r.payment.amountCad + " CAD)",
      payTo: r.payment.payTo, uri: r.payment.uri }, "payment request (EIP-681)");
    show("pay-out", r.instructions.join("\\n"), "instructions");
  } catch (e) {
    show("pay-out", "✖ " + e.message + " — the seeded invoice may already be settled; try 'Reset demo data' below.");
  }
}
async function payCheck() {
  show("pay-out", "→ invoice_payment_check { simulate: true }   (live mode would verify a real txHash by RPC)");
  try {
    const r = await call("invoice_payment_check", { paymentId: PAY, simulate: true });
    show("pay-out", r.verification, "settlement");
    show("pay-out", { invoice: r.payment.invoiceId, status: r.payment.status, mode: r.payment.mode }, "books updated");
  } catch (e) { show("pay-out", "✖ " + e.message); }
}
async function x402() {
  clearOut("x-out");
  const body = JSON.stringify({ jsonrpc:"2.0", id:1, method:"initialize",
    params:{ protocolVersion:"2025-03-26", capabilities:{}, clientInfo:{ name:"playground", version:"1" } } });
  const hdrs = { "content-type":"application/json", accept:"application/json, text/event-stream" };
  show("x-out", "→ POST /mcp-paid   (no payment)");
  const r1 = await fetch("/mcp-paid", { method:"POST", headers:hdrs, body });
  const env = await r1.json();
  show("x-out", "HTTP " + r1.status + " Payment Required", "challenge");
  show("x-out", env.accepts ? env.accepts[0] : env, "accepts[0]");
  show("x-out", "→ POST /mcp-paid   with  X-PAYMENT: {\\"simulated\\":true}");
  const r2 = await fetch("/mcp-paid", { method:"POST",
    headers: Object.assign({ "X-PAYMENT": JSON.stringify({ simulated:true }) }, hdrs), body });
  const receipt = r2.headers.get("x-payment-response");
  show("x-out", "HTTP " + r2.status, "paid call");
  if (receipt) show("x-out", JSON.parse(atob(receipt)), "X-PAYMENT-RESPONSE (settlement receipt)");
  const text = await r2.text();
  const m = text.match(/"serverInfo":\\s*({[^}]+})/);
  show("x-out", m ? JSON.parse(m[1]) : text.slice(0, 300), "the service, unlocked");
}
(async () => {
  try {
    const h = await (await fetch("/health")).json();
    $("c-status").textContent = "live · v" + h.version;
    $("c-tools").textContent = h.tools;
  } catch { $("c-status").textContent = "unreachable"; }
  try {
    const s = await call("xlayer_status", {});
    $("c-chain").textContent = s.rpcProbe.reachable ? ("chain " + s.rpcProbe.chainId + " · block " + s.rpcProbe.blockNumber) : "rpc offline (fails closed)";
  } catch { $("c-chain").textContent = "—"; }
})();
</script>
</body></html>`;

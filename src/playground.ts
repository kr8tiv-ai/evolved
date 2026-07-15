/**
 * Evolved — the hosted interactive playground (v2).
 *
 * One self-contained page (served at / and /playground) that runs the live
 * service from a browser. v2 adds Judge Mode — a one-click autopilot that
 * tells the whole story by itself — plus a live business ticker, a rendered
 * morning digest, a CFO cash-curve chart drawn from real tool output, and
 * the rate-engine learning story visualized. Synthetic data, testnet only.
 *
 * Implementation note: the page's own JavaScript deliberately avoids
 * template literals and ${} so this file can hold it in one TS literal.
 */

export const PLAYGROUND_HTML = `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Evolved — live playground</title>
<meta name="description" content="A real company's operations brain as an autonomous MCP agent — run it live: voice, photo-to-quote, the full lifecycle with human money gates, and x402 on-chain payments on X Layer testnet.">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Archivo:wght@500;600;700;800;900&family=JetBrains+Mono:wght@400;700&display=swap" rel="stylesheet">
<style>
  :root { --void:#080a08; --deep:#040504; --panel:#0e100e; --panel2:#0b0d0b; --line:#1c2620;
          --silver:#f3f4f6; --dim:#9aa39a; --dim2:#6b746b; --aurora:#4ade80; --lime:#39ff14; --ice:#22d3ee; }
  * { box-sizing:border-box; margin:0; }
  html { scroll-behavior:smooth; }
  body { background:#000; color:var(--silver); font-family:"Archivo",system-ui,sans-serif;
         font-size:15px; line-height:1.55; min-height:100vh; overflow-x:hidden;
         -webkit-font-smoothing:antialiased; }
  .mono { font-family:"JetBrains Mono",Consolas,monospace; }
  a { color:var(--aurora); }

  /* cinematic backdrop: animated aurora canvas + grain + vignette */
  #aurora { position:fixed; inset:0; z-index:-3; width:100%; height:100%; display:block; background:#000; }
  .grain { position:fixed; inset:0; z-index:-1; pointer-events:none; opacity:.045; mix-blend-mode:screen;
    background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence baseFrequency='0.85' numOctaves='2'/%3E%3C/filter%3E%3Crect width='140' height='140' filter='url(%23n)' opacity='0.7'/%3E%3C/svg%3E"); }
  .vign { position:fixed; inset:0; z-index:-2; pointer-events:none;
    background:radial-gradient(120% 90% at 50% 0%, transparent 40%, rgba(0,0,0,.55) 100%); }

  /* top nav */
  nav { position:fixed; top:0; left:0; right:0; z-index:40; display:flex; align-items:center; justify-content:space-between;
        padding:16px 26px; backdrop-filter:blur(8px); background:linear-gradient(180deg,rgba(0,0,0,.72),rgba(0,0,0,0));
        transition:background .3s; }
  nav.solid { background:rgba(5,6,5,.9); border-bottom:1px solid var(--line); }
  nav .brand { display:flex; align-items:center; gap:11px; }
  nav .brand img { height:30px; filter:drop-shadow(0 0 12px rgba(74,222,128,.5)); }
  nav .brand b { font-weight:800; letter-spacing:.22em; font-size:15px; }
  nav .nlinks { display:flex; gap:26px; align-items:center; }
  nav .nlinks a { color:var(--dim); text-decoration:none; font-size:12px; letter-spacing:.16em; text-transform:uppercase; font-weight:600; transition:color .2s; }
  nav .nlinks a:hover { color:var(--silver); }
  nav .cta { background:var(--lime); color:#000; padding:9px 18px; border-radius:999px; font-weight:800;
             font-size:12px; letter-spacing:.1em; text-transform:uppercase; box-shadow:0 0 22px rgba(57,255,20,.35); }
  @media (max-width:820px){ nav .nlinks a:not(.cta){ display:none } nav{padding:14px 18px} }

  /* hero */
  .hero { position:relative; min-height:100vh; display:flex; flex-direction:column; justify-content:center;
          max-width:1180px; margin:0 auto; padding:120px 26px 90px; }
  .hero .eyebrow-h { display:flex; align-items:center; gap:14px; color:var(--aurora);
                     font-family:"JetBrains Mono",monospace; font-size:12px; letter-spacing:.34em;
                     text-transform:uppercase; margin-bottom:22px; }
  .hero .eyebrow-h::before { content:""; width:46px; height:2px; background:var(--aurora); box-shadow:0 0 10px var(--aurora); }
  .htitle { font-weight:900; font-size:clamp(46px, 8.5vw, 116px); line-height:.94; letter-spacing:-.01em;
            text-transform:uppercase; color:#fbfdfb; margin:0; }
  .htitle .glow { color:var(--lime); text-shadow:0 0 34px rgba(57,255,20,.75), 0 0 8px rgba(57,255,20,.6); }
  .hlead { color:#c7cdc7; font-size:clamp(16px,2vw,21px); line-height:1.5; max-width:660px; margin:28px 0 0; }
  .hcta { display:flex; gap:14px; flex-wrap:wrap; margin-top:36px; }
  .btn-pill { display:inline-flex; align-items:center; gap:10px; background:var(--lime); color:#000;
              font-family:"Archivo"; font-weight:800; font-size:14px; letter-spacing:.06em; text-transform:uppercase;
              border:0; border-radius:999px; padding:15px 30px; cursor:pointer; text-decoration:none;
              box-shadow:0 0 30px rgba(57,255,20,.4); transition:transform .12s, box-shadow .2s, filter .2s; }
  .btn-pill:hover { filter:brightness(1.08); box-shadow:0 0 44px rgba(57,255,20,.6); transform:translateY(-2px); }
  .btn-pill.outline { background:transparent; color:var(--silver); border:1.5px solid rgba(154,163,154,.5); box-shadow:none; }
  .btn-pill.outline:hover { border-color:var(--aurora); color:#fff; box-shadow:0 0 24px rgba(74,222,128,.25); }
  .hstats { display:flex; gap:30px; flex-wrap:wrap; margin-top:52px; }
  .hstats .s b { display:block; font-weight:900; font-size:30px; color:#fbfdfb; line-height:1; }
  .hstats .s span { font-family:"JetBrains Mono",monospace; font-size:11px; letter-spacing:.16em; color:var(--dim); text-transform:uppercase; }
  .hstats .s b.lime { color:var(--lime); }

  /* live status chips over hero */
  .chips { display:flex; gap:9px; flex-wrap:wrap; margin-top:40px; }
  .chip { border:1px solid var(--line); border-radius:999px; padding:6px 15px; font-size:11.5px;
          color:var(--dim); background:rgba(8,10,8,.7); backdrop-filter:blur(6px); font-family:"JetBrains Mono",monospace;
          letter-spacing:.04em; display:inline-flex; gap:6px; align-items:center; }
  .chip::before { content:""; width:7px; height:7px; border-radius:50%; background:var(--aurora); box-shadow:0 0 8px var(--aurora); }
  .chip.static::before { display:none; }
  .chip b { color:var(--aurora); font-weight:700; }
  .chip a { color:var(--aurora); text-decoration:none; }

  /* treeline silhouette at hero base */
  .treeline { position:absolute; bottom:0; left:0; right:0; width:100%; height:120px; z-index:1; pointer-events:none; opacity:.9; }

  /* live business ticker */
  .tickerwrap { position:relative; z-index:2; border-top:1px solid var(--line); border-bottom:1px solid var(--line);
                background:rgba(4,5,4,.9); overflow:hidden; white-space:nowrap; }
  .ticker { display:inline-block; padding:11px 0; animation:tick 46s linear infinite;
            font-family:"JetBrains Mono",monospace; font-size:12.5px; letter-spacing:.08em; color:var(--dim); }
  .ticker b { color:var(--aurora); font-weight:600; } .ticker i { color:var(--lime); font-style:normal; }
  .ticker span { margin:0 26px; }
  @keyframes tick { from{ transform:translateX(0) } to{ transform:translateX(-50%) } }

  /* section headers */
  .section { max-width:1180px; margin:0 auto; padding:64px 26px 0; }
  .section-head { margin-bottom:26px; }
  .section-head .kicker { display:flex; align-items:center; gap:12px; color:var(--aurora);
                          font-family:"JetBrains Mono",monospace; font-size:11px; letter-spacing:.3em; text-transform:uppercase; margin-bottom:14px; }
  .section-head .kicker::before, .section-head .kicker::after { content:""; height:1px; width:34px; background:rgba(74,222,128,.5); }
  .section-head .kicker::after { flex:0 0 34px; }
  .section-head h2.sh { font-weight:900; font-size:clamp(28px,4.4vw,50px); line-height:1; text-transform:uppercase; color:#fbfdfb; letter-spacing:-.01em; }
  .section-head h2.sh .glow { color:var(--lime); text-shadow:0 0 26px rgba(57,255,20,.6); }
  .section-head p.sp { color:var(--dim); font-size:15px; max-width:680px; margin-top:14px; line-height:1.55; }

  main { max-width:1180px; margin:0 auto; padding:22px 26px 40px; }
  .grid { display:grid; grid-template-columns:repeat(2,1fr); gap:18px; }
  @media (max-width:1000px){ .grid{grid-template-columns:1fr} }
  .card { position:relative; background:linear-gradient(180deg,rgba(14,16,14,.94),rgba(9,11,9,.96));
          border:1px solid var(--line); border-radius:16px; padding:24px; overflow:hidden;
          transition:border-color .25s, transform .25s, box-shadow .25s; }
  .card::before { content:""; position:absolute; left:0; top:22px; bottom:22px; width:3px; border-radius:3px;
                  background:linear-gradient(180deg,var(--aurora),var(--lime)); opacity:0; transition:opacity .25s; }
  .card:hover { border-color:rgba(74,222,128,.45); transform:translateY(-3px);
                box-shadow:0 16px 48px rgba(0,0,0,.55), 0 0 0 1px rgba(74,222,128,.12); }
  .card:hover::before { opacity:.9; }
  .eyebrow { font-family:"JetBrains Mono",monospace; font-size:10.5px; letter-spacing:.28em;
             color:var(--aurora); text-transform:uppercase; margin-bottom:8px; }
  .card h2 { font-size:22px; font-weight:800; letter-spacing:-.01em; color:#fbfdfb; margin-bottom:8px; text-transform:none; }
  .card h2 .g { color:var(--lime); }
  .card p.hint { color:var(--dim); font-size:13.5px; margin-bottom:14px; line-height:1.55; }
  button { font-family:"Archivo"; font-size:13px; font-weight:800; letter-spacing:.04em; text-transform:uppercase;
           background:var(--lime); color:#000; border:0; border-radius:999px; padding:11px 22px;
           cursor:pointer; margin:3px 8px 3px 0; transition:filter .15s, transform .06s, box-shadow .2s; }
  button:hover { filter:brightness(1.1); box-shadow:0 0 24px rgba(57,255,20,.4); }
  button:active { transform:translateY(1px); }
  button.ghost { background:transparent; color:var(--aurora); border:1.5px solid rgba(74,222,128,.55); }
  button.ghost:hover { box-shadow:0 0 16px rgba(74,222,128,.25); background:rgba(74,222,128,.08); }
  button:disabled { background:#12160f; color:#4b5563; cursor:not-allowed; border:1px solid var(--line); box-shadow:none; }
  select,input[type=number],input[type=text] { background:#070907; color:var(--silver); border:1px solid var(--line);
           border-radius:10px; padding:10px 12px; font-family:"JetBrains Mono",monospace; font-size:13px; margin:3px 6px 3px 0; }
  input[type=text] { width:100%; }
  input:focus,select:focus { outline:none; border-color:rgba(74,222,128,.6); box-shadow:0 0 0 2px rgba(74,222,128,.12); }

  .out { background:#050605; border:1px solid var(--line); border-radius:12px; margin-top:14px;
         padding:14px 16px; max-height:360px; overflow:auto; font-family:"JetBrains Mono",monospace;
         font-size:12.5px; white-space:pre-wrap; word-break:break-word; color:#cbd5e1; }
  .out:empty { display:none; }
  .out .step { color:var(--silver); font-weight:700; }
  .out .gate { color:var(--lime); font-weight:700; }
  .out .jk { color:var(--aurora); } .out .js { color:#e5e7eb; } .out .jn { color:var(--ice); }
  .out .jb { color:var(--lime); } .out .dimx { color:#6b7280; }

  .wide { grid-column:1 / -1; }

  /* judge mode — the marquee card */
  .judge { border:1px solid rgba(57,255,20,.45); background:
           linear-gradient(180deg, rgba(57,255,20,.07), rgba(9,11,9,.96)); box-shadow:0 0 40px rgba(57,255,20,.08); }
  .judge h2 { color:var(--lime); }
  .progress { height:7px; background:#0d110d; border-radius:4px; margin:14px 0 5px; overflow:hidden; }
  .progress i { display:block; height:100%; width:0%; border-radius:4px;
                background:linear-gradient(90deg, var(--aurora), var(--lime)); box-shadow:0 0 14px rgba(57,255,20,.5); transition:width .6s ease; }
  .stepline { font-family:"JetBrains Mono",monospace; font-size:11.5px; color:var(--dim); letter-spacing:.12em; min-height:16px; }

  /* trade persona strip */
  .trades { display:grid; grid-template-columns:repeat(4,1fr); gap:16px; }
  @media (max-width:1000px){ .trades{grid-template-columns:repeat(2,1fr)} }
  @media (max-width:560px){ .trades{grid-template-columns:1fr} }
  .trade { position:relative; border:1px solid var(--line); border-radius:16px; padding:22px 20px 20px;
           background:linear-gradient(180deg,rgba(14,16,14,.9),rgba(8,10,8,.95)); cursor:pointer;
           transition:border-color .22s, transform .22s, box-shadow .22s; overflow:hidden; }
  .trade:hover { border-color:rgba(74,222,128,.5); transform:translateY(-4px); box-shadow:0 18px 44px rgba(0,0,0,.5); }
  .trade .num { font-family:"JetBrains Mono",monospace; font-size:11px; color:var(--dim2); letter-spacing:.2em; }
  .trade .tag2 { position:absolute; top:18px; right:16px; border:1px solid rgba(74,222,128,.6); color:var(--aurora);
                 border-radius:999px; padding:3px 11px; font-family:"JetBrains Mono",monospace; font-size:10px; letter-spacing:.14em; text-transform:uppercase; }
  .trade h3 { font-weight:800; font-size:21px; margin:16px 0 8px; color:#fbfdfb; }
  .trade h3 .g { color:var(--lime); }
  .trade p { color:var(--dim); font-size:13px; line-height:1.5; }
  .trade .go { margin-top:14px; color:var(--aurora); font-family:"JetBrains Mono",monospace; font-size:11px; letter-spacing:.14em; text-transform:uppercase; display:flex; align-items:center; gap:8px; }
  .trade .go::before { content:""; width:20px; height:1px; background:var(--aurora); }

  /* rendered digest */
  .brief { margin-top:12px; display:none; }
  .brief.on { display:block; }
  .callout { border:1px solid rgba(57,255,20,.5); border-left:4px solid var(--lime); border-radius:10px;
             padding:12px 14px; margin-bottom:12px; background:rgba(57,255,20,.05); font-size:14px; }
  .callout b { color:var(--lime); letter-spacing:.14em; font-size:11px; display:block; margin-bottom:4px; }
  .pills { display:flex; flex-wrap:wrap; gap:8px; margin:8px 0; }
  .pill { border:1px solid var(--line); border-radius:8px; padding:7px 12px; font-family:"JetBrains Mono",monospace;
          font-size:12px; color:var(--dim); background:#0b0d0c; }
  .pill b { color:var(--silver); display:block; font-size:15px; }
  .pill.good b { color:var(--aurora); } .pill.hot b { color:var(--lime); }
  ul.list { list-style:none; margin:8px 0; }
  ul.list li { padding:6px 0 6px 18px; position:relative; font-size:13px; color:#cbd5e1; border-bottom:1px dashed #16201b; }
  ul.list li::before { content:"◆"; color:var(--lime); position:absolute; left:0; font-size:10px; top:9px; }
  .wx { display:flex; gap:6px; flex-wrap:wrap; margin-top:8px; }
  .wx span { font-family:"JetBrains Mono",monospace; font-size:11px; padding:5px 9px; border-radius:6px; border:1px solid var(--line); }
  .wx .go { color:var(--aurora); border-color:rgba(74,222,128,.5); }
  .wx .mid { color:#fbbf24; border-color:rgba(251,191,36,.4); }
  .wx .no { color:#f87171; border-color:rgba(248,113,113,.4); }

  svg.chart { width:100%; height:210px; margin-top:10px; display:none; }
  svg.chart.on { display:block; }
  .bars { margin-top:10px; display:none; } .bars.on { display:block; }
  .bar { margin:9px 0; }
  .bar .lbl { display:flex; justify-content:space-between; font-family:"JetBrains Mono",monospace; font-size:11.5px; color:var(--dim); margin-bottom:4px; }
  .bar .lbl b { color:var(--silver); }
  .track { height:10px; background:#0b0d0c; border:1px solid var(--line); border-radius:5px; position:relative; overflow:hidden; }
  .track i { position:absolute; inset:0; width:0%; border-radius:5px; background:#334155; transition:width 1s ease; }
  .track i.learned { background:linear-gradient(90deg,var(--aurora),var(--lime)); box-shadow:0 0 12px rgba(57,255,20,.4); }

  .cfg { display:grid; grid-template-columns:1fr 1fr; gap:14px; }
  @media (max-width:900px){ .cfg{grid-template-columns:1fr} }
  pre.copy { background:#070808; border:1px solid var(--line); border-radius:10px; padding:12px;
             font-size:12px; overflow:auto; color:#cbd5e1; }
  footer { text-align:center; color:var(--dim); font-size:11.5px; letter-spacing:.14em;
           padding:26px 16px 40px; text-transform:uppercase; }
  footer a { color:var(--aurora); text-decoration:none; }
</style></head><body>
<canvas id="aurora"></canvas><div class="vign"></div><div class="grain"></div>

<nav id="nav">
  <div class="brand">
    <img src="https://github.com/kr8tiv-ai/evolved/raw/main/assets/evolve-logo.png" alt="Evolve">
    <b>EVOLVED</b>
  </div>
  <div class="nlinks">
    <a href="#run">Run it</a>
    <a href="#adapt">Make it yours</a>
    <a href="#onchain">On-chain</a>
    <a href="https://github.com/kr8tiv-ai/evolved">GitHub</a>
    <a class="cta" href="#run" onclick="setTimeout(judgeMode,400)">▶ Judge Mode</a>
  </div>
</nav>

<section class="hero">
  <div class="eyebrow-h">BUSINESS MANAGEMENT IN A BOX · MODEL CONTEXT PROTOCOL</div>
  <h1 class="htitle">Run the whole<br>business with<br><span class="glow">one agent.</span></h1>
  <p class="hlead">Evolved is the operating system that lets an AI run a service business end to end — quotes that price themselves, safety, receipts, dispatch, invoicing, and settlement. It runs a real Alberta company today, and spins up for <b style="color:#e8ebe8">any trade in one call</b>.</p>
  <div class="hcta">
    <a class="btn-pill" href="#run" onclick="setTimeout(judgeMode,450)">▶ Watch it run itself</a>
    <a class="btn-pill outline" href="#adapt">Make it your business</a>
  </div>
  <div class="hstats">
    <div class="s"><b class="lime" id="h-tools">83</b><span>MCP tools · 16 domains</span></div>
    <div class="s"><b>2</b><span>OKX rails · x402 + X Layer</span></div>
    <div class="s"><b>2</b><span>human gates · both money</span></div>
    <div class="s"><b id="h-tests">41</b><span>tests · live testnet probe</span></div>
  </div>
  <div class="chips" id="chips">
    <span class="chip">service <b id="c-status">checking…</b></span>
    <span class="chip">tools <b id="c-tools">—</b></span>
    <span class="chip">X Layer testnet <b id="c-chain">probing…</b></span>
    <span class="chip">paid calls <b id="c-paid">—</b></span>
    <span class="chip static"><a href="https://github.com/kr8tiv-ai/evolved">github.com/kr8tiv-ai/evolved</a></span>
  </div>
  <svg class="treeline" viewBox="0 0 1440 120" preserveAspectRatio="none" aria-hidden="true">
    <path fill="#000" d="M0,120 L0,74 L28,62 L40,74 L60,48 L74,66 L96,40 L108,60 L120,66 L150,44 L166,64 L190,52 L210,70 L232,40 L248,62 L268,54 L292,30 L308,58 L330,64 L356,46 L372,66 L398,52 L420,72 L444,42 L462,64 L486,56 L510,34 L528,60 L552,66 L580,48 L598,68 L622,54 L648,36 L666,62 L690,58 L714,40 L732,64 L758,52 L784,70 L806,44 L826,64 L850,56 L876,32 L894,60 L918,66 L946,48 L964,68 L988,54 L1014,38 L1032,62 L1058,58 L1084,42 L1102,64 L1128,52 L1154,70 L1178,44 L1198,66 L1222,56 L1248,34 L1266,60 L1290,66 L1318,48 L1338,68 L1362,54 L1388,40 L1408,64 L1428,58 L1440,66 L1440,120 Z"/>
  </svg>
</section>

<div class="tickerwrap"><div class="ticker" id="ticker"><span>booting the books…</span></div></div>

<div class="section" id="run">
  <div class="section-head">
    <div class="kicker">See it work · 60 seconds</div>
    <h2 class="sh">Watch one agent <span class="glow">run a company.</span></h2>
    <p class="sp">Every button below hits the real live service. Nothing is faked; the data is synthetic and restores itself hourly. Start with Judge Mode — one click runs the entire story, hands-free.</p>
  </div>
</div>

<main><div class="grid">

<div class="card wide judge">
  <div class="eyebrow">hands-free · one click</div>
  <h2>▶ <span class="g">Judge Mode</span> — the whole business, autopilot</h2>
  <p class="hint">One click runs the entire story against the live service: the books of a real company → a photo turned into a priced quote → the autonomous lifecycle (holding at both human money gates) → any-business spin-up → the workbook spine → the raw x402 on-chain payment → tomorrow's digest. About 60 seconds. Touch nothing.</p>
  <button id="jm-btn" onclick="judgeMode()">▶ Run the whole story</button>
  <div class="progress"><i id="jm-bar"></i></div>
  <div class="stepline" id="jm-step"></div>
  <div class="out" id="jm-out"></div>
</div>

<div class="card">
  <div class="eyebrow">hands-free field ops</div>
  <h2>🎙️ Talk to the crew radio</h2>
  <p class="hint">Deterministic voice-intent parsing. Try: “used two bags of crushed glass on the Jasper Ave job” · “open the FLHA” · “next stop?” · “remind me to grab couplers today”.</p>
  <input type="text" id="voice-in" value="used two bags of crushed glass on the Jasper Ave job">
  <div><button onclick="voice()">Send voice command</button></div>
  <div class="out" id="voice-out"></div>
</div>

<div class="card">
  <div class="eyebrow">seconds, not site visits</div>
  <h2>📸 Photo-to-quote</h2>
  <p class="hint">A customer texts a driveway photo. The estimator sizes it, the learning rate engine prices it, and a branded draft quote lands in the books with a measure-to-confirm clause.</p>
  <select id="pq-surface"><option>driveway</option><option>sidewalk</option><option>patio</option><option>garage-pad</option><option>exposed-aggregate</option></select>
  <input type="number" id="pq-w" value="20" min="4" max="200" style="width:88px"> ×
  <input type="number" id="pq-l" value="30" min="4" max="400" style="width:88px"> ft
  <div><button onclick="photoQuote()">Price it & draft the quote</button></div>
  <div class="out" id="pq-out"></div>
</div>

<div class="card wide">
  <div class="eyebrow">autonomy with judgment</div>
  <h2>🔄 The autonomous lifecycle — with human money gates</h2>
  <p class="hint">One agent runs lead → quote → e-sign → weather-gated booking → FLHA → work → invoice → on-chain payment → review. It stops twice, both times about money. You are the human — clear the gates.</p>
  <div>
    <button id="lc-start" onclick="lcStart()">1 · Start engagement</button>
    <button id="lc-approve" onclick="lcApprove()" disabled>2 · 🔒 Approve quote & e-sign (human gate)</button>
    <button id="lc-settle" onclick="lcSettle()" disabled>3 · 🔒 Settle on-chain (human gate)</button>
  </div>
  <div class="out" id="lc-out"></div>
</div>

<div class="card" id="onchain">
  <div class="eyebrow">real invoices, real rail</div>
  <h2>Invoice → <span class="g">X Layer testnet</span></h2>
  <p class="hint">A real invoice balance becomes an EIP-681 payment request in test OKB on chainId 1952. Evolved never holds keys — it only verifies settlement by read-only RPC.</p>
  <div>
    <button onclick="payRequest()">Create payment request</button>
    <button class="ghost" onclick="payCheck()" id="pay-check" disabled>Verify settlement (simulated)</button>
  </div>
  <div class="out" id="pay-out"></div>
</div>

<div class="card">
  <div class="eyebrow">the asp earns too</div>
  <h2>🧾 x402 — pay-per-call, live</h2>
  <p class="hint">Watch the raw protocol: no payment → HTTP 402 with an <span class="mono">accepts</span> envelope; present proof → the service answers with a settlement receipt header, and the /stats scoreboard ticks.</p>
  <div><button onclick="x402()">Run the 402 → pay → 200 flow</button></div>
  <div class="out" id="x-out"></div>
</div>

<div class="card">
  <div class="eyebrow">6:30 am, rendered</div>
  <h2>🌅 The morning digest</h2>
  <p class="hint">Not JSON — the actual owner briefing, composed live from the books: the one thing not to drop, money pulse, today's jobs, blast-day weather.</p>
  <div><button onclick="digest()">Compile the briefing</button></div>
  <div class="brief" id="dg"></div>
</div>

<div class="card">
  <div class="eyebrow">the agentic cfo</div>
  <h2>📈 Should I buy a second truck?</h2>
  <p class="hint">A 12-month cash simulation from the live books: capex hole, winter trough, break-even month — drawn from the actual tool output.</p>
  <div><button onclick="cfo()">Run the add-a-truck scenario</button></div>
  <svg class="chart" id="cfo-svg" viewBox="0 0 560 210" preserveAspectRatio="none"></svg>
  <div class="stepline" id="cfo-verdict"></div>
</div>

<div class="card wide">
  <div class="eyebrow">pricing that learns</div>
  <h2>🧠 The rate engine — base market floor vs learned rate</h2>
  <p class="hint">Won jobs at healthy margins teach the engine — and it never stops. Every logged outcome lifts a <b>confidence</b> score, tightens the suggested quote range, and benchmarks the rate against the going <b>market</b> band. Watch what outcome history has already done to driveway pricing.</p>
  <div><button onclick="rates()">Show the learned rates</button></div>
  <div class="bars" id="rate-bars"></div>
</div>

</div></main>

<div class="section" id="adapt">
  <div class="section-head">
    <div class="kicker">Make it yours · one call</div>
    <h2 class="sh">What business are <span class="glow">you</span> running?</h2>
    <p class="sp">Evolved is a toolkit, not a one-off. Pick a trade and preview exactly what <span class="mono">franchise_spinup</span> installs — the rate card into the quoting engine, the trade's hazards into every JHA, empty books, the full machine. Adding your own is one entry in <span class="mono">src/trades.ts</span>; <span class="mono">brand_configure</span> makes every rendered quote feel like your company. Read-only and safe to click here.</p>
  </div>
  <div class="trades">
    <div class="trade" onclick="packPreview('pressure-washing')">
      <div class="num">01</div><div class="tag2">Pressure washing</div>
      <h3>I wash <span class="g">driveways &amp; siding.</span></h3>
      <p>Rinse to strip-wash, priced per sqft. Wand-injection, slip, and ladder hazards in every JHA.</p>
      <div class="go">Preview the pack</div>
    </div>
    <div class="trade" onclick="packPreview('line-painting')">
      <div class="num">02</div><div class="tag2">Line painting</div>
      <h3>I stripe <span class="g">parking lots.</span></h3>
      <p>Re-stripe to full layout, per sqft. Live-traffic, fume, and heat-stress hazards baked in.</p>
      <div class="go">Preview the pack</div>
    </div>
    <div class="trade" onclick="packPreview('mobile-detailing')">
      <div class="num">03</div><div class="tag2">Mobile detailing</div>
      <h3>I detail <span class="g">cars &amp; fleets.</span></h3>
      <p>Express to full restoration, per unit. Chemical-exposure and customer-property hazards.</p>
      <div class="go">Preview the pack</div>
    </div>
    <div class="trade" onclick="document.getElementById('fp-out').scrollIntoView({behavior:'smooth',block:'center'}); packPreview('pressure-washing')">
      <div class="num">04</div><div class="tag2">Your trade</div>
      <h3>I run <span class="g">something else.</span></h3>
      <p>~30 lines in one file: your rate card + hazards. Then it is your OS — quoting, dispatch, payroll, on-chain invoicing.</p>
      <div class="go">See how</div>
    </div>
  </div>
</div>

<main><div class="grid">

<div class="card wide">
  <div class="eyebrow">the toolkit story — try it</div>
  <h2>What <span class="g">franchise_spinup</span> installs</h2>
  <p class="hint">Pick a trade above, or here, and preview exactly what re-seeds — rate card, depth labels, trade-specific hazards. The server also speaks the whole MCP spec: <b style="color:#cdd3cd">resources</b> (rate table, hazard library, trade packs) and <b style="color:#cdd3cd">prompts</b>, not just tools. Guide: <a href="https://github.com/kr8tiv-ai/evolved/blob/main/docs/ADAPT.md">docs/ADAPT.md</a> · <a href="https://github.com/kr8tiv-ai/evolved/blob/main/SECURITY.md">SECURITY.md</a></p>
  <div>
    <select id="fp-pack"><option value="pressure-washing">pressure washing</option><option value="line-painting">parking lot line painting</option><option value="mobile-detailing">mobile auto detailing</option></select>
    <button onclick="packPreview()">Preview the pack</button>
  </div>
  <div class="out" id="fp-out"></div>
</div>

<div class="card">
  <div class="eyebrow">your books, your sheet</div>
  <h2>The workbook <span class="g">spine</span></h2>
  <p class="hint">The whole OS renders as a real operations workbook — every collection a tab. With a Google service account (<span class="mono">EVOLVED_GOOGLE_SA</span>) it creates, shares, and syncs an actual Google Sheets workbook; with zero credentials it exports the identical 20 tabs as CSV. Watch it write the spine live:</p>
  <div><button onclick="workbook()">Export the workbook</button></div>
  <div class="out" id="wb-out"></div>
</div>

<div class="card">
  <div class="eyebrow">done work → next work</div>
  <h2>Scorecard &amp; <span class="g">reputation</span></h2>
  <p class="hint">The Job P&amp;L scorecard (quoted vs actual, win rate, overall margin) plus the reputation ledger — reviews earned, response rate, and the testimonial bank ready for a website.</p>
  <div><button onclick="scorecard()">Run the scorecard</button></div>
  <div class="out" id="sc-out"></div>
</div>

<div class="card wide"><div class="cfg">
  <div>
    <div class="eyebrow">power users</div>
    <h2>Point your own agent at it</h2>
    <p class="hint">Claude Desktop / Claude Code / any MCP client — the live Streamable HTTP endpoint:</p>
<pre class="copy mono">{ "mcpServers": { "evolved": {
    "type": "http",
    "url": "https://powderblue-leopard-801168.hostingersite.com/mcp"
} } }</pre>
  </div>
  <div>
    <div class="eyebrow">the full 83-tool surface</div>
    <h2>Or run it locally</h2>
    <p class="hint">Zero credentials; 41 tests including a live testnet probe:</p>
<pre class="copy mono">git clone https://github.com/kr8tiv-ai/evolved.git
cd evolved && npm install && npm run build
npm test && npm run demo</pre>
  </div>
</div></div>

</div></main>

<footer>
  OKX AI GENESIS HACKATHON · MCP AGENTIC SERVICE PROVIDER · X LAYER TESTNET 1952 ·
  <a href="https://github.com/kr8tiv-ai/evolved">SOURCE</a> ·
  <a href="/health">HEALTH</a> · <a href="/stats">STATS</a> ·
  BUILT FROM THE LIVE OPS SYSTEM OF <a href="https://www.evolveecoblasting.com">EVOLVE ECO BLASTING</a>
</footer>

<script>
var $ = function(id){ return document.getElementById(id); };
function esc(s){ return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;"); }
function hl(obj){
  var s = typeof obj === "string" ? obj : JSON.stringify(obj, null, 2);
  s = esc(s);
  s = s.replace(/"([^"]+)":/g, '"<span class=jk>$1</span>":');
  s = s.replace(/: "((?:[^"\\\\]|\\\\.)*)"/g, ': "<span class=js>$1</span>"');
  s = s.replace(/: (-?[0-9][0-9.]*)/g, ': <span class=jn>$1</span>');
  s = s.replace(/: (true|false|null)/g, ': <span class=jb>$1</span>');
  return s;
}
function show(id, obj, label){
  var el = $(id);
  el.innerHTML += (label ? '<span class="step">' + esc(label) + '</span>\\n' : '') + hl(obj) + '\\n\\n';
  el.scrollTop = el.scrollHeight;
}
function clearOut(id){ $(id).innerHTML = ""; }
function sleep(ms){ return new Promise(function(r){ setTimeout(r, ms); }); }
async function call(tool, args){
  var r = await fetch("/demo/call", { method:"POST",
    headers:{ "content-type":"application/json" },
    body: JSON.stringify({ tool: tool, args: args || {} }) });
  var j = await r.json();
  if (!r.ok) throw new Error(j.error || ("HTTP " + r.status));
  return j.result;
}

/* ---------- ticker ---------- */
async function ticker(){
  try {
    var snap = await call("business_snapshot", {});
    var stats = await (await fetch("/stats")).json();
    var parts = [
      "<span>RECEIVABLES <i>$" + Number(snap.money.receivables).toLocaleString() + "</i></span>",
      "<span>QUOTES OUT <b>" + snap.funnel.quotesOut + "</b></span>",
      "<span>JOBS BOOKED <b>" + snap.funnel.jobsBooked + "</b></span>",
      "<span>NEW LEADS <b>" + snap.funnel.newLeads + "</b></span>",
      "<span>RECEIPTS ON FILE <b>" + snap.money.receiptsOnFile + "</b></span>",
      "<span>FLHA AWAITING SIGN-OFF <b>" + snap.safety.awaitingSignoff + "</b></span>",
      "<span>PAID API CALLS <i>" + stats.paidApiCalls + "</i></span>",
      "<span>ON-CHAIN SETTLEMENTS <i>" + stats.invoicePaymentsSettled + "</i></span>",
      "<span>MODE <b>" + esc(stats.mode.split(" ")[0].toUpperCase()) + "</b></span>"
    ].join("·");
    $("ticker").innerHTML = parts + "·" + parts; // duplicate for seamless loop
    $("c-paid").textContent = stats.paidApiCalls;
  } catch(e) { /* ticker is decoration; never noisy */ }
}

/* ---------- cards ---------- */
async function voice(){
  clearOut("voice-out");
  var u = $("voice-in").value;
  show("voice-out", "→ voice_command: “" + u + "”");
  try {
    var r = await call("voice_command", { utterance: u, speaker: "Playground" });
    show("voice-out", "🗣 " + (r.reply || ""), "reply");
    show("voice-out", r.intent, "parsed intent");
    if (r.action) show("voice-out", r.action, "action taken");
  } catch(e){ show("voice-out", "✖ " + e.message); }
}
async function photoQuote(){
  clearOut("pq-out");
  var args = { surface: $("pq-surface").value,
    approxWidthFt: Number($("pq-w").value), approxLengthFt: Number($("pq-l").value),
    customerName: "Playground Lead " + new Date().toISOString().slice(11,19),
    siteAddress: "Playground demo site" };
  show("pq-out", "→ quote_from_photo (" + args.surface + ", " + args.approxWidthFt + "×" + args.approxLengthFt + " ft)");
  try {
    var r = await call("quote_from_photo", args);
    show("pq-out", r.estimate, "estimate");
    show("pq-out", { id: r.quote.id, subtotal: r.quote.subtotal, gst: r.quote.gst,
      total: r.quote.total, deposit: r.quote.depositRequired, validUntil: r.quote.validUntil }, "quote (in the books)");
    show("pq-out", r.advisory || "", "margin verdict");
  } catch(e){ show("pq-out", "✖ " + e.message); }
}
var LC = null;
async function lcStart(outId){
  var out = outId || "lc-out"; clearOut(out); $("lc-start").disabled = true;
  show(out, "→ lifecycle_start { 520 sqft sidewalk, light blast, moderate access }");
  try {
    var r = await call("lifecycle_start", { customerName: "Playground Client " + (Date.now()%100000),
      siteAddress: "9922 82 Ave, Edmonton", summary: "Entrance concrete refresh",
      surface: "sidewalk", sqft: 520, depth: "light", access: "moderate" });
    LC = r.lifecycle.id;
    show(out, { quote: r.quote.id, total: r.quote.total, marginPct: r.quote.profitability.marginPct }, "quoted");
    show(out, "🔒 GATE — " + r.lifecycle.gates[0].reason);
    $("lc-approve").disabled = false;
    return r;
  } catch(e){ show(out, "✖ " + e.message); $("lc-start").disabled = false; throw e; }
}
async function lcApprove(outId){
  var out = outId || "lc-out"; $("lc-approve").disabled = true;
  show(out, "→ lifecycle_advance { approveQuote: true, esignSigner: 'Playground Judge' }");
  try {
    var r = await call("lifecycle_advance", { lifecycleId: LC, approveQuote: true, esignSigner: "Playground Judge" });
    for (var i=0;i<r.log.length;i++) show(out, "◆ " + r.log[i].step + " — " + r.log[i].detail);
    show(out, "🔒 GATE — settlement must be confirmed (txHash on X Layer testnet, or simulated here).");
    $("lc-settle").disabled = false;
    return r;
  } catch(e){ show(out, "✖ " + e.message); $("lc-approve").disabled = false; throw e; }
}
async function lcSettle(outId){
  var out = outId || "lc-out"; $("lc-settle").disabled = true;
  show(out, "→ lifecycle_advance { simulatePayment: true }");
  try {
    var r = await call("lifecycle_advance", { lifecycleId: LC, simulatePayment: true });
    var tail = r.log.slice(-3);
    for (var i=0;i<tail.length;i++) show(out, "◆ " + tail[i].step + " — " + tail[i].detail);
    show(out, "✔ CLOSED — lead to paid, one agent, two human money gates. The rate engine just got smarter.");
    $("lc-start").disabled = false;
    ticker();
    return r;
  } catch(e){ show(out, "✖ " + e.message); $("lc-settle").disabled = false; throw e; }
}
var PAY = null;
async function payRequest(){
  clearOut("pay-out");
  show("pay-out", "→ invoice_payment_request { invoiceId: 'ECO-INV-9002' }");
  try {
    var r = await call("invoice_payment_request", { invoiceId: "ECO-INV-9002" });
    PAY = r.payment.id; $("pay-check").disabled = false;
    show("pay-out", { network: r.payment.network, chainId: r.payment.chainId,
      amount: r.payment.amountAsset + " " + r.payment.asset.symbol + " (= $" + r.payment.amountCad + " CAD)",
      payTo: r.payment.payTo, uri: r.payment.uri }, "payment request (EIP-681)");
  } catch(e){
    show("pay-out", "✖ " + e.message + " — the seeded invoice may already be settled; hit Judge Mode's reset or wait for the hourly restore.");
  }
}
async function payCheck(){
  show("pay-out", "→ invoice_payment_check { simulate: true }   (live mode verifies a real txHash by RPC)");
  try {
    var r = await call("invoice_payment_check", { paymentId: PAY, simulate: true });
    show("pay-out", r.verification, "settlement");
    show("pay-out", { invoice: r.payment.invoiceId, status: r.payment.status, mode: r.payment.mode }, "books updated");
    ticker();
  } catch(e){ show("pay-out", "✖ " + e.message); }
}
async function x402(outId){
  var out = outId || "x-out"; clearOut(out);
  var body = JSON.stringify({ jsonrpc:"2.0", id:1, method:"initialize",
    params:{ protocolVersion:"2025-03-26", capabilities:{}, clientInfo:{ name:"playground", version:"1" } } });
  var hdrs = { "content-type":"application/json", accept:"application/json, text/event-stream" };
  show(out, "→ POST /mcp-paid   (no payment)");
  var r1 = await fetch("/mcp-paid", { method:"POST", headers:hdrs, body:body });
  var env = await r1.json();
  show(out, "HTTP " + r1.status + " Payment Required", "challenge");
  show(out, env.accepts ? env.accepts[0] : env, "accepts[0]");
  show(out, '→ POST /mcp-paid   with  X-PAYMENT: {"simulated":true}');
  var h2 = { "content-type":"application/json", accept:"application/json, text/event-stream", "X-PAYMENT": JSON.stringify({ simulated:true }) };
  var r2 = await fetch("/mcp-paid", { method:"POST", headers:h2, body:body });
  var receipt = r2.headers.get("x-payment-response");
  show(out, "HTTP " + r2.status, "paid call");
  if (receipt) show(out, JSON.parse(atob(receipt)), "X-PAYMENT-RESPONSE (settlement receipt)");
  var text = await r2.text();
  var m = text.match(/"serverInfo":\\s*({[^}]+})/);
  show(out, m ? JSON.parse(m[1]) : text.slice(0, 240), "the service, unlocked");
  ticker();
}

/* ---------- rendered digest ---------- */
async function digest(){
  var el = $("dg"); el.className = "brief on"; el.innerHTML = '<div class="stepline">compiling from the books…</div>';
  try {
    var d = await call("morning_digest", {});
    var h = "";
    h += '<div class="callout"><b>THE ONE THING NOT TO DROP</b>' + esc(d.oneThingNotToDrop) + '</div>';
    h += '<div class="pills">' +
      '<div class="pill good"><b>$' + Number(d.moneyPulse.monthRevenue).toLocaleString() + '</b>revenue MTD</div>' +
      '<div class="pill"><b>$' + Number(d.moneyPulse.monthExpenses).toLocaleString() + '</b>expenses MTD</div>' +
      '<div class="pill hot"><b>$' + Number(d.moneyPulse.outstandingTotal).toLocaleString() + '</b>receivables (' + d.moneyPulse.outstandingInvoices + ')</div>' +
      '<div class="pill"><b>' + d.actionItems.length + '</b>action items</div></div>';
    if (d.todaysJobs.length) {
      h += '<ul class="list">';
      for (var i=0;i<Math.min(3,d.todaysJobs.length);i++) h += "<li>" + esc(d.todaysJobs[i]) + "</li>";
      h += "</ul>";
    }
    if (d.quotesOut.length) {
      h += '<ul class="list">';
      for (var q=0;q<Math.min(3,d.quotesOut.length);q++) h += "<li>" + esc(d.quotesOut[q]) + "</li>";
      h += "</ul>";
    }
    h += '<div class="wx">';
    for (var w=0;w<d.weather.lines.length;w++) {
      var line = d.weather.lines[w];
      var cls = line.indexOf("Good") >= 0 ? "go" : (line.indexOf("Marginal") >= 0 ? "mid" : "no");
      h += '<span class="' + cls + '">' + esc(line.split(" — ")[0].replace("2026-","")) + "</span>";
    }
    h += "</div>";
    el.innerHTML = h;
  } catch(e){ el.innerHTML = '<div class="stepline">✖ ' + esc(e.message) + "</div>"; }
}

/* ---------- cfo chart ---------- */
async function cfo(){
  $("cfo-verdict").textContent = "simulating 12 months…";
  try {
    var f = await call("cfo_forecast", { scenario: "add-truck" });
    var months = f.months, W = 560, H = 210, P = 26;
    var vals = months.map(function(m){ return m.cumulative; });
    var min = Math.min.apply(null, vals.concat([0])), max = Math.max.apply(null, vals.concat([0]));
    var x = function(i){ return P + i * ((W - 2*P) / 11); };
    var y = function(v){ return H - P - ((v - min) / (max - min || 1)) * (H - 2*P); };
    var svg = "";
    svg += '<line x1="' + P + '" y1="' + y(0) + '" x2="' + (W-P) + '" y2="' + y(0) + '" stroke="#1f2937" stroke-width="1"/>';
    svg += '<text x="' + (P+2) + '" y="' + (y(0)-5) + '" fill="#6b7280" font-size="10" font-family="monospace">$0</text>';
    var pts = months.map(function(m,i){ return x(i) + "," + y(m.cumulative); }).join(" ");
    svg += '<polyline points="' + pts + '" fill="none" stroke="#4ade80" stroke-width="2.5"/>';
    var area = P + "," + y(0) + " " + pts + " " + (W-P) + "," + y(0);
    svg += '<polygon points="' + area + '" fill="rgba(74,222,128,0.09)"/>';
    for (var i=0;i<months.length;i++) {
      var m = months[i];
      svg += '<circle cx="' + x(i) + '" cy="' + y(m.cumulative) + '" r="3" fill="' + (m.cumulative >= 0 ? "#39ff14" : "#f87171") + '"/>';
      if (i % 2 === 0) svg += '<text x="' + x(i) + '" y="' + (H-8) + '" fill="#6b7280" font-size="9.5" text-anchor="middle" font-family="monospace">M' + m.month + "</text>";
    }
    if (f.breakEvenMonth) {
      svg += '<line x1="' + x(f.breakEvenMonth-1) + '" y1="' + P + '" x2="' + x(f.breakEvenMonth-1) + '" y2="' + (H-P) + '" stroke="#39ff14" stroke-dasharray="4 4" stroke-width="1.2"/>';
      svg += '<text x="' + x(f.breakEvenMonth-1) + '" y="' + (P-6) + '" fill="#39ff14" font-size="10" text-anchor="middle" font-family="monospace">break-even M' + f.breakEvenMonth + "</text>";
    }
    var el = $("cfo-svg"); el.innerHTML = svg; el.className = "chart on";
    $("cfo-verdict").textContent = f.verdict;
  } catch(e){ $("cfo-verdict").textContent = "✖ " + e.message; }
}

/* ---------- rate bars ---------- */
async function rates(){
  var el = $("rate-bars"); el.className = "bars on"; el.innerHTML = '<div class="stepline">reading the rate engine…</div>';
  try {
    var r = await call("pricing_rates", { surface: "driveway" });
    var maxRate = 0;
    r.rates.forEach(function(x){ maxRate = Math.max(maxRate, x.effectiveRate, x.baseRate); });
    var h = "";
    r.rates.forEach(function(x){
      var bw = Math.round((x.baseRate / maxRate) * 100), ew = Math.round((x.effectiveRate / maxRate) * 100);
      var learned = x.effectiveRate > x.baseRate;
      var conf = Math.round((x.confidence || 0) * 100);
      var mkt = x.market ? x.market.position : "";
      var typ = x.market ? x.market.typical.toFixed(2) : "—";
      var rng = x.suggestedRange ? ("$" + x.suggestedRange[0].toFixed(2) + "–$" + x.suggestedRange[1].toFixed(2)) : "—";
      var mcol = mkt === "above-market" ? "#fbbf24" : mkt === "below-market" ? "#22d3ee" : "#4ade80";
      h += '<div class="bar"><div class="lbl"><span>' + esc(x.label) + '</span><span><b>$' + x.effectiveRate.toFixed(2) + '</b> /sqft' +
           (learned ? ' <span style="color:#39ff14">▲ learned (base $' + x.baseRate.toFixed(2) + ')</span>' : " (base)") + "</span></div>" +
           '<div class="track"><i style="width:' + bw + '%"></i></div>' +
           '<div class="track" style="margin-top:3px"><i class="learned" data-w="' + ew + '"></i></div>' +
           '<div class="stepline" style="margin-top:4px">confidence ' + conf + '% · <span style="color:' + mcol + '">' + esc(mkt || "—") + '</span> vs market typ $' + typ + ' · suggested ' + rng + '</div>' +
           '</div>';
    });
    h += '<div class="stepline" style="margin-top:8px">driveway filter · silver = market floor · green = learned from won jobs (never below base) · confidence climbs with every logged job · each rate benchmarked to its market band · see pricing_learning_status &amp; market_benchmark</div>';
    el.innerHTML = h;
    await sleep(60);
    var greens = el.querySelectorAll("i.learned");
    for (var g=0; g<greens.length; g++) greens[g].style.width = greens[g].getAttribute("data-w") + "%";
  } catch(e){ el.innerHTML = '<div class="stepline">✖ ' + esc(e.message) + "</div>"; }
}

/* ---------- v3 cards: toolkit preview, workbook spine, scorecard ---------- */
async function packPreview(preset){
  clearOut("fp-out");
  var key = preset || $("fp-pack").value;
  if (preset) { try { $("fp-pack").value = preset; } catch(e){} }
  show("fp-out", "→ franchise_preview { tradePack: \\"" + key + "\\" } — read-only");
  try {
    var r = await call("franchise_preview", { tradePack: key });
    show("fp-out", r.pack, "the pack");
    show("fp-out", r.rateCard, "rate card → the quoting engine");
    show("fp-out", r.tradeHazards.map(function(h){ return h.hazard + " (" + h.risk + ")"; }), "hazards → every FLHA");
    show("fp-out", r.applyWith, "apply for real with");
  } catch(e){ show("fp-out", "✖ " + e.message); }
}
async function workbook(){
  clearOut("wb-out");
  show("wb-out", "→ workbook_export — rendering the whole OS as tabs…");
  try {
    var r = await call("workbook_export", {});
    show("wb-out", r.summary, "workbook");
    show("wb-out", r.files, r.files.length + " tabs written (CSV; Google Sheets when credentialed)");
  } catch(e){ show("wb-out", "✖ " + e.message); }
}
async function scorecard(){
  clearOut("sc-out");
  show("sc-out", "→ job_pnl_report + reputation_report");
  try {
    var p = await call("job_pnl_report", {});
    show("sc-out", p.scorecard, "the scorecard");
    var rep = await call("reputation_report", {});
    show("sc-out", { averageRating: rep.averageRating, responseRate: rep.responseRate, fiveStarShare: rep.fiveStarShare }, "reputation ledger");
    if (rep.testimonialBank && rep.testimonialBank.length) show("sc-out", "“" + rep.testimonialBank[0].quote + "”", "from the testimonial bank");
  } catch(e){ show("sc-out", "✖ " + e.message); }
}

/* ---------- judge mode autopilot ---------- */
var jmRunning = false;
function jmProgress(pct, label){ $("jm-bar").style.width = pct + "%"; $("jm-step").textContent = label; }
async function judgeMode(){
  if (jmRunning) return;
  jmRunning = true; $("jm-btn").disabled = true; clearOut("jm-out");
  var out = "jm-out";
  try {
    jmProgress(4, "ACT 0 · PROVE IT'S ALIVE");
    var h = await (await fetch("/health")).json();
    show(out, { service: h.service, version: h.version, tools: h.tools }, "GET /health");
    var s = await call("xlayer_status", {});
    show(out, s.rpcProbe, "live X Layer testnet probe (read-only RPC)");
    await sleep(700);

    jmProgress(14, "ACT 1 · THE BOOKS OF A REAL BUSINESS");
    var snap = await call("business_snapshot", {});
    show(out, snap, "business_snapshot");
    await sleep(700);

    jmProgress(26, "ACT 2 · PHOTO → PRICED QUOTE IN SECONDS");
    var pq = await call("quote_from_photo", { surface: "driveway", approxWidthFt: 22, approxLengthFt: 30,
      customerName: "Judge Mode Lead " + (Date.now()%100000), siteAddress: "Judge Mode Ave" });
    show(out, { sqft: pq.estimate.sqft, depth: pq.estimate.depth, quote: pq.quote.id,
      total: pq.quote.total, verdict: pq.quote.profitability.verdict }, "quote_from_photo → " + pq.quote.id);
    await sleep(800);

    jmProgress(38, "ACT 3 · THE AUTONOMOUS LIFECYCLE BEGINS");
    var st = await call("lifecycle_start", { customerName: "Judge Mode Client " + (Date.now()%100000),
      siteAddress: "9922 82 Ave, Edmonton", summary: "Entrance concrete refresh",
      surface: "sidewalk", sqft: 520, depth: "light", access: "moderate" });
    show(out, { quote: st.quote.id, total: st.quote.total, marginPct: st.quote.profitability.marginPct }, "lifecycle_start — quoted");
    show(out, "🔒 HOLDING AT THE FIRST HUMAN MONEY GATE — the agent will not send a quote without the owner.");
    jmProgress(46, "🔒 HUMAN GATE 1 · approving the quote…");
    await sleep(1800);

    jmProgress(58, "ACT 4 · E-SIGN → WEATHER → FLHA → WORK → INVOICE");
    var adv = await call("lifecycle_advance", { lifecycleId: st.lifecycle.id, approveQuote: true, esignSigner: "The Judge" });
    for (var i=0;i<adv.log.length;i++){ show(out, "◆ " + adv.log[i].step + " — " + adv.log[i].detail); await sleep(320); }
    show(out, "🔒 HOLDING AT THE SECOND HUMAN MONEY GATE — settlement must be confirmed by a human.");
    jmProgress(70, "🔒 HUMAN GATE 2 · confirming settlement…");
    await sleep(1800);

    jmProgress(74, "ACT 5 · PAID ON-CHAIN, ENGINE TAUGHT");
    var fin = await call("lifecycle_advance", { lifecycleId: st.lifecycle.id, simulatePayment: true });
    var tail = fin.log.slice(-3);
    for (var t=0;t<tail.length;t++){ show(out, "◆ " + tail[t].step + " — " + tail[t].detail); await sleep(300); }
    await sleep(500);

    jmProgress(82, "ACT 6 · ANY BUSINESS, ONE CALL");
    var pk = await call("franchise_preview", { tradePack: "pressure-washing" });
    show(out, "🧰 " + pk.pack.trade + " — " + pk.rateCard.length + " rates, " + pk.tradeHazards.length + " trade hazards, one call to install", "franchise_preview (read-only)");
    var wb = await call("workbook_export", {});
    show(out, "📗 " + wb.summary, "workbook_export — the whole OS as a real workbook (Google Sheets when credentialed)");
    await sleep(700);

    jmProgress(92, "ACT 7 · THE ASP EARNS TOO — RAW x402");
    await x402(out);
    await sleep(600);

    jmProgress(100, "CLOSE · NOTHING DROPPED");
    var dg = await call("morning_digest", {});
    show(out, "🌅 " + dg.oneThingNotToDrop, "tomorrow's digest — the one thing not to drop");
    show(out, "✔ THE WHOLE STORY: a real company's books, a photo turned into money, an autonomous engagement with humans owning the money decisions, any trade installable in one call, the whole OS on a workbook spine, and an agent service that itself gets paid on-chain. 83 tools. Open source. Try any card above yourself.");
    ticker();
  } catch(e){ show(out, "✖ " + e.message + " — cards above still work individually."); }
  jmRunning = false; $("jm-btn").disabled = false;
}

/* ---------- cinematic aurora backdrop (canvas) ---------- */
function initAurora(){
  var cv = document.getElementById("aurora");
  if (!cv) return;
  var ctx = cv.getContext("2d");
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var W=0, H=0, dpr = Math.min(window.devicePixelRatio || 1, 1.6);
  function resize(){
    W = window.innerWidth; H = window.innerHeight;
    cv.width = W*dpr; cv.height = H*dpr; cv.style.width = W+"px"; cv.style.height = H+"px";
    ctx.setTransform(dpr,0,0,dpr,0,0);
  }
  resize(); window.addEventListener("resize", resize);
  // aurora bands + fog + rising embers
  var bands = [
    { col:"74,222,128",  amp:70, yy:0.30, wl:0.0016, sp:0.00022, th:150, a:0.20 },
    { col:"34,211,238",  amp:52, yy:0.22, wl:0.0022, sp:-0.00017, th:90,  a:0.15 },
    { col:"57,255,20",   amp:90, yy:0.42, wl:0.0012, sp:0.00013, th:120, a:0.13 }
  ];
  var fog = [];
  for (var i=0;i<5;i++) fog.push({ x:Math.random(), y:Math.random()*0.6, r:200+Math.random()*260, sp:0.00002+Math.random()*0.00004, ph:Math.random()*6.28 });
  var embers = [];
  for (var j=0;j<44;j++) embers.push({ x:Math.random(), y:Math.random(), r:0.5+Math.random()*1.6, sp:0.00004+Math.random()*0.00010, tw:Math.random()*6.28, hue:Math.random()<0.7 });
  function frame(t){
    ctx.clearRect(0,0,W,H);
    // deep base glow at top
    var g0 = ctx.createRadialGradient(W*0.5,-H*0.15,0, W*0.5,-H*0.15, H*1.05);
    g0.addColorStop(0,"rgba(16,42,26,0.55)"); g0.addColorStop(0.5,"rgba(6,12,8,0.6)"); g0.addColorStop(1,"rgba(0,0,0,0)");
    ctx.fillStyle=g0; ctx.fillRect(0,0,W,H);
    // drifting fog blobs
    for (var f=0; f<fog.length; f++){
      var fo=fog[f]; var fx=(fo.x + Math.sin(t*fo.sp+fo.ph)*0.12)*W; var fy=fo.y*H + Math.cos(t*fo.sp*0.7+fo.ph)*40;
      var gg=ctx.createRadialGradient(fx,fy,0,fx,fy,fo.r);
      gg.addColorStop(0,"rgba(40,70,52,0.10)"); gg.addColorStop(1,"rgba(0,0,0,0)");
      ctx.fillStyle=gg; ctx.beginPath(); ctx.arc(fx,fy,fo.r,0,6.2832); ctx.fill();
    }
    // aurora bands
    for (var b=0; b<bands.length; b++){
      var bd=bands[b]; var baseY=bd.yy*H;
      var grad=ctx.createLinearGradient(0,baseY-bd.th,0,baseY+bd.th);
      grad.addColorStop(0,"rgba("+bd.col+",0)");
      grad.addColorStop(0.5,"rgba("+bd.col+","+bd.a+")");
      grad.addColorStop(1,"rgba("+bd.col+",0)");
      ctx.beginPath(); ctx.moveTo(0,H);
      for (var x=0; x<=W; x+=14){
        var y = baseY + Math.sin(x*bd.wl + t*bd.sp*1000)*bd.amp + Math.sin(x*bd.wl*2.3 + t*bd.sp*640)*bd.amp*0.35;
        ctx.lineTo(x,y);
      }
      ctx.lineTo(W,0); ctx.lineTo(0,0); ctx.closePath();
      ctx.fillStyle=grad; ctx.globalCompositeOperation="screen"; ctx.fill(); ctx.globalCompositeOperation="source-over";
    }
    // rising embers
    ctx.globalCompositeOperation="screen";
    for (var e=0; e<embers.length; e++){
      var em=embers[e]; em.y -= em.sp* (reduce?0:16); if (em.y<-0.02){ em.y=1.02; em.x=Math.random(); }
      var ex=em.x*W + Math.sin(t*0.0004+em.tw)*10; var ey=em.y*H;
      var tw=0.4+0.6*Math.abs(Math.sin(t*0.001+em.tw));
      ctx.fillStyle = em.hue ? "rgba(74,222,128,"+(0.5*tw)+")" : "rgba(226,240,226,"+(0.4*tw)+")";
      ctx.beginPath(); ctx.arc(ex,ey,em.r,0,6.2832); ctx.fill();
    }
    ctx.globalCompositeOperation="source-over";
  }
  if (reduce){ frame(0); return; }
  var running=true;
  document.addEventListener("visibilitychange", function(){ running=!document.hidden; if(running) requestAnimationFrame(loop); });
  function loop(t){ if(!running) return; frame(t); requestAnimationFrame(loop); }
  requestAnimationFrame(loop);
}

/* ---------- nav solidify on scroll ---------- */
function initNav(){
  var nav=document.getElementById("nav");
  function onScroll(){ if (window.scrollY>60) nav.classList.add("solid"); else nav.classList.remove("solid"); }
  window.addEventListener("scroll", onScroll, { passive:true }); onScroll();
}

/* ---------- boot ---------- */
(async function(){
  initAurora(); initNav();
  try {
    var h = await (await fetch("/health")).json();
    $("c-status").textContent = "live · v" + h.version;
    $("c-tools").textContent = h.tools;
    var ht=$("h-tools"); if(ht) ht.textContent = h.tools;
  } catch(e){ $("c-status").textContent = "unreachable"; }
  try {
    var s = await call("xlayer_status", {});
    $("c-chain").textContent = s.rpcProbe.reachable ? ("chain " + s.rpcProbe.chainId + " · block " + s.rpcProbe.blockNumber) : "rpc offline (fails closed)";
  } catch(e){ $("c-chain").textContent = "—"; }
  ticker();
  setInterval(ticker, 90000);
})();
</script>
</body></html>`;

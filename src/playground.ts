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
<title>Evolved — business-in-a-box, run by an AI, paid on-chain</title>
<meta name="description" content="A real company's operations brain as an autonomous MCP agent — run it live: voice, photo-to-quote, the full lifecycle with human money gates, and x402 on-chain payments on X Layer testnet.">
<link rel="canonical" href="https://www.evolvedmcp.cloud/">
<meta name="theme-color" content="#0a0a0a">
<!-- Open Graph -->
<meta property="og:type" content="website">
<meta property="og:site_name" content="Evolved">
<meta property="og:title" content="Evolved — business-in-a-box, run by an AI, paid on-chain">
<meta property="og:description" content="A real Alberta company's operations brain, live as an MCP Agentic Service Provider. 83 tools across 16 domains — quoting that learns, receipts to books, FLHA safety, dispatch, invoicing, and x402 + on-chain settlement on OKX X Layer. Any service business, spun up in one call. Try it live, zero install.">
<meta property="og:url" content="https://www.evolvedmcp.cloud/">
<meta property="og:image" content="https://www.evolvedmcp.cloud/og.png">
<meta property="og:image:secure_url" content="https://www.evolvedmcp.cloud/og.png">
<meta property="og:image:type" content="image/png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="EVOLVED — business-in-a-box, run by an AI, paid on-chain, over a boreal aurora">
<!-- Twitter / X Card -->
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:site" content="@aurora_ventures">
<meta name="twitter:creator" content="@aurora_ventures">
<meta name="twitter:title" content="Evolved — business-in-a-box, run by an AI, paid on-chain">
<meta name="twitter:description" content="A real Alberta company's operations brain, live as an MCP Agentic Service Provider. 83 tools, x402 + on-chain settlement on OKX X Layer testnet. Any service business, one call. Try it live.">
<meta name="twitter:image" content="https://www.evolvedmcp.cloud/og.png">
<meta name="twitter:image:alt" content="EVOLVED — business-in-a-box, run by an AI, paid on-chain">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Archivo:wght@500;600;700;800;900&family=JetBrains+Mono:wght@400;700&display=swap" rel="stylesheet">
<style>
  :root { --void:#080a08; --deep:#040504; --panel:#0e100e; --panel2:#0b0d0b; --line:#1c2620;
          --silver:#f3f4f6; --dim:#9aa39a; --dim2:#6b746b; --aurora:#4ade80; --lime:#39ff14; --ice:#22d3ee; }
  * { box-sizing:border-box; margin:0; }
  html { scroll-behavior:smooth; overflow-x:hidden; max-width:100%; }
  body { background:#000; color:var(--silver); font-family:"Archivo",system-ui,sans-serif;
         font-size:15px; line-height:1.55; min-height:100vh;
         width:100%; max-width:100%; overflow-x:hidden; position:relative;
         -webkit-font-smoothing:antialiased; }
  /* nothing may exceed the viewport width — hard cap on every structural block */
  main, .section, .hero, .hero-inner, .tickerwrap, footer, nav { max-width:100%; }
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
  nav .cta { background:var(--lime); color:#000 !important; padding:10px 20px; border-radius:3px; font-weight:800;
             font-size:12px; letter-spacing:.1em; text-transform:uppercase; box-shadow:0 0 22px rgba(57,255,20,.35); }
  @media (max-width:820px){ nav .nlinks a:not(.cta){ display:none } nav{padding:14px 18px} }

  /* hero — real site footage under a cinematic shade */
  .hero { position:relative; min-height:100vh; display:flex; flex-direction:column; justify-content:center;
          padding:120px 0 90px; }
  .hero-inner { position:relative; z-index:3; max-width:1180px; margin:0 auto; padding:0 26px; width:100%;
                will-change:transform, opacity; }
  .herowrap { position:absolute; inset:0; overflow:hidden; z-index:0; }
  .herovid { position:absolute; inset:0; width:100%; height:100%; object-fit:cover;
             filter:brightness(.52) saturate(1.15) contrast(1.05); will-change:transform; }
  .heroshade { position:absolute; inset:0; z-index:1;
    background:linear-gradient(180deg, rgba(0,0,0,.62) 0%, rgba(0,0,0,.28) 34%, rgba(0,0,0,.45) 68%, #000 100%),
               radial-gradient(90% 60% at 28% 46%, rgba(0,0,0,.28), transparent 70%); }

  /* reveal-on-scroll (GSAP-grade easing, zero deps) — vertical + directional */
  .rv { opacity:0; transform:translateY(34px); transition:opacity .85s cubic-bezier(.2,.65,.15,1), transform .85s cubic-bezier(.2,.65,.15,1); }
  .rv-l { transform:translateX(-44px); } .rv-r { transform:translateX(44px); }
  .rv.in { opacity:1; transform:none; }
  .rv-d1 { transition-delay:.08s } .rv-d2 { transition-delay:.16s } .rv-d3 { transition-delay:.24s } .rv-d4 { transition-delay:.32s }
  @media (prefers-reduced-motion: reduce){ .rv{ opacity:1; transform:none; transition:none } }

  /* giant outlined ghost word behind section heads (desktop flourish only) */
  .section-head { position:relative; }
  .bg-word { position:absolute; top:-58px; left:-10px; z-index:-1; font-weight:900; white-space:nowrap;
             font-size:clamp(90px, 15vw, 200px); letter-spacing:-.02em; text-transform:uppercase; line-height:1;
             color:transparent; -webkit-text-stroke:1px rgba(74,222,128,.13); pointer-events:none; user-select:none;
             max-width:100vw; }
  /* on phones these oversized words overflow the viewport — retire them */
  @media (max-width:680px){ .bg-word{ display:none } }
  .hero .eyebrow-h { display:flex; align-items:center; gap:14px; color:var(--aurora);
                     font-family:"JetBrains Mono",monospace; font-size:12px; letter-spacing:.34em;
                     text-transform:uppercase; margin-bottom:22px; }
  .hero .eyebrow-h::before { content:""; width:46px; height:2px; background:var(--aurora); box-shadow:0 0 10px var(--aurora); }
  .htitle { font-weight:900; font-size:clamp(48px, 8.8vw, 122px); line-height:.92; letter-spacing:-.025em;
            text-transform:uppercase; color:#fbfdfb; margin:0; }
  .htitle .glow { color:var(--lime); text-shadow:0 0 34px rgba(57,255,20,.75), 0 0 8px rgba(57,255,20,.6); }
  .hlead { color:#c7cdc7; font-size:clamp(16px,2vw,21px); line-height:1.5; max-width:660px; margin:28px 0 0; }
  .hcta { display:flex; gap:14px; flex-wrap:wrap; margin-top:36px; }
  .btn-pill { display:inline-flex; align-items:center; gap:12px; background:var(--lime); color:#000;
              font-family:"Archivo"; font-weight:800; font-size:14px; letter-spacing:.08em; text-transform:uppercase;
              border:0; border-radius:3px; padding:16px 32px; cursor:pointer; text-decoration:none;
              box-shadow:0 0 30px rgba(57,255,20,.35); transition:transform .12s, box-shadow .2s, filter .2s; }
  .btn-pill::after { content:"→"; font-weight:800; transition:transform .2s; }
  .btn-pill:hover { filter:brightness(1.08); box-shadow:0 0 44px rgba(57,255,20,.55); transform:translateY(-2px); }
  .btn-pill:hover::after { transform:translateX(5px); }
  .btn-pill.outline { background:transparent; color:var(--silver); border:1.5px solid rgba(154,163,154,.5); box-shadow:none; }
  .btn-pill.outline:hover { border-color:var(--aurora); color:#fff; box-shadow:0 0 24px rgba(74,222,128,.25); }
  .hstats { display:flex; gap:30px; flex-wrap:wrap; margin-top:52px; }
  .hstats .s b { display:block; font-weight:900; font-size:30px; color:#fbfdfb; line-height:1; }
  .hstats .s span { font-family:"JetBrains Mono",monospace; font-size:11px; letter-spacing:.16em; color:var(--dim); text-transform:uppercase; }
  .hstats .s b.lime { color:var(--lime); }

  /* live status chips over hero */
  .chips { display:flex; gap:9px; flex-wrap:wrap; margin-top:40px; }
  .chip { border:1px solid var(--line); border-radius:3px; padding:6px 15px; font-size:11.5px;
          color:var(--dim); background:rgba(8,10,8,.7); backdrop-filter:blur(6px); font-family:"JetBrains Mono",monospace;
          letter-spacing:.04em; display:inline-flex; gap:6px; align-items:center; }
  .chip::before { content:""; width:7px; height:7px; border-radius:50%; background:var(--aurora); box-shadow:0 0 8px var(--aurora); }
  .chip.static::before { display:none; }
  .chip b { color:var(--aurora); font-weight:700; }
  .chip a { color:var(--aurora); text-decoration:none; }

  /* treeline silhouette at hero base */
  .treeline { position:absolute; bottom:0; left:0; right:0; width:100%; height:120px; z-index:1; pointer-events:none; opacity:.9; }

  /* the marquee — big, bold, alive */
  .tickerwrap { position:relative; z-index:2; border-top:1px solid var(--line); border-bottom:1px solid var(--line);
                background:rgba(3,4,3,.92); overflow:hidden; white-space:nowrap; }
  .ticker { display:inline-block; padding:20px 0; animation:tick 52s linear infinite;
            font-family:"Archivo"; font-weight:800; font-size:clamp(18px,2.2vw,28px); letter-spacing:.08em;
            text-transform:uppercase; color:#3a423a; }
  .ticker b { color:var(--silver); font-weight:800; } .ticker i { color:var(--lime); font-style:normal;
            text-shadow:0 0 18px rgba(57,255,20,.4); }
  .ticker span { margin:0 34px; }
  .ticker span::after { content:"✦"; color:rgba(74,222,128,.6); font-size:.6em; margin-left:68px; vertical-align:middle; }
  @keyframes tick { from{ transform:translateX(0) } to{ transform:translateX(-50%) } }

  /* section headers */
  .section { max-width:1180px; margin:0 auto; padding:64px 26px 0; }
  .section-head { margin-bottom:26px; }
  .section-head .kicker { display:flex; align-items:center; gap:12px; color:var(--aurora);
                          font-family:"JetBrains Mono",monospace; font-size:11px; letter-spacing:.3em; text-transform:uppercase; margin-bottom:14px; }
  .section-head .kicker::before, .section-head .kicker::after { content:""; height:1px; width:34px; background:rgba(74,222,128,.5); }
  .section-head .kicker::after { flex:0 0 34px; }
  .section-head h2.sh { font-weight:900; font-size:clamp(30px,4.9vw,58px); line-height:.98; text-transform:uppercase; color:#fbfdfb; letter-spacing:-.02em; }
  .section-head h2.sh .glow { color:var(--lime); text-shadow:0 0 26px rgba(57,255,20,.6); }
  .section-head p.sp { color:var(--dim); font-size:15px; max-width:680px; margin-top:14px; line-height:1.55; }

  main { max-width:1180px; margin:0 auto; padding:22px 26px 40px; }
  .grid { display:grid; grid-template-columns:repeat(2,1fr); gap:18px; }
  @media (max-width:1000px){ .grid{grid-template-columns:1fr} }
  .card { position:relative; background:linear-gradient(180deg,rgba(14,16,14,.94),rgba(9,11,9,.96));
          border:1px solid var(--line); border-radius:8px; padding:26px; overflow:hidden;
          transition:border-color .25s, transform .25s, box-shadow .25s; }
  .card::before { content:""; position:absolute; left:0; top:22px; bottom:22px; width:3px;
                  background:linear-gradient(180deg,var(--aurora),var(--lime)); opacity:0; transition:opacity .25s; }
  .card::after { content:""; position:absolute; inset:0; z-index:-1; pointer-events:none;
                 background:radial-gradient(70% 85% at 50% 100%, rgba(74,222,128,.10), transparent 70%);
                 opacity:.35; animation:breathe 8s ease-in-out infinite; }
  .card:nth-child(odd)::after { animation-delay:-4s; }
  @keyframes breathe { 0%,100%{ opacity:.22; transform:scale(1) } 50%{ opacity:.6; transform:scale(1.06) } }
  .card:hover { border-color:rgba(74,222,128,.45); transform:translateY(-3px);
                box-shadow:0 16px 48px rgba(0,0,0,.55), 0 0 34px rgba(57,255,20,.10), 0 0 0 1px rgba(74,222,128,.12); }
  .card:hover::before { opacity:.9; }
  @media (prefers-reduced-motion: reduce){ .card::after{ animation:none } }
  .eyebrow { font-family:"JetBrains Mono",monospace; font-size:10.5px; letter-spacing:.28em;
             color:var(--aurora); text-transform:uppercase; margin-bottom:8px; }
  .card h2 { font-size:22px; font-weight:800; letter-spacing:-.01em; color:#fbfdfb; margin-bottom:8px; text-transform:none; }
  .card h2 .g { color:var(--lime); }
  .card p.hint { color:var(--dim); font-size:13.5px; margin-bottom:14px; line-height:1.55; }
  button { font-family:"Archivo"; font-size:13px; font-weight:800; letter-spacing:.06em; text-transform:uppercase;
           background:var(--lime); color:#000; border:0; border-radius:3px; padding:12px 24px;
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

  /* trade persona strip — real jobsite imagery, like the mother site */
  .trades { display:grid; grid-template-columns:repeat(4,1fr); gap:16px; }
  @media (max-width:1000px){ .trades{grid-template-columns:repeat(2,1fr)} }
  @media (max-width:560px){ .trades{grid-template-columns:1fr} }
  .trade { position:relative; border:1px solid var(--line); border-radius:16px; padding:150px 20px 20px;
           background:#060806; cursor:pointer; isolation:isolate;
           transition:border-color .22s, transform .22s, box-shadow .22s; overflow:hidden; }
  .trade .ph { position:absolute; inset:0; z-index:-2; background-position:center; background-size:cover;
               opacity:.55; filter:saturate(.9) contrast(1.05); transform:scale(1.001);
               transition:transform .9s cubic-bezier(.2,.65,.15,1), opacity .3s; }
  .trade .shade { position:absolute; inset:0; z-index:-1;
                  background:linear-gradient(180deg, rgba(4,6,4,.18) 0%, rgba(3,5,3,.72) 52%, rgba(2,4,2,.96) 100%); }
  .trade:hover { border-color:rgba(74,222,128,.55); transform:translateY(-5px); box-shadow:0 22px 54px rgba(0,0,0,.6); }
  .trade:hover .ph { transform:scale(1.07); opacity:.68; }
  .trade .num { position:absolute; top:18px; left:20px; font-family:"JetBrains Mono",monospace; font-size:11px; color:#c6cdc6; letter-spacing:.2em; text-shadow:0 1px 8px rgba(0,0,0,.8); }
  .trade .tag2 { position:absolute; top:14px; right:14px; border:1px solid rgba(74,222,128,.7); color:#d9ffe2;
                 background:rgba(3,6,3,.55); backdrop-filter:blur(3px);
                 border-radius:999px; padding:4px 12px; font-family:"JetBrains Mono",monospace; font-size:10px; letter-spacing:.14em; text-transform:uppercase; }
  .trade h3 { font-weight:800; font-size:21px; margin:0 0 8px; color:#fbfdfb; text-shadow:0 2px 14px rgba(0,0,0,.7); }
  .trade h3 .g { color:var(--lime); text-shadow:0 0 16px rgba(57,255,20,.55); }
  .trade p { color:#b7bfb7; font-size:13px; line-height:1.5; text-shadow:0 1px 8px rgba(0,0,0,.8); }
  .trade .go { margin-top:14px; color:var(--aurora); font-family:"JetBrains Mono",monospace; font-size:11px; letter-spacing:.14em; text-transform:uppercase; display:flex; align-items:center; gap:8px; }
  .trade .go::before { content:""; width:20px; height:1px; background:var(--aurora); transition:width .25s; }
  .trade:hover .go::before { width:34px; }

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
           padding:26px 16px 40px; text-transform:uppercase; word-break:break-word; }
  footer a { color:var(--aurora); text-decoration:none; }
  .madeby { margin-top:22px; display:flex; flex-direction:column; align-items:center; gap:10px; }
  .madeby .heart { color:#ff5c7a; letter-spacing:0; }
  .madeby img { height:30px; width:auto; opacity:.68; transition:opacity .2s ease; }
  .madeby a:hover img { opacity:1; }

  /* phone layout: tighter gutters, inputs never exceed the column, no drag */
  @media (max-width:560px){
    .section { padding:48px 18px 0; }
    main { padding:18px 18px 34px; }
    .card { padding:20px; }
    select, input[type=number], input[type=text] { max-width:100%; }
    pre.copy { font-size:11px; }
    .htitle { font-size:clamp(40px, 12vw, 66px); }
  }
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
  <div class="herowrap">
    <video class="herovid" id="herovid" autoplay muted loop playsinline poster="/media/hero-poster.webp">
      <source src="/media/hero.webm" type="video/webm">
    </video>
    <div class="heroshade"></div>
  </div>
  <div class="hero-inner" id="heroInner">
  <div class="eyebrow-h">BUSINESS MANAGEMENT IN A BOX · MODEL CONTEXT PROTOCOL</div>
  <h1 class="htitle">Run the whole<br>business with<br><span class="glow">one agent.</span></h1>
  <p class="hlead"><b style="color:#e8ebe8">Most AI talks about business. Evolved runs one</b> — end to end: quotes that price themselves, safety, receipts, dispatch, invoicing, and on-chain settlement. It runs a real Alberta company today, and spins up for <b style="color:#e8ebe8">any trade in one call</b>.</p>
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
  </div>
  <svg class="treeline" viewBox="0 0 1440 120" preserveAspectRatio="none" aria-hidden="true">
    <path fill="#000" d="M0,120 L0,74 L28,62 L40,74 L60,48 L74,66 L96,40 L108,60 L120,66 L150,44 L166,64 L190,52 L210,70 L232,40 L248,62 L268,54 L292,30 L308,58 L330,64 L356,46 L372,66 L398,52 L420,72 L444,42 L462,64 L486,56 L510,34 L528,60 L552,66 L580,48 L598,68 L622,54 L648,36 L666,62 L690,58 L714,40 L732,64 L758,52 L784,70 L806,44 L826,64 L850,56 L876,32 L894,60 L918,66 L946,48 L964,68 L988,54 L1014,38 L1032,62 L1058,58 L1084,42 L1102,64 L1128,52 L1154,70 L1178,44 L1198,66 L1222,56 L1248,34 L1266,60 L1290,66 L1318,48 L1338,68 L1362,54 L1388,40 L1408,64 L1428,58 L1440,66 L1440,120 Z"/>
  </svg>
</section>

<div class="tickerwrap"><div class="ticker" id="ticker"><span>booting the books…</span></div></div>

<div class="section" id="run">
  <div class="section-head rv">
    <div class="bg-word">Operate</div>
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
  <p class="hint">A customer texts a driveway photo. The estimator sizes it and reads condition; the learning engine prices it as a <b>confidence band</b> — not a wild guess — grounded in <b>comparable jobs already in the books</b>, benchmarked to the market, with the exact site factors that could move the number. A branded draft lands in the ledger with a measure-to-confirm clause.</p>
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
  <div class="eyebrow">why on-chain, not a bolt-on</div>
  <h2>Programmable deposit → <span class="g">X Layer testnet</span></h2>
  <p class="hint">A blasting crew buys media and fuel before the first grain hits the driveway. The <b>25% deposit</b> is enforced in code and encoded into an EIP-681 request — it clears in seconds (not a 3-day e-transfer), it's <b>final</b> (no chargeback after the abrasive is spent), and the agent <b>verifies settlement itself</b> by read-only RPC before it books the crew. Evolved never holds keys.</p>
  <div>
    <button onclick="payRequest()">Request the deposit on-chain</button>
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
  <div class="section-head rv">
    <div class="bg-word">Adapt</div>
    <div class="kicker">Make it yours · one call</div>
    <h2 class="sh">What business are <span class="glow">you</span> running?</h2>
    <p class="sp">Evolved is a toolkit, not a one-off. Pick a trade and preview exactly what <span class="mono">franchise_spinup</span> installs — the rate card into the quoting engine, the trade's hazards into every JHA, empty books, the full machine. Adding your own is one entry in <span class="mono">src/trades.ts</span>; <span class="mono">brand_configure</span> makes every rendered quote feel like your company. Read-only and safe to click here.</p>
  </div>
  <div class="trades">
    <div class="trade rv" onclick="packPreview('pressure-washing')">
      <i class="ph" style="background-image:url('/media/decks.webp')"></i><i class="shade"></i>
      <div class="num">01</div><div class="tag2">Pressure washing</div>
      <h3>I wash <span class="g">driveways &amp; siding.</span></h3>
      <p>Rinse to strip-wash, priced per sqft. Wand-injection, slip, and ladder hazards in every JHA.</p>
      <div class="go">Preview the pack</div>
    </div>
    <div class="trade rv rv-d1" onclick="packPreview('line-painting')">
      <i class="ph" style="background-image:url('/media/industrial.webp')"></i><i class="shade"></i>
      <div class="num">02</div><div class="tag2">Line painting</div>
      <h3>I stripe <span class="g">parking lots.</span></h3>
      <p>Re-stripe to full layout, per sqft. Live-traffic, fume, and heat-stress hazards baked in.</p>
      <div class="go">Preview the pack</div>
    </div>
    <div class="trade rv rv-d2" onclick="packPreview('mobile-detailing')">
      <i class="ph" style="background-image:url('/media/motors.webp')"></i><i class="shade"></i>
      <div class="num">03</div><div class="tag2">Mobile detailing</div>
      <h3>I detail <span class="g">cars &amp; fleets.</span></h3>
      <p>Express to full restoration, per unit. Chemical-exposure and customer-property hazards.</p>
      <div class="go">Preview the pack</div>
    </div>
    <div class="trade rv rv-d3" onclick="document.getElementById('fp-out').scrollIntoView({behavior:'smooth',block:'center'}); packPreview('pressure-washing')">
      <i class="ph" style="background-image:url('/media/cornerlog.webp')"></i><i class="shade"></i>
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
    "url": "https://www.evolvedmcp.cloud/mcp"
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
  <div class="madeby">
    <span>BUILT WITH <span class="heart">&#9829;</span> BY <a href="https://kr8tiv.io">KR8TIV</a></span>
    <a href="https://kr8tiv.io" aria-label="KR8TIV"><img src="data:image/png;base64,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" alt="KR8TIV"></a>
  </div>
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
      "<span>QUOTES THAT <i>PRICE THEMSELVES</i></span>",
      "<span>RECEIVABLES <i>$" + Number(snap.money.receivables).toLocaleString() + "</i></span>",
      "<span>PAID <i>ON-CHAIN</i></span>",
      "<span>QUOTES OUT <b>" + snap.funnel.quotesOut + "</b></span>",
      "<span>JOBS BOOKED <b>" + snap.funnel.jobsBooked + "</b></span>",
      "<span>ANY TRADE <i>ONE CALL</i></span>",
      "<span>NEW LEADS <b>" + snap.funnel.newLeads + "</b></span>",
      "<span>PAID API CALLS <i>" + stats.paidApiCalls + "</i></span>",
      "<span>ON-CHAIN SETTLEMENTS <i>" + stats.invoicePaymentsSettled + "</i></span>",
      "<span>HUMANS GATE <b>ONLY MONEY</b></span>"
    ].join("");
    $("ticker").innerHTML = parts + parts; // duplicate for seamless loop
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
    show("pq-out", { surface: r.estimate.surface, sqft: r.estimate.sqft, depth: r.estimate.depth,
      condition: r.estimate.condition, confidence: r.estimate.confidence, source: r.estimate.source }, "estimate");
    if (r.quoteBand){
      show("pq-out", { pointTotal: r.quoteBand.pointTotal, notToExceedRange: r.quoteBand.rangeSubtotal,
        ratePerSqft: r.quoteBand.rangeRate, basis: r.quoteBand.basis }, "priced as a confidence band, not a guess");
      show("pq-out", r.quoteBand.comparables, "grounded in comparable jobs");
      show("pq-out", r.quoteBand.market, "vs the market");
      show("pq-out", r.quoteBand.priceDrivers, "what a site measure could change");
    }
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
  show("pay-out", "→ invoice_payment_request { invoiceId: 'ECO-INV-9002', split: 'deposit' }");
  try {
    var r = await call("invoice_payment_request", { invoiceId: "ECO-INV-9002", split: "deposit" });
    PAY = r.payment.id; $("pay-check").disabled = false;
    show("pay-out", { split: r.split.kind, amount: r.payment.amountAsset + " " + r.payment.asset.symbol + " (= $" + r.payment.amountCad + " CAD)",
      of: "$" + r.split.invoiceTotal + " invoice · deposit $" + r.split.depositDue + " · balance $" + r.split.balanceDue }, "programmable deposit (25% of GST-inclusive total)");
    show("pay-out", { network: r.payment.network, chainId: r.payment.chainId, payTo: r.payment.payTo, uri: r.payment.uri }, "on-chain request (EIP-681)");
    if (r.whyOnChain){ show("pay-out", r.whyOnChain.headline, "why on-chain here"); show("pay-out", r.whyOnChain.reasons, "not a bolt-on — essential for a cash-tight trade"); }
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

/* ---------- aurora backdrop: WebGL FBM curtains — slow, deep, mouse-reactive ---------- */
function initAurora(){
  var cv = document.getElementById("aurora");
  if (!cv) return;
  var gl = cv.getContext("webgl", { antialias:false, alpha:false });
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!gl){ cv.style.background = "radial-gradient(120% 80% at 50% 0%, #0c1a10 0%, #000 70%)"; return; }
  var VS = "attribute vec2 a; void main(){ gl_Position = vec4(a,0.,1.); }";
  var FS = [
    "precision highp float;",
    "uniform vec2 r; uniform float t; uniform vec2 m;",
    "float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }",
    "float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);",
    "  return mix(mix(h(i),h(i+vec2(1.,0.)),f.x), mix(h(i+vec2(0.,1.)),h(i+vec2(1.,1.)),f.x), f.y); }",
    "float fbm(vec2 p){ float v=0., a=.5; for(int i=0;i<5;i++){ v+=a*n(p); p*=2.03; a*=.5; } return v; }",
    "void main(){",
    "  vec2 uv = gl_FragCoord.xy / r;",
    "  float mx=(m.x-.5)*.22, my=(m.y-.5)*.10;",
    "  vec3 col = vec3(0.);",
    "  for(int i=0;i<3;i++){",
    "    float fi=float(i);",
    "    float sc=1.5+fi*1.15;",
    "    float q = fbm(vec2(uv.x*sc + t*(.010+fi*.006) + mx*(1.+fi*.7), fi*7.31 + t*.004));",
    "    float yy = .26 + fi*.17 + my*(1.-fi*.3);",
    "    float band = smoothstep(.55, .98, 1.-abs(uv.y - yy - (q-.5)*.38)*(1.6+fi*.5));",
    "    float glow = pow(band, 2.4)*(.42-fi*.10);",
    "    vec3 c = mix(vec3(.24,.86,.47), vec3(.13,.78,.90), fi*.48);",
    "    col += c*glow*(.55+.45*fbm(vec2(uv.x*5.5 - t*.008, fi*3.7)));",
    "  }",
    "  col += vec3(.010,.028,.016)*(1.-uv.y);",
    "  float vg = 1.-.6*length(uv-vec2(.5,.42));",
    "  col *= clamp(vg,0.,1.);",
    "  gl_FragColor = vec4(col*.85, 1.);",
    "}"
  ].join("\\n");
  function sh(type, src){ var s=gl.createShader(type); gl.shaderSource(s,src); gl.compileShader(s); return s; }
  var prog = gl.createProgram();
  gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS));
  gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)){ cv.style.background="#020402"; return; }
  gl.useProgram(prog);
  var buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 3,-1, -1,3]), gl.STATIC_DRAW);
  var loc = gl.getAttribLocation(prog, "a");
  gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  var uR = gl.getUniformLocation(prog,"r"), uT = gl.getUniformLocation(prog,"t"), uM = gl.getUniformLocation(prog,"m");
  var dpr = Math.min(window.devicePixelRatio||1, 1.5);
  function resize(){
    cv.width = Math.floor(window.innerWidth*dpr*0.75); cv.height = Math.floor(window.innerHeight*dpr*0.75);
    cv.style.width = window.innerWidth+"px"; cv.style.height = window.innerHeight+"px";
    gl.viewport(0,0,cv.width,cv.height);
  }
  resize(); window.addEventListener("resize", resize);
  var mx=0.5, my=0.5, tx=0.5, ty=0.5;
  window.addEventListener("pointermove", function(e){ tx=e.clientX/window.innerWidth; ty=1-e.clientY/window.innerHeight; }, { passive:true });
  var running=true;
  document.addEventListener("visibilitychange", function(){ running=!document.hidden; if(running) requestAnimationFrame(loop); });
  function draw(sec){
    mx += (tx-mx)*0.03; my += (ty-my)*0.03;   // eased — the sky follows you, gently
    gl.uniform2f(uR, cv.width, cv.height);
    gl.uniform1f(uT, sec);
    gl.uniform2f(uM, mx, my);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
  if (reduce){ draw(12.0); return; }
  function loop(t){ if(!running) return; draw(t*0.001); requestAnimationFrame(loop); }
  requestAnimationFrame(loop);
}

/* ---------- nav solidify + hero parallax on scroll ---------- */
function initNav(){
  var nav=document.getElementById("nav");
  var hi=document.getElementById("heroInner");
  var hv=document.getElementById("herovid");
  var raf=false;
  function apply(){
    raf=false;
    var y=window.scrollY;
    if (y>60) nav.classList.add("solid"); else nav.classList.remove("solid");
    if (hi){ hi.style.transform="translateY("+(y*0.18)+"px)"; hi.style.opacity=Math.max(0,1-y/720); }
    if (hv){ hv.style.transform="translateY("+(y*0.10)+"px) scale(1.02)"; }
  }
  window.addEventListener("scroll", function(){ if(!raf){ raf=true; requestAnimationFrame(apply); } }, { passive:true });
  apply();
}

/* ---------- reveal on scroll (auto-tags cards; alternating directions) ---------- */
function initReveal(){
  var els=document.querySelectorAll(".card, .section-head, .trade");
  var k=0;
  els.forEach(function(el){
    if(!el.classList.contains("rv")) el.classList.add("rv");
    // cards glide in from alternating sides; wide cards and heads rise
    if (el.classList.contains("card") && !el.classList.contains("wide")){
      el.classList.add((k%2===0) ? "rv-l" : "rv-r"); k++;
    }
  });
  if (!("IntersectionObserver" in window)){ els.forEach(function(el){ el.classList.add("in"); }); return; }
  var io=new IntersectionObserver(function(entries){
    entries.forEach(function(en){
      if (en.isIntersecting){ en.target.classList.add("in"); io.unobserve(en.target); }
    });
  }, { rootMargin:"0px 0px -8% 0px", threshold:0.08 });
  els.forEach(function(el){ io.observe(el); });
  // ghost words drift horizontally with scroll — quiet depth (desktop only;
  // they are display:none on phones, and we must never add horizontal drift there)
  var words = window.innerWidth > 680 ? [].slice.call(document.querySelectorAll(".bg-word")) : [];
  if (words.length){
    var raf2=false;
    window.addEventListener("scroll", function(){
      if (raf2) return; raf2=true;
      requestAnimationFrame(function(){
        raf2=false;
        var y=window.scrollY;
        for (var i=0;i<words.length;i++){
          words[i].style.transform="translateX("+((i%2===0?1:-1)*y*0.045)+"px)";
        }
      });
    }, { passive:true });
  }
}

/* ---------- boot ---------- */
(async function(){
  initAurora(); initNav(); initReveal();
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

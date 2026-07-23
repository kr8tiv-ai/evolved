/**
 * Evolved — branded document renderer.
 *
 * Emits self-contained dark-brand HTML for quotes and invoices, matching the
 * company's locked design language: Boreal Void #0a0a0a page, Cyber Lime
 * #39ff14 accents, Aurora Neon #4ade80 labels, uppercase tracked headings,
 * diamond bullets, payment schedule with a big green total.
 */

import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Customer, Invoice, Quote } from "../types.js";
import { money, safeMkdirSync } from "../store.js";

const here = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = process.env.EVOLVED_OUT_DIR ?? join(here, "..", "..", "out");

const PALETTE = {
  page: "#0a0a0a",
  panel: "#101010",
  line: "#1f2937",
  lime: "#39ff14",
  aurora: "#4ade80",
  silver: "#d1d5db",
  dim: "#9ca3af",
};

function shell(title: string, body: string): string {
  const p = PALETTE;
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<style>
  * { box-sizing: border-box; margin: 0; }
  body { background: ${p.page}; color: ${p.silver}; font: 15px/1.55 "Segoe UI", system-ui, sans-serif; padding: 48px 24px; }
  .sheet { max-width: 820px; margin: 0 auto; background: ${p.panel}; border: 1px solid ${p.line}; border-radius: 14px; padding: 48px 56px; }
  h1 { color: #fff; font-size: 44px; letter-spacing: .14em; text-transform: uppercase; }
  h1 .underline { display:block; width: 120px; height: 4px; background: ${p.lime}; margin-top: 10px; border-radius: 2px; }
  .brand { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom: 36px; }
  .brand .co { text-align:right; color:${p.dim}; font-size: 12px; letter-spacing:.08em; text-transform: uppercase; }
  .brand .co b { color:${p.aurora}; display:block; font-size:15px; letter-spacing:.18em; }
  .grid { display:grid; grid-template-columns: 1fr 1fr; gap: 8px 32px; margin: 26px 0; }
  .grid .lbl { color:${p.aurora}; font-size:11px; letter-spacing:.16em; text-transform:uppercase; }
  .grid .val { color:#fff; margin-bottom: 8px; }
  table { width:100%; border-collapse: collapse; margin: 22px 0; border:1px solid ${p.line}; }
  th { color:${p.aurora}; font-size:11px; letter-spacing:.16em; text-transform:uppercase; text-align:left; padding:12px 14px; border-bottom:1px solid ${p.line}; }
  td { padding:11px 14px; border-bottom:1px solid ${p.line}; }
  td.num, th.num { text-align:right; font-variant-numeric: tabular-nums; }
  td .diamond { color:${p.lime}; margin-right:8px; }
  .totals { margin-top: 26px; display:flex; justify-content:flex-end; }
  .totals table { width: 340px; border:none; }
  .totals td { border:none; padding:6px 8px; }
  .totals .big { color:${p.lime}; font-size:30px; font-weight:700; }
  .notes { margin-top: 30px; columns: 2; gap: 32px; color:${p.dim}; font-size: 12.5px; }
  .notes h3 { color:${p.aurora}; font-size:11px; letter-spacing:.16em; text-transform:uppercase; margin-bottom:6px; }
  footer { margin-top: 40px; padding-top: 18px; border-top:1px solid ${p.line}; color:${p.dim}; font-size:11px; letter-spacing:.12em; text-transform:uppercase; text-align:center; }
  footer b { color:${p.aurora}; }
</style></head><body><div class="sheet">${body}</div></body></html>`;
}

const FOOTER = `<footer>780-XXX-XXXX &nbsp;&middot;&nbsp; <b>WWW.EVOLVEECOBLASTING.COM</b> &nbsp;&middot;&nbsp; DEMO@EVOLVEECOBLASTING.COM<br>SERVING EDMONTON &amp; GREATER ALBERTA &mdash; DEMO DOCUMENT, SYNTHETIC DATA</footer>`;

export function renderQuoteHtml(q: Quote, customer: Customer): string {
  const rows = q.lines
    .map(
      (l) => `<tr>
    <td><span class="diamond">&#9670;</span>${l.description}</td>
    <td class="num">${l.sqft ? `${l.sqft.toLocaleString()} sqft` : "—"}</td>
    <td class="num">${money(l.amount)}</td></tr>`,
    )
    .join("\n");

  const body = `
  <div class="brand">
    <h1>Quote<span class="underline"></span></h1>
    <div class="co"><b>EVOLVE ECO BLASTING</b>Dustless abrasive blasting<br>Substrate profiling &middot; Eco media</div>
  </div>
  <div class="grid">
    <div><div class="lbl">Prepared for</div><div class="val">${customer.name}</div>
         <div class="lbl">Site address</div><div class="val">${q.siteAddress}</div></div>
    <div><div class="lbl">Quote no.</div><div class="val">${q.id}</div>
         <div class="lbl">Valid until</div><div class="val">${q.validUntil}</div></div>
  </div>
  <table>
    <tr><th>Scope of work</th><th class="num">Area</th><th class="num">Amount</th></tr>
    ${rows}
  </table>
  <div class="totals"><table>
    <tr><td>Subtotal</td><td class="num">${money(q.subtotal)}</td></tr>
    <tr><td>GST (5%)</td><td class="num">${money(q.gst)}</td></tr>
    <tr><td>Total</td><td class="num big">${money(q.total)}</td></tr>
    <tr><td>Deposit to book (25%)</td><td class="num">${money(q.depositRequired)}</td></tr>
  </table></div>
  <div class="notes">
    <div><h3>Payment schedule</h3>25% deposit on acceptance, balance on completion. 5% GST applies on the final invoice.</div>
    <div><h3>Terms</h3>Quote valid 30 days. Fresh concrete requires a 28-day cure before abrasive blasting. Substrate profiling performed with eco-friendly media.</div>
  </div>
  ${FOOTER}`;
  return shell(`Evolve Quote ${q.id}`, body);
}

export function renderInvoiceHtml(inv: Invoice, customer: Customer): string {
  const rows = inv.lines
    .map(
      (l) => `<tr><td><span class="diamond">&#9670;</span>${l.description}</td>
      <td class="num">${money(l.amount)}</td></tr>`,
    )
    .join("\n");
  const body = `
  <div class="brand">
    <h1>Invoice<span class="underline"></span></h1>
    <div class="co"><b>EVOLVE ECO BLASTING</b>Dustless abrasive blasting<br>Substrate profiling &middot; Eco media</div>
  </div>
  <div class="grid">
    <div><div class="lbl">Billed to</div><div class="val">${customer.name}</div></div>
    <div><div class="lbl">Invoice no.</div><div class="val">${inv.id}</div>
         <div class="lbl">Due</div><div class="val">${inv.dueDate}</div></div>
  </div>
  <table><tr><th>Description</th><th class="num">Amount</th></tr>${rows}</table>
  <div class="totals"><table>
    <tr><td>Subtotal</td><td class="num">${money(inv.subtotal)}</td></tr>
    <tr><td>GST (5%)</td><td class="num">${money(inv.gst)}</td></tr>
    <tr><td>Deposit applied</td><td class="num">−${money(inv.depositApplied)}</td></tr>
    <tr><td>Balance due</td><td class="num big">${money(inv.balanceDue)}</td></tr>
  </table></div>
  ${FOOTER}`;
  return shell(`Evolve Invoice ${inv.id}`, body);
}

export function writeDocument(filename: string, html: string): string {
  safeMkdirSync(OUT_DIR);
  const path = join(OUT_DIR, filename);
  writeFileSync(path, html, "utf8");
  return path;
}

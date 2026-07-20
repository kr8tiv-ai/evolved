/**
 * Evolved — Ops Router (Apps Script) · TEMPLATE
 * ------------------------------------------------------------------
 * A tiny, secret-gated web app that lets the field app and the owner
 * dashboard READ and WRITE your operations workbook without ever holding a
 * Google credential of their own. Deploy it once, generate YOUR own secret,
 * and point the other surfaces at its URL.
 *
 * This is a clean-room template — no company's data, URL, or secret. Copy it
 * into a Google Apps Script project bound to your workbook and make it yours.
 *
 * Actions (POST a JSON body):
 *   { "secret": "...", "action": "readTab",   "tab": "Quotes", "maxRows": 200 }
 *   { "secret": "...", "action": "writeRow",  "tab": "To-Do", "row": 42, "values": [ ... ] }
 *   { "secret": "...", "action": "appendRow", "tab": "To-Do", "values": [ ... ] }
 *   { "secret": "...", "action": "setCell",   "tab": "Quotes", "a1": "I2", "value": "Sent" }
 *   { "secret": "...", "action": "ping" }
 *
 * SETUP (5 minutes):
 *   1. Open your workbook → Extensions → Apps Script. Paste this file in.
 *   2. Generate a long random secret yourself (e.g. `openssl rand -hex 24`) and,
 *      in Apps Script, Project Settings → Script properties, add:
 *          ROUTER_SECRET = <your secret>
 *   3. Run setup() once. It VERIFIES the secret is set (it will not invent one).
 *   4. Deploy → New deployment → Web app → Execute as "Me", access
 *      "Anyone" (the secret is the gate). Copy the /exec URL.
 *   5. Put that URL + your secret into the field app and dashboard env. Done.
 *
 * TWO DELIBERATE SAFETY CHOICES (both are real footguns in naive routers):
 *   • The secret is NEVER written to the execution log. Logging it would leak
 *     it to anyone who can view executions. We log actions, never credentials.
 *   • setup() REFUSES to auto-generate a missing secret. A router that mints a
 *     fresh random secret when the property is absent silently breaks every
 *     consumer at once — with no copy of the new value anywhere. You set it; we
 *     verify it.
 */

var SECRET_PROP = "ROUTER_SECRET";

function _secret() {
  return PropertiesService.getScriptProperties().getProperty(SECRET_PROP) || "";
}

/** Run once after setting the ROUTER_SECRET script property. */
function setup() {
  var s = _secret();
  if (!s || s.length < 16) {
    // NEVER auto-mint: that would break every consumer with no copy of the value.
    throw new Error(
      "ROUTER_SECRET is missing or too short. Set it yourself: Project Settings → " +
      "Script properties → ROUTER_SECRET = <a long random string, 24+ chars>. " +
      "This template will not invent one for you, by design."
    );
  }
  // Do NOT log the secret. Confirm only that it is present.
  Logger.log("Router setup OK — ROUTER_SECRET is set (%s chars). Deploy as a web app next.", s.length);
}

/** Constant-time-ish string compare so a bad secret can't be timed out. */
function _safeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  var diff = 0;
  for (var i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function _json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function _sheet(tab) {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(tab);
  if (!sh) throw new Error("No tab named '" + tab + "'.");
  return sh;
}

function doPost(e) {
  try {
    var body = JSON.parse((e && e.postData && e.postData.contents) || "{}");
    if (!_safeEqual(body.secret || "", _secret())) {
      // Log the rejection, never the attempted secret.
      Logger.log("Rejected request: bad secret for action '%s'.", body.action || "?");
      return _json({ ok: false, error: "unauthorized" });
    }
    var lock = LockService.getScriptLock();
    lock.waitLock(25000); // serialize writes; Apps Script is single-threaded per script
    try {
      switch (body.action) {
        case "ping":
          return _json({ ok: true, pong: true });
        case "readTab": {
          var sh = _sheet(body.tab);
          var max = Math.min(body.maxRows || 500, sh.getLastRow());
          var values = max > 0 ? sh.getRange(1, 1, max, sh.getLastColumn()).getValues() : [];
          return _json({ ok: true, tab: body.tab, rows: values.length, values: values });
        }
        case "writeRow": {
          var shw = _sheet(body.tab);
          var vals = body.values || [];
          shw.getRange(body.row, 1, 1, vals.length).setValues([vals]);
          Logger.log("writeRow %s!row %s (%s cells).", body.tab, body.row, vals.length);
          return _json({ ok: true, tab: body.tab, row: body.row });
        }
        case "appendRow": {
          var sha = _sheet(body.tab);
          sha.appendRow(body.values || []);
          Logger.log("appendRow %s (%s cells).", body.tab, (body.values || []).length);
          return _json({ ok: true, tab: body.tab, appended: true });
        }
        case "setCell": {
          var shc = _sheet(body.tab);
          shc.getRange(body.a1).setValue(body.value);
          Logger.log("setCell %s!%s.", body.tab, body.a1);
          return _json({ ok: true, tab: body.tab, a1: body.a1 });
        }
        default:
          return _json({ ok: false, error: "unknown action '" + body.action + "'" });
      }
    } finally {
      lock.releaseLock();
    }
  } catch (err) {
    return _json({ ok: false, error: String(err && err.message ? err.message : err) });
  }
}

/** GET is a health check only — it exposes nothing and requires no secret. */
function doGet() {
  return _json({ ok: true, service: "evolved-ops-router", note: "POST with a secret to read/write." });
}

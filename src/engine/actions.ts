/**
 * Evolved — the ball-drop catcher.
 *
 * The five auto-raise rules from the production Action Items tab. Run on
 * demand or as part of the morning digest; each rule scans the books and
 * raises an action item so nothing quietly falls through.
 */

import type { ActionItem, Database } from "../types.js";
import { daysBetween, nowIso, shortId, today } from "../store.js";

interface RaisedRule {
  rule: string;
  severity: ActionItem["severity"];
  message: string;
  relatedId?: string;
}

export function scanForActionItems(db: Database): { raised: ActionItem[]; existing: number } {
  const found: RaisedRule[] = [];
  const t = today();

  // 1. Deposit in but job unscheduled.
  for (const j of db.jobs) {
    if (j.depositPaid && !j.scheduledDate && j.status !== "Complete" && j.status !== "Paid") {
      found.push({
        rule: "deposit-unscheduled",
        severity: "urgent",
        message: `Deposit received for job ${j.id} (${j.siteAddress}) but no date scheduled — book it.`,
        relatedId: j.id,
      });
    }
  }

  // 2. Invoice unpaid 7+ days.
  for (const inv of db.invoices) {
    if (inv.status === "Sent" && daysBetween(inv.createdAt.slice(0, 10), t) >= 7) {
      found.push({
        rule: "invoice-unpaid-7d",
        severity: "urgent",
        message: `Invoice ${inv.id} (${inv.balanceDue.toFixed(2)} CAD) unpaid ${daysBetween(inv.createdAt.slice(0, 10), t)} days — follow up.`,
        relatedId: inv.id,
      });
    }
  }

  // 3. Quote unanswered 7 days.
  for (const q of db.quotes) {
    if (q.status === "Sent" && daysBetween(q.updatedAt.slice(0, 10), t) >= 7) {
      found.push({
        rule: "quote-unanswered-7d",
        severity: "warn",
        message: `Quote ${q.id} sent ${daysBetween(q.updatedAt.slice(0, 10), t)} days ago with no reply — follow up with the client.`,
        relatedId: q.id,
      });
    }
  }

  // 4. Quote expiring within 7 days.
  for (const q of db.quotes) {
    if (q.status === "Sent") {
      const left = daysBetween(t, q.validUntil);
      if (left >= 0 && left <= 7) {
        found.push({
          rule: "quote-expiring-7d",
          severity: "warn",
          message: `Quote ${q.id} expires in ${left} day${left === 1 ? "" : "s"} (${q.validUntil}) — last call to the client.`,
          relatedId: q.id,
        });
      }
    }
  }

  // 5. Job complete but not invoiced.
  for (const j of db.jobs) {
    if (j.status === "Complete") {
      const hasInvoice = db.invoices.some((i) => i.jobId === j.id);
      if (!hasInvoice) {
        found.push({
          rule: "done-not-invoiced",
          severity: "urgent",
          message: `Job ${j.id} (${j.siteAddress}) is complete but has not been invoiced — money on the table.`,
          relatedId: j.id,
        });
      }
    }
  }

  // 6. Open lead with a stale or missing next action.
  for (const l of db.leads) {
    if (l.stage !== "Won" && l.stage !== "Lost") {
      if (!l.nextAction || daysBetween(l.nextActionDate, t) > 0) {
        found.push({
          rule: "lead-next-action-stale",
          severity: "info",
          message: `Lead ${l.id} (${l.summary}) has a stale or missing next action — every open lead needs one with a date.`,
          relatedId: l.id,
        });
      }
    }
  }

  // Dedupe against unresolved items already raised for the same rule+related.
  const open = db.actionItems.filter((a) => !a.resolvedAt);
  const raised: ActionItem[] = [];
  for (const f of found) {
    const dup = open.some((a) => a.rule === f.rule && a.relatedId === f.relatedId);
    if (dup) continue;
    const item: ActionItem = {
      id: shortId("ACT"),
      rule: f.rule,
      severity: f.severity,
      message: f.message,
      relatedId: f.relatedId,
      raisedAt: nowIso(),
    };
    db.actionItems.push(item);
    raised.push(item);
  }
  return { raised, existing: open.length };
}

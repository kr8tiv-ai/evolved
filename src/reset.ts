/** CLI: restore the synthetic demo dataset. */
import { resetDb } from "./store.js";

const db = resetDb();
console.log(
  `Demo dataset reset: ${db.customers.length} customers, ${db.leads.length} leads, ${db.quotes.length} quotes, ${db.jobs.length} jobs, ${db.receipts.length} receipts.`,
);

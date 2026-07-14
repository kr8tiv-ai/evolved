// CommonJS entry for managed hosts whose Node runners require() the entry
// file and expect a synchronous listen() (the app itself is ESM).
//
// The HTTP server binds immediately; the ESM app loads behind it. If the app
// fails to boot, /health reports the boot error instead of a blank 503 so
// failures are diagnosable from outside.
const http = require("node:http");

const PORT = Number(process.env.PORT || 3000);

let bootError = null;
const appPromise = import("./dist/app.js").catch((err) => {
  bootError = err;
  console.error("Evolved failed to boot:", err);
  return null;
});

http
  .createServer((req, res) => {
    appPromise.then((mod) => {
      if (mod && typeof mod.handleRequest === "function") {
        void mod.handleRequest(req, res);
      } else {
        res.writeHead(500, { "content-type": "application/json" });
        res.end(
          JSON.stringify({ ok: false, error: "boot failure", detail: String(bootError) }),
        );
      }
    });
  })
  .listen(PORT, () => {
    console.log(`Evolved MCP server (cjs shim) listening on port ${PORT}`);
  });

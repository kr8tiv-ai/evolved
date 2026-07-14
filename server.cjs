// CommonJS entry shim for managed hosts whose Node runners require() the
// entry file. The app itself is ESM — load it via dynamic import.
import("./dist/http.js").catch((err) => {
  console.error("Evolved failed to start:", err);
  process.exit(1);
});

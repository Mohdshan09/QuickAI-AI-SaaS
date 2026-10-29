// Temporary smoke check: load built pages in headless Chrome, report console errors and the
// rendered h1 so a broken base path shows up before deploy. Deleted after use.
import { spawn } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const PORT = 9334;
const profile = mkdtempSync(join(tmpdir(), "check-chrome-"));
const chrome = spawn(CHROME, ["--headless=new", `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, "--no-first-run", "about:blank"], { stdio: "ignore" });

async function waitJson(url, tries = 60) {
  for (let i = 0; i < tries; i += 1) {
    try {
      const r = await fetch(url);
      if (r.ok) return r.json();
    } catch { /* not up */ }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error("devtools not ready");
}

await waitJson(`http://127.0.0.1:${PORT}/json/version`);
const target = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: "PUT" })).json();
const ws = new WebSocket(target.webSocketDebuggerUrl);
let id = 0;
const pending = new Map();
const problems = [];
ws.addEventListener("message", (e) => {
  const msg = JSON.parse(e.data);
  if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); return; }
  if (msg.method === "Runtime.exceptionThrown") problems.push(msg.params.exceptionDetails.text);
  if (msg.method === "Runtime.consoleAPICalled" && msg.params.type === "error") {
    problems.push(msg.params.args.map((a) => a.value ?? a.description).join(" "));
  }
  if (msg.method === "Log.entryAdded" && msg.params.entry.level === "error") problems.push(msg.params.entry.text);
});
await new Promise((ok, no) => { ws.addEventListener("open", ok); ws.addEventListener("error", no); });
const send = (method, params = {}) => new Promise((ok, no) => {
  const mid = (id += 1);
  pending.set(mid, (m) => (m.error ? no(new Error(method + ": " + m.error.message)) : ok(m.result)));
  ws.send(JSON.stringify({ id: mid, method, params }));
});
const evaluate = async (expression) => {
  const r = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  return r.result.value;
};

await send("Page.enable");
await send("Runtime.enable");
await send("Log.enable");

for (const path of ["/", "/ssc-chsl-photo-signature-size", "/check/ssc-chsl-photo-signature-size", "/custom"]) {
  problems.length = 0;
  await send("Page.navigate", { url: `http://localhost:5201${path}` });
  await new Promise((r) => setTimeout(r, 1200));
  const info = await evaluate(`JSON.stringify({
    path: location.pathname,
    title: document.title,
    h1: document.querySelector("h1")?.textContent?.trim().slice(0, 70) || null,
    css: [...document.styleSheets].length,
    links: document.querySelectorAll("a").length,
    canonical: document.querySelector('link[rel=canonical]')?.href || null,
    lang: document.documentElement.lang
  })`);
  console.log(info, problems.length ? `PROBLEMS: ${JSON.stringify(problems)}` : "clean");
}

ws.close();
chrome.kill();

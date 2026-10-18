// Logged-out X profiles -> top-level post texts (same text the extension sends). Appends to harvest.jsonl.
import fs from 'fs';
const handles = fs.readFileSync(process.argv[2], 'utf8').split(/\s+/).filter(Boolean), OUT = process.argv[3];
const sleep = ms => new Promise(r => setTimeout(r, ms));
let page;
for (let i = 0; i < 40 && !page; i++) { await sleep(500); try { page = (await (await fetch('http://127.0.0.1:9333/json')).json()).find(t => t.type === 'page'); } catch {} }
const ws = new WebSocket(page.webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
let id = 0; const pending = {};
ws.onmessage = e => { const m = JSON.parse(e.data); pending[m.id]?.(m.result); };
const cdp = (method, params = {}) => new Promise(r => { pending[++id] = r; ws.send(JSON.stringify({ id, method, params })); });
const ev = async x => (await cdp('Runtime.evaluate', { expression: x, returnByValue: true }))?.result?.value;
const grab = `[...document.querySelectorAll('article')].filter(a => !a.parentElement.closest('article')).map(a => [a.querySelector('a[href*="/status/"]')?.getAttribute('href').match(/\\/status\\/(\\d+)/)?.[1], a.innerText.replace(/\\n{2,}/g, '\\n').slice(0, 2000)]).filter(x => x[0])`;
for (const h of handles) {
  await cdp('Page.navigate', { url: `https://x.com/${h}` });
  const got = new Map();
  for (let i = 0; i < 8; i++) {
    await sleep(1000);
    for (const [k, v] of (await ev(grab)) || []) got.set(k, v);
    if (i > 2) await ev('window.scrollBy(0, 1200)');
  }
  for (const [k, v] of got) fs.appendFileSync(OUT, JSON.stringify({ id: k, src: h, post: v }) + '\n');
  console.log(h, got.size);
}
process.exit(0);

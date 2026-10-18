// Real extension in headless Chromium on a logged-out X profile: wait for tints, print them, screenshot.
const sleep = ms => new Promise(r => setTimeout(r, ms));
let page;
for (let i = 0; i < 40 && !page; i++) { await sleep(500); try { page = (await (await fetch('http://127.0.0.1:9333/json')).json()).find(t => t.type === 'page' && t.url.includes('x.com')); } catch {} }
const ws = new WebSocket(page.webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
let id = 0; const pending = {};
ws.onmessage = e => { const m = JSON.parse(e.data); pending[m.id]?.(m.result); };
const cdp = (method, params = {}) => new Promise(r => { pending[++id] = r; ws.send(JSON.stringify({ id, method, params })); });
const ev = async x => (await cdp('Runtime.evaluate', { expression: x, returnByValue: true })).result.value;
let r;
for (let i = 0; i < 30; i++) {
  await sleep(1000);
  r = await ev(`[...document.querySelectorAll('article')].filter(a => !a.parentElement.closest('article')).map(a => [a.dataset.worth ?? '-', a.innerText.split('\\n').slice(3,4).join('').slice(0,70)])`);
  if (r.length && r.every(x => x[0] !== '-')) break;
}
console.log(JSON.stringify(r, null, 0).replace(/\],\[/g, ']\n['));
await ev(`window.scrollTo(0, 560)`); await sleep(500);
const shot = await cdp('Page.captureScreenshot', { format: 'png' });
(await import('fs')).writeFileSync(process.argv[2], Buffer.from(shot.data, 'base64'));
process.exit(r.length && r.every(x => x[0] !== '-') ? 0 : 1);

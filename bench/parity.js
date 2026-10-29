// background.js small() in Node vs distill.py predictions on the same 45 posts.
const fs = require('fs'), path = require('path'), ext = path.join(__dirname, '..');
let handler;
globalThis.chrome = { runtime: { onMessage: { addListener: f => (handler = f) },
  getURL: f => 'data:application/json,' + encodeURIComponent(fs.readFileSync(path.join(ext, f), 'utf8')) } };
globalThis.importScripts = f => (0, eval)(fs.readFileSync(path.join(ext, f), 'utf8').replace(/^const /gm, 'globalThis.'));
(0, eval)(fs.readFileSync(path.join(ext, 'background.js'), 'utf8'));
const posts = JSON.parse(fs.readFileSync(process.argv[2])), py = JSON.parse(fs.readFileSync(process.argv[3]));
const h = JSON.parse(fs.readFileSync(path.join(ext, 'head.json')));
(async () => {
  let worst = 0;
  for (let i = 0; i < posts.length; i++) {
    const js = await new Promise(r => handler({ state: { post: posts[i].post } }, null, r));
    if (js.error) throw js.error;
    const want = Math.min(1, Math.max(0, (py[i] - h.lo) / (h.hi - h.lo)));
    worst = Math.max(worst, Math.abs(js.score - want));
  }
  console.log('max |js - python| =', worst.toFixed(4)); process.exit(worst < 0.01 ? 0 : 1);
})();

// Tints each post red (waste) to green (worth it) from Jev's score.
// X recycles article nodes while scrolling, so paint is keyed by post id, not node.
const scores = new Map(); // post id -> 0..1, null while pending, 'err' on failure

// First status link in the article is the post's own (timestamp); quoted post links come later.
const idOf = a => a.querySelector('a[href*="/status/"]')?.getAttribute('href').match(/\/status\/(\d+)/)?.[1];

// Whole visible text of the post: author, handle, age, body, quoted post, link card, counts.
// No data-testid parsing: logged-out X strips those attributes and they get renamed.
const stateOf = a => ({ post: a.innerText.replace(/\n{2,}/g, '\n').slice(0, 2000) });

function paint(a, s) {
  if (typeof s !== 'number') {
    a.style.removeProperty('box-shadow');
    a.style.removeProperty('background');
    delete a.dataset.worth;
    return;
  }
  const hue = Math.round(s * 120); // 0 red, 120 green
  a.style.boxShadow = `inset 4px 0 0 hsl(${hue} 85% 50%)`;
  a.style.background = `hsl(${hue} 85% 45% / 0.13)`;
  a.dataset.worth = s.toFixed(2);
}

function scan() {
  for (const a of document.querySelectorAll('article')) {
    const id = idOf(a);
    if (!id || a.parentElement.closest('article')) continue; // nested = quoted post, scored with its parent
    if (scores.has(id)) { paint(a, scores.get(id)); continue; }
    paint(a, null);
    scores.set(id, null);
    try {
      chrome.runtime.sendMessage({ state: stateOf(a) }, r => {
        if (!r || r.error) console.warn('[xworth]', id, r?.error || chrome.runtime.lastError?.message);
        scores.set(id, r && !r.error ? r.score : 'err');
        scan();
      });
    } catch (e) { console.warn('[xworth] extension reloaded: refresh the page'); return; }
  }
}

// Feed lock: Following only. Selectors skip aria-labels so they hold in any UI language:
// For you is always the first home tab, and every sidebar section/aside is trends, who to
// follow or Premium upsell (search is a form outside them), plus the news card. The :has rules hide
// the bordered card around them; a wider rule (any div above a section) also took search.
if (FEED_LOCK) document.documentElement.append(Object.assign(document.createElement('style'), {
  textContent: `html.xw-home [data-testid="primaryColumn"] [role="tablist"] > [role="presentation"]:first-child,
    [data-testid="sidebarColumn"] :is(section, aside),
    [data-testid="sidebarColumn"] div:is(:has(> [data-testid="news_sidebar"]), :has(> div > aside)) { display: none !important; }`,
}));

function lock() {
  if (!FEED_LOCK) return;
  document.documentElement.classList.toggle('xw-home', location.pathname === '/home');
  const tabs = document.querySelectorAll('html.xw-home [data-testid="primaryColumn"] [role="tablist"] [role="tab"]');
  if (tabs[0]?.getAttribute('aria-selected') === 'true') tabs[1]?.click(); // X remembers the choice
}

let t = 0;
new MutationObserver(() => { t ||= setTimeout(() => { t = 0; lock(); scan(); }, 300); })
  .observe(document.body, { childList: true, subtree: true });
lock();
scan();

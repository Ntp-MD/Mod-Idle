/**
 * The icon gallery, shared by both hosts.
 *
 * `GALLERY_RUNTIME` is the whole client side — search, category tabs, favourites and removal markers — held as a
 * string because the two hosts load it differently. The live wiki (`wiki.html`, Vite) resolves every
 * SVG to a URL and runs this text in the page; `tools/wiki.ts` writes the same text into
 * `docs/wiki/icons.html`, where the icons are read off the disk by relative path, so the page works straight
 * from `file://`. The entries arrive the same way in both: a `#icons-data` JSON block the static build
 * bakes in, or `window.__ICONS__` when a host sets it. No DOM is touched here, so the static build can
 * import this module from Node.
 */

export interface IconEntry {
  /** Where the browser loads the SVG from — a Vite URL live, a relative path static. */
  url: string;
  /** The icon's path under `game/src/icon/`; stable key for favourites and removal markers. */
  path: string;
  /** The filename with dashes turned into spaces — what the search box matches. */
  name: string;
  /** The icon's own folder under `game/src/icon/` — the tab it sits under. */
  category: string;
  /** The category's own subfolder, when the icon has one (skill/aura, misc/stones, …). */
  sub: string;
}

/** One SVG, named the same way in both hosts: `rel` is its path below `game/src/icon/`. */
export function iconEntry(rel: string, url: string): IconEntry {
  const parts = rel.split('/');
  const file = parts[parts.length - 1];
  return {
    url,
    path: rel,
    name: file.replace(/\.(svg|png)$/i, '').replace(/-/g, ' '),
    category: parts.length > 1 ? parts[0] : 'icon',
    sub: parts.length > 2 ? parts.slice(1, -1).join(' ') : '',
  };
}

export const GALLERY_RUNTIME = `(function () {
  var mount = document.getElementById('icons-gallery');
  if (!mount) return;
  var ALL = window.__ICONS__;
  if (!ALL) {
    var block = document.getElementById('icons-data');
    ALL = block && block.textContent ? JSON.parse(block.textContent) : [];
  }
  if (!ALL || !ALL.length) return;

  var CATS = [];
  for (var i = 0; i < ALL.length; i++) if (CATS.indexOf(ALL[i].category) < 0) CATS.push(ALL[i].category);
  CATS.sort();

  var FAV_KEY = 'wiki-icons-favourites';
  var MARK_KEY = 'wiki-icons-marked-for-removal';
  var favs = readFavs();
  var marked = readMarked();
  var search = '';
  var category = 'all';
  var showFavs = false;
  var showMarked = false;

  function readFavs() {
    try {
      var raw = JSON.parse(localStorage.getItem(FAV_KEY) || '[]');
      return (Array.isArray(raw) ? raw : []).filter(function (p) { return typeof p === 'string'; });
    } catch (e) { return []; }
  }
  function writeFavs() {
    /* a star that cannot be stored simply does not persist: private mode, quota, storage shut off */
    try { localStorage.setItem(FAV_KEY, JSON.stringify(favs)); } catch (e) {}
  }
  function readMarked() {
    try {
      var raw = JSON.parse(localStorage.getItem(MARK_KEY) || '[]');
      return (Array.isArray(raw) ? raw : []).filter(function (p) { return typeof p === 'string'; });
    } catch (e) { return []; }
  }
  function writeMarked() {
    try { localStorage.setItem(MARK_KEY, JSON.stringify(marked)); } catch (e) {}
  }
  var availablePaths = Object.create(null);
  for (var a = 0; a < ALL.length; a++) availablePaths[ALL[a].path] = true;
  var savedMarkedCount = marked.length;
  var seenMarked = Object.create(null);
  marked = marked.filter(function (p) {
    if (!availablePaths[p] || seenMarked[p]) return false;
    seenMarked[p] = true;
    return true;
  });
  if (marked.length !== savedMarkedCount) writeMarked();
  function hasFav(p) { return favs.indexOf(p) >= 0; }
  function hasMark(p) { return marked.indexOf(p) >= 0; }
  function toggleFav(p) {
    var at = favs.indexOf(p);
    if (at >= 0) favs.splice(at, 1); else favs.push(p);
    writeFavs();
  }

  function toggleMark(p) {
    var at = marked.indexOf(p);
    if (at >= 0) marked.splice(at, 1); else marked.push(p);
    writeMarked();
  }

  var searchInput = document.createElement('input');
  searchInput.type = 'search';
  searchInput.placeholder = 'Search ' + ALL.length + ' icons…';
  searchInput.setAttribute('aria-label', 'Search icons');
  searchInput.style.cssText = 'width:100%;padding:.4rem .6rem;margin-bottom:.6rem;background:var(--panel);border:1px solid var(--line);border-radius:var(--radius-sm);color:var(--text);font:inherit;';

  var tabs = document.createElement('div');
  tabs.style.cssText = 'display:flex;flex-wrap:wrap;gap:.3rem;margin-bottom:.8rem;';

  var count = document.createElement('p');
  count.style.cssText = 'margin:0 0 .5rem;font-size:var(--font-xs);color:var(--dim);';

  var grid = document.createElement('div');
  grid.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fill,minmax(96px,1fr));gap:.5rem;';

  var TAB_ON = 'padding:.25rem .6rem;border:1px solid var(--gold);border-radius:var(--radius-sm);background:var(--gold);color:#000;cursor:pointer;font-size:var(--font-xs);';
  var TAB_OFF = 'padding:.25rem .6rem;border:1px solid var(--line);border-radius:var(--radius-sm);background:transparent;color:var(--text);cursor:pointer;font-size:var(--font-xs);';

  function renderTabs() {
    tabs.textContent = '';
    var cats = ['all'].concat(CATS, ['favourites', 'marked']);
    var press = function (cat) {
      if (cat === 'favourites') { showFavs = true; showMarked = false; }
      else if (cat === 'marked') { showFavs = false; showMarked = true; }
      else { showFavs = false; showMarked = false; category = cat; }
      render();
    };
    for (var i = 0; i < cats.length; i++) {
      var cat = cats[i];
      var btn = document.createElement('button');
      btn.textContent = cat === 'all' ? 'All' : cat === 'favourites' ? '★ Favourites' : cat === 'marked' ? 'Marked (' + marked.length + ')' : cat;
      var active = cat === 'marked' ? showMarked : cat === 'favourites' ? showFavs : !showFavs && !showMarked && category === cat;
      btn.style.cssText = active ? TAB_ON : TAB_OFF;
      btn.onclick = press.bind(null, cat);
      tabs.appendChild(btn);
    }
  }

  function keeps(item) {
    if (showMarked && !hasMark(item.path)) return false;
    if (!showMarked && hasMark(item.path)) return false;
    if (!showMarked && showFavs && !hasFav(item.path)) return false;
    if (!showMarked && !showFavs && category !== 'all' && item.category !== category) return false;
    if (!search) return true;
    return item.name.toLowerCase().indexOf(search) >= 0
      || item.category.indexOf(search) >= 0
      || item.sub.indexOf(search) >= 0;
  }

  function card(item) {
    var el = document.createElement('div');
    el.style.cssText = 'border:1px solid var(--line);border-radius:var(--radius-sm);padding:.4rem;text-align:center;position:relative;background:var(--panel);';

    var on = hasFav(item.path);
    var star = document.createElement('button');
    star.textContent = on ? '★' : '☆';
    star.title = on ? 'Remove favourite' : 'Mark favourite';
    star.style.cssText = 'position:absolute;top:2px;right:2px;background:none;border:none;cursor:pointer;font-size:var(--font-xs);color:var(--gold);padding:0;';
    star.onclick = function (e) { e.stopPropagation(); toggleFav(item.path); render(); };

    var isMarked = hasMark(item.path);
    var marker = document.createElement('button');
    marker.type = 'button';
    marker.setAttribute('aria-label', (isMarked ? 'Unmark ' : 'Mark ') + item.name + ' for removal');
    marker.title = isMarked ? 'Unmark for removal' : 'Mark for removal';
    marker.style.cssText = 'position:absolute;top:2px;left:2px;display:flex;align-items:center;justify-content:center;width:var(--icon-sm);height:var(--icon-sm);padding:0;border:1px solid var(--line);border-radius:var(--radius-round);background:' + (isMarked ? 'var(--gold)' : 'var(--panel)') + ';color:' + (isMarked ? 'var(--bg)' : 'var(--dim)') + ';cursor:pointer;';
    marker.onmouseenter = function () { marker.style.background = isMarked ? 'var(--gold)' : 'var(--surface-selected)'; };
    marker.onmouseleave = function () { marker.style.background = isMarked ? 'var(--gold)' : 'var(--panel)'; };
    marker.onfocus = function () { marker.style.outline = '2px solid var(--focus)'; };
    marker.onblur = function () { marker.style.outline = ''; };
    var flag = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    flag.setAttribute('viewBox', '0 0 16 16');
    flag.setAttribute('aria-hidden', 'true');
    flag.style.cssText = 'width:var(--icon-xs);height:var(--icon-xs);';
    var flagPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    flagPath.setAttribute('d', 'M4 14V3m0 1h8l-2 3 2 3H4');
    flagPath.setAttribute('fill', 'none');
    flagPath.setAttribute('stroke', 'currentColor');
    flagPath.setAttribute('stroke-width', '1.8');
    flagPath.setAttribute('stroke-linecap', 'round');
    flagPath.setAttribute('stroke-linejoin', 'round');
    flag.appendChild(flagPath);
    marker.appendChild(flag);
    marker.onclick = function (e) { e.stopPropagation(); toggleMark(item.path); render(); };

    var img = document.createElement('img');
    img.src = item.url;
    img.alt = item.name;
    img.loading = 'lazy';
    img.style.cssText = 'width:48px;height:48px;display:block;margin:0 auto;';

    var label = document.createElement('div');
    label.textContent = item.name;
    label.title = item.path;
    label.style.cssText = 'font-size:var(--font-xs);color:var(--dim);margin-top:.25rem;word-break:break-all;line-height:1.25;';

    el.appendChild(star);
    el.appendChild(marker);
    el.appendChild(img);
    el.appendChild(label);
    return el;
  }

  function render() {
    renderTabs();
    var items = ALL.filter(keeps);
    var visibleTotal = showMarked ? marked.length : ALL.length - marked.length;
    count.textContent = items.length + ' of ' + visibleTotal + ' icons'
      + (showMarked ? ' marked for removal' : marked.length ? ' — ' + marked.length + ' marked and hidden' : '');
    grid.textContent = '';
    for (var i = 0; i < items.length; i++) grid.appendChild(card(items[i]));
  }

  searchInput.oninput = function () {
    search = searchInput.value.trim().toLowerCase();
    render();
  };

  mount.textContent = '';
  mount.appendChild(searchInput);
  mount.appendChild(tabs);
  mount.appendChild(count);
  mount.appendChild(grid);
  render();
})();`;

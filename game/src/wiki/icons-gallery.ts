/**
 * The icon gallery, shared by both hosts.
 *
 * `GALLERY_RUNTIME` is the whole client side — search, category tabs and a per-icon star — held as a
 * string because the two hosts load it differently. The live wiki (`wiki.html`, Vite) resolves every
 * SVG to a URL and runs this text in the page; `tools/wiki.ts` writes the same text into
 * `wiki/icons.html`, where the icons are read off the disk by relative path, so the page works straight
 * from `file://`. The entries arrive the same way in both: a `#icons-data` JSON block the static build
 * bakes in, or `window.__ICONS__` when a host sets it. No DOM is touched here, so the static build can
 * import this module from Node.
 */

export interface IconEntry {
  /** Where the browser loads the SVG from — a Vite URL live, a relative path static. */
  url: string;
  /** The icon's path under `game/src/icon/`; the favourite key, so a star survives a host switch. */
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
    name: file.replace(/\.svg$/, '').replace(/-/g, ' '),
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
  var favs = readFavs();
  var search = '';
  var category = 'all';
  var showFavs = false;

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
  function hasFav(p) { return favs.indexOf(p) >= 0; }
  function toggleFav(p) {
    var at = favs.indexOf(p);
    if (at >= 0) favs.splice(at, 1); else favs.push(p);
    writeFavs();
  }

  var searchInput = document.createElement('input');
  searchInput.type = 'search';
  searchInput.placeholder = 'Search ' + ALL.length + ' icons…';
  searchInput.setAttribute('aria-label', 'Search icons');
  searchInput.style.cssText = 'width:100%;padding:.4rem .6rem;margin-bottom:.6rem;background:var(--panel);border:1px solid var(--line);border-radius:var(--radius-sm);color:var(--text);font:inherit;';

  var tabs = document.createElement('div');
  tabs.style.cssText = 'display:flex;flex-wrap:wrap;gap:.3rem;margin-bottom:.8rem;';

  var count = document.createElement('p');
  count.style.cssText = 'margin:0 0 .5rem;font-size:.78rem;color:var(--dim);';

  var grid = document.createElement('div');
  grid.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fill,minmax(96px,1fr));gap:.5rem;';

  var TAB_ON = 'padding:.25rem .6rem;border:1px solid var(--gold);border-radius:var(--radius-sm);background:var(--gold);color:#000;cursor:pointer;font-size:.75rem;';
  var TAB_OFF = 'padding:.25rem .6rem;border:1px solid var(--line);border-radius:var(--radius-sm);background:transparent;color:var(--text);cursor:pointer;font-size:.75rem;';

  function renderTabs() {
    tabs.textContent = '';
    var cats = ['all'].concat(CATS, ['favourites']);
    var press = function (cat) {
      if (cat === 'favourites') showFavs = true;
      else { showFavs = false; category = cat; }
      render();
    };
    for (var i = 0; i < cats.length; i++) {
      var cat = cats[i];
      var btn = document.createElement('button');
      btn.textContent = cat === 'all' ? 'All' : cat === 'favourites' ? '★ Favourites' : cat;
      var active = cat === 'favourites' ? showFavs : !showFavs && category === cat;
      btn.style.cssText = active ? TAB_ON : TAB_OFF;
      btn.onclick = press.bind(null, cat);
      tabs.appendChild(btn);
    }
  }

  function keeps(item) {
    if (showFavs && !hasFav(item.path)) return false;
    if (!showFavs && category !== 'all' && item.category !== category) return false;
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
    star.style.cssText = 'position:absolute;top:2px;right:2px;background:none;border:none;cursor:pointer;font-size:.95rem;color:var(--gold);padding:0;';
    star.onclick = function (e) { e.stopPropagation(); toggleFav(item.path); render(); };

    var img = document.createElement('img');
    img.src = item.url;
    img.alt = item.name;
    img.loading = 'lazy';
    img.style.cssText = 'width:48px;height:48px;display:block;margin:0 auto;';

    var label = document.createElement('div');
    label.textContent = item.name;
    label.title = item.path;
    label.style.cssText = 'font-size:.62rem;color:var(--dim);margin-top:.25rem;word-break:break-all;line-height:1.25;';

    el.appendChild(star);
    el.appendChild(img);
    el.appendChild(label);
    return el;
  }

  function render() {
    renderTabs();
    var items = ALL.filter(keeps);
    count.textContent = items.length + ' of ' + ALL.length + ' icons'
      + (items.length < ALL.length ? ' — All shows the rest' : '');
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

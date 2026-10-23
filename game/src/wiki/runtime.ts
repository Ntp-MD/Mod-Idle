/**
 * The wiki's small client runtime — one string, two hosts. `main.ts` executes it after every paint
 * (the live wiki swaps the body in place); the static build embeds it at the end of each document.
 * It owns only chrome: the mobile chapter menu, the index search and the section tracker. No figure
 * and no route lives here.
 */
export const WIKI_RUNTIME = `
(function () {
  var shell = document.querySelector('.wiki-shell');
  var menu = document.querySelector('[data-wiki-menu]');
  if (menu && shell) {
    menu.addEventListener('click', function () {
      var open = shell.classList.toggle('nav-open');
      menu.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  }
  var skip = document.querySelector('[data-skip]');
  if (skip) skip.addEventListener('click', function () {
    var main = document.getElementById('wiki-main');
    if (main) { main.focus(); main.scrollIntoView({ block: 'start' }); }
  });
  var input = document.getElementById('wiki-search');
  var results = document.getElementById('wiki-search-results');
  var links = Array.prototype.slice.call(document.querySelectorAll('[data-page-link]'));
  var close = function () { if (results) { results.hidden = true; results.innerHTML = ''; } };
  if (input && results) {
    var render = function () {
      var q = input.value.trim().toLowerCase();
      if (!q) { close(); return; }
      var hits = links.filter(function (a) {
        return (a.getAttribute('data-search') || '').toLowerCase().indexOf(q) >= 0;
      }).slice(0, 8);
      results.innerHTML = '';
      if (!hits.length) {
        var none = document.createElement('p');
        none.className = 'search-none';
        none.textContent = 'No chapter matches.';
        results.appendChild(none);
      } else {
        hits.forEach(function (a) {
          var hit = document.createElement('a');
          hit.className = 'search-hit';
          hit.href = a.getAttribute('href');
          var title = document.createElement('span');
          title.textContent = a.getAttribute('data-title') || '';
          var group = document.createElement('small');
          group.textContent = a.getAttribute('data-group') || '';
          hit.appendChild(title);
          hit.appendChild(group);
          results.appendChild(hit);
        });
      }
      results.hidden = false;
    };
    input.addEventListener('input', render);
    input.addEventListener('focus', render);
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { input.value = ''; close(); input.blur(); }
      if (e.key === 'Enter') {
        var first = results.querySelector('a');
        if (first) { e.preventDefault(); first.click(); }
      }
    });
    if (!window.__wikiSearchOutside) {
      window.__wikiSearchOutside = true;
      document.addEventListener('click', function (e) {
        var box = document.querySelector('.search');
        if (box && !box.contains(e.target)) {
          var r = document.getElementById('wiki-search-results');
          if (r) { r.hidden = true; r.innerHTML = ''; }
        }
      });
      document.addEventListener('keydown', function (e) {
        var field = document.getElementById('wiki-search');
        if (!field) return;
        if (e.key === '/' && document.activeElement !== field && !/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName)) {
          e.preventDefault(); field.focus();
        }
      });
    }
    var q = new URLSearchParams(window.location.search).get('q');
    if (q) { input.value = q; render(); }
  }
  Array.prototype.forEach.call(document.querySelectorAll('[data-scroll]'), function (b) {
    b.addEventListener('click', function () {
      var target = document.getElementById(b.getAttribute('data-scroll'));
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      if (shell) shell.classList.remove('nav-open');
    });
  });
  var toc = Array.prototype.slice.call(document.querySelectorAll('[data-toc]'));
  if (toc.length && 'IntersectionObserver' in window) {
    var seen = {};
    toc.forEach(function (a) { seen[a.getAttribute('data-toc')] = a; });
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        toc.forEach(function (a) { a.classList.toggle('on', a === seen[en.target.id]); });
      });
    }, { rootMargin: '-15% 0px -70% 0px' });
    Array.prototype.forEach.call(document.querySelectorAll('.page-content > section[id]'), function (s) { io.observe(s); });
  }
  Array.prototype.forEach.call(document.querySelectorAll('.wiki-nav [data-page-link]'), function (a) {
    a.addEventListener('click', function () { if (shell) shell.classList.remove('nav-open'); });
  });

  // The passive-tree board: a viewBox camera over the canonical SVG, with a node card that follows
  // the hovered or pinned node exactly as the game's board does.
  var treeView = document.querySelector('[data-tree-view]');
  if (treeView) {
    var treeSvg = treeView.querySelector('svg[data-tree-svg]');
    var treeStage = treeView.querySelector('[data-tree-stage]');
    if (treeSvg && treeStage) {
      var treeCard = treeView.querySelector('[data-tree-card]');
      var treeZoomLabel = treeView.querySelector('[data-tree-zoom-label]');
      var readTreeBox = function () {
        var v = (treeSvg.getAttribute('viewBox') || '').split(' ').map(Number);
        return { x: v[0] || 0, y: v[1] || 0, w: v[2] || 1, h: v[3] || 1 };
      };
      var treeFit = readTreeBox();
      var treeCamera = { x: treeFit.x, y: treeFit.y, w: treeFit.w, h: treeFit.h };
      var treeClamp = function (v, lo, hi) { return Math.max(lo, Math.min(hi, v)); };
      var applyTree = function () {
        treeSvg.setAttribute('viewBox', [treeCamera.x, treeCamera.y, treeCamera.w, treeCamera.h].join(' '));
        if (treeZoomLabel) treeZoomLabel.textContent = Math.round((treeFit.w / treeCamera.w) * 100) + '%';
        if (treeHover || treePinned) placeTreeCard(treeHover || treePinned);
      };
      var zoomTree = function (factor, px, py) {
        var nextW = treeClamp(treeCamera.w / factor, treeFit.w / 8, treeFit.w / 0.65);
        var nextH = nextW * (treeFit.h / treeFit.w);
        var wx = treeCamera.x + px * treeCamera.w;
        var wy = treeCamera.y + py * treeCamera.h;
        treeCamera.x = wx - px * nextW;
        treeCamera.y = wy - py * nextH;
        treeCamera.w = nextW;
        treeCamera.h = nextH;
        applyTree();
      };
      var zoomTreeCenter = function (factor) { zoomTree(factor, 0.5, 0.5); };
      var treeChips = Array.prototype.slice.call(treeView.querySelectorAll('[data-tree-region]'));
      var clearTreeChips = function () {
        treeChips.forEach(function (chip) { chip.classList.remove('on'); chip.setAttribute('aria-pressed', 'false'); });
      };
      var fitTree = function () {
        treeCamera = { x: treeFit.x, y: treeFit.y, w: treeFit.w, h: treeFit.h };
        applyTree();
        clearTreeChips();
      };
      var fitBtn = treeView.querySelector('[data-tree-fit]');
      if (fitBtn) fitBtn.addEventListener('click', fitTree);
      Array.prototype.forEach.call(treeView.querySelectorAll('[data-tree-zoom]'), function (b) {
        b.addEventListener('click', function () { zoomTreeCenter(Number(b.getAttribute('data-tree-zoom')) || 1); });
      });
      treeChips.forEach(function (chip) {
        chip.addEventListener('click', function () {
          var wing = chip.getAttribute('data-tree-region');
          var list = treeView.querySelectorAll('.wiki-tree-node.' + wing);
          var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
          Array.prototype.forEach.call(list, function (n) {
            var x = Number(n.getAttribute('data-x'));
            var y = Number(n.getAttribute('data-y'));
            if (!isFinite(x) || !isFinite(y)) return;
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          });
          if (!isFinite(minX) || !isFinite(minY)) return;
          var pad = 70;
          var w = Math.max(1, maxX - minX + pad * 2);
          var h = Math.max(1, maxY - minY + pad * 2);
          var ratio = treeFit.h / treeFit.w;
          if (h / w < ratio) h = w * ratio;
          else w = h / ratio;
          treeCamera = { x: (minX + maxX) / 2 - w / 2, y: (minY + maxY) / 2 - h / 2, w: w, h: h };
          applyTree();
          clearTreeChips();
          chip.classList.add('on');
          chip.setAttribute('aria-pressed', 'true');
        });
      });
      var treeDrag = null, treeMoved = false, treeHover = null, treePinned = null;
      var placeTreeCard = function (node) {
        if (!node || !treeCard || treeCard.hidden) return;
        var nr = node.getBoundingClientRect();
        var sr = treeStage.getBoundingClientRect();
        var cw = treeCard.offsetWidth;
        var ch = treeCard.offsetHeight;
        var x = nr.left + nr.width / 2 - sr.left + 18;
        if (x + cw > sr.width - 12) x = nr.left - sr.left - cw - 18;
        x = Math.max(12, Math.min(sr.width - cw - 12, x));
        var y = nr.top - sr.top + nr.height / 2 - ch / 2;
        y = Math.max(12, Math.min(sr.height - ch - 12, y));
        treeCard.style.left = x + 'px';
        treeCard.style.top = y + 'px';
      };
      var hideTreeCard = function () { if (treeCard) treeCard.hidden = true; };
      var showTreeCard = function (node) {
        if (!treeCard) return;
        var name = node.getAttribute('data-name') || 'Node';
        var meta = node.getAttribute('data-meta') || '';
        var text = node.getAttribute('data-detail') || '';
        treeCard.innerHTML = '';
        var title = document.createElement('strong');
        title.textContent = name;
        var line = document.createElement('span');
        line.className = 'tree-card-meta';
        line.textContent = meta;
        treeCard.appendChild(title);
        treeCard.appendChild(line);
        if (text) {
          var body = document.createElement('p');
          body.textContent = text;
          treeCard.appendChild(body);
        }
        treeCard.hidden = false;
        placeTreeCard(node);
      };
      var pickTreeNode = function (node) {
        Array.prototype.forEach.call(treeView.querySelectorAll('.wiki-tree-node.picked'), function (n) { n.classList.remove('picked'); });
        node.classList.add('picked');
      };
      Array.prototype.forEach.call(treeView.querySelectorAll('.wiki-tree-node'), function (node) {
        node.addEventListener('pointerenter', function () {
          if (treeMoved) return;
          treeHover = node;
          showTreeCard(node);
        });
        node.addEventListener('pointerleave', function () {
          treeHover = null;
          if (treePinned) showTreeCard(treePinned);
          else hideTreeCard();
        });
        node.addEventListener('click', function () {
          if (treeMoved) return;
          treePinned = node;
          pickTreeNode(node);
          showTreeCard(node);
        });
      });
      treeStage.addEventListener('pointerleave', function () {
        treeHover = null;
        if (treePinned) showTreeCard(treePinned);
        else hideTreeCard();
      });
      treeStage.addEventListener('click', function (e) {
        if (treeMoved) return;
        var target = e.target;
        if (target && target.closest && target.closest('.wiki-tree-node')) return;
        treePinned = null;
        treeHover = null;
        Array.prototype.forEach.call(treeView.querySelectorAll('.wiki-tree-node.picked'), function (n) { n.classList.remove('picked'); });
        hideTreeCard();
      });
      treeStage.addEventListener('pointerdown', function (e) {
        if (e.button != null && e.button !== 0) return;
        treeDrag = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: false };
        treeMoved = false;
        try { treeStage.setPointerCapture(e.pointerId); } catch (err) {}
        treeStage.classList.add('dragging');
      });
      treeStage.addEventListener('pointermove', function (e) {
        if (!treeDrag || e.pointerId !== treeDrag.id) return;
        var rect = treeStage.getBoundingClientRect();
        var dx = (e.clientX - treeDrag.x) * (treeCamera.w / Math.max(1, rect.width));
        var dy = (e.clientY - treeDrag.y) * (treeCamera.h / Math.max(1, rect.height));
        if (Math.abs(e.clientX - treeDrag.x) + Math.abs(e.clientY - treeDrag.y) > 2) {
          treeDrag.moved = true;
          treeMoved = true;
        }
        if (!treeDrag.moved) return;
        treeCamera.x -= dx;
        treeCamera.y -= dy;
        treeDrag.x = e.clientX;
        treeDrag.y = e.clientY;
        applyTree();
      });
      var endTreeDrag = function (e) {
        if (!treeDrag || (e.pointerId != null && e.pointerId !== treeDrag.id)) return;
        try { if (treeStage.hasPointerCapture(treeDrag.id)) treeStage.releasePointerCapture(treeDrag.id); } catch (err) {}
        treeDrag = null;
        treeStage.classList.remove('dragging');
        setTimeout(function () { treeMoved = false; }, 0);
      };
      treeStage.addEventListener('pointerup', endTreeDrag);
      treeStage.addEventListener('pointercancel', endTreeDrag);
      treeStage.addEventListener('wheel', function (e) {
        e.preventDefault();
        var rect = treeStage.getBoundingClientRect();
        var px = (e.clientX - rect.left) / Math.max(1, rect.width);
        var py = (e.clientY - rect.top) / Math.max(1, rect.height);
        zoomTree(e.deltaY < 0 ? 1.18 : 1 / 1.18, px, py);
      }, { passive: false });
      treeStage.addEventListener('keydown', function (e) {
        var step = 0.12;
        var handled = true;
        if (e.key === 'ArrowLeft') treeCamera.x -= treeCamera.w * step;
        else if (e.key === 'ArrowRight') treeCamera.x += treeCamera.w * step;
        else if (e.key === 'ArrowUp') treeCamera.y -= treeCamera.h * step;
        else if (e.key === 'ArrowDown') treeCamera.y += treeCamera.h * step;
        else if (e.key === '+' || e.key === '=') zoomTreeCenter(1.2);
        else if (e.key === '-' || e.key === '_') zoomTreeCenter(0.83);
        else if (e.key === '0') fitTree();
        else handled = false;
        if (!handled) return;
        e.preventDefault();
        if (e.key !== '+' && e.key !== '=' && e.key !== '-' && e.key !== '_' && e.key !== '0') applyTree();
      });
      applyTree();
    }
  }
})();
`;

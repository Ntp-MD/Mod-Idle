/** Paint resolved content and signals. No state, engine, discovery or species lookups here. */
import type { MapDomIndex } from './map-dom';
import type { MapCellIcon, MapPaintModel } from '../map-types';
import { layoutHexContent, type HexContentLayout } from '../map-content-layout';

const NS = 'http://www.w3.org/2000/svg';
const esc = (s: string) => s.replace(/[<>&"']/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[c]!);
const rendered = new WeakMap<Element, string>();
const set = (el: Element, key: string, value: string) => { if (el.getAttribute(key) !== value) el.setAttribute(key, value); };

/** One in-hex layout for every cell. Asset resolution never determines gameplay or icon size. */
export function hexContentMarkup(name: string, level: string, icons: readonly MapCellIcon[], layout: HexContentLayout): string {
  const caption = name.length > layout.nameCharacters ? name.slice(0, layout.nameCharacters - 1) + '…' : name;
  const row = layout.icons.map((slot, i) => {
    const item = icons[i];
    const border = item.unique
      ? `<rect class="hex-icon-unique" x="${slot.x.toFixed(3)}" y="${slot.y.toFixed(3)}" width="${slot.size}" height="${slot.size}" stroke-width="${layout.uniqueStroke}"/>`
      : '';
    return `<image class="hex-icon${item.unique ? ' is-unique' : ''}${item.quiet ? ' is-quiet' : ''}" data-icon-role="${item.role}" href="${esc(item.href)}" x="${slot.x.toFixed(3)}" y="${slot.y.toFixed(3)}" width="${slot.size}" height="${slot.size}" preserveAspectRatio="xMidYMid meet"><title>${esc(item.label)}</title></image>${border}`;
  }).join('');
  const overflow = layout.extra ? `<text class="hex-overflow" x="0" y="${layout.overflow.y}" font-size="${layout.overflow.fontSize}" stroke-width="${layout.textOutline}">+${layout.extra}</text>` : '';
  if (!name && !level && !row) return '';
  return (name ? `<text class="hex-name" x="0" y="${layout.name.y}" font-size="${layout.name.fontSize}" stroke-width="${layout.textOutline}" text-anchor="middle">${esc(caption)}</text>` : '')
    + (level ? `<text class="hex-level" x="0" y="${layout.level.y}" font-size="${layout.level.fontSize}" stroke-width="${layout.textOutline}">${esc(level)}</text>` : '')
    + (row ? `<g class="hex-icons">${row}${overflow}</g>` : '');
}

function render(host: Element, markup: string): boolean {
  if (rendered.get(host) === markup) return false;
  host.innerHTML = markup;
  rendered.set(host, markup);
  return true;
}

export function paintMapContent(index: MapDomIndex, model: MapPaintModel) {
  const { showNames, cleanMap } = model.surface.options;
  // D1: icons show every semantic fact the model carries; Show Names owns text only.
  const textOn = showNames && !cleanMap;
  const marks = new Map(model.adventure.marks.map(mark => [mark.ax, mark]));
  const contents = new Map(model.content.map(content => [content.ax, content]));
  const placements = new Map(model.adventure.placements.map(placement => [placement.ax, placement]));
  for (const cell of index.cells) {
    const mark = marks.get(cell.ax), content = contents.get(cell.ax), placement = placements.get(cell.ax);
    if (mark) {
      set(cell.polygon, 'data-discovery', mark.discovery);
      set(cell.polygon, 'data-threat', mark.threat || 'none');
      set(cell.polygon, 'data-signal-count', placement ? '1' : '0');
      for (const host of [cell.figure, cell.actor]) {
        if (!host) continue;
        set(host, 'data-discovery', mark.discovery);
        set(host, 'data-activity', mark.activity);
        set(host, 'data-camp', String(mark.camp));
        set(host, 'data-picked', String(mark.picked));
      }
    }
    const title = cell.polygon.querySelector('title');
    if (title && content && title.textContent !== content.title) title.textContent = content.title;
    const trail = placement?.source === 'trail';
    set(cell.polygon, 'data-trail-claimed', String(trail && placement.cls.includes('is-explored')));
    set(cell.polygon, 'data-trail-name', trail ? placement.label.split(' · ')[0] : '');
    if (cell.figure) set(cell.figure, 'data-trail-site', 'false');

    let group = cell.scenery.querySelector<SVGGElement>('.map-hex-content');
    const name = textOn ? (content?.name ?? '') : '';
    const level = textOn ? (content?.levelText ?? '') : '';
    const layout = content ? layoutHexContent(cell.radius, content.icons.length) : null;
    const markup = layout && content ? hexContentMarkup(name, level, content.icons, layout) : '';
    if (!markup) group?.remove();
    else {
      if (!group) {
        group = document.createElementNS(NS, 'g');
        group.setAttribute('class', 'map-hex-content');
        group.setAttribute('pointer-events', 'none');
        cell.scenery.prepend(group);
      }
      if (render(group, markup)) {
        for (const role of ['name', 'level', 'overflow'] as const) {
          const text = group.querySelector<SVGTextElement>('.hex-' + role);
          if (text && text.getComputedTextLength() > layout![role].maxWidth) {
            text.setAttribute('textLength', String(layout![role].maxWidth));
            text.setAttribute('lengthAdjust', 'spacingAndGlyphs');
          }
        }
      }
    }
  }
}

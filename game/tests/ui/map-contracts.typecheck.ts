import type { AdventurePlacement, MapCellContent, MapPaintModel } from '../../src/ui/map/map-types';
import { layoutHexContent, type HexContentLayout } from '../../src/ui/map/map-content-layout';
declare const layout: HexContentLayout;
// @ts-expect-error Consumers cannot change the computed sizing profile.
layout.icons[0].size = 100;
// @ts-expect-error Callers cannot supply ad hoc sizing overrides.
layoutHexContent(15, 4, { iconSize: 100 });

declare const signal: AdventurePlacement;
declare const content: MapCellContent;
// @ts-expect-error Per-icon sizing is not part of the content contract.
content.icons = [{ href: '/icon.png', label: '', role: 'mob', width: 100 }];
// @ts-expect-error Model signals carry descriptors; SVG belongs to the painter.
signal.art = '<svg/>';
// @ts-expect-error A DOM node cannot become a content title.
content.title = document.createElement('span');
// @ts-expect-error Icons carry resolved image hrefs, never DOM nodes.
content.icons = [{ href: document.createElement('img'), label: '', role: 'mob' }];
declare const model: MapPaintModel;
// @ts-expect-error Painters cannot rewrite the snapshot's view settings.
model.surface.options.view = 'gate';
// @ts-expect-error Rendering cannot append signals to the resolved snapshot.
model.adventure.placements.push(signal);

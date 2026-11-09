/** Shared map DTOs. No runtime imports, DOM nodes, GameState or SVG markup. */
import type { FieldSite } from '@sim/core/types';
import type { MapKnowledge } from '@sim/world/map-exploration';
import type { MapPoint } from './map-camera';

/** Axial identity is the world key below the SVG; display keys such as A1 are presentation. */
export type AxialKey = `${number},${number}`;

export type PickedKind = 'town' | 'sub' | 'bare';
/** The clicked cell's presentation identity: its display key is not world identity. */
export interface Picked {
  key: string;
  q: number;
  r: number;
  kind: PickedKind;
  label: string;
  sub: number | null;
  site: FieldSite | null;
  terrain: string | null;
  /** The owning settlement when the sheet names one; display/selection support only. */
  nodeId?: string | null;
}

export interface MapViewOptions {
  view: 'terrain' | 'band' | 'gate';
  gateLevel: number;
  showIds: boolean;
  showWalk: boolean;
  townId: string;
  showNames: boolean;
  cleanMap: boolean;
  showHexCalibration: boolean;
  /** Upright relief figures (forest/rock/town dioramas). Off by default; flat ground always stays. */
  relief: boolean;
}

export interface MapStaticCell {
  ax: AxialKey;
  picked: Picked;
  nodeId: string | null;
  zone: number | null;
  originalTitle: string;
  tone: string;
  edgeOpacity: number;
  band: number | null;
  center: MapPoint;
  radius: number;
  points: readonly MapPoint[];
}

export interface MapCellContent {
  ax: AxialKey;
  /** Ready to paint: empty for unknown fields, complete name otherwise. */
  name: string;
  levelText: string;
  title: string;
  icons: readonly MapCellIcon[];
}

export interface MapPaintModel {
  readonly surface: Readonly<{
    options: Readonly<MapViewOptions>;
    playerAx: AxialKey;
    selectedAx: AxialKey | null;
    campAx: AxialKey | null;
    selectedTown: string | null;
    hereTown: string | null;
    targetTown: string | null;
    pinHereAx: AxialKey | null;
    pinTargetAx: AxialKey | null;
    walking: boolean;
    route: readonly AxialKey[];
    walked: readonly AxialKey[];
    cells: readonly Readonly<{ ax: AxialKey; fill: string; opacity: number; locked: boolean }>[];
  }>;
  readonly adventure: Readonly<{
    marks: readonly Readonly<AdventureMark>[];
    placements: readonly Readonly<AdventurePlacement>[];
  }>;
  readonly content: readonly Readonly<MapCellContent>[];
}


export interface AdventureMark {
  ax: string;
  discovery: MapKnowledge;
  activity: string;
  uniqueSpecies?: string;
  threat?: 'territory' | 'unique-possible' | 'warning' | 'combat' | 'boss';
  camp: boolean;
  picked: boolean;
  roster: readonly string[];
}
export type AdventureSource = 'mob' | 'camp-encounter' | 'camp' | 'trail' | 'resource';
export interface MapCellIcon {
  readonly href: string;
  readonly label: string;
  readonly role: 'player' | 'town' | 'site' | 'mob' | 'signal';
  readonly unique?: boolean;
  readonly quiet?: boolean;
}
export interface AdventureIcon {
  readonly kind: 'mob' | 'boss' | 'event' | 'unknown' | 'camp' | 'resource';
  readonly href: string;
  readonly quiet?: boolean;
}
/** Semantic signals only. SVG and pixel placement belong to render/. */
export interface AdventurePlacement {
  ax: string;
  cls: string;
  label: string;
  icon: AdventureIcon;
  source: AdventureSource;
  combat: boolean;
}
export interface AdventureView { marks: AdventureMark[]; placements: AdventurePlacement[] }

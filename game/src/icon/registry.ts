/** Stable entity IDs can opt into a specific piece of art here. Otherwise the resolver tries the
 * ID/name convention, then the registered category fallback. Missing art therefore stays visible. */
export const ICON_REGISTRY = {
  gear: {
    byBase: {} as Record<string, string>,
  },
  item: {
    byId: {
      'food:hunters_roast': 'hunter-s-roast',
      'food:soldiers_ration': 'soldier-s-ration',
    } as Record<string, string>,
    fallbackByGroup: {
      stones: ['crystal-cluster-1'],
      herbs: ['herb-bundle', 'leaf'],
      materials: ['minerals'],
      draughts: ['hp-potion'],
      condensed: ['rainbow-potion'],
      food: ['food-roast-meat'],
      junk: ['junk-items', 'dread-skull'],
      default: ['currency-strongbox'],
    } as Record<string, string[]>,
  },
  skill: {
    byId: { 'attack.fireball': 'fireball' } as Record<string, string>,
    fallbackByType: {
      attack: 'type-active-skill',
      buff: 'type-buff-skill',
      curse: 'type-curse-skill',
      heal: 'type-heal-skill',
      aura: 'type-aura-skill',
      default: 'spell-book',
    } as Record<string, string>,
  },
  character: {
    byId: { 'player.default': 'black-knight-helm' } as Record<string, string>,
    fallback: 'black-knight-helm',
  },
} as const;

export function iconSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

const unique = (keys: (string | undefined)[]): string[] => [...new Set(keys.filter((key): key is string => !!key))];
const idTail = (id: string): string => id.includes(':') ? id.slice(id.indexOf(':') + 1) : id;

const DRAUGHT_ART: Record<string, string> = {
  'red draught': 'hp-potion',
  'yellow draught': 'orange-potion',
  'white draught': 'white-potion',
  'sky draught': 'mana-potion',
  'blue draught': 'blue-potion',
  'deep blue draught': 'puple-potion',
};

/** Candidate shelf keys in priority order: registered ID, stable ID slug, label slug, safe fallback. */
export function stackIconCandidates(group: string, name: string, stableId?: string): string[] {
  const category = group.toLowerCase();
  const item = name.toLowerCase();
  const direct = stableId ? ICON_REGISTRY.item.byId[stableId] : undefined;
  const stable = stableId ? iconSlug(idTail(stableId)) : undefined;
  const specific = iconSlug(name);
  let fallback = ICON_REGISTRY.item.fallbackByGroup[category] || ICON_REGISTRY.item.fallbackByGroup.default;

  if (category === 'draughts') fallback = [DRAUGHT_ART[item] || (item.includes('mana') ? 'mana-potion' : fallback[0])];
  else if (category === 'food') {
    fallback = [item.includes('berry') || item.includes('nut') ? 'raspberry'
      : item.includes('mushroom') ? 'mushroom'
        : item.includes('herb') ? 'herb-bundle' : fallback[0]];
  }

  return unique([direct, stable, specific, ...fallback, ...ICON_REGISTRY.item.fallbackByGroup.default, 'gear']);
}

const ARMOR_BY_SLOT: Record<string, string> = {
  helmet: 'heavy-helm', chest: 'armor-upgrade', pant: 'clothes', boots: 'boot-prints',
  belt: 'gem-pendant', gloves: 'gloves', ring: 'swirl-ring', amulet: 'gem-pendant',
  earring: 'crystal-cluster-1', cape: 'cape',
};

const WEAPON_ART: [string, string][] = [
  ['crossbow', 'crossbow-1'], ['one-handed axe', 'battle-axe-1'], ['two-handed axe', 'war-axe'],
  ['two-handed sword', 'greatsword'], ['one-handed sword', 'broadsword'], ['staff', 'weapon-staff'],
  ['wand', 'weapon-wand'], ['spear', 'weapon-spear'], ['mace', 'weapon-mace'], ['dagger', 'weapon-dagger'], ['bow', 'bow-arrow'],
];

export function gearIconCandidates(baseName: string, slotName: string): string[] {
  const slot = slotName.toLowerCase();
  const base = baseName.toLowerCase();
  const named = ICON_REGISTRY.gear.byBase[base] || iconSlug(baseName);
  if (slot === 'main hand') return unique([named, ...WEAPON_ART.filter(([key]) => base.includes(key)).map(([, file]) => file), 'broadsword', 'gear']);
  if (slot === 'helmet' && base.includes('barbute')) return unique([named, 'barbute', 'heavy-helm', 'gear']);
  if (slot === 'off hand') {
    const special = base.includes('tome') ? ['spell-book']
      : base.includes('kite') ? ['dragon-shield']
        : base.includes('sword') || base.includes('axe') || base.includes('dagger')
          ? [...WEAPON_ART.filter(([key]) => base.includes(key)).map(([, file]) => file), 'broadsword']
          : ['cross-shield'];
    return unique([named, ...special, 'gear']);
  }
  return unique([named, ARMOR_BY_SLOT[slot], 'armor-upgrade', 'gear']);
}

/** Existing slot art used when an empty equipment cell has no item identity. */
export function slotIconCandidates(slotName: string): string[] {
  const slot = slotName.toLowerCase();
  if (slot === 'main hand') return ['broadsword', 'gear'];
  if (slot === 'off hand') return ['cross-shield', 'gear'];
  return unique([ARMOR_BY_SLOT[slot], 'armor-upgrade', 'gear']);
}

const SKILL_ART_RULES: [RegExp, string][] = [
  [/whirlwind|whirlaxe|twister/, 'whirlwind-1'],
  [/sand_storm/, 'sandstorm'],
  [/fan_of_knives|backstab|nerve_strike|poisoned_edge/, 'knife-thrust'],
  [/impale|skewer_line|reach_thrust/, 'arrowhead'],
  [/skull_crack|bone_breaker|iron_toll/, 'warhammer'],
  [/low_sweep|wide_swing|cleave_down/, 'crossed-swords-1'],
  [/acid/, 'acid-blob'],
  [/arrow|shot|volley/, 'bow-arrow'],
  [/shield|guard|wall|block|damage_taken/, 'cross-shield'],
  [/heal|cleanse|vitality/, 'heart-beats'],
  [/bleed|reap|carnage/, 'debuff-bleed'],
  [/fire|flame|ember|meteor|wisp|burn/, 'small-fire'],
  [/frost|cold|ice|rime|snow|blizzard|frozen/, 'snowflake'],
  [/lightning|spark|thunder|storm|static/, 'lightning-branches'],
  [/poison|toxic|venom|acid/, 'poison'],
  [/void|veil/, 'element-void'],
  [/chaos/, 'vortex'],
  [/earth|sand|quake|ground|stone|rock/, 'boulder'],
  [/dodge|sidestep/, 'dodging'],
  [/crit/, 'layer-critical-damage'],
];

export function skillIconCandidates(id: string, type?: string): string[] {
  const skill = id.toLowerCase();
  const kind = (type || skill.split('.')[0]).toLowerCase();
  const slug = skill.split('.').pop()?.replace(/_/g, '-') ?? skill.replace(/_/g, '-');
  const semantic = SKILL_ART_RULES.find(([pattern]) => pattern.test(skill))?.[1];
  return unique([
    ICON_REGISTRY.skill.byId[skill], `${kind}-${slug}`, slug, semantic,
    ICON_REGISTRY.skill.fallbackByType[kind] || ICON_REGISTRY.skill.fallbackByType.default,
    ICON_REGISTRY.skill.fallbackByType.default, 'gear',
  ]);
}

export function characterIconCandidates(id = 'player.default'): string[] {
  return unique([ICON_REGISTRY.character.byId[id], ICON_REGISTRY.character.fallback, 'gear']);
}

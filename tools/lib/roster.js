'use strict';

/**
 * Skill-roster loader — the shared read of tools/data/skills.json.
 *
 * Everything that needs the roster (tools/skills.js, tools/tree.js, tools/lint.js)
 * goes through here, so the count, the name→id map and the mechanic gate have one
 * definition. Counts are always derived from the data; nothing hand-types "43".
 */

const fs = require('fs');
const path = require('path');

const DATA = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'skills.json'), 'utf8'));
const SKILLS = DATA.skills;
const TYPES = DATA.meta.types;
const TYPE_META = DATA.meta.type_meta;
const WEAPON_GROUPS = DATA.meta.weapon_groups;
const ELEMENTS = DATA.meta.elements;
const RESERVE = DATA.reserve_tiers;
const DEPRECATED = DATA.deprecated || {};
const RENAMES = DATA.renames || {};

const byType = (t) => SKILLS.filter((s) => s.type === t);
const count = (t) => byType(t).length;
const total = () => SKILLS.length;
const nameMap = () => new Map(SKILLS.map((s) => [s.name, s]));
const idMap = () => new Map(SKILLS.map((s) => [s.id, s]));
const allNames = () => SKILLS.map((s) => s.name);
const fmt = (n) => Number(n).toLocaleString('en-US');

/**
 * Mechanic gate (checks.md D18): the roster must be internally consistent and
 * satisfy the promises the design makes about coverage.
 * Returns [{ id, ok, detail }].
 */
function gates() {
  const out = [];
  const add = (id, ok, detail) => out.push({ id, ok, detail });

  const ids = SKILLS.map((s) => s.id);
  const dupIds = ids.filter((x, i) => ids.indexOf(x) !== i);
  add('S1', dupIds.length === 0, `unique skill ids (${ids.length} records)${dupIds.length ? ' · DUPLICATES: ' + [...new Set(dupIds)].join(', ') : ''}`);

  const names = SKILLS.map((s) => s.name);
  const dupNames = names.filter((x, i) => names.indexOf(x) !== i);
  add('S2', dupNames.length === 0, `unique skill names${dupNames.length ? ' · DUPLICATES: ' + [...new Set(dupNames)].join(', ') : ''}`);

  const badType = SKILLS.filter((s) => !TYPES.includes(s.type)).map((s) => s.id);
  add('S3', badType.length === 0, `every skill has a known type (${TYPES.join(' · ')})${badType.length ? ' · BAD: ' + badType.join(', ') : ''}`);

  const badAttack = byType('attack').filter((s) => !WEAPON_GROUPS.includes(s.group) && s.group !== 'all').map((s) => s.id);
  add('S4', badAttack.length === 0, `every attack skill names a weapon group or "all"${badAttack.length ? ' · BAD: ' + badAttack.join(', ') : ''}`);

  const missingElement = ELEMENTS.filter((el) => !byType('attack').some((s) => s.element === el));
  add('S5', missingElement.length === 0, `every Element has an attack skill (${ELEMENTS.join(' · ')})${missingElement.length ? ' · MISSING: ' + missingElement.join(', ') : ''}`);

  const groupCounts = WEAPON_GROUPS.map((g) => [g, byType('attack').filter((s) => s.group === g).length]);
  const thin = groupCounts.filter(([, n]) => n < 4);
  add('S6', thin.length === 0, `every weapon group has at least 4 attack skills (${groupCounts.map(([g, n]) => `${g} ${n}`).join(' · ')})${thin.length ? ' · THIN: ' + thin.map(([g]) => g).join(', ') : ''}`);

  const forbidden = SKILLS.filter((s) => /\b(mob|target|enemy)s?\s+armou?r\b|\b(mob|enemy)s?\s+mana\b/i.test(s.effect || '')).map((s) => s.id);
  add('S7', forbidden.length === 0, `no skill effect references mob armour or mob mana${forbidden.length ? ' · BAD: ' + forbidden.join(', ') : ''}`);

  const badReserve = byType('aura').filter((s) => s.reserve !== null && !(s.reserve in RESERVE)).map((s) => s.id);
  add('S8', badReserve.length === 0, `every aura reserve is a known tier or null (TBD)${badReserve.length ? ' · BAD: ' + badReserve.join(', ') : ''}`);

  const totalReserve = byType('aura').reduce((s, a) => s + (a.reserve ? RESERVE[a.reserve].pct : 0), 0);
  const block = (DATA.meta.reservation && DATA.meta.reservation.max_pct) || 100;
  add('S9', true, `the full aura set reserves ${totalReserve}% of the pool against the ${block}% block — the set can never all run at once, so the player must choose (informational)`);

  return out;
}

module.exports = {
  DATA, SKILLS, TYPES, TYPE_META, WEAPON_GROUPS, ELEMENTS, RESERVE, DEPRECATED, RENAMES,
  byType, count, total, nameMap, idMap, allNames, fmt, gates,
};

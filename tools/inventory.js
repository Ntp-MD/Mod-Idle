'use strict';

/**
 * Inventory cage — the two bags, their stacks and their fill times.
 *
 *   node tools/inventory.js --emit     print the fill / stack / weight model
 *   node tools/inventory.js --checks   gate the inventory data
 *
 * Source: tools/data/engine.json `inventory`, read through tools/lib/engine.js so the
 * loot rates and the weight K cannot disagree with the rest of the engine.
 * Model (D-056): adventure bag = 50 slots of kept gear (full pauses pickups, nothing
 * auto-converts); character bag = 30 slots of carried consumables (stone 999/slot,
 * herb/potion 100/slot, gold no slot); both weight-counted; stash + craft town-only.
 */

const eng = require('./lib/engine');

const { E, K, L, BAND, CEIL, DERIVED } = eng;
const IV = E.inventory;
const f0 = (x) => Math.round(x).toLocaleString('en-US');
const f1 = (x) => x.toFixed(1);

// kept gear per hour = the measured upgrade rate (loot.md F4), not the junk flow
const KEEP_HR = L.bands.high.upgrades_per_hr;
const GEAR_FILL_HR = IV.adventure_slots / KEEP_HR;
// one character-bag slot of each consumable, and how long it takes to earn it
const SLOT_HR = {
  stone: IV.stack_size.stone / BAND.high.junk_per_hr,      // value stones are the junk line
  herb: IV.stack_size.herb / 54,                           // high-band herb bundles/hr (F13)
};
const STONE_BAG_WEIGHT = IV.character_slots * IV.stack_size.stone * IV.unit_weight.stone;
const HERB_BAG_WEIGHT = IV.character_slots * IV.stack_size.herb * IV.unit_weight.herb;
const CAPACITY = CEIL * K.K_STR_WEIGHT;

function gates() {
  const out = [];
  const add = (id, ok, detail) => out.push({ id, ok, detail });

  const bad = [];
  if (!(IV.adventure_slots > 0)) bad.push('no adventure bag size');
  if (!(IV.character_slots > 0)) bad.push('no character bag size');
  if (IV.overflow !== 'stop_pickup') bad.push('overflow must be stop_pickup');
  if (IV.gold_uses_slot !== false) bad.push('gold must not take a slot');
  for (const k of ['stone', 'herb', 'potion']) if (!(IV.stack_size && IV.stack_size[k] > 0)) bad.push(`no stack size for ${k}`);
  add('IV1', bad.length === 0, bad.length ? bad.join(' · ')
    : `adventure bag ${IV.adventure_slots} slots (kept gear) · character bag ${IV.character_slots} slots (stone ${IV.stack_size.stone}/slot · herb/potion ${IV.stack_size.herb}/slot) · gold no slot · full = pickups pause, nothing auto-converts`);

  // the adventure bag must not fill from kept gear inside the offline window, or an AFK
  // session would stop looting while the player is away
  add('IV2', GEAR_FILL_HR > IV.offline_cap_hr,
    `the adventure bag fills in ~${f1(GEAR_FILL_HR)} hr at the high band's measured ${KEEP_HR} upgrades/hr — longer than the ${IV.offline_cap_hr} hr offline cap, so an offline session cannot run the bag dry from gear alone`);

  // stones are weightless on purpose (they are currency-like); herbs and potions still weigh,
  // so the weight tax can only come from carrying consumables, not from the stone economy
  const w = IV.unit_weight;
  const wOk = w.stone === 0 && w.herb > 0 && w.potion > 0;
  add('IV3', wOk, wOk
    ? `stones are weightless — a full ${IV.character_slots}-slot stone bag costs 0 weight — while herbs and potions weigh ${w.herb}/${w.potion} per unit, so only herb/potion stacks can tax aspd (a full herb bag ${f0(HERB_BAG_WEIGHT)} vs capacity ${f0(CAPACITY)} · formula.md section 11)`
    : `expected stone weight 0 and herb/potion > 0, got stone ${w.stone} · herb ${w.herb} · potion ${w.potion}`);

  // the docs must describe the bag the data models
  const loot = require('fs').readFileSync(require('path').join(eng.ROOT, 'loot.md'), 'utf8');
  add('IV4', /adventure bag/i.test(loot) && /settlement-only/i.test(loot),
    `loot.md describes the adventure bag and the Settlement-only deposit/craft loop (loot.md section 4)`);

  return out;
}

function emit() {
  console.log(`inventory model (engine.json inventory · D-056)`);
  console.log('');
  console.log(`adventure bag : ${IV.adventure_slots} slots · kept gear 1/slot · fills ~${f1(GEAR_FILL_HR)} hr at high band (${KEEP_HR} upgrades/hr)`);
  console.log(`character bag : ${IV.character_slots} slots · stone ${IV.stack_size.stone}/slot (~${f1(SLOT_HR.stone)} hr) · herb ${IV.stack_size.herb}/slot (~${f1(SLOT_HR.herb)} hr) · potion ${IV.stack_size.potion}/slot · gold no slot`);
  console.log(`weight        : stone weightless · herb ${IV.unit_weight.herb} · potion ${IV.unit_weight.potion} /unit · full herb bag ${f0(HERB_BAG_WEIGHT)} vs capacity ${f0(CAPACITY)}`);
  console.log(`overflow      : ${IV.overflow} (nothing auto-converts, nothing is deleted)`);
  console.log(`stash + craft : Settlement-only (towns.md · crafting.md)`);
}

const arg = process.argv[2];
if (arg === '--emit') {
  emit();
} else if (arg === '--checks') {
  const rows = gates();
  for (const r of rows) console.log(`${r.id.padEnd(4)}  ${r.ok ? 'PASS ' : 'FAIL '}  ${r.detail}`);
  const fails = rows.filter((r) => !r.ok).length;
  console.log(`\n${rows.length - fails}/${rows.length} gate PASS · ${fails} FAIL`);
  if (fails) process.exitCode = 1;
} else {
  console.log(`inventory cage — the two bags, their stacks and their fill times

  node tools/inventory.js --emit     print the fill / stack / weight model
  node tools/inventory.js --checks   gate the inventory data
`);
}

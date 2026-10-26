import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { newGame, push } from '../src/sim/core/game';
import { E, loot } from '../src/engine/client';
import { buildCharacter } from '../src/sim/core/player';
import { autoEquip, equipFromBag, unequip } from '../src/sim/gear/gear';
import { drink, cycleQuickbar } from '../src/sim/world/farm';
import { depositMany, withdrawMany } from '../src/sim/town/town';

// Execute the actual Svelte controller callbacks without a second copy of their logic.
// Rendering and native input still require the integrated-browser check.
const source = readFileSync(new URL('../src/App.svelte', import.meta.url), 'utf8').split('<script lang="ts">')[1].split('</script>')[0];
const ast = ts.createSourceFile('App.ts', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
const names = ['requireAccountWriter', 'doBestEquip', 'useQuickSlot', 'doDrink', 'updateAutoEat',
  'setPatrolRepeat', 'setAutoReturn', 'toggleLock', 'equip', 'doUnequip', 'doDepositAll', 'doWithdrawAll',
  'cycleQuickSlot', 'assignQuickSlot', 'setAutoPotion', 'setPotionThreshold', 'setFarmAutomation'];
const callbacks = ast.statements.filter((node): node is ts.FunctionDeclaration =>
  ts.isFunctionDeclaration(node) && !!node.name && names.includes(node.name.text));
const javascript = ts.transpileModule(callbacks.map(node => node.getText(ast)).join('\n'),
  { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;

function controls(writer: boolean, showcase = false) {
  const state = newGame(720), c = buildCharacter(state.player.level, state.gear, {}, 0);
  state.player.hp = 1; state.quickbar[0] = 'Red Draught';
  const item = { slot: 'helmet', base: 'coif', ilvl: 1, quality: 'low', tier: 'T1', q: 0, lines: [] };
  state.bag = [item as any]; state.grants.stash_tabs = 1;
  state.gear[loot.SLOTS.indexOf('main hand')] = { ...item, slot: 'main hand', base: 'one-handed sword' } as any;
  state.stash[0] = [{ ...item } as any];
  const deps = { gameState: state, c, settings: { equipMargin: 0 }, transactionWriter: writer,
    canWriteAccount: writer, showcaseMode: showcase, accountWriterMessage: 'Read-only',
    E, autoEquip, equipFromBag, unequip, drink, cycleQuickbar, depositMany, withdrawMany, push };
  const make = new Function('deps', `let { ${Object.keys(deps).join(',')} } = deps;
    let saveNote = '', equipNote = '', townNote = '', farmNote = '', invTab = 'inv';
    ${javascript}
    return { ${names.join(',')}, state: () => gameState };`);
  return make(deps) as Record<string, any>;
}

describe('account writer gates on gameplay controls', () => {
  for (const showcase of [false, true]) {
    for (const [name, args] of [
      ['doBestEquip', []], ['useQuickSlot', [0]], ['doDrink', ['Red Draught']],
      ['updateAutoEat', [{ enabled: false }]], ['setPatrolRepeat', [false]],
      ['setAutoReturn', [true]], ['equip', [0]], ['doUnequip', [loot.SLOTS.indexOf('main hand')]],
      ['doDepositAll', [0]], ['doWithdrawAll', [0]],
      ['cycleQuickSlot', [0]], ['assignQuickSlot', [1, 'Sky Draught']],
      ['setAutoPotion', ['hp', false]], ['setPotionThreshold', ['hp', 80]],
      ['setFarmAutomation', ['plant', true]],
    ] as [string, unknown[]][]) {
      it(`refuses ${name} in ${showcase ? 'read-only showcase' : 'a non-writer tab'}`, () => {
        const app = controls(false, showcase), before = structuredClone(app.state());
        app[name](...args);
        expect(app.state()).toEqual(before);
      });
    }
  }
  it('refuses changing a carried lock without the writer lease', () => {
    const app = controls(false), before = structuredClone(app.state());
    app.toggleLock(app.state().bag[0]);
    expect(app.state()).toEqual(before);
  });
  it('keeps potion shortcuts and manual equipment working for the writer', () => {
    const app = controls(true);
    app.useQuickSlot(0);
    expect(app.state().farm.potions['Red Draught']).toBe(0);
    app.equip(0);
    expect(app.state().gear[loot.SLOTS.indexOf('helmet')]?.base).toBe('coif');
  });
  it('keeps potion thresholds finite and within the displayed percentage range', () => {
    const app = controls(true);
    const before = app.state().farm.threshold.hp;
    app.setPotionThreshold('hp', Number.NaN);
    expect(app.state().farm.threshold.hp).toBe(before);
    app.setPotionThreshold('hp', 101);
    expect(app.state().farm.threshold.hp).toBe(99);
    app.setPotionThreshold('hp', -1);
    expect(app.state().farm.threshold.hp).toBe(1);
  });
});

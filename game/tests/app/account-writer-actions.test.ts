import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { newGame, push } from '@sim/core/game';
import { E, loot, sm } from '../../src/engine/client';
import { buildCharacter } from '@sim/core/player';
import { autoEquip, equipFromBag, unequip } from '@sim/gear/gear';
import { drink, cycleQuickbar } from '@sim/world/farm';
import { depositMany, withdrawMany } from '@sim/town/town';
import { createGearCommands } from '../../src/app/commands/gear';
import { createFieldCommands } from '../../src/app/commands/field';
import { createEconomyCommands } from '../../src/app/commands/economy';
import { questBonusText } from '../../src/ui/town/quest-rewards';
import { refreshSelectionAfterRepair, resolveItemSelection } from '../../src/ui/inventory/item-selection';

// Execute the actual Svelte controller callbacks without a second copy of their logic.
// Rendering and native input still require the integrated-browser check.
// Domain verbs moved to app/commands/* factories (plan phase 1); the App wrappers and the
// remaining App-owned callbacks are still extracted from App.svelte and run against the real
// factories wired to the same sandbox state.
const source = readFileSync(new URL('../../src/App.svelte', import.meta.url), 'utf8').split('<script lang="ts">')[1].split('</script>')[0];
const ast = ts.createSourceFile('App.ts', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
const names = ['requireAccountWriter', 'doBestEquip', 'useQuickSlot', 'doDrink', 'updateAutoEat',
  'toggleLock', 'equip', 'doUnequip', 'doDepositAll', 'doWithdrawAll',
  'cycleQuickSlot', 'assignQuickSlot', 'setAutoPotion', 'setPotionThreshold', 'setFarmAutomation'];
const helpers = ['doDeposit', 'rowFlag', 'rowExploitFlag'];
const wanted = new Set([...names, ...helpers]);
const callbacks = ast.statements.filter((node): node is ts.FunctionDeclaration =>
  ts.isFunctionDeclaration(node) && !!node.name && wanted.has(node.name.text));
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
    E, sm, autoEquip, equipFromBag, unequip, drink, cycleQuickbar, depositMany, withdrawMany, push,
    createGearCommands, createFieldCommands, createEconomyCommands,
    questBonusText, resolveItemSelection, refreshSelectionAfterRepair,
    craftThisItem: () => {}, fmtNum: (n: number) => String(n) };
  const make = new Function('deps', `let { ${Object.keys(deps).join(',')} } = deps;
    let saveNote = '', equipNote = '', townNote = '', farmNote = '', skillNote = '', benchNote = '', forgeNote = '';
    let invTab = 'inv', marketSale = null, marketTownId = '', benchSelection = null, forgeResultItem = null;
    let travelScene = false, running = true, panel = null;
    let townLive = false, tabs = 1, stashTab = 0, fieldCellName = 'field', viewHere = true, ownedAuras = [];
    const town = undefined;
    const __gear = createGearCommands({
      get gameState() { return gameState; }, set gameState(v) { gameState = v; },
      get settings() { return settings; },
      get equipNote() { return equipNote; }, set equipNote(v) { equipNote = v; },
      get invTab() { return invTab; }, set invTab(v) { invTab = v; },
      get townLive() { return townLive; }, get tabs() { return tabs; }, get stashTab() { return stashTab; },
      requireAccountWriter, craftThisItem, doDeposit, toggleLock,
    });
    const __field = createFieldCommands({
      get gameState() { return gameState; }, set gameState(v) { gameState = v; },
      get saveNote() { return saveNote; }, set saveNote(v) { saveNote = v; },
      get skillNote() { return skillNote; }, set skillNote(v) { skillNote = v; },
      get farmNote() { return farmNote; }, set farmNote(v) { farmNote = v; },
      get transactionWriter() { return transactionWriter; },
      get fieldCellName() { return fieldCellName; }, get viewHere() { return viewHere; },
      get c() { return c; }, get ownedAuras() { return ownedAuras; },
      get travelScene() { return travelScene; }, set travelScene(v) { travelScene = v; },
      get running() { return running; }, set running(v) { running = v; },
      get showcaseMode() { return showcaseMode; },
      get panel() { return panel; }, set panel(v) { panel = v; },
      requireAccountWriter, rowFlag, rowExploitFlag,
    });
    const __economy = createEconomyCommands({
      get gameState() { return gameState; }, set gameState(v) { gameState = v; },
      get saveNote() { return saveNote; }, set saveNote(v) { saveNote = v; },
      get transactionWriter() { return transactionWriter; },
      get town() { return town; }, get marketTownId() { return marketTownId; },
      get marketSale() { return marketSale; }, set marketSale(v) { marketSale = v; },
      requireAccountWriter,
      get bench() { return null; },
      get benchSelection() { return benchSelection; }, set benchSelection(v) { benchSelection = v; },
      get benchNote() { return benchNote; }, set benchNote(v) { benchNote = v; },
      get townNote() { return townNote; }, set townNote(v) { townNote = v; },
      get forgeNote() { return forgeNote; }, set forgeNote(v) { forgeNote = v; },
      get forgeResultItem() { return forgeResultItem; }, set forgeResultItem(v) { forgeResultItem = v; },
      get viewColSet() { return null; }, fmtNum, questBonusText,
      resolveItemSelection, refreshSelectionAfterRepair,
    });
    ${javascript}
    return { ${names.join(',')}, state: () => gameState };`);
  return make(deps) as Record<string, any>;
}

describe('account writer gates on gameplay controls', () => {
  for (const showcase of [false, true]) {
    for (const [name, args] of [
      ['doBestEquip', []], ['useQuickSlot', [0]], ['doDrink', ['Red Draught']],
      ['updateAutoEat', [{ enabled: false }]], ['equip', [0]], ['doUnequip', [loot.SLOTS.indexOf('main hand')]],
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

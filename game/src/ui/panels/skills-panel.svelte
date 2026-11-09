<script lang="ts">
  import Panel from '../hud/Panel.svelte';
  import SkillsWorkbench, { newSkillsWorkbenchView, type SkillsWorkbenchView } from '../character/SkillsWorkbench.svelte';
  import { ACTIVE_SLOTS } from '@sim/combat/skills';
  import type { GameState } from '@sim/core/types';
  import type { Character } from '@sim/core/player';
  import type { SkillConditions, SkillMode } from '@sim/combat/skills';

  let {
    gameState, character, writable, note, autoSkills, view = $bindable(newSkillsWorkbenchView()),
    modalGridArea, showcaseMode,
    onslot, onmove, onmode, onauto, oncondition, ontoggle, onaurapool, ondisableauras, onswitchpreset, onstorepreset, onbindzone, onclose,
  }: {
    gameState: GameState;
    character: Character;
    writable: boolean;
    note: string;
    autoSkills: boolean;
    view: SkillsWorkbenchView;
    modalGridArea: string;
    showcaseMode: boolean;
    onslot: (index: number, id: string) => void;
    onmove: (from: number, to: number) => void;
    onmode: (id: string, mode: SkillMode) => void;
    onauto: (id: string, mode: 'auto' | 'manual' | 'both') => void;
    oncondition: (id: string, patch: Partial<SkillConditions>) => void;
    ontoggle: (id: string) => void;
    onaurapool: (id: string, pool: 'hp' | 'mana') => void;
    ondisableauras: () => void;
    onswitchpreset: (index: number) => void;
    onstorepreset: () => void;
    onbindzone: (index: number) => void;
    onclose: () => void;
  } = $props();
</script>

<Panel title="Skills" subtitle={`${ACTIVE_SLOTS} slots · timed skills first, fillers last`} width="wide" showcase={showcaseMode} gridArea={modalGridArea} onclose={onclose}>
  <SkillsWorkbench state={gameState} character={character} writable={writable} note={note}
    autoSkills={autoSkills} bind:view
    {onslot} {onmove} {onmode} {onauto} {oncondition} {ontoggle} {onaurapool}
    {ondisableauras} {onswitchpreset} {onstorepreset} {onbindzone} />
</Panel>

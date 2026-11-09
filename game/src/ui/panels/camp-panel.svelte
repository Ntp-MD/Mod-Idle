<script lang="ts">
  import Panel from '../hud/Panel.svelte';
  import FieldworkBoard from '../map/FieldworkBoard.svelte';
  import type { GameState } from '@sim/core/types';

  let {
    gameState, fieldworkSite, fieldCellName, fieldCampName, fieldCampHere, fieldworkBusy, townLive,
    modalGridArea, showcaseMode,
    oncamp, onstart, onstop, oncook, oneat, onauto, onclose,
  }: {
    gameState: GameState;
    fieldworkSite: 'dungeon' | 'mine' | 'grove' | 'fishing' | 'hunt' | null;
    fieldCellName: string;
    fieldCampName: string;
    fieldCampHere: boolean;
    fieldworkBusy: boolean;
    townLive: boolean;
    modalGridArea: string;
    showcaseMode: boolean;
    oncamp: () => void;
    onstart: (kind: 'mine' | 'grove' | 'fish') => void;
    onstop: () => void;
    oncook: (id: string, count?: number) => void;
    oneat: (id: string) => void;
    onauto: (patch: Partial<{ enabled: boolean; threshold: number; allowRaw: boolean }>) => void;
    onclose: () => void;
  } = $props();
</script>

<Panel title="Field Camp" subtitle={`${fieldworkSite ? fieldworkSite.replace(/^./, (letter) => letter.toUpperCase()) : 'Field'} · ${fieldCampHere ? 'safe at Camp' : 'set up away from town'}`} width="wide" showcase={showcaseMode} gridArea={modalGridArea} onclose={onclose}>
  <FieldworkBoard
    state={gameState}
    site={fieldworkSite}
    cellName={fieldCellName}
    campName={fieldCampName}
    campHere={fieldCampHere}
    busy={fieldworkBusy}
    inTown={townLive}
    {oncamp}
    {onstart}
    {onstop}
    {oncook}
    {oneat}
    {onauto}
  />
</Panel>

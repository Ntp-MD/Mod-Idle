<script lang="ts">
  import { campBeats } from '../../sim/camp/camp-story';
  import type { StorytellerBeat } from '../../../../engine/camp-events';

  let { beatId = $bindable('prowler-at-the-edge'), onchoice } : {
    beatId: string;
    onchoice: (beat: StorytellerBeat, index: number) => void;
  } = $props();
  const beats = campBeats();
  const beat = $derived(beats.find(b => b.id === beatId) ?? beats[0]);
</script>

{#if beat}
  <div class="camp-story" data-state={beat.state}>
    <p class="story-line">{beat.line}</p>
    <div class="choices">
      {#each beat.choices as choice, i}
        <button onclick={() => onchoice(beat, i)}>{choice.label}</button>
      {/each}
    </div>
  </div>
{/if}

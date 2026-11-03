import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import PlayerStatusRow from '../../src/ui/combat/PlayerStatusRow.svelte';

describe('arena player status row', () => {
  it('names each live status, its stacks and remaining seconds', () => {
    const body = render(PlayerStatusRow, {
      props: { statuses: {
        burn: { stacks: 2, secLeft: 8, perSec: 12 },
        chill: { stacks: 1, secLeft: 3.4, perSec: 0 },
        shock: undefined,
      } },
    }).body;
    expect(body).toContain('burning · 2 stacks · 8s');
    expect(body).toContain('chilled · 4s');
    expect(body).not.toContain('shocked');
  });

  it('renders nothing when no status is live', () => {
    const body = render(PlayerStatusRow, { props: { statuses: { burn: undefined } } }).body;
    expect(body).not.toContain('player-statuses');
  });
});

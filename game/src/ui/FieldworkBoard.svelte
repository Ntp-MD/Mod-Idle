<script lang="ts">
  import { fieldwork } from '../engine/client';
  import { activeMeal, canCook, fieldHarvestAmount, fieldMasteryLevel, fieldSkillLevel } from '../sim/fieldwork';
  import type { GameState } from '../sim/types';
  import { stackIcon, icon } from '../icon';

  /**
   * The Field Camp, read as a place and not as a form. Three stations stand in one row on the camp's
   * ground, and each station is both the read and the press: a tent that is up or packed, a fire
   * burning as well as it is fed, a pot with a meal in it. A station's own controls hang under it, so
   * a column is one part of the camp — where it stands, what it eats, what it cooks — and the props
   * carry their own condition, which is why nothing in the scene needs a word to say what it is.
   */
  const tentIcon = icon('tent');
  const fireIcon = icon('rest-campfire');
  const potIcon = icon('cooking-cauldron');
  const pickIcon = icon('pickaxe');
  const treeIcon = icon('tree');
  const meatIcon = icon('meat');
  const herbIcon = icon('jasmine');
  const mineralIcon = icon('minerals');

  let {
    state: gameState, site, cellName, campName, campHere, busy, inTown,
    oncamp, onstart, onstop, onhunt, onrest, oncook, oneat, onauto,
  }: {
    state: GameState;
    site: 'dungeon' | 'mine' | 'grove' | 'hunt' | null;
    cellName: string;
    campName: string;
    campHere: boolean;
    busy: boolean;
    inTown: boolean;
    oncamp: () => void;
    onstart: (kind: 'mine' | 'grove' | 'fish') => void;
    onstop: () => void;
    onhunt: () => void;
    onrest: () => void;
    oncook: (id: string, count?: number) => void;
    oneat: (id: string) => void;
    onauto: (patch: Partial<{ enabled: boolean; threshold: number; allowRaw: boolean }>) => void;
  } = $props();

  const regional = $derived(fieldwork.F.regional_sources[String(gameState.zone)]);
  const resources = $derived(fieldwork.F.materials.filter((material: any) =>
    (gameState.fieldwork.materials[material.id] || 0) > 0 || ['ore', 'timber', 'rarewood', regional?.mine, regional?.grove].includes(material.id))
    .map((material: any) => ({ ...material, icon: material.group === 'wood' ? treeIcon : mineralIcon })));
  const skillNames = [
    ['mining', 'Mining'], ['woodcutting', 'Woodcutting'], ['hunting', 'Hunting'], ['cooking', 'Cooking'], ['fishing', 'Fishing'], ['smithing', 'Smithing'],
  ] as const;
  const recipeMenus = [
    { id: 'hearth', label: 'Hearth' }, { id: 'forage', label: 'Wild recipes' },
  ] as const;
  let recipeMenu = $state<'hearth' | 'forage'>('hearth');
  const active = $derived(activeMeal(gameState));
  const remaining = $derived(active ? `${Math.ceil(active.secondsLeft / 60)} min` : '');
  const recovering = $derived(gameState.phase === 'camp');
  const campSet = $derived(!!gameState.fieldwork.camp);
  const canSetCamp = $derived(!inTown && !busy && !recovering && !gameState.dungeon);
  const campMoveLabel = $derived(gameState.fieldwork.freeRelocationsRemaining > 0 ? 'Move Camp · free' : `Move Camp · ${fieldwork.F.camp.relocate_ore} ore · ${fieldwork.F.camp.relocate_timber} timber`);
  const siteAction = $derived(site === 'mine' ? 'mine' : site === 'grove' ? 'grove' : null);
  const fishingId = $derived(regional && fieldwork.F.fishing.foods.includes(regional.food) ? regional.food : null);
  const activityTitle = $derived(site === 'mine' ? 'Mine' : site === 'grove' ? 'Rare Grove' : site === 'hunt' ? 'Hunting Ground' : site === 'dungeon' ? 'Dungeon Entrance' : 'Field');
  const activityMark = $derived(site === 'mine' ? pickIcon : site === 'grove' ? treeIcon : site === 'hunt' ? meatIcon : tentIcon);
  const activityDetail = $derived(
    site === 'mine' ? `Mine ${fieldHarvestAmount(gameState, 'mining', fieldwork.F.actions.mine.yield)} ore/action · local find: ${fieldwork.materialById[regional?.mine]?.name} · Mst ${fieldMasteryLevel(gameState, 'mining', 'mine')}`
      : site === 'grove' ? `Cut ${fieldHarvestAmount(gameState, 'woodcutting', fieldwork.F.actions.grove.yield)} timber/action · local wood: ${fieldwork.materialById[regional?.grove]?.name} · forage: ${fieldwork.foodById[regional?.food]?.name}`
        : site === 'hunt' ? 'Drop chance and portions improve with Hunting level and species Mastery · humans may drop cooked rations, Goblins raw haunches'
          : site === 'dungeon' ? 'A special dungeon run starts from this map hex'
            : fishingId ? `Camp fishing source · ${fieldwork.foodById[fishingId]?.name} · 1 catch every ${fieldwork.F.fishing.interval_sec} sec`
              : 'Choose a field hex from the map to see what this ground offers');
  /** The tent's one press, and the words on it: at Camp it is the way in or out of the hunt, away from
   *  Camp it is the way the Camp is set, moved or first made. */
  const tentAction = $derived(campHere
    ? (gameState.hunting ? 'Return to Camp' : 'Leave Camp · Hunt')
    : (gameState.fieldwork.camp ? campMoveLabel : 'Set Camp · free'));
  const tentDisabled = $derived(campHere ? recovering : !canSetCamp);
  const pantry = $derived(fieldwork.foods.filter((food: any) => food.kind !== 'cooked'));
  /** What each food station has to hand out. Cooked dishes belong to the pot alone, because a dish is
   *  the only thing that carries a meal buff; the fire hands out what feeds Hunger and nothing else. */
  const bestStock = (cooked: boolean) => fieldwork.foods
    .filter((food: any) => food.edible && (food.kind === 'cooked') === cooked && (gameState.fieldwork.foods[food.id] || 0) > 0)
    .sort((a: any, b: any) => b.hunger_restore - a.hunger_restore)[0] || null;
  const fireFood = $derived(bestStock(false));
  const potMeal = $derived(bestStock(true));
  const foodName = (food: any) => fieldwork.foodById[food.id]?.name || food.id;
  const visibleRecipes = $derived(fieldwork.F.recipes.filter((recipe: any) => recipe.menu === recipeMenu));
  const recipesInMenu = (menu: string) => fieldwork.F.recipes.filter((recipe: any) => recipe.menu === menu).length;
  const hungerFill = $derived(Math.max(0, Math.min(1, gameState.fieldwork.hunger / fieldwork.F.hunger.max)));
  const recipeCost = (recipe: any) => [
    ...Object.entries(recipe.foods).map(([id, amount]) => `${amount} ${fieldwork.foodById[id]?.name || id}`),
    ...Object.entries(recipe.materials).map(([id, amount]) => `${amount} ${fieldwork.materialById[id]?.name || id}`),
    ...Object.entries(recipe.herbs).map(([tier, amount]) => `${amount} ${tier} herb`),
  ].join(' · ');
</script>

<div class="fieldwork-board">
  <section class="scene plate-ground" aria-label="Field Camp stations">

    <section class="station">
      <button class="btn btn-prop station-btn" class:toggled={campHere} class:off={!campSet} class:busy={recovering}
              style={`--fed:${campHere ? 1 : 0}`} disabled={tentDisabled}
              onclick={() => (campHere ? (gameState.hunting ? onrest() : onhunt()) : oncamp())}
              title={campSet
                ? (campHere
                  ? (gameState.hunting ? 'Pause combat and return to safe Camp' : 'Leave the safe Camp and resume hunting')
                  : (gameState.fieldwork.freeRelocationsRemaining > 0 ? 'First relocation is free' : `Relocate Camp · costs ${fieldwork.F.camp.relocate_ore} ore and ${fieldwork.F.camp.relocate_timber} timber`))
                : 'The first Camp is free'}>
        <img src={tentIcon} alt="" aria-hidden="true" />
        <span>{recovering ? `Resting · ${Math.max(0, Math.ceil(gameState.campSec))}s` : tentAction}</span>
      </button>
      <p class="station-read"><b>{campSet ? 'Field Camp' : 'No Camp set'}</b>{campSet ? ` · ${campName}` : ''}</p>
      <small class="text-note">{campHere ? `Standing at ${cellName} · safe ground` : `Hex ${cellName} · ${activityTitle}`}</small>
      <div class="work">
        <b class="work-title"><img src={activityMark} alt="" aria-hidden="true" />{activityTitle}</b>
        <small class="text-note">{activityDetail}</small>
        {#if siteAction}
          {#if gameState.fieldwork.action?.kind === siteAction}
            <button class="btn btn-quiet" onclick={onstop}>Stop gathering</button>
          {:else}
            <button class="btn btn-quiet" disabled={!campHere || gameState.hunting || recovering} onclick={() => onstart(siteAction)} title={campHere ? '' : 'Set Camp on this hex to gather'}>
              {siteAction === 'mine' ? 'Start mining' : 'Start woodcutting'}
            </button>
          {/if}
        {:else if fishingId && (campHere || gameState.fieldwork.action?.kind === 'fish')}
          {#if gameState.fieldwork.action?.kind === 'fish'}
            <button class="btn btn-quiet" onclick={onstop}>Stop fishing</button>
          {:else}
            <button class="btn btn-quiet" disabled={gameState.hunting || recovering} onclick={() => onstart('fish')}>Start fishing · {fieldwork.foodById[fishingId]?.name}</button>
          {/if}
        {/if}
      </div>
    </section>

    <section class="station" aria-label="Hunger">
      <button class="btn btn-prop station-btn" class:toggled={gameState.fieldwork.hunger > 0} class:off={!fireFood}
              style={`--fed:${hungerFill.toFixed(3)}`} disabled={!fireFood}
              onclick={() => fireFood && oneat(fireFood.id)}
              title={fireFood ? `Eat ${foodName(fireFood)} · +${fireFood.hunger_restore} Hunger` : 'No field food in the bag · gather, fish or cook first'}>
        <img src={fireIcon} alt="" aria-hidden="true" />
        <span>{fireFood ? `Eat ${foodName(fireFood)}` : 'Nothing to eat'}</span>
      </button>
      <p class="station-read"><b>Hunger</b>
        <strong class="text-value" class:text-alarm={gameState.fieldwork.hunger <= 0}>{Math.floor(gameState.fieldwork.hunger)}</strong>
        <span class="text-dim">/ {fieldwork.F.hunger.max}</span>
      </p>
      <div class="hunger-meter gauge-hunger" class:empty={gameState.fieldwork.hunger <= 0}
           title={gameState.fieldwork.hunger <= 0 ? `Empty Hunger · HP regeneration reduced by ${fieldwork.F.hunger.empty_hp_regen_cut_pct}% · Energy Shield recharge unaffected` : 'Hunger drains during travel, hunts and field gathering'}>
        <i><em style:width={`${hungerFill * 100}%`}></em></i>
      </div>
      <div class="auto-eat">
        <label><input type="checkbox" checked={gameState.fieldwork.autoEat.enabled} onchange={(event) => onauto({ enabled: (event.currentTarget as HTMLInputElement).checked })} /> Auto Eat</label>
        <select aria-label="Auto Eat threshold" value={gameState.fieldwork.autoEat.threshold} disabled={!gameState.fieldwork.autoEat.enabled} onchange={(event) => onauto({ threshold: Number((event.currentTarget as HTMLSelectElement).value) })}>
          {#each fieldwork.F.hunger.auto_eat.threshold_options as threshold (threshold)}<option value={threshold}>{threshold}%</option>{/each}
        </select>
        <label title="Allow raw food before Hunger reaches zero"><input type="checkbox" checked={gameState.fieldwork.autoEat.allowRaw} disabled={!gameState.fieldwork.autoEat.enabled} onchange={(event) => onauto({ allowRaw: (event.currentTarget as HTMLInputElement).checked })} /> Raw early</label>
      </div>
      <div class="pantry" aria-label="Food bag">
        <small class="text-note">Auto Eat: cooked → fruit → herb · {gameState.fieldwork.autoEat.allowRaw ? 'raw allowed' : 'raw held to zero'}</small>
        {#each pantry as food (food.id)}
          <span class="provision" class:ingredient={food.kind === 'ingredient'}>
            <img src={stackIcon('food', food.name, `food:${food.id}`)} alt="" aria-hidden="true" />
            <span>{food.name}</span><strong class="text-value">×{gameState.fieldwork.foods[food.id] || 0}</strong>
            {#if food.edible}<button class="eat-small" disabled={(gameState.fieldwork.foods[food.id] || 0) === 0} aria-label="Eat {food.name}" title="Eat {food.name} · +{food.hunger_restore} Hunger" onclick={() => oneat(food.id)}>Eat</button>{/if}
          </span>
        {/each}
      </div>
    </section>

    <section class="station" aria-label="Camp Kitchen">
      <button class="btn btn-prop station-btn" class:toggled={!!active} class:off={!potMeal}
              style={`--fed:${active ? 1 : 0}`} disabled={!potMeal}
              onclick={() => potMeal && oneat(potMeal.id)}
              title={potMeal ? `Eat ${foodName(potMeal)} · +${potMeal.hunger_restore} Hunger and its meal buff` : 'No cooked dish in the bag · cook one from the menu below'}>
        <img src={potIcon} alt="" aria-hidden="true" />
        <span>{potMeal ? 'Eat meal' : 'Empty pot'}</span>
      </button>
      <p class="station-read"><b>Camp Kitchen</b></p>
      <small class="text-note">{active
        ? `${active.name} · ${remaining} left · +${active.damage_pct}% damage · +${active.hp_regen_pct}% Max HP regen`
        : 'No meal cooking · a dish restores Hunger and carries its buff into the field'}</small>
      <div class="recipe-tabs" role="tablist" aria-label="Recipe menus">
        {#each recipeMenus as menu (menu.id)}
          <button role="tab" class="btn btn-quiet" class:picked={recipeMenu === menu.id} aria-selected={recipeMenu === menu.id}
                  onclick={() => (recipeMenu = menu.id)}>
            {menu.label}<small>{recipesInMenu(menu.id)}</small>
          </button>
        {/each}
      </div>
      <div class="recipes">
        {#each visibleRecipes as recipe (recipe.id)}
          {@const verdict = canCook(gameState, recipe.id)}
          <article class="recipe" class:locked={fieldSkillLevel(gameState, 'cooking') < recipe.level}>
            <div class="recipe-head"><b>{recipe.name}</b><strong class="text-value">×{gameState.fieldwork.foods[recipe.id] || 0}</strong></div>
            <small>{recipeCost(recipe)}</small>
            <small>+{recipe.hunger_restore} Hunger · Lv {recipe.level} · {recipe.duration_sec / 60} min · +{recipe.damage_pct}% damage · +{recipe.hp_regen_pct}% HP regen</small>
            <div class="recipe-actions">
              <button class="btn btn-quiet" disabled={!verdict.ok} title={verdict.why || 'Cook at your active Camp'} onclick={() => oncook(recipe.id, 1 + Math.floor(fieldMasteryLevel(gameState, 'cooking', recipe.id) / 20))}>Cook ×{1 + Math.floor(fieldMasteryLevel(gameState, 'cooking', recipe.id) / 20)}</button>
              <button class="btn btn-quiet" disabled={(gameState.fieldwork.foods[recipe.id] || 0) === 0} title="Eat, restore Hunger and activate this meal's buff" onclick={() => oneat(recipe.id)}>Eat</button>
            </div>
          </article>
        {/each}
      </div>
    </section>
  </section>

  <footer class="stores">
    <div class="stock-group" aria-label="Field supplies">
      {#each resources as resource (resource.id)}
        <span class="stock"><img src={resource.icon} alt="" aria-hidden="true" /><b>{resource.name}</b><strong class="text-value">{gameState.fieldwork.materials[resource.id] || 0}</strong></span>
      {/each}
      <span class="stock"><img src={herbIcon} alt="" aria-hidden="true" /><b>Herbs</b><strong class="text-value">{Object.values(gameState.farm.herbs).reduce((sum, n) => sum + n, 0)}</strong></span>
    </div>
    <div class="skill-group" aria-label="Life skill levels">
      {#each skillNames as [id, name] (id)}
        <span><b>{name}</b><strong class="text-value">Lv {fieldSkillLevel(gameState, id)}</strong></span>
      {/each}
    </div>
  </footer>
</div>

<style>
  /* The camp's own layout: one row of stations over a stores footer. The look of a station and of the
     ground it stands on lives in `skins.css` (`btn-prop`, `plate-ground`); this block places them. */
  .fieldwork-board { display: grid; grid-template-rows: minmax(0, 1fr) auto; gap: var(--spacing-sm); flex: 1; min-height: 0; overflow: hidden; font-size: var(--font-xs); }
  .scene { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: var(--spacing-md); min-height: 0; overflow: hidden; }
  .station { display: flex; flex-direction: column; gap: var(--spacing-xs); min-width: 0; min-height: 0; overflow: hidden; }
  .station-btn { position: relative; display: grid; justify-items: center; gap: var(--spacing-xs); }
  .station-btn > img, .station-btn > span { position: relative; z-index: var(--z-content); }
  .station-btn img { width: var(--icon-xl); height: var(--icon-xl); object-fit: contain; }
  .station-btn span { text-align: center; }
  .station-read { display: flex; align-items: baseline; justify-content: center; gap: var(--spacing-xs); text-align: center; }
  .station-read strong { font-family: var(--num); font-weight: 600; }
  .station > small { text-align: center; }
  .hunger-meter > i { display: block; height: 4px; overflow: hidden; border-radius: var(--radius-xs); }
  .hunger-meter em { display: block; height: 100%; }
  .auto-eat { display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: var(--spacing-sm); }
  .auto-eat label { display: inline-flex; align-items: center; gap: var(--spacing-xs); }
  .auto-eat select { max-width: clamp(63px, 4.84vw, 135px); }
  .pantry { display: flex; flex-wrap: wrap; align-content: flex-start; gap: var(--spacing-xs); flex: 1; min-height: 0; overflow: auto; }
  .work { display: grid; gap: var(--spacing-xs); min-width: 0; }
  .work-title { display: inline-flex; align-items: center; justify-content: center; gap: var(--spacing-xs); }
  .work-title img { width: var(--icon-xs); height: var(--icon-xs); object-fit: contain; }
  .recipe-tabs { display: flex; justify-content: center; gap: var(--spacing-xs); }
  .recipe-tabs button { display: inline-flex; align-items: center; gap: var(--spacing-xs); }
  .recipe-tabs small { color: inherit; font-family: var(--num); }
  .recipes { display: grid; gap: var(--spacing-sm); flex: 1; min-height: 0; overflow: auto; }
  .recipe { display: grid; align-content: start; gap: var(--spacing-xs); min-width: 0; overflow: hidden; border-top: 1px solid var(--edge); padding: var(--spacing-sm) var(--spacing-xs); background: color-mix(in srgb, var(--panel) 64%, transparent); }
  .recipe.locked { opacity: .56; }
  .recipe-head { display: flex; justify-content: space-between; align-items: baseline; gap: var(--spacing-xs); }
  .recipe-actions { display: flex; gap: var(--spacing-xs); }
  .recipe-actions button { flex: 1; }
  .provision { display: inline-flex; align-items: center; gap: var(--spacing-xs); padding: var(--spacing-xs) var(--spacing-xs); border: 1px solid var(--edge); border-radius: var(--radius-sm); background: color-mix(in srgb, var(--panel) 65%, transparent); white-space: nowrap; }
  .provision strong { font-family: var(--num); }
  .provision img { width: var(--icon-xs); height: var(--icon-xs); object-fit: contain; }
  .provision.ingredient { color: var(--dim); }
  .stores { display: flex; align-items: center; justify-content: space-between; gap: var(--spacing-sm); min-width: 0; border-top: 1px solid var(--line); padding-top: var(--spacing-xs); }
  .stock-group, .skill-group { display: flex; flex-wrap: wrap; align-items: center; gap: var(--spacing-sm); }
  .stock, .skill-group span { display: inline-flex; align-items: center; gap: var(--spacing-xs); white-space: nowrap; }
  .stock img { width: var(--icon-xs); height: var(--icon-xs); object-fit: contain; }
  .stock strong, .skill-group strong { font-variant-numeric: tabular-nums; }
  .skill-group { color: var(--dim); }
</style>

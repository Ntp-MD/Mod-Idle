<script lang="ts">
  import { fieldwork } from '../engine/client';
  import { activeMeal, canCook, fieldDropChance, fieldHarvestAmount, fieldMasteryLevel, fieldSkillLevel } from '../sim/fieldwork';
  import type { GameState } from '../sim/types';
  import { stackIcon, icon } from '../icon';
  const campIcon = icon('camping-tent');
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
    onstart: (kind: 'mine' | 'grove') => void;
    onstop: () => void;
    onhunt: () => void;
    onrest: () => void;
    oncook: (id: string) => void;
    oneat: (id: string) => void;
    onauto: (patch: Partial<{ enabled: boolean; threshold: number; allowRaw: boolean }>) => void;
  } = $props();

  const regional = $derived(fieldwork.F.regional_sources[String(gameState.zone)]);
  const resources = $derived(fieldwork.F.materials.filter((material: any) =>
    (gameState.fieldwork.materials[material.id] || 0) > 0 || ['ore', 'timber', 'rarewood', regional?.mine, regional?.grove].includes(material.id))
    .map((material: any) => ({ ...material, icon: material.group === 'wood' ? treeIcon : mineralIcon })));
  const skillNames = [
    ['mining', 'Mining'], ['woodcutting', 'Woodcutting'], ['hunting', 'Hunting'], ['cooking', 'Cooking'],
  ] as const;
  const recipeMenus = [
    { id: 'hearth', label: 'Hearth' }, { id: 'forage', label: 'Wild recipes' },
  ] as const;
  let recipeMenu = $state<'hearth' | 'forage'>('hearth');
  const active = $derived(activeMeal(gameState));
  const remaining = $derived(active ? `${Math.ceil(active.secondsLeft / 60)} min` : '');
  const canSetCamp = $derived(!inTown && !busy && gameState.phase !== 'camp' && !gameState.dungeon);
  const campMoveLabel = $derived(gameState.fieldwork.freeRelocationsRemaining > 0 ? 'Move Camp · free' : `Move Camp · ${fieldwork.F.camp.relocate_ore} ore · ${fieldwork.F.camp.relocate_timber} timber`);
  const siteAction = $derived(site === 'mine' ? 'mine' : site === 'grove' ? 'grove' : null);
  const activityTitle = $derived(site === 'mine' ? 'Mine' : site === 'grove' ? 'Rare Grove' : site === 'hunt' ? 'Hunting Ground' : site === 'dungeon' ? 'Dungeon Entrance' : 'Field');
  const pantry = $derived(fieldwork.foods.filter((food: any) => food.kind !== 'cooked'));
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
  <section class="camp-line">
    <div class="camp-mark"><img src={campIcon} alt="" aria-hidden="true" /></div>
    <div class="camp-copy">
      <h3>Field Camp</h3>
      <p>{gameState.fieldwork.camp ? `Camp at ${campName}` : 'No Camp set · set up on any field hex'}</p>
      <small>{campHere ? `Standing at ${cellName} · safe ground` : `Current hex ${cellName} · ${activityTitle}`}</small>
    </div>
    {#if campHere}
      {#if gameState.hunting}
        <button class="camp-action" disabled={gameState.phase === 'camp'} onclick={onrest} title="Pause combat and return to safe Camp">{gameState.phase === 'camp' ? 'Recovering…' : 'Return to Camp'}</button>
      {:else}
        <button class="camp-action" disabled={gameState.phase === 'camp'} onclick={onhunt} title="Leave the safe Camp and resume hunting">{gameState.phase === 'camp' ? 'Recovering…' : 'Leave Camp · Hunt'}</button>
      {/if}
    {:else}
      <button class="camp-action" disabled={!canSetCamp} onclick={oncamp} title={gameState.fieldwork.camp ? (gameState.fieldwork.freeRelocationsRemaining > 0 ? 'First relocation is free' : `Relocate Camp · costs ${fieldwork.F.camp.relocate_ore} ore and ${fieldwork.F.camp.relocate_timber} timber`) : 'The first Camp is free'}>
        {gameState.fieldwork.camp ? campMoveLabel : 'Set Camp · free'}
      </button>
    {/if}
  </section>

  <section class="hunger-line" aria-label="Hunger and automatic eating">
    <div class="hunger-meter" class:empty={gameState.fieldwork.hunger <= 0} title={gameState.fieldwork.hunger <= 0 ? `Empty Hunger · HP regeneration reduced by ${fieldwork.F.hunger.empty_hp_regen_cut_pct}% · Energy Shield recharge unaffected` : 'Hunger drains during travel, hunts and field gathering'}>
      <div><b>Hunger</b><strong>{Math.floor(gameState.fieldwork.hunger)} / {fieldwork.F.hunger.max}</strong></div>
      <i><em style:width={`${hungerFill * 100}%`}></em></i>
    </div>
    <div class="auto-eat">
      <label><input type="checkbox" checked={gameState.fieldwork.autoEat.enabled} onchange={(event) => onauto({ enabled: (event.currentTarget as HTMLInputElement).checked })} /> Auto Eat</label>
      <select aria-label="Auto Eat threshold" value={gameState.fieldwork.autoEat.threshold} disabled={!gameState.fieldwork.autoEat.enabled} onchange={(event) => onauto({ threshold: Number((event.currentTarget as HTMLSelectElement).value) })}>
        {#each fieldwork.F.hunger.auto_eat.threshold_options as threshold (threshold)}<option value={threshold}>{threshold}%</option>{/each}
      </select>
      <label title="Allow raw food before Hunger reaches zero"><input type="checkbox" checked={gameState.fieldwork.autoEat.allowRaw} disabled={!gameState.fieldwork.autoEat.enabled} onchange={(event) => onauto({ allowRaw: (event.currentTarget as HTMLInputElement).checked })} /> Raw early</label>
    </div>
  </section>

  <section class="activity-line">
    <div class="activity-mark">
      {#if site === 'mine'}<img src={pickIcon} alt="" aria-hidden="true" />
      {:else if site === 'grove'}<img src={treeIcon} alt="" aria-hidden="true" />
      {:else if site === 'hunt'}<img src={meatIcon} alt="" aria-hidden="true" />
      {:else}<img src={campIcon} alt="" aria-hidden="true" />{/if}
    </div>
    <div class="activity-copy">
      <b>{activityTitle}</b>
      <small>
        {#if site === 'mine'}Mine {fieldHarvestAmount(gameState, 'mining', fieldwork.F.actions.mine.yield)} ore/action · local find: {fieldwork.materialById[regional?.mine]?.name} · Mst {fieldMasteryLevel(gameState, 'mining', 'mine')}
        {:else if site === 'grove'}Cut {fieldHarvestAmount(gameState, 'woodcutting', fieldwork.F.actions.grove.yield)} timber/action · local wood: {fieldwork.materialById[regional?.grove]?.name} · forage: {fieldwork.foodById[regional?.food]?.name}
        {:else if site === 'hunt'}Drop chance and portions improve with Hunting level and species Mastery · humans may drop cooked rations, Goblins raw haunches
        {:else if site === 'dungeon'}A special dungeon run starts from this map hex
        {:else}Choose a field hex from the map to see its activity{/if}
      </small>
    </div>
    {#if siteAction}
      {#if gameState.fieldwork.action?.kind === siteAction}
        <button class="activity-action" onclick={onstop}>Stop gathering</button>
      {:else}
        <button class="activity-action" disabled={!campHere || gameState.hunting || gameState.phase === 'camp'} onclick={() => onstart(siteAction)} title={campHere ? '' : 'Set Camp on this hex to gather'}>
          {siteAction === 'mine' ? 'Start mining' : 'Start woodcutting'}
        </button>
      {/if}
    {/if}
  </section>

  <section class="stock-line" aria-label="Field supplies">
    <div class="stock-group">
      {#each resources as resource (resource.id)}
        <span class="stock"><img src={resource.icon} alt="" aria-hidden="true" /><b>{resource.name}</b><strong>{gameState.fieldwork.materials[resource.id] || 0}</strong></span>
      {/each}
      <span class="stock"><img src={herbIcon} alt="" aria-hidden="true" /><b>Herbs</b><strong>{Object.values(gameState.farm.herbs).reduce((sum, n) => sum + n, 0)}</strong></span>
    </div>
    <div class="skill-group" aria-label="Life skill levels">
      {#each skillNames as [id, name] (id)}
        <span><b>{name}</b><strong>Lv {fieldSkillLevel(gameState, id)}</strong></span>
      {/each}
    </div>
  </section>

  <section class="provisions-line" aria-label="Food bag">
    <header><b>Provisions</b><small>Auto Eat: cooked → fruit → herb · {gameState.fieldwork.autoEat.allowRaw ? 'raw allowed' : 'raw held to zero'}</small></header>
    <div class="provisions">
      {#each pantry as food (food.id)}
        <span class="provision" class:ingredient={food.kind === 'ingredient'}>
          <img src={stackIcon('food', food.name, `food:${food.id}`)} alt="" aria-hidden="true" />
          <span>{food.name}</span><strong>×{gameState.fieldwork.foods[food.id] || 0}</strong>
          {#if food.edible}<button class="eat-small" disabled={(gameState.fieldwork.foods[food.id] || 0) === 0} aria-label="Eat {food.name}" title="Eat {food.name} · +{food.hunger_restore} Hunger" onclick={() => oneat(food.id)}>Eat</button>{/if}
        </span>
      {/each}
    </div>
  </section>

  <section class="kitchen-line">
    <header>
      <div>
        <h3>Camp Kitchen</h3>
        <small>{active ? `${active.name} active · ${remaining} left · +${active.damage_pct}% damage · +${active.hp_regen_pct}% Max HP regen/sec` : 'Cook field food for Hunger and a timed combat buff'}</small>
      </div>
      <div class="recipe-tabs" role="tablist" aria-label="Recipe menus">
        {#each recipeMenus as menu (menu.id)}
          <button role="tab" class:selected={recipeMenu === menu.id} aria-selected={recipeMenu === menu.id}
                  onclick={() => (recipeMenu = menu.id)}>
            {menu.label}<small>{recipesInMenu(menu.id)}</small>
          </button>
        {/each}
      </div>
      {#if active}<span class="meal-live" aria-label="Meal buff active"></span>{/if}
    </header>
    <div class="recipes">
      {#each visibleRecipes as recipe (recipe.id)}
        {@const verdict = canCook(gameState, recipe.id)}
        <article class="recipe" class:locked={fieldSkillLevel(gameState, 'cooking') < recipe.level}>
          <div class="recipe-head"><b>{recipe.name}</b><strong>×{gameState.fieldwork.foods[recipe.id] || 0}</strong></div>
          <small>{recipeCost(recipe)}</small>
          <small>+{recipe.hunger_restore} Hunger · Lv {recipe.level} · {recipe.duration_sec / 60} min · +{recipe.damage_pct}% damage · +{recipe.hp_regen_pct}% HP regen</small>
          <div class="recipe-actions">
            <button disabled={!verdict.ok} title={verdict.why || 'Cook at your active Camp'} onclick={() => oncook(recipe.id)}>Cook</button>
            <button disabled={(gameState.fieldwork.foods[recipe.id] || 0) === 0} title="Eat, restore Hunger and activate this meal's buff" onclick={() => oneat(recipe.id)}>Eat</button>
          </div>
        </article>
      {/each}
    </div>
  </section>
</div>

<style>
  .fieldwork-board { display: grid; grid-template-rows: auto auto auto auto auto minmax(0, 1fr); gap: var(--spacing-sm); flex: 1; min-height: 0; overflow: hidden; font-size: var(--font-xs); }
  .camp-line, .activity-line { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; gap: var(--spacing-sm); min-width: 0; border-bottom: 1px solid var(--line); padding-bottom: var(--spacing-xs); }
  .camp-mark, .activity-mark { display: grid; place-items: center; width: var(--icon-lg); height: var(--icon-lg); border: 1px solid var(--edge); border-radius: var(--radius-sm); background: var(--panel); }
  .camp-mark img, .activity-mark img { width: var(--icon-md); height: var(--icon-md); object-fit: contain; }
  .camp-copy, .activity-copy { display: grid; gap: var(--spacing-xs); min-width: 0; }
  .camp-copy h3, .kitchen-line h3 { margin: 0; color: var(--gold); font-size: var(--font-sm); }
  .camp-copy p { margin: 0; color: var(--text); }
  .camp-copy small, .activity-copy small, .kitchen-line small, .recipe small { color: var(--dim); }
  .camp-action, .activity-action { white-space: nowrap; }
  .hunger-line { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: var(--spacing-sm); border-bottom: 1px solid var(--line); padding-bottom: var(--spacing-xs); }
  .hunger-meter { display: grid; gap: var(--spacing-xs); min-width: 0; }
  .hunger-meter > div { display: flex; justify-content: space-between; gap: var(--spacing-sm); }
  .hunger-meter b { color: var(--gold); }
  .hunger-meter strong { color: var(--text); font-family: var(--num); font-weight: 600; }
  .hunger-meter > i { display: block; height: 4px; overflow: hidden; border-radius: var(--radius-round); background: var(--bar-2); }
  .hunger-meter em { display: block; height: 100%; background: var(--gold); }
  .hunger-meter.empty strong { color: var(--alarm); }
  .hunger-meter.empty em { background: var(--alarm); }
  .auto-eat { display: flex; align-items: center; gap: var(--spacing-sm); white-space: nowrap; }
  .auto-eat label { display: inline-flex; align-items: center; gap: var(--spacing-xs); }
  .auto-eat select { max-width: clamp(63px, 4.84vw, 135px); }
  .activity-line { grid-template-columns: auto minmax(0, 1fr) auto; }
  .stock-line { display: flex; align-items: center; justify-content: space-between; gap: var(--spacing-sm); min-width: 0; border-bottom: 1px solid var(--line); padding-bottom: var(--spacing-xs); }
  .stock-group, .skill-group { display: flex; flex-wrap: wrap; align-items: center; gap: var(--spacing-xs); }
  .stock, .skill-group span { display: inline-flex; align-items: center; gap: var(--spacing-xs); white-space: nowrap; }
  .stock img { width: var(--icon-xs); height: var(--icon-xs); object-fit: contain; }
  .stock strong, .skill-group strong { color: var(--gold); font-variant-numeric: tabular-nums; }
  .skill-group { color: var(--dim); }
  .provisions-line { display: grid; gap: var(--spacing-xs); min-width: 0; border-bottom: 1px solid var(--line); padding-bottom: var(--spacing-xs); }
  .provisions-line > header { display: flex; align-items: baseline; justify-content: space-between; gap: var(--spacing-sm); }
  .provisions-line > header b { color: var(--gold); }
  .provisions-line > header small { color: var(--dim); }
  .provisions { display: flex; flex-wrap: wrap; align-items: center; gap: var(--spacing-xs); }
  .provision { display: inline-flex; align-items: center; gap: var(--spacing-xs); padding: var(--spacing-xs) var(--spacing-xs); border: 1px solid var(--edge); border-radius: var(--radius-sm); background: color-mix(in srgb, var(--panel) 65%, transparent); white-space: nowrap; }
  .provision strong { color: var(--gold); font-family: var(--num); }
  .provision img { width: var(--icon-xs); height: var(--icon-xs); object-fit: contain; }
  .provision.ingredient { color: var(--dim); }
  .eat-small { padding: var(--spacing-xs) var(--spacing-xs); }
  .kitchen-line { display: grid; grid-template-rows: auto minmax(0, 1fr); gap: var(--spacing-xs); min-height: 0; overflow: hidden; }
  .kitchen-line > header { display: flex; justify-content: space-between; align-items: center; gap: var(--spacing-sm); }
  .kitchen-line > header > div { display: grid; gap: var(--spacing-xs); min-width: 0; }
  .recipe-tabs { display: flex; align-items: center; gap: var(--spacing-xs); flex: none; }
  .recipe-tabs button { display: inline-flex; align-items: center; gap: var(--spacing-xs); padding: var(--spacing-xs) var(--spacing-xs); font-size: var(--font-xs); color: var(--dim); }
  .recipe-tabs button.selected { color: var(--gold); border-color: var(--gold); background: color-mix(in srgb, var(--gold) 10%, var(--panel)); }
  .recipe-tabs small { color: inherit; font-family: var(--num); }
  .recipes { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: var(--spacing-sm); min-height: 0; overflow: auto; }
  .recipe { display: grid; align-content: start; gap: var(--spacing-xs); min-width: 0; overflow: hidden; border-top: 1px solid var(--edge); padding: var(--spacing-sm) var(--spacing-xs); background: color-mix(in srgb, var(--panel) 64%, transparent); }
  .recipe.locked { opacity: .56; }
  .recipe-head { display: flex; justify-content: space-between; align-items: baseline; gap: var(--spacing-xs); }
  .recipe-head strong { color: var(--gold); }
  .recipe-actions { display: flex; gap: var(--spacing-xs); margin-top: var(--spacing-xs); }
  .recipe-actions button { flex: 1; }
  .meal-live { flex: none; width: var(--icon-xs); height: var(--icon-xs); border-radius: var(--radius-round); border: 1px solid var(--good-lit); background: var(--good-lit); }
</style>

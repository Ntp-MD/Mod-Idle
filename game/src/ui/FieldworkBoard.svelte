<script lang="ts">
  import { fieldwork } from '../engine/client';
  import { activeMeal, canCook, fieldActionProblem, fieldHarvestAmount, fieldMasteryLevel, fieldSkillLevel } from '../sim/fieldwork';
  import type { GameState } from '../sim/types';
  import { stackIcon, icon } from '../icon';
  import Tabs from './Tabs.svelte';

  /**
   * The Field Camp, read as a place and not as a form. A meadow band holds the scene: a tree line on
   * the horizon, and the camp's own objects are named on that ground as plates — a tent that is up or packed, a fire
   * burning as well as it is fed, a pot with a meal in it. Their figures live in the cards below. Under the
   * band, a two-column collage holds the camp's boards — the ground and its work, Hunger and the food
   * bag, the kitchen, and the Field bag — so each card is one part of the camp.
   */
  const tentIcon = icon('tent');
  const fireIcon = icon('rest-campfire');
  const potIcon = icon('cooking-cauldron');
  const bagIcon = icon('adventure-bags');
  const pickIcon = icon('pickaxe');
  const treeIcon = icon('tree');
  const meatIcon = icon('meat');
  const herbIcon = icon('jasmine');
  const skillMarks: Record<string, string> = {
    mining: icon('pickaxe'),
    woodcutting: icon('axe-in-stump'),
    hunting: icon('meat'),
    cooking: icon('cooking-cauldron'),
    fishing: icon('fishing-rod'),
    smithing: icon('hammer'),
  };

  /** The scene's own art: the shelf figures that stand behind the camp, sized and dimmed by distance.
   *  Nothing here is a control — the props above them are — so the whole layer stays out of the tree. */
  const treeLine = [
    { src: icon('pine-tree'), size: 1.0 },
    { src: icon('birch-trees'), size: 0.84 },
    { src: icon('oak'), size: 0.94 },
    { src: icon('pine-tree'), size: 0.78 },
    { src: icon('beech'), size: 0.9 },
    { src: icon('willow-tree'), size: 0.82 },
    { src: icon('pine-tree'), size: 0.96 },
    { src: icon('birch-trees'), size: 0.74 },
    { src: icon('pine-tree'), size: 0.9 },
  ];
  const groundBits = [
    { src: icon('boulder'), x: 2, y: 26, size: 0.5 },
    { src: icon('high-grass'), x: 8, y: 6, size: 0.42 },
    { src: icon('mushroom-cluster'), x: 14, y: 22, size: 0.3 },
    { src: icon('dead-wood'), x: 24, y: 10, size: 0.4 },
    { src: icon('high-grass'), x: 46, y: 3, size: 0.4 },
    { src: icon('clover-2'), x: 52, y: 1, size: 0.26 },
    { src: icon('stump-regrowth'), x: 58, y: 26, size: 0.36 },
    { src: icon('mushrooms'), x: 74, y: 14, size: 0.3 },
    { src: icon('boulder'), x: 84, y: 24, size: 0.42 },
    { src: icon('high-grass'), x: 90, y: 3, size: 0.44 },
    { src: icon('axe-in-stump'), x: 95, y: 26, size: 0.4 },
    { src: icon('hunters-roast'), x: 34, y: 12, size: 0.26, near: true },
    { src: icon('river-fish'), x: 40, y: 24, size: 0.24, near: true },
    { src: icon('herb-bundle'), x: 55, y: 20, size: 0.2, near: true },
    { src: icon('food-bread-loaf'), x: 62, y: 18, size: 0.26, near: true },
    { src: icon('grilled-skewer'), x: 68, y: 8, size: 0.24, near: true },
  ];

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
    .map((material: any) => ({ ...material, icon: stackIcon('material', material.name, `material:${material.id}`) })));
  const herbs = $derived(Object.values(gameState.farm.herbs).reduce((sum, n) => sum + n, 0));
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
  const gatheringProblem = $derived(siteAction ? fieldActionProblem(gameState, siteAction) : null);
  const fishingProblem = $derived(fieldActionProblem(gameState, 'fish'));
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
  const foodStock = $derived(pantry.filter((food: any) => (gameState.fieldwork.foods[food.id] || 0) > 0));
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
  <section class="scene plate-ground" aria-label="Field Camp scene">
    <div class="treeline" aria-hidden="true">
      {#each treeLine as tree, index (index)}
        <img src={tree.src} alt="" decoding="async" style={`--size:${tree.size}`} />
      {/each}
    </div>
    <div class="scatter" aria-hidden="true">
      {#each groundBits as bit, index (index)}
        <img src={bit.src} alt="" decoding="async" class:near={bit.near} style={`--x:${bit.x}%; --y:${bit.y}%; --size:${bit.size}`} />
      {/each}
    </div>

    <div class="props">
      <section class="station">
        <button class="btn btn-prop station-btn" class:toggled={campHere} class:off={!campSet} class:busy={recovering}
                style={`--fed:${campHere ? 1 : 0}`} disabled={tentDisabled}
                onclick={() => (campHere ? (gameState.hunting ? onrest() : onhunt()) : oncamp())}
                title={campSet
                  ? (campHere
                    ? (gameState.hunting ? 'Pause combat and return to safe Camp' : 'Leave the safe Camp and resume hunting')
                    : (gameState.fieldwork.freeRelocationsRemaining > 0 ? 'First relocation is free' : `Relocate Camp · costs ${fieldwork.F.camp.relocate_ore} ore and ${fieldwork.F.camp.relocate_timber} timber`))
                  : 'The first Camp is free'}>
          <span class="station-label">{recovering ? `Resting · ${Math.max(0, Math.ceil(gameState.campSec))}s` : tentAction}</span>
        </button>
      </section>

      <section class="station" aria-label="Hunger">
        <button class="btn btn-prop station-btn" class:toggled={gameState.fieldwork.hunger > 0} class:off={!fireFood}
                style={`--fed:${hungerFill.toFixed(3)}`} disabled={!fireFood}
                onclick={() => fireFood && oneat(fireFood.id)}
                title={fireFood ? `Eat ${foodName(fireFood)} · +${fireFood.hunger_restore} Hunger` : 'No field food in the bag · gather, fish or cook first'}>
          <span class="station-label">{fireFood ? `Eat ${foodName(fireFood)}` : 'Nothing to eat'}</span>
        </button>
      </section>

      <section class="station" aria-label="Camp Kitchen">
        <button class="btn btn-prop station-btn" class:toggled={!!active} class:off={!potMeal}
                style={`--fed:${active ? 1 : 0}`} disabled={!potMeal}
                onclick={() => potMeal && oneat(potMeal.id)}
                title={potMeal ? `Eat ${foodName(potMeal)} · +${potMeal.hunger_restore} Hunger and its meal buff` : 'No cooked dish in the bag · cook one from the menu below'}>
          <span class="station-label">{potMeal ? 'Eat meal' : 'Empty pot'}</span>
        </button>
      </section>
    </div>
  </section>

  <div class="cards">
    <section class="card card-read camp-card">
      <header class="card-head">
        <span class="face plate-medallion" aria-hidden="true"><img src={activityMark} alt="" /></span>
        <div class="card-title">
          <b>{campSet ? `Camp · ${campName}` : 'No Camp set'}</b>
          <small class="text-note">{campHere ? `Standing at ${cellName} · safe ground` : `Hex ${cellName} · ${activityTitle}`}</small>
        </div>
      </header>
      <div class="work">
        <b class="work-title">{activityTitle}</b>
        <small class="text-note">{activityDetail}</small>
      </div>
      <div class="camp-facts">
        <span class="card-tile fact" title={campSet ? (campHere ? 'Camp standing on this hex' : 'Camp set on another hex') : 'No Camp set'}>
          <img src={tentIcon} alt="" aria-hidden="true" />
          <small class="text-note">Camp</small>
          <b>{campSet ? (campHere ? 'Standing' : 'Set') : 'Packed'}</b>
        </span>
        <span class="card-tile fact" title={fireFood ? `${foodName(fireFood)} ready at the fire` : 'No field food in the bag'}>
          <img src={fireIcon} alt="" aria-hidden="true" />
          <small class="text-note">Fire</small>
          <b>{fireFood ? foodName(fireFood) : 'Cold'}</b>
        </span>
        <span class="card-tile fact" title={active ? `${active.name} · ${remaining} left` : potMeal ? `${foodName(potMeal)} ready at the pot` : 'No cooked dish in the bag'}>
          <img src={potIcon} alt="" aria-hidden="true" />
          <small class="text-note">Pot</small>
          <b>{active ? active.name : potMeal ? foodName(potMeal) : 'Empty'}</b>
        </span>
      </div>
      <div class="card-actions">
        {#if siteAction}
          {#if gameState.fieldwork.action?.kind === siteAction}
            <button class="btn btn-quiet" onclick={onstop}>Stop gathering</button>
          {:else}
            <button class="btn btn-quiet" disabled={!!gatheringProblem} onclick={() => onstart(siteAction)} title={gatheringProblem || 'Gather at your Camp'}>
              {siteAction === 'mine' ? 'Start mining' : 'Start woodcutting'}
            </button>
          {/if}
        {:else if fishingId && (campHere || gameState.fieldwork.action?.kind === 'fish')}
          {#if gameState.fieldwork.action?.kind === 'fish'}
            <button class="btn btn-quiet" onclick={onstop}>Stop fishing</button>
          {:else}
            <button class="btn btn-quiet" disabled={!!fishingProblem} title={fishingProblem || 'Fish at your Camp'} onclick={() => onstart('fish')}>Start fishing · {fieldwork.foodById[fishingId]?.name}</button>
          {/if}
        {/if}
      </div>
    </section>

    <section class="card card-read hunger-card" aria-label="Hunger">
      <header class="card-head">
        <span class="face plate-medallion" aria-hidden="true"><img src={fireIcon} alt="" /></span>
        <div class="card-title">
          <b>Hunger <strong class="text-value" class:text-alarm={gameState.fieldwork.hunger <= 0}>{Math.floor(gameState.fieldwork.hunger)}</strong><span class="text-dim">/ {fieldwork.F.hunger.max}</span></b>
          <small class="text-note">The bag feeds Hunger · Auto Eat: cooked → fruit → herb · {gameState.fieldwork.autoEat.allowRaw ? 'raw allowed' : 'raw held to zero'}</small>
        </div>
      </header>
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
      <div class="roster" aria-label="Food bag">
        {#if foodStock.length === 0}
          <small class="text-note">Bag empty · gather, fish or cook first</small>
        {:else}
          {#each foodStock as food (food.id)}
            {#if food.edible}
              <button class="medallion plate-medallion" aria-label="Eat {food.name}" title="Eat {food.name} · +{food.hunger_restore} Hunger" onclick={() => oneat(food.id)}>
                <img src={stackIcon('food', food.name, `food:${food.id}`)} alt="" aria-hidden="true" />
                <span class="badge badge-count count">{gameState.fieldwork.foods[food.id]}</span>
              </button>
            {:else}
              <span class="medallion plate-medallion off" role="img" aria-label="{food.name}, ingredient, {gameState.fieldwork.foods[food.id]} carried" title="{food.name} · ingredient">
                <img src={stackIcon('food', food.name, `food:${food.id}`)} alt="" aria-hidden="true" />
                <span class="badge badge-count count">{gameState.fieldwork.foods[food.id]}</span>
              </span>
            {/if}
          {/each}
        {/if}
      </div>
    </section>

    <section class="card card-read kitchen-card" aria-label="Camp Kitchen">
      <header class="card-head">
        <span class="face plate-medallion" aria-hidden="true"><img src={potIcon} alt="" /></span>
        <div class="card-title">
          <b>Camp Kitchen</b>
          <small class="text-note">{active
            ? `${active.name} · ${remaining} left · +${active.damage_pct}% damage · +${active.hp_regen_pct}% Max HP regen`
            : 'No meal cooking · a dish restores Hunger and carries its buff into the field'}</small>
        </div>
      </header>
      <Tabs
        label="Recipe menus"
        tabs={recipeMenus.map((m) => ({ id: m.id, label: m.label }))}
        active={recipeMenu}
        onpick={(id) => (recipeMenu = id as typeof recipeMenu)}
        columns={2}
      >
        {#snippet item(m)}
          <span>{m.label}</span><small class="text-note">{recipesInMenu(m.id)}</small>
        {/snippet}
      </Tabs>
      <div class="recipes">
        {#each visibleRecipes as recipe (recipe.id)}
          {@const verdict = canCook(gameState, recipe.id)}
          <article class="card-tile recipe" class:locked={fieldSkillLevel(gameState, 'cooking') < recipe.level}>
            <span class="recipe-mark plate-mark" aria-hidden="true"><img src={stackIcon('food', recipe.name, `food:${recipe.id}`)} alt="" /></span>
            <div class="recipe-copy">
              <div class="recipe-head"><b>{recipe.name}</b><span class="badge badge-count">{gameState.fieldwork.foods[recipe.id] || 0}</span></div>
              <small class="text-note">{recipeCost(recipe)}</small>
              <small class="text-note" title={`+${recipe.hunger_restore} Hunger · Lv ${recipe.level} · ${recipe.duration_sec / 60} min · +${recipe.damage_pct}% damage · +${recipe.hp_regen_pct}% HP regen`}>+{recipe.hunger_restore} Hunger · Lv {recipe.level} · +{recipe.damage_pct}% dmg</small>
            </div>
            <div class="recipe-actions">
              <button class="btn btn-quiet" disabled={!verdict.ok} title={verdict.why || 'Cook at your active Camp'} onclick={() => oncook(recipe.id, 1 + Math.floor(fieldMasteryLevel(gameState, 'cooking', recipe.id) / 20))}>Cook ×{1 + Math.floor(fieldMasteryLevel(gameState, 'cooking', recipe.id) / 20)}</button>
              <button class="btn btn-quiet" disabled={(gameState.fieldwork.foods[recipe.id] || 0) === 0} title="Eat, restore Hunger and activate this meal's buff" onclick={() => oneat(recipe.id)}>Eat</button>
            </div>
          </article>
        {/each}
      </div>
    </section>

    <section class="card card-read bag-card" aria-label="Field bag">
      <header class="card-head">
        <span class="face plate-medallion" aria-hidden="true"><img src={bagIcon} alt="" /></span>
        <div class="card-title">
          <b>Field bag</b>
          <small class="text-note">Gathered supplies and life skills</small>
        </div>
      </header>
      <div class="bag-groups">
        <div class="bag-group" aria-label="Field supplies">
          <small class="text-note">Supplies</small>
          <div class="roster bag-roster">
            {#each resources as resource (resource.id)}
              <span class="bag-entry" role="img" aria-label="{resource.name}, {gameState.fieldwork.materials[resource.id] || 0}" title="{resource.name} · {gameState.fieldwork.materials[resource.id] || 0}">
                <span class="medallion plate-medallion" aria-hidden="true">
                  <img src={resource.icon} alt="" />
                  <span class="badge badge-count count">{gameState.fieldwork.materials[resource.id] || 0}</span>
                </span>
                <span class="bag-entry-name" aria-hidden="true">{resource.name}</span>
              </span>
            {/each}
            <span class="bag-entry" role="img" aria-label="Herbs, {herbs}" title="Herbs · {herbs}">
              <span class="medallion plate-medallion" aria-hidden="true">
                <img src={herbIcon} alt="" />
                <span class="badge badge-count count">{herbs}</span>
              </span>
              <span class="bag-entry-name" aria-hidden="true">Herbs</span>
            </span>
          </div>
        </div>
        <div class="bag-group" aria-label="Life skill levels">
          <small class="text-note">Life skills</small>
          <div class="roster bag-roster">
            {#each skillNames as [id, name] (id)}
              <span class="bag-entry" role="img" aria-label="{name} level {fieldSkillLevel(gameState, id)}" title="{name} · Lv {fieldSkillLevel(gameState, id)}">
                <span class="medallion plate-medallion" aria-hidden="true">
                  <img src={skillMarks[id]} alt="" />
                  <span class="badge badge-count count">{fieldSkillLevel(gameState, id)}</span>
                </span>
                <span class="bag-entry-name" aria-hidden="true">{name}</span>
              </span>
            {/each}
          </div>
        </div>
      </div>
    </section>
  </div>
</div>

<style>
  /* The camp reads as a place: a drawn clearing on top, then the boards a camp keeps — where it stands,
     what it eats, what it cooks, what it carries — as a two-column collage. The paint of the ground, the
     props, a read card and a tile lives in `skins.css`; this block places them and sizes the faces. The
     scene's own art — tree line and ground scatter — is this component's, as the orbs' layers are the
     HUD's. */
  .fieldwork-board { display: grid; grid-template-rows: auto minmax(0, 1fr); gap: var(--spacing-md); flex: 1; min-height: 0; overflow: hidden; font-size: var(--font-xs); }
  .scene { position: relative; height: clamp(170px, 13vw, 300px); --horizon: 58%; overflow: hidden; }
  .treeline { position: absolute; inset-inline: 0; top: 0; height: var(--horizon); display: flex; align-items: flex-end; justify-content: space-between; padding-inline: var(--spacing-md); pointer-events: none; }
  .treeline img { height: calc(var(--icon-card) * 2.66 * var(--size, 1)); width: auto; object-fit: contain; opacity: .26; }
  .scatter { position: absolute; inset: 0; pointer-events: none; }
  .scatter img { position: absolute; left: var(--x); bottom: var(--y); height: calc(var(--icon-card) * 2.24 * var(--size, .3)); width: auto; object-fit: contain; opacity: .42; }
  .scatter img.near { opacity: .58; }
  /* The scene carries no art of its own beyond the clearing: the camp, the fire and the pot are named
     on the meadow as plates, and the figures they belong to stay in the cards. The plates end a little
     under the horizon, so they read as lying on the ground in front of the tree line. */
  .props { position: absolute; inset-inline: 0; bottom: calc(100% - var(--horizon) - var(--spacing-md)); height: 0; display: grid; grid-template-columns: 1.1fr .9fr 1.1fr; justify-items: center; align-items: end; align-content: end; }
  .station { display: grid; justify-items: center; min-width: 0; }
  .station-btn { position: relative; display: grid; justify-items: center; gap: var(--spacing-xs); }
  .station-btn > span { position: relative; z-index: var(--z-content); }
  .station-btn span { text-align: center; }
  .station-label { padding: var(--spacing-xs) var(--spacing-sm); }
  .cards { display: grid; grid-template-columns: minmax(0, .9fr) minmax(0, 1.1fr); grid-template-rows: minmax(0, 1fr) minmax(0, 1fr); gap: var(--spacing-md); min-height: 0; overflow: hidden; }
  .card { display: flex; flex-direction: column; gap: var(--spacing-sm); padding: var(--spacing-md); min-width: 0; min-height: 0; overflow: hidden; }
  .camp-card { grid-area: 1 / 1; }
  .hunger-card { grid-area: 2 / 1; }
  .kitchen-card { grid-area: 1 / 2; display: grid; grid-template-rows: auto auto minmax(0, 1fr); }
  .bag-card { grid-area: 2 / 2; }
  .card-head { display: flex; align-items: center; gap: var(--spacing-sm); min-width: 0; }
  .card-title { display: grid; gap: var(--spacing-xs); min-width: 0; }
  .card-title b { display: flex; align-items: baseline; flex-wrap: wrap; gap: var(--spacing-xs); font-size: var(--font-sm); }
  .face { display: grid; place-items: center; flex: none; width: calc(var(--icon-card) + var(--spacing-md)); height: calc(var(--icon-card) + var(--spacing-md)); }
  .face img { width: var(--icon-card); height: var(--icon-card); object-fit: contain; }
  .work { display: grid; align-content: start; gap: var(--spacing-xs); min-width: 0; }
  .work-title { font-size: var(--font-md); }
  .camp-facts { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: var(--spacing-sm); }
  .fact { display: grid; grid-template-columns: auto minmax(0, 1fr); grid-template-rows: auto auto; align-items: center; gap: var(--spacing-xs); padding: var(--spacing-sm); }
  .fact img { grid-row: 1 / -1; width: var(--icon-label); height: var(--icon-label); object-fit: contain; }
  .fact b { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .card-actions { display: grid; gap: var(--spacing-xs); }
  .hunger-meter > i { display: block; height: 4px; overflow: hidden; border-radius: var(--radius-card); }
  .hunger-meter em { display: block; height: 100%; }
  .auto-eat { display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: var(--spacing-sm); }
  .auto-eat label { display: inline-flex; align-items: center; gap: var(--spacing-xs); }
  .auto-eat select { max-width: clamp(63px, 4.84vw, 135px); }
  .roster { display: flex; flex-wrap: wrap; align-content: flex-start; gap: var(--spacing-sm); flex: 1; min-height: 0; overflow: auto; }
  .roster.bag-roster { display: grid; grid-template-columns: repeat(auto-fit, minmax(calc(var(--icon-card) * 1.4 + var(--spacing-lg) + var(--spacing-lg) + var(--spacing-lg)), 1fr)); align-content: start; gap: var(--spacing-xs); }
  .bag-entry { display: grid; grid-template-columns: calc(var(--icon-label) + var(--spacing-lg)) minmax(0, 1fr); align-items: center; gap: var(--spacing-xs); min-width: 0; }
  .bag-entry .medallion { width: calc(var(--icon-label) + var(--spacing-lg)); height: calc(var(--icon-label) + var(--spacing-lg)); }
  .bag-entry .medallion img { width: var(--icon-label); height: var(--icon-label); }
  .bag-entry-name { min-width: 0; font-size: var(--font-xs); line-height: 1.15; overflow-wrap: anywhere; }
  .medallion { position: relative; display: grid; place-items: center; flex: none; width: calc(var(--icon-label) * 1.5 + var(--spacing-xl)); height: calc(var(--icon-label) * 1.5 + var(--spacing-xl)); }
  .medallion img { width: calc(var(--icon-label) * 1.5); height: calc(var(--icon-label) * 1.5); object-fit: contain; }
  .medallion .count { position: absolute; right: var(--spacing-xs); bottom: var(--spacing-xs); line-height: 1; }
  /* the tab buttons live in Tabs.svelte's scope, so their face styles reach them globally */
  .kitchen-card :global(.tabs .btn-quiet) { display: inline-flex; align-items: center; justify-content: center; gap: var(--spacing-xs); }
  .kitchen-card :global(.tabs .btn-quiet small) { font-family: var(--num); }
  .recipes { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); align-content: start; gap: var(--spacing-sm); min-height: 0; overflow: auto; }
  .recipe { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: var(--spacing-xs); padding: var(--spacing-sm); min-width: 0; }
  .recipe-mark { display: grid; place-items: center; width: calc(var(--icon-label) * 1.5 + var(--spacing-md)); height: calc(var(--icon-label) * 1.5 + var(--spacing-md)); }
  .recipe-mark img { width: calc(var(--icon-label) * 1.5); height: calc(var(--icon-label) * 1.5); object-fit: contain; }
  .recipe-copy { display: grid; align-content: start; gap: var(--spacing-xs); min-width: 0; }
  .recipe-head { display: flex; justify-content: space-between; align-items: baseline; gap: var(--spacing-xs); }
  .recipe-actions { grid-column: 1 / -1; display: flex; gap: var(--spacing-xs); }
  .recipe-actions button { flex: 1; }
  .bag-groups { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--spacing-md); flex: 1; min-width: 0; min-height: 0; }
  .bag-group { display: grid; grid-template-rows: auto minmax(0, 1fr); gap: var(--spacing-xs); min-width: 0; min-height: 0; }
</style>

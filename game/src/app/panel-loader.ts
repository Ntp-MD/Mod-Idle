const loaders: Record<string, () => Promise<unknown>> = {
  tree: () => import('../ui/passive-tree/PassiveTreeBoard.svelte'),
  skills: () => import('../ui/character/SkillsWorkbench.svelte'),
  craft: () => import('../ui/inventory/CraftWorkshop.svelte'),
  forge: () => import('../ui/inventory/Forge.svelte'),
  stash: () => import('../ui/inventory/StashBoard.svelte'),
  market: () => import('../ui/town/Market.svelte'),
  town: () => import('../ui/town/TownHub.svelte'),
};
const cache = new Map<string, Promise<unknown>>();
export function loadPanel(id: string): Promise<unknown> {
  const loader = loaders[id];
  if (!loader) return Promise.reject(new Error(`unknown panel ${id}`));
  const existing = cache.get(id);
  if (existing) return existing;
  const p = loader().catch((e) => { cache.delete(id); throw e; });
  cache.set(id, p);
  return p;
}
export function clearFailed(id: string) { cache.delete(id); }

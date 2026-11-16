// The DEV import boundary keeps authoring PNGs out of production asset collection.
const review = import.meta.env.DEV ? await import('../dev/procedural-vfx-review') : undefined;

export function selectProceduralVfxReview(component: string, skillId: string): void {
  review?.selectProceduralVfxReview(component, skillId);
}

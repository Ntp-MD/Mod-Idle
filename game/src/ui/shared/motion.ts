/**
 * The one leave a number plays.
 *
 * The ring's push-out and the park's drain are both instant, so the leave is given to a transition — the
 * last gesture the event plays before the DOM lets it go, and the one that makes a crowded second read as
 * a stagger rather than a flicker (owner ruling, MapleStory-staged). A column figure fades from wherever
 * its own arc had reached; a parked figure, whose arc ends held, is dissolved instead — held for its first
 * third, then lifted, fattened and blurred off the card. The reduced-motion dial hands both a zero.
 */
export function fxOut(node: Element, { ms = 0, held = false }: { ms?: number; held?: boolean } = {}) {
  if (ms === 0) return { duration: 0 };
  if (!held) {
    const from = Number(getComputedStyle(node).opacity) || 1;
    return { duration: ms, css: (t: number) => `opacity: ${(t * from).toFixed(3)};` };
  }
  return {
    duration: ms,
    css: (t: number) => {
      const u = 1 - t;
      const o = t > 2 / 3 ? 1 : t * 1.5;
      return `opacity: ${o.toFixed(3)}; transform: translateY(${(-u * 10).toFixed(1)}px)`
        + ` scale(${(1 + u * .12).toFixed(3)}); filter: blur(${(u * 1.6).toFixed(2)}px);`;
    },
  };
}

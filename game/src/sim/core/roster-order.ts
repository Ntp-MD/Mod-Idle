/** Front-line bodies sort ahead of the back line; equal lines keep their input order. */
export const byFrontLine = (a: { line: string }, b: { line: string }): number =>
  (a.line === 'front' ? -1 : 1) - (b.line === 'front' ? -1 : 1);

/**
 * The gate/watch contract — one home (AGENTS.md §Numbers).
 *
 * A **gate** is a condition: a copy, a wiring, a shape or coverage break, a direction flip, a Cap's
 * reachability, a binding cap, a pointer. It FAILs the run.
 *
 * A **watch** is a numeric window, tolerance or band on a measured figure. It prints PENDING and
 * never fails, because balance is read by eye from that line — promoting a watch to a hard gate is
 * the owner's ask, so nothing in this file owns or judges a threshold.
 *
 * A cage collects its rows and hands them to `report()`: the row shape, the column layout, the
 * verdict line and the exit code are this module's business, not each cage's.
 */

/** What one check resolved to. Only `FAIL` reaches the exit code. */
export type Verdict = 'PASS' | 'FAIL' | 'PENDING';

export type GateRow = { id: string; verdict: Verdict; detail: string };

export function gates() {
  const rows: GateRow[] = [];
  const push = (id: string, verdict: Verdict, detail: string) => rows.push({ id, verdict, detail });

  return {
    /** A gate: `ok` is the condition itself. A false `ok` is a FAIL. */
    add: (id: string, ok: unknown, detail: string) => push(id, ok ? 'PASS' : 'FAIL', detail),

    /**
     * An ADVISORY gate: where `add` would print FAIL this prints PENDING, so a figure that a design
     * change moved can never block a feature. The signal survives — the line still prints, with its own
     * numbers — and the repair is the one the line already names. Structural invariants (an id, a
     * reference, a shape) stay `add`; a measured or published figure is `soft`.
     */
    soft: (id: string, ok: unknown, detail: string) => push(id, ok ? 'PASS' : 'PENDING', detail),

    /**
     * A watch: `met` says the measured figure sits inside its window. Outside it the row reads
     * PENDING and the run still passes — `outside` is the line the owner reads by eye.
     */
    watch: (id: string, met: unknown, outside: string, inside: string) =>
      push(id, met ? 'PASS' : 'PENDING', met ? inside : outside),

    /** A row that is PENDING whatever the figure — work the data has not closed yet. */
    pending: (id: string, detail: string) => push(id, 'PENDING', detail),

    /** The rows so far, for a cage whose gate list is built away from its CLI. */
    rows: (): GateRow[] => rows.slice(),
  };
}

export type Gates = ReturnType<typeof gates>;

/**
 * Print every row, then the problems a cage collected beside them, then the one verdict line, and
 * set `process.exitCode` if any gate FAILed. A PENDING row never reaches the exit code.
 */
export function report(rows: GateRow[], problems?: string[]): { total: number; fails: number; pending: number } {
  const width = Math.max(4, ...rows.map((r) => r.id.length));
  for (const r of rows) console.log(`${r.id.padEnd(width)}  ${r.verdict.padEnd(7)}  ${r.detail}`);
  if (problems?.length) {
    console.log(`\n${problems.length} problem(s):`);
    for (const p of problems) console.log(`  · ${p}`);
  }
  const fails = rows.filter((r) => r.verdict === 'FAIL').length;
  const pending = rows.filter((r) => r.verdict === 'PENDING').length;
  console.log(`\n${rows.length - fails - pending}/${rows.length} gate PASS · ${pending} PENDING · ${fails} FAIL`);
  if (fails) process.exitCode = 1;
  return { total: rows.length, fails, pending };
}

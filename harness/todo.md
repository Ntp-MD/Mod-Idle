# Todo

import AGENT.md
import harness/HARNESS.md
import checks.md

The **single work file**: only what is *not built yet*, split by who can close it — **A** waiting on the
owner · **B** mine to build · **C** housekeeping that must not rot. **When work is done the line is
deleted, not ticked.** `node tools/verify.ts` green is the state of everything already built, so never
copy a cage result in here.

# Open work

## C · housekeeping that must not rot

- **`L9` sits exactly on its cap** (`tools/data/engine.json` `doc_prose_lines_max`), so it has zero
  headroom: the next doc line that puts any digit in prose fails `verify.ts`. The cap may only fall,
  never rise — lower it in the same pass that fixes lines.

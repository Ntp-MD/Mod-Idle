'use strict';
// The "Not Yet Defined" list still carried "minute one" as open. The opening now exists as data,
// so replace the line with a section that says what the player actually gets.
const fs = require('fs');
const p = 'concept.md';
let t = fs.readFileSync(p, 'utf8');
fs.writeFileSync('/tmp/concept.pre', t);

const SECTION = `# Minute One

**A client builds the starting character from one read of \`engine.json\` \`opening\`.** Everything below
is generated or gated by the five opening checks — a client needs nothing else to make the first
screen playable.

<!-- BEGIN GENERATED:opening -->
<!-- END GENERATED:opening -->

- **Why the starting weapon is the worst roll in the table.** The mob-health curve already prices a
  level-1 zone-1 mob against a character holding one weapon, so handing out a top-tier one would pay
  more damage than the curve allows. The floor of the low-quality table is exactly what the curve
  expects, which is why it is a roll the design can produce rather than a gift.
- **Why there is no starting skill.** The curve gives a level-1 character almost no skill power, so
  a free attack skill would be power the mobs are not priced against. The first skill is the first
  boss drop, which is also the first moment the skill axis becomes visible.
- **Why the first rule is a hunt task.** The task board already exists and pays stones only, so the
  opening instruction costs no new system and no power outside the loot funnel.

`;

const A = '# Not Yet Defined\n';
if (t.indexOf(A) < 0) { console.error('anchor'); process.exit(1); }
const i = t.indexOf(A);
const after = t.slice(i + A.length);
const minus = after.indexOf('- ~~**Zone count and level pacing**~~');
if (minus < 0) { console.error('first bullet not found'); process.exit(1); }

fs.writeFileSync(p, t.slice(0, i) + SECTION + A + after.slice(minus), 'utf8');
console.log('Minute One section added, section order fixed');
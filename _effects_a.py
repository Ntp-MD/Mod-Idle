import io, json, re

# ---------- 1. engine/skills.js: wider closed vocabulary, conditions, caps
p = 'engine/skills.js'
raw = io.open(p, encoding='utf-8', newline='').read()
crlf = '\r\n' in raw
t = raw.replace('\r\n', '\n') if crlf else raw

def rep(a, b):
    global t
    assert t.count(a) == 1, ('MISS', repr(a[:70]), t.count(a))
    t = t.replace(a, b)

rep("""  function aggregateEffects(rows) {
    const add = {}, mult = {};
    for (const s of rows || []) {
      for (const e of s.effects || []) {
        if (e.op === 'mult') mult[e.stat] = (mult[e.stat] || 1) * e.value;
        else add[e.stat] = (add[e.stat] || 0) + e.value;
      }
    }
    return { add, mult };
  }""",
"""  function aggregateEffects(rows) {
    const add = {}, mult = {}, conditional = [];
    for (const s of rows || []) {
      for (const e of s.effects || []) {
        // an Elemental line names the Element it feeds, so the key carries it
        const key = e.element ? `${e.stat}:${e.element}` : e.stat;
        if (e.condition) { conditional.push({ key, op: e.op, value: e.value, condition: e.condition }); continue; }
        if (e.op === 'mult') mult[key] = (mult[key] || 1) * e.value;
        else {
          add[key] = (add[key] || 0) + e.value;
          // a Cap stated by the same sentence rides along as `<stat>~cap`
          if (e.cap != null) add[`${key}~cap`] = Math.min(add[`${key}~cap`] ?? Infinity, e.cap);
        }
      }
    }
    return { add, mult, conditional };
  }""")

rep("""  const EFFECT_SUBJECTS = ['self', 'target'];""",
"""  const EFFECT_SUBJECTS = ['self', 'target'];
  /**
   * The lines that only take effect in a state the status store can actually write
   * (`mobStatus.ts`), so a conditional effect can never key on something nothing inflicts.
   */
  const EFFECT_CONDITIONS = ['chilled'];""")

rep("""    'damage_dealt', 'accuracy', 'crit_chance'];""",
"""    'damage_dealt', 'accuracy', 'crit_chance',
    // what the per-Element pool (D-090) and the status store (D-094) made expressible
    'leech', 'elemental_power', 'burn_stacks', 'poison_stacks', 'bleed_chance', 'poison_hold_sec',
    'execute_threshold_pct', 'execute_damage', 'damage_per_dodge_pct'];""")

rep("    aggregateEffects, EFFECT_STATS, EFFECT_OPS, EFFECT_SUBJECTS,",
    "    aggregateEffects, EFFECT_STATS, EFFECT_OPS, EFFECT_SUBJECTS, EFFECT_CONDITIONS,")
io.open(p, 'w', encoding='utf-8', newline='').write(t.replace('\n', '\r\n') if crlf else t)
print('engine/skills.js extended')

# ---------- 2. tools/lib/roster.js: the gate learns the new keys
p = 'tools/lib/roster.js'
raw = io.open(p, encoding='utf-8', newline='').read()
crlf = '\r\n' in raw
t = raw.replace('\r\n', '\n') if crlf else raw
a = """      if (!SM.EFFECT_SUBJECTS.includes(e.subject || 'self')) badStat.push(`${s.id}:subject ${e.subject}`);"""
b = """      if (!SM.EFFECT_SUBJECTS.includes(e.subject || 'self')) badStat.push(`${s.id}:subject ${e.subject}`);
      if (e.condition && !SM.EFFECT_CONDITIONS.includes(e.condition)) badStat.push(`${s.id}:condition ${e.condition}`);
      if (e.element && !EN.E.elements.order.includes(e.element)) badStat.push(`${s.id}:element ${e.element}`);"""
assert t.count(a) == 1
t = t.replace(a, b)
io.open(p, 'w', encoding='utf-8', newline='').write(t.replace('\n', '\r\n') if crlf else t)
print('roster gate learns condition and element')

# ---------- 3. skills.json: the rows whose sentence already states the number
path = 'tools/data/skills.json'
raw = io.open(path, encoding='utf-8', newline='').read()
crlf2 = '\r\n' in raw
doc = json.loads(raw)
byid = {s['id']: s for s in doc['skills']}

NEW = {
  'aura.herald_of_ash': [
    {'stat': 'elemental_power', 'op': 'add_flat', 'value': 50, 'element': 'fire', 'subject': 'self'},
    {'stat': 'elemental_alignment', 'op': 'add_flat', 'value': 6, 'subject': 'self'}],
  'aura.herald_of_frost': [
    {'stat': 'elemental_power', 'op': 'add_flat', 'value': 50, 'element': 'cold', 'subject': 'self'},
    {'stat': 'elemental_alignment', 'op': 'add_flat', 'value': 6, 'subject': 'self'}],
  'aura.herald_of_lightning': [
    {'stat': 'elemental_power', 'op': 'add_flat', 'value': 50, 'element': 'lightning', 'subject': 'self'},
    {'stat': 'elemental_alignment', 'op': 'add_flat', 'value': 6, 'subject': 'self'}],
  'buff.berserker': [
    {'stat': 'attack_speed', 'op': 'mult', 'value': 1.2, 'subject': 'self'},
    {'stat': 'leech', 'op': 'add_pct', 'value': 15, 'subject': 'self'},
    {'stat': 'damage_taken', 'op': 'mult', 'value': 1.15, 'subject': 'self'}],
  'attack.puncture': [{'stat': 'poison_stacks', 'op': 'add_flat', 'value': 3, 'subject': 'target'}],
  'attack.flame_lash': [{'stat': 'burn_stacks', 'op': 'add_flat', 'value': 3, 'subject': 'target'}],
  'attack.execute': [
    {'stat': 'execute_threshold_pct', 'op': 'add_flat', 'value': 20, 'subject': 'self'},
    {'stat': 'execute_damage', 'op': 'mult', 'value': 2, 'subject': 'self'}],
  'attack.riposte': [{'stat': 'damage_per_dodge_pct', 'op': 'add_pct', 'value': 3, 'cap': 120, 'subject': 'self'}],
  'curse.lacerate': [{'stat': 'bleed_chance', 'op': 'add_pct', 'value': 40, 'subject': 'target'}],
  'curse.venom_bind': [{'stat': 'poison_hold_sec', 'op': 'add_flat', 'value': 6, 'subject': 'target'}],
  'curse.shatter': [{'stat': 'damage_taken', 'op': 'add_pct', 'value': 12, 'subject': 'target', 'condition': 'chilled'}],
  'curse.mark_of_the_executioner': [{'stat': 'execute_threshold_pct', 'op': 'add_flat', 'value': 35, 'subject': 'target'}],
}
for sid, effects in NEW.items():
    for e in effects:
        assert str(e['value']) in byid[sid]['effect'], (sid, e, byid[sid]['effect'])
    byid[sid]['effects'] = effects

# keep the file's own formatting: rewrite only the 12 rows, one line each
lines = raw.replace('\r\n', '\n').split('\n')
hits = 0
for i, line in enumerate(lines):
    m = re.search(r'^(\s*)\{ "id": "([^"]+)".*', line)
    if not m or m.group(2) not in NEW:
        continue
    row = byid[m.group(2)]
    lines[i] = m.group(1) + json.dumps(row, ensure_ascii=False, separators=(', ', ': ')).replace('{ ', '{', 1)
    hits += 1
assert hits == len(NEW), hits
out = '\n'.join(lines)
assert json.loads(out)
io.open(path, 'w', encoding='utf-8', newline='').write(out.replace('\n', '\r\n') if crlf2 else out)
print('skills.json: %d rows now carry effects, formatting preserved' % hits)

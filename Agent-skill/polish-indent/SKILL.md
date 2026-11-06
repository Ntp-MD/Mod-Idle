---
name: polish-indent
description: "PolishIndent: condense prose, docs and UI copy without flattening the voice. Use when asked to shorten, tighten, trim or polish text."
---

# PolishIndent

Cut words, never character. Every line that goes must take away only repetition, not information or voice.

## Anchor first

Before editing, read one unedited sample of the same author or the same file's untouched half, and keep it open. Note what carries the identity:

- sentence length and rhythm — short declaratives, or long clauses with commas
- verb person and directness — "run this", "we decided", "you might try"
- punctuation habits — em dashes, no semicolons, no exclamation marks
- register — dry, blunt, playful, formal
- humour and deadpan asides
- the load-bearing vocabulary: a project's glossary terms are not synonyms

An edit that makes text *cleaner and blander* failed, however short it got.

## The pass

1. Delete the scaffolding: the preamble, the restatement of the request, the recap of what was just said, "Note that", "It is important to", "In order to", "Basically", "Actually", hedges that carry no doubt.
2. One idea per sentence. A sentence doing two jobs becomes one, or two — whichever is shorter.
3. Prefer the specific over the general: name the file, the command, the metric, not "the relevant configuration".
4. Conditional over blanket. "Run the tests before shipping" becomes "Run the tests when the change touches `engine/`."
5. Cut a rule the model already follows. If removing it changes no behaviour, keep it removed.
6. Move, never paraphrase: numbers, tables, formulas, identifiers, file paths, commands, quotes, term names.
7. Keep one deliberate oddity per paragraph untouched. That is usually where the voice lives.

## Where the length is

For a skill description: shortest form that makes the trigger unambiguous — what it does, then when to reach for it. No summary of the method, no list of every sub-case.

For `AGENTS.md` and rules files: route by task type ("for X, read Y") instead of loading everything on every turn. Project facts, boundaries, and hard-won rules stay; vague guidance goes.

For task prompts: state the goal, the constraint, and the evidence that says it is finished. Do not narrate the steps the executor would choose anyway.

## Done when

- the text is measurably shorter and says everything the original said
- reading the polished text against the anchor, the voice is indistinguishable
- no line was cut that the author would notice missing
- every remaining line earns its place: it states a fact, a trigger, or a limit

## Never

- no register shift — blunt stays blunt, formal stays formal
- no adding emoji, exclamation marks, or connective filler to smooth a cut
- no replacing a project term with a plainer near-synonym
- no shortening that drops a number, a caveat, or a condition
- if the text is already tight, say so and change nothing

/**
 * Generated-file guard.
 *
 * The doc tables are projections of the data — every one is produced by a
 * writer in `tools/lib/writers.ts`. A hand-edit between the generated markers is
 * silently overwritten on the next `--write`, and a stale doc passes
 * `build.ts --check` today because nothing regenerates it to compare.
 *
 * This guard closes that hole: it copies the repo into a temp dir, runs every
 * writer against the copy, and diffs the result against the committed files. Any
 * committed generated file the writer would change is stale by definition, so it
 * exits 1 and names the file. It never writes to the real working tree — the
 * temp copy is removed on the way out.
 *
 *   node tools/check-generated.ts
 */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { WRITERS } from './lib/writers.ts';
import { withNodeFlags } from './lib/node.ts';

const ROOT = path.resolve(import.meta.dirname, '..');

// What a writer can read: the tools, the shared engine, the design docs and the
// data. The private owner/ folder, git and the client's build output are kept
// out — a copy is a throwaway, not a second home for the design.
const COPY = ['tools', 'engine', 'doc', 'harness', 'package.json', 'tsconfig.json'];
const SKIP = new Set(['.wiki-backup', 'node_modules', '.git']);

function copyInto(src: string, dst: string): void {
  fs.mkdirSync(dst, { recursive: true });
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    if (SKIP.has(e.name)) continue;
    const from = path.join(src, e.name);
    const to = path.join(dst, e.name);
    if (e.isDirectory()) copyInto(from, to);
    else if (e.isFile()) fs.copyFileSync(from, to);
  }
}

function makeScratch(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'modworld-gen-'));
  for (const entry of COPY) {
    const from = path.join(ROOT, entry);
    if (!fs.existsSync(from)) continue;
    if (fs.statSync(from).isDirectory()) copyInto(from, path.join(dir, entry));
    else fs.copyFileSync(from, path.join(dir, entry));
  }
  // root-level markdown (AGENT.md and friends) so the writers' resolveDoc finds every doc.
  for (const e of fs.readdirSync(ROOT, { withFileTypes: true })) {
    if (e.isFile() && e.name.endsWith('.md')) fs.copyFileSync(path.join(ROOT, e.name), path.join(dir, e.name));
  }
  return dir;
}

function walk(dir: string, base = dir): string[] {
  const out: string[] = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(abs, base));
    else if (e.isFile()) out.push(path.relative(base, abs));
  }
  return out;
}

/** A single-hunk unified diff, trimmed to the changed region and capped. */
function unified(rel: string, a: string, b: string, maxLines = 40): string {
  const A = a.split(/\r\n|\n/);
  const B = b.split(/\r\n|\n/);
  let start = 0;
  while (start < A.length && start < B.length && A[start] === B[start]) start++;
  let endA = A.length;
  let endB = B.length;
  while (endA > start && endB > start && A[endA - 1] === B[endB - 1]) { endA--; endB--; }
  const ctx = 2;
  const fromA = Math.max(0, start - ctx);
  const toA = Math.min(A.length, endA + ctx);
  const fromB = Math.max(0, start - ctx);
  const toB = Math.min(B.length, endB + ctx);
  const out = [`--- a/${rel}`, `+++ b/${rel}`, `@@ -${fromA + 1},${toA - fromA} +${fromB + 1},${toB - fromB} @@`];
  for (let i = fromA; i < start; i++) out.push(` ${A[i]}`);
  for (let i = start; i < endA; i++) out.push(`-${A[i]}`);
  for (let i = start; i < endB; i++) out.push(`+${B[i]}`);
  for (let i = endA; i < toA; i++) out.push(` ${A[i]}`);
  if (out.length > maxLines) return out.slice(0, maxLines).join('\n') + `\n  … (${out.length - maxLines} more diff line(s))`;
  return out.join('\n');
}

function main(): number {
  const scratch = makeScratch();
  try {
    const env = { ...process.env, NODE_OPTIONS: withNodeFlags(process.env.NODE_OPTIONS) };
    // Serial on purpose: `check.ts --write` rewrites blocks in 19 docs including loot.md,
    // world.md, combat.md and skill-pool-system.md, so it overlaps loot/timeline/survival/
    // ladder and they cannot run against the same files concurrently.
    for (const [script, args] of WRITERS) {
      try {
        execFileSync('node', [path.join('tools', script), ...args], { cwd: scratch, env, encoding: 'utf8', stdio: 'pipe' });
      } catch (e) {
        process.stdout.write(((e as any).stdout || '') + ((e as any).stderr || ''));
        console.error(`\ncheck-generated: writer ${script} failed in the scratch copy — cannot compare`);
        return 1;
      }
    }

    const drifted: { rel: string; diff: string }[] = [];
    for (const raw of walk(scratch).sort()) {
      const rel = raw.split(path.sep).join('/');
      const produced = fs.readFileSync(path.join(scratch, raw));
      const committedPath = path.join(ROOT, raw);
      if (!fs.existsSync(committedPath)) {
        drifted.push({ rel, diff: `missing in the working tree — the writer creates it` });
      } else if (!produced.equals(fs.readFileSync(committedPath))) {
        drifted.push({ rel, diff: unified(rel, fs.readFileSync(committedPath, 'utf8'), produced.toString('utf8')) });
      }
    }

    if (!drifted.length) {
      console.log(`check-generated PASS — every committed generated file matches the writers (${WRITERS.length} run)`);
      return 0;
    }

    console.log(`check-generated FAIL — ${drifted.length} committed file(s) do not match the writers:\n`);
    for (const d of drifted) console.log(d.diff + '\n');
    console.log('a generated file was hand-edited, or its source doc/data drifted since it was written.');
    console.log('fix the source, then regenerate:  node tools/build.ts');
    return 1;
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
  }
}

process.exitCode = main();

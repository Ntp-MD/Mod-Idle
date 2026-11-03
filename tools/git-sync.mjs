#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { closeSync, existsSync, openSync, readFileSync, realpathSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
function git(args, { input, quiet = false, allowFailure = false } = {}) {
  const result = spawnSync('git', args, {
    cwd: root, encoding: 'utf8', input, maxBuffer: 32 * 1024 * 1024,
    stdio: quiet || input != null ? ['pipe', 'pipe', 'pipe'] : 'inherit',
  });
  if (result.error) throw result.error;
  if (result.status !== 0 && !allowFailure) {
    throw new Error(`git ${args[0]} failed (${result.status}). ${result.stderr?.trim() ?? ''}`);
  }
  return result;
}
const readGit = args => git(args, { quiet: true }).stdout.trim();
const paths = output => output.split('\0').filter(Boolean);
function untrackIgnored() {
  const ignored = git(['ls-files', '--cached', '--ignored', '--exclude-standard', '-z'], { quiet: true }).stdout;
  // --cached keeps disk files; force only removes their staged copies, never working files.
  if (ignored) git(['--literal-pathspecs', 'rm', '--cached', '--force', '--quiet', '--pathspec-from-file=-', '--pathspec-file-nul'], { input: ignored });
  return !!ignored;
}

function sync() {
  const rawArgs = process.argv.slice(2);
  const pullOnly = rawArgs.includes('--pull');
  const allowMissing = rawArgs.includes('--allow-missing');
  const baseMessage = rawArgs.filter(argument => argument !== '--pull' && argument !== '--allow-missing').join(' ') || `sync: checkpoint ${new Date().toISOString()}`;
  const top = readGit(['rev-parse', '--show-toplevel']);
  if (realpathSync(top).toLowerCase() !== realpathSync(root).toLowerCase())
    throw new Error('Run sync from this project repository, not a parent repository.');
  readGit(['rev-parse', '--verify', 'HEAD']);
  const branch = readGit(['symbolic-ref', '--quiet', '--short', 'HEAD']);
  const remote = readGit(['config', '--get', `branch.${branch}.remote`]);
  const mergeRef = readGit(['config', '--get', `branch.${branch}.merge`]);
  const upstream = readGit(['rev-parse', '--symbolic-full-name', '@{upstream}']);
  if (remote === '.' || !mergeRef.startsWith('refs/heads/'))
    throw new Error('The current branch needs a remote tracking branch before sync.');

  const common = readGit(['rev-parse', '--path-format=absolute', '--git-common-dir']);
  const lock = join(common, 'modworld-sync.lock');
  const staleAfterMs = 10 * 60 * 1000;
  function acquireLock() {
    try { return openSync(lock, 'wx'); }
    catch (error) {
      if (error.code !== 'EEXIST') throw error;
      let info = null;
      try { info = JSON.parse(readFileSync(lock, 'utf8')); } catch {}
      let alive = true;
      if (info && typeof info.pid === 'number') {
        try { process.kill(info.pid, 0); }
        catch (killError) { if (killError.code === 'ESRCH' || killError.code === 'EINVAL') alive = false; }
      }
      let old = false;
      try { old = Date.now() - statSync(lock).mtimeMs > staleAfterMs; } catch {}
      if (alive && !old) throw new Error(`Another sync owns ${lock}. Check its process before removing a stale lock.`);
      console.log(`Removing stale sync lock (pid ${info?.pid ?? 'unknown'}).`);
      unlinkSync(lock);
      return openSync(lock, 'wx');
    }
  }
  let descriptor;
  descriptor = acquireLock();
  try {
    writeFileSync(descriptor, JSON.stringify({ pid: process.pid, branch, startedAt: new Date().toISOString() }));
    for (const state of ['MERGE_HEAD', 'CHERRY_PICK_HEAD', 'REVERT_HEAD', 'rebase-merge', 'rebase-apply']) {
      if (existsSync(readGit(['rev-parse', '--path-format=absolute', '--git-path', state]))) {
        throw new Error(`Finish the existing ${state} operation before sync.`);
      }
    }
    if (readGit(['ls-files', '--unmerged'])) throw new Error('Resolve existing conflicts before sync.');

    // A missing tracked top-level directory is how the previous source loss appeared.
    // Push propagates deletions, so guard it; pull overwrites local anyway (backup kept), so skip.
    // The user deletes paths themselves at times: bypass with --allow-missing on that order.
    if (!pullOnly && !allowMissing) {
      const directories = paths(git(['ls-tree', '-d', '--name-only', '-z', 'HEAD'], { quiet: true }).stdout);
      for (const path of [...directories, 'game/src', 'tools/data', 'AGENTS.md', 'package.json', '.gitignore']) {
        const ignored = git(['check-ignore', '--no-index', '--quiet', '--', path], { quiet: true, allowFailure: true });
        if (ignored.status !== 0 && !existsSync(join(root, path)))
          throw new Error(`Required tracked path is missing: ${path}. Restore it, or rerun with --allow-missing if you deleted it yourself.`);
      }
    }

    const maxAttempts = 3;
    for (let attempt = 1; ; attempt += 1) {
      git(['fetch', '--tags', remote]);
      if (pullOnly) {
        git(['add', '--all', '--', '.']);
        untrackIgnored();
        const dirty = git(['diff', '--cached', '--quiet'], { quiet: true, allowFailure: true });
        if (dirty.status === 1) git(['commit', '-m', `${baseMessage} (local backup before pull-replace)`]);
        else if (dirty.status !== 0) throw new Error('Cannot inspect staged changes.');
        const backup = `refs/backup/modworld-sync/${Date.now()}-${process.pid}-${attempt}`;
        git(['update-ref', backup, 'HEAD']);
        console.log(`Local backup: ${backup}`);
        git(['reset', '--hard', upstream]);
        untrackIgnored();
        if (!readGit(['status', '--porcelain', '--untracked-files=normal'])) {
          console.log(`Pulled ${branch}: local replaced with ${upstream}.`);
          break;
        }
        if (attempt >= maxAttempts)
          throw new Error('New local edits arrived during pull-replace; run sync again.');
        console.log(`Sync attempt ${attempt}: new edits arrived during pull; retrying...`);
        continue;
      }
      git(['add', '--all', '--', '.']);
      untrackIgnored();
      git(['diff', '--cached', '--check']);
      const diff = git(['diff', '--cached', '--quiet'], { quiet: true, allowFailure: true });
      if (diff.status === 1) {
        git(['commit', '-m', attempt > 1 ? `${baseMessage} (retry ${attempt})` : baseMessage]);
      } else if (diff.status !== 0) throw new Error('Cannot inspect staged changes.');

      const checkpoint = `refs/backup/modworld-sync/${Date.now()}-${process.pid}-${attempt}`;
      git(['update-ref', checkpoint, 'HEAD']);
      console.log(`Local checkpoint: ${checkpoint}`);
      const remoteSha = readGit(['rev-parse', '--verify', upstream]);
      const remoteBackup = `refs/backup/modworld-sync/remote-${Date.now()}-${process.pid}-${attempt}`;
      git(['update-ref', remoteBackup, remoteSha]);
      console.log(`Remote backup: ${remoteBackup} (${remoteSha.slice(0, 7)})`);
      git(['push', '--force', remote, `HEAD:${mergeRef}`]);
      if (!readGit(['status', '--porcelain', '--untracked-files=normal'])) {
        console.log(`Synced ${branch}: local replaced ${mergeRef} with push --force.`);
        break;
      }
      if (attempt >= maxAttempts)
        throw new Error('New local edits arrived during sync. The checkpoint was pushed; run sync again to include those edits.');
      console.log(`Sync attempt ${attempt}: new edits arrived during push; retrying...`);
    }
  } finally {
    closeSync(descriptor);
    unlinkSync(lock);
  }
}

try { sync(); }
catch (error) { console.error(`Sync stopped: ${error.message}`); process.exitCode = 1; }

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, rmdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(new URL('./git-sync.mjs', import.meta.url));
function write(root, path, content) {
  mkdirSync(dirname(join(root, path)), { recursive: true });
  writeFileSync(join(root, path), content);
}
function git(root, ...args) {
  const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return result.stdout.trim();
}
function identity(root) {
  git(root, 'config', 'user.name', 'Sync Test');
  git(root, 'config', 'user.email', 'sync-test@example.invalid');
  git(root, 'config', 'core.autocrlf', 'false');
}
function fixture(t) {
  const base = mkdtempSync(join(tmpdir(), 'modworld-git-sync-'));
  t.after(() => {
    // Delete only the unique temporary directory created by this test.
    assert.equal(dirname(resolve(base)), realpathSync(tmpdir()));
    assert.ok(base.includes('modworld-git-sync-'));
    rmSync(base, { recursive: true, force: true });
  });
  const remote = join(base, 'remote.git');
  const local = join(base, 'local');
  const peer = join(base, 'peer');
  mkdirSync(local);
  git(base, 'init', '--bare', '--initial-branch=master', remote);
  git(local, 'init', '--initial-branch=master');
  identity(local);
  for (const [path, content] of Object.entries({
    'AGENTS.md': 'Working agreement\n', 'package.json': '{}\n',
    '.gitignore': 'node_modules/\n', 'engine/index.ts': 'export const value = 1;\n',
    'game/src/app.ts': 'export {};\n', 'tools/data/config.json': '{}\n',
    'docs/guide.md': 'Guide\n', 'docs/obsolete.md': 'Old\n', 'cache/tracked.txt': 'Cached\n',
  })) write(local, path, content);
  copyFileSync(script, join(local, 'tools/git-sync.mjs'));
  git(local, 'add', '--all'); git(local, 'commit', '-m', 'initial');
  git(local, 'remote', 'add', 'origin', remote);
  git(local, 'push', '-u', 'origin', 'master');
  git(base, '-c', 'core.autocrlf=false', 'clone', remote, peer); identity(peer);
  return { local, peer, remote };
}
function sync(local, extraArgs = []) {
  return spawnSync(process.execPath, [join(local, 'tools/git-sync.mjs'), ...extraArgs, 'test: checkpoint'], { cwd: local, encoding: 'utf8' });
}

test('push-replace commits local snapshot and overwrites remote', t => {
  const { local, peer, remote } = fixture(t);
  write(peer, 'remote-only.txt', 'Incoming\n');
  git(peer, 'add', '--all'); git(peer, 'commit', '-m', 'incoming'); git(peer, 'push');
  write(local, 'engine/index.ts', 'export const value = 2;\n');
  write(local, 'new local file.txt', 'Local\n');
  write(local, 'node_modules/ignored.txt', 'Do not publish\n');
  write(local, '.gitignore', 'node_modules/\ncache/\n');
  write(local, 'cache/tracked.txt', 'Keep on disk\n');
  rmSync(join(local, 'docs/obsolete.md'));
  const result = sync(local);
  assert.equal(result.status, 0, result.stderr + result.stdout);
  assert.equal(git(local, 'status', '--porcelain'), '');
  assert.equal(git(local, 'rev-parse', 'HEAD'), git(remote, 'rev-parse', 'master'));
  const files = git(remote, 'ls-tree', '-r', '--name-only', 'master').split('\n');
  assert.ok(files.includes('new local file.txt'));
  assert.ok(!files.includes('docs/obsolete.md'));
  assert.ok(!files.includes('remote-only.txt'));
  assert.ok(!files.some(path => path.startsWith('node_modules/') || path.startsWith('cache/')));
  assert.equal(readFileSync(join(local, 'cache/tracked.txt'), 'utf8'), 'Keep on disk\n');
  const backups = git(local, 'for-each-ref', '--format=%(refname)', 'refs/backup/modworld-sync/').split('\n');
  const remoteBackup = backups.find(ref => ref.includes('remote-'));
  assert.ok(remoteBackup, 'expected a remote backup ref');
  assert.ok(git(local, 'ls-tree', '-r', '--name-only', remoteBackup).split('\n').includes('remote-only.txt'));
  assert.ok(!existsSync(join(local, '.git/modworld-sync.lock')));
  const again = sync(local);
  assert.equal(again.status, 0, again.stderr + again.stdout);
  assert.equal(git(local, 'rev-parse', 'HEAD'), git(remote, 'rev-parse', 'master'));
});

test('push-replace overwrites a conflicting remote edit without a merge', t => {
  const { local, peer, remote } = fixture(t);
  write(peer, 'engine/index.ts', 'Remote edit\n');
  git(peer, 'add', '--all'); git(peer, 'commit', '-m', 'remote change'); git(peer, 'push');
  write(local, 'engine/index.ts', 'Local edit\n');
  const result = sync(local);
  assert.equal(result.status, 0, result.stderr + result.stdout);
  assert.ok(!existsSync(join(local, '.git/MERGE_HEAD')));
  assert.equal(readFileSync(join(local, 'engine/index.ts'), 'utf8'), 'Local edit\n');
  assert.equal(git(remote, 'show', 'master:engine/index.ts'), 'Local edit');
  assert.equal(git(local, 'rev-parse', 'HEAD'), git(remote, 'rev-parse', 'master'));
  assert.ok(!existsSync(join(local, '.git/modworld-sync.lock')));
});

test('pull-replace overwrites local with remote and keeps a local backup', t => {
  const { local, peer, remote } = fixture(t);
  write(peer, '.gitignore', 'node_modules/\n*.log\n');
  write(peer, 'from-remote.txt', 'Remote wins\n');
  git(peer, 'add', '--all'); git(peer, 'commit', '-m', 'remote wins'); git(peer, 'push');
  write(local, 'engine/index.ts', 'Local divergence\n');
  const result = sync(local, ['--pull']);
  assert.equal(result.status, 0, result.stderr + result.stdout);
  assert.equal(readFileSync(join(local, 'from-remote.txt'), 'utf8'), 'Remote wins\n');
  assert.equal(readFileSync(join(local, 'engine/index.ts'), 'utf8'), 'export const value = 1;\n');
  assert.equal(git(local, 'rev-parse', 'HEAD'), git(remote, 'rev-parse', 'master'));
  assert.equal(git(local, 'status', '--porcelain'), '');
  assert.ok(git(local, 'for-each-ref', '--format=%(refname)', 'refs/backup/modworld-sync/'));
  assert.ok(!existsSync(join(local, '.git/modworld-sync.lock')));
});

test('an active sync lock refuses another sync without taking over its lock', t => {
  const { local } = fixture(t);
  const before = git(local, 'rev-parse', 'HEAD');
  const active = JSON.stringify({ pid: process.pid }) + '\n';
  write(local, '.git/modworld-sync.lock', active);
  write(local, 'unsaved.txt', 'Preserve\n');
  const result = sync(local);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Another sync owns/);
  assert.equal(git(local, 'rev-parse', 'HEAD'), before);
  assert.equal(readFileSync(join(local, '.git/modworld-sync.lock'), 'utf8'), active);
  assert.equal(readFileSync(join(local, 'unsaved.txt'), 'utf8'), 'Preserve\n');
});

test('a stale sync lock from a dead process is removed and sync proceeds', t => {
  const { local, remote } = fixture(t);
  write(local, '.git/modworld-sync.lock', '{"pid":2147483647}\n');
  write(local, 'unsaved.txt', 'Preserve\n');
  const result = sync(local);
  assert.equal(result.status, 0, result.stderr + result.stdout);
  assert.match(result.stdout + result.stderr, /Removing stale sync lock/);
  assert.equal(git(local, 'rev-parse', 'HEAD'), git(remote, 'rev-parse', 'master'));
  assert.equal(git(local, 'status', '--porcelain'), '');
  assert.ok(!existsSync(join(local, '.git/modworld-sync.lock')));
});

test('missing source directories stop before a deletion checkpoint or push', t => {
  const { local, remote } = fixture(t);
  const before = git(local, 'rev-parse', 'HEAD');
  rmSync(join(local, 'engine/index.ts'));
  rmdirSync(join(local, 'engine'));
  const result = sync(local);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Required tracked path is missing: engine/);
  assert.match(result.stderr, /--allow-missing/);
  assert.equal(git(local, 'rev-parse', 'HEAD'), before);
  assert.equal(git(remote, 'rev-parse', 'master'), before);
  assert.ok(!existsSync(join(local, '.git/modworld-sync.lock')));
});

test('push with --allow-missing propagates a self-deleted directory', t => {
  const { local, remote } = fixture(t);
  rmSync(join(local, 'engine/index.ts'));
  rmdirSync(join(local, 'engine'));
  const result = sync(local, ['--allow-missing']);
  assert.equal(result.status, 0, result.stderr + result.stdout);
  assert.equal(git(local, 'rev-parse', 'HEAD'), git(remote, 'rev-parse', 'master'));
  assert.ok(!git(remote, 'ls-tree', '-d', '--name-only', 'master').split('\n').includes('engine'));
  assert.equal(git(local, 'status', '--porcelain'), '');
  assert.ok(!existsSync(join(local, '.git/modworld-sync.lock')));
});

test('pull-replace restores a locally missing directory from remote', t => {
  const { local, remote } = fixture(t);
  rmSync(join(local, 'engine/index.ts'));
  rmdirSync(join(local, 'engine'));
  const result = sync(local, ['--pull']);
  assert.equal(result.status, 0, result.stderr + result.stdout);
  assert.equal(readFileSync(join(local, 'engine/index.ts'), 'utf8'), 'export const value = 1;\n');
  assert.equal(git(local, 'rev-parse', 'HEAD'), git(remote, 'rev-parse', 'master'));
  assert.equal(git(local, 'status', '--porcelain'), '');
  assert.ok(!existsSync(join(local, '.git/modworld-sync.lock')));
});

test('a missing upstream stops without committing local changes or inventing a remote', t => {
  const { local, remote } = fixture(t);
  const before = git(local, 'rev-parse', 'HEAD');
  git(local, 'config', '--unset', 'branch.master.remote');
  write(local, 'unsaved.txt', 'Preserve\n');
  assert.notEqual(sync(local).status, 0);
  assert.equal(git(local, 'rev-parse', 'HEAD'), before);
  assert.equal(git(remote, 'rev-parse', 'master'), before);
  assert.equal(readFileSync(join(local, 'unsaved.txt'), 'utf8'), 'Preserve\n');
});

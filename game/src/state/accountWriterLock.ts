const ACCOUNT_WRITER_LOCK = 'modworld:account-writer';

export type AccountWriterLockResult =
  | { status: 'acquired'; release: () => void }
  | { status: 'busy' | 'unsupported' | 'cancelled' | 'unavailable' };

type LockOptionsFor = { wait?: boolean };

/** Hold one browser-wide lock while this tab may write any character slot or shared account data. */
export function requestAccountWriterLock(options: {
  wait?: boolean;
  signal?: AbortSignal;
  /**
   * How long a busy lock keeps waiting for the departing holder. A same-document remount flushes
   * before it releases, so its replacement must not mistake that flush window for a second tab.
   * A genuinely occupied tab still wins the wait and is reported busy.
   */
  retryMs?: number;
} = {}): Promise<AccountWriterLockResult> {
  if (typeof navigator === 'undefined' || !navigator.locks) return Promise.resolve({ status: 'unsupported' });
  if (options.signal?.aborted) return Promise.resolve({ status: 'cancelled' });
  return acquire({ wait: options.wait }).then((first) => {
    if (first.status !== 'busy' || !(options.retryMs && options.retryMs > 0)) return first;
    if (options.signal?.aborted) return { status: 'cancelled' as const };
    // Cancellation is owned here, not by a LockOptions.signal: not every browser accepts that
    // option, and a rejected request would read as an unsupported writer. A queued grant that
    // arrives after the caller stopped waiting is released immediately.
    const queued = acquire({ wait: true });
    let stoppedWon = false;
    const stopped = new Promise<AccountWriterLockResult>((resolve) => {
      const finish = () => {
        stoppedWon = true;
        resolve({ status: options.signal?.aborted ? 'cancelled' : 'busy' });
      };
      const timer = setTimeout(finish, options.retryMs);
      options.signal?.addEventListener('abort', () => { clearTimeout(timer); finish(); }, { once: true });
      void queued.then(() => clearTimeout(timer));
    });
    return Promise.race([queued, stopped]).then((result) => {
      // A grant that lands after the caller stopped waiting is released immediately.
      if (stoppedWon) {
        void queued.then((late) => { if (late.status === 'acquired') late.release(); });
      }
      return result;
    });
  });
}

function acquire(options: LockOptionsFor): Promise<AccountWriterLockResult> {
  return new Promise((resolve) => {
    let unlock!: () => void;
    const held = new Promise<void>((done) => { unlock = done; });
    const lockOptions: LockOptions = { mode: 'exclusive', ifAvailable: options.wait !== true };

    void navigator.locks.request(ACCOUNT_WRITER_LOCK, lockOptions, async (lock) => {
      if (!lock) {
        resolve({ status: 'busy' });
        return;
      }
      let released = false;
      resolve({
        status: 'acquired',
        release: () => {
          if (released) return;
          released = true;
          unlock();
        },
      });
      await held;
    }).catch(() => {
      resolve({ status: 'unavailable' });
    });
  });
}

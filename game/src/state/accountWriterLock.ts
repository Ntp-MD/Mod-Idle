const ACCOUNT_WRITER_LOCK = 'modworld:account-writer';

export type AccountWriterLockResult =
  | { status: 'acquired'; release: () => void }
  | { status: 'busy' | 'unsupported' | 'cancelled' | 'unavailable' };

/** Hold one browser-wide lock while this tab may write any character slot or shared account data. */
export function requestAccountWriterLock(options: {
  wait?: boolean;
  signal?: AbortSignal;
} = {}): Promise<AccountWriterLockResult> {
  if (typeof navigator === 'undefined' || !navigator.locks) return Promise.resolve({ status: 'unsupported' });

  return new Promise((resolve) => {
    let unlock!: () => void;
    const held = new Promise<void>((done) => { unlock = done; });
    const lockOptions: LockOptions = {
      mode: 'exclusive',
      ifAvailable: options.wait !== true,
      ...(options.signal ? { signal: options.signal } : {}),
    };

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
      resolve({ status: options.signal?.aborted ? 'cancelled' : 'unavailable' });
    });
  });
}

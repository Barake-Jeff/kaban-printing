/** Thrown by ConcurrencyLimiter.run when the wait queue is already full. */
export class LimiterFullError extends Error {
  constructor() {
    super('Concurrency limiter queue is full');
  }
}

/** The caller went away (e.g. the HTTP client disconnected) before the work finished. */
export class OperationAbortedError extends Error {
  constructor() {
    super('Operation aborted');
  }
}

/**
 * Caps how many async tasks run at once (e.g. LibreOffice conversions, each a whole
 * process) and how many may wait for a slot; anything beyond that is rejected
 * immediately rather than piling up. In-process only, so it limits a single backend
 * instance — enough for one container, revisit if the API is scaled out.
 */
export class ConcurrencyLimiter {
  private active = 0;
  private readonly waiting: Array<() => void> = [];

  constructor(
    private readonly maxConcurrent: number,
    private readonly maxQueued: number,
  ) {}

  /**
   * `signal` lets the caller abandon its place: an already-aborted signal is rejected
   * without taking a slot, and a task still waiting when the signal fires is removed from
   * the queue so it never runs. Once a task is running it is the task's job to watch the
   * signal and stop; the slot is released when it settles either way.
   */
  async run<T>(task: () => Promise<T>, signal?: AbortSignal): Promise<T> {
    if (signal?.aborted) throw new OperationAbortedError();

    if (this.active < this.maxConcurrent) {
      this.active++;
    } else if (this.waiting.length < this.maxQueued) {
      await new Promise<void>((resolve, reject) => {
        // release() hands its slot straight to us, so `active` is already counted.
        const onSlot = () => {
          signal?.removeEventListener('abort', onAbort);
          resolve();
        };
        // Whichever of onSlot/onAbort runs first wins: onAbort only rejects if the waiter
        // is still in the queue, and release() only calls waiters that are.
        const onAbort = () => {
          const i = this.waiting.indexOf(onSlot);
          if (i >= 0) {
            this.waiting.splice(i, 1);
            reject(new OperationAbortedError());
          }
        };
        signal?.addEventListener('abort', onAbort, { once: true });
        this.waiting.push(onSlot);
      });
    } else {
      throw new LimiterFullError();
    }

    try {
      return await task();
    } finally {
      const next = this.waiting.shift();
      if (next) next();
      else this.active--;
    }
  }
}

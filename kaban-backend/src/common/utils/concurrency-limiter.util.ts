/** Thrown by ConcurrencyLimiter.run when the wait queue is already full. */
export class LimiterFullError extends Error {
  constructor() {
    super('Concurrency limiter queue is full');
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

  async run<T>(task: () => Promise<T>): Promise<T> {
    if (this.active < this.maxConcurrent) {
      this.active++;
    } else if (this.waiting.length < this.maxQueued) {
      // release() hands its slot straight to us, so `active` is already counted.
      await new Promise<void>(resolve => this.waiting.push(resolve));
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

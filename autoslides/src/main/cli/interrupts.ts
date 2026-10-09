// Ctrl-C for command line runs.
//
// Electron answers SIGINT/SIGTERM itself by quitting the app, which would end a
// command mid-write with exit code 0. `main.ts` routes both the signals and
// that quit attempt (`before-quit`) here instead, so a command can stop its
// work and report the interruption.
export interface CliInterrupts {
  onInterrupt: (handler: () => void) => () => void;
  /** Returns false when nothing was listening — the caller should just exit. */
  fire: () => boolean;
}

export function createCliInterrupts(): CliInterrupts {
  const handlers = new Set<() => void>();
  return {
    onInterrupt(handler) {
      handlers.add(handler);
      return () => handlers.delete(handler);
    },
    fire() {
      if (handlers.size === 0) return false;
      for (const handler of [...handlers]) handler();
      return true;
    },
  };
}

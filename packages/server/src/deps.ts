import { randomBytes, randomInt } from 'node:crypto';
import type { ServerMessage, TimerPreset } from '@shadow-court/protocol';

/** One connected client. The transport adapter (Socket.IO, tests) implements this. */
export interface Connection {
  readonly id: string;
  send(message: ServerMessage): void;
}

export type TimerHandle = unknown;

/** Time source. Injected so tests can run a 2-hour room expiry in microseconds. */
export interface Scheduler {
  now(): number;
  setTimeout(fn: () => void, ms: number): TimerHandle;
  clearTimeout(handle: TimerHandle): void;
}

export const realScheduler: Scheduler = {
  now: () => Date.now(),
  setTimeout: (fn, ms) => {
    const handle = setTimeout(fn, ms);
    // A pending game timer must never keep the process alive on shutdown.
    handle.unref();
    return handle;
  },
  clearTimeout: (handle) => clearTimeout(handle as NodeJS.Timeout),
};

/** Randomness source. Production uses the OS CSPRNG; tests inject a seeded one. */
export interface Random {
  /** Integer in [0, maxExclusive). */
  int(maxExclusive: number): number;
  /** `bytes` random bytes as a hex string. */
  hex(bytes: number): string;
}

export const cryptoRandom: Random = {
  int: (max) => randomInt(max),
  hex: (bytes) => randomBytes(bytes).toString('hex'),
};

export interface ServerConfig {
  maxPlayers: number;
  maxSpectators: number;
  /** Base timers in milliseconds, before the preset multiplier. */
  turnMs: number;
  reactionMs: number;
  cardMs: number;
  /** Window length when everyone being waited for is Away. */
  awayMs: number;
  /** Consecutive missed timers before a player is marked Away. */
  awayStrikes: number;
  /** A room with nobody connected is deleted after this long. */
  roomExpiryMs: number;
  /** Create/join/rejoin attempts allowed per connection in `attemptWindowMs`. */
  maxAttempts: number;
  attemptWindowMs: number;
  emoteCooldownMs: number;
}

export const DEFAULT_CONFIG: ServerConfig = {
  maxPlayers: 6,
  maxSpectators: 10,
  turnMs: 60_000,
  reactionMs: 20_000,
  cardMs: 30_000,
  awayMs: 5_000,
  awayStrikes: 3,
  roomExpiryMs: 2 * 60 * 60 * 1000,
  maxAttempts: 10,
  attemptWindowMs: 60_000,
  emoteCooldownMs: 1_000,
};

export const TIMER_MULTIPLIER: Record<Exclude<TimerPreset, 'none'>, number> = {
  relaxed: 2,
  standard: 1,
  fast: 0.5,
};

export interface ServerDeps {
  scheduler: Scheduler;
  random: Random;
  config: ServerConfig;
}

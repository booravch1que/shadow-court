import type { GameEvent, PlayerId } from '@shadow-court/engine';
import { createStore, type Store } from '../store';
import { buildSteps, type Adjust, type Anchor, type Flight, type LagKind, type Step } from './steps';

export interface SpriteState {
  id: number;
  flight: Flight;
  /** Viewport coordinates of the centre of the start and end anchors. */
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface FxState {
  sprites: SpriteState[];
  lag: Record<LagKind, Record<PlayerId, number>>;
}

/** Past this many waiting steps the table is too far behind: skip ahead instead of replaying it all. */
const MAX_BACKLOG = 12;

const emptyLag = (): FxState['lag'] => ({ coins: {}, cards: {}, discard: {} });

/** The attribute value an anchor is found by. */
export function anchorKey(anchor: Anchor): string {
  return 'playerId' in anchor ? `${anchor.kind}:${anchor.playerId}` : anchor.kind;
}

/**
 * Plays the animation script one step at a time. Events wait until the snapshot that
 * goes with them has arrived (`commit`), so numbers never jump ahead of the effects.
 */
export class FxDirector {
  readonly store: Store<FxState> = createStore<FxState>({ sprites: [], lag: emptyLag() });
  private pending: GameEvent[] = [];
  private queue: Step[] = [];
  private running = false;
  /** Bumped by `flush` so a step that is already playing stops touching the state. */
  private generation = 0;
  private counter = 0;

  /** New events from the server. They play once the matching view is in. */
  enqueue(events: readonly GameEvent[]): void {
    if (events.some((e) => e.type === 'gameStarted')) this.flush();
    this.pending.push(...events);
  }

  /** A fresh view has been stored: queue whatever arrived before it. */
  commit(): void {
    if (this.pending.length === 0) return;
    const events = this.pending;
    this.pending = [];
    if (!this.enabled()) return;

    const steps = buildSteps(events);
    if (this.queue.length + steps.length > MAX_BACKLOG) {
      this.flush();
      return;
    }
    for (const s of steps) for (const f of s.flights) this.apply(f.onQueue);
    this.queue.push(...steps);
    if (!this.running) void this.run();
  }

  /** Drops everything in flight and shows the table as it really is. */
  flush(): void {
    this.generation += 1;
    this.queue = [];
    this.pending = [];
    this.running = false;
    this.store.set({ sprites: [], lag: emptyLag() });
  }

  private enabled(): boolean {
    if (typeof document === 'undefined' || document.hidden) return false;
    return !globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  }

  private async run(): Promise<void> {
    const generation = this.generation;
    this.running = true;
    while (this.generation === generation) {
      const next = this.queue.shift();
      if (!next) break;
      this.play(next, generation);
      await wait(next.hold);
    }
    if (this.generation === generation) this.running = false;
  }

  private play(step: Step, generation: number): void {
    for (const flight of step.flights) {
      setTimeout(() => {
        if (this.generation !== generation) return;
        this.apply(flight.onStart);
        const from = locate(flight.from);
        const to = locate(flight.to);
        if (!from || !to) {
          // Off screen (or not rendered on this layout): just settle the numbers.
          this.apply(flight.onLand);
          return;
        }
        const id = ++this.counter;
        this.store.set((s) => ({ sprites: [...s.sprites, { id, flight, x0: from.x, y0: from.y, x1: to.x, y1: to.y }] }));
        setTimeout(() => {
          if (this.generation !== generation) return;
          this.apply(flight.onLand);
          this.store.set((s) => ({ sprites: s.sprites.filter((x) => x.id !== id) }));
        }, flight.duration);
      }, flight.delay);
    }
  }

  private apply(adjusts: Adjust[]): void {
    if (adjusts.length === 0) return;
    this.store.set((s) => {
      const lag = { coins: { ...s.lag.coins }, cards: { ...s.lag.cards }, discard: { ...s.lag.discard } };
      for (const a of adjusts) lag[a.what][a.playerId] = (lag[a.what][a.playerId] ?? 0) + a.by;
      return { lag };
    });
  }
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Centre of the anchor on screen. When several elements carry it (a player's own
 * coins are both on their seat and in their hand) the last visible one wins.
 */
function locate(anchor: Anchor): { x: number; y: number } | null {
  if (typeof document === 'undefined') return null;
  const nodes = document.querySelectorAll(`[data-fx="${anchorKey(anchor)}"]`);
  for (let i = nodes.length - 1; i >= 0; i--) {
    const rect = (nodes[i] as Element).getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  }
  return null;
}

export const fx = new FxDirector();

import { COUP_COST, MAX_COINS } from './constants';
import type {
  BlockChallengeWindowPhase,
  BlockWindowPhase,
  ChallengeWindowPhase,
  GameState,
  PlayerId,
  PlayerState,
} from './types';

/** A player is alive while they still hold at least one hidden card. */
export function isAlive(player: PlayerState): boolean {
  return player.hand.length > 0;
}

export function findPlayer(state: GameState, id: PlayerId): PlayerState | undefined {
  return state.players.find((p) => p.id === id);
}

export function getPlayer(state: GameState, id: PlayerId): PlayerState {
  const player = findPlayer(state, id);
  if (!player) throw new Error(`Unknown player ${id}`);
  return player;
}

export function livingPlayers(state: GameState): PlayerState[] {
  return state.players.filter(isAlive);
}

/** Ids of living players, in seating order, excluding `excludeId`. */
export function livingIdsExcept(state: GameState, excludeId: PlayerId): PlayerId[] {
  return state.players.filter((p) => isAlive(p) && p.id !== excludeId).map((p) => p.id);
}

/** The player whose claim a reaction window is about: the blocker, or else the actor. */
export function claimantOf(phase: ChallengeWindowPhase | BlockWindowPhase | BlockChallengeWindowPhase): PlayerId {
  return phase.type === 'blockChallengeWindow' ? phase.block.blockerId : phase.pending.actorId;
}

/**
 * Who may answer an open reaction window right now. Simultaneously that is
 * everyone eligible who has not passed; sequentially it is only the first of
 * them going clockwise from the claimant. `players` is in seating order.
 */
export function respondersNow(
  players: readonly { id: PlayerId }[],
  phase: ChallengeWindowPhase | BlockWindowPhase | BlockChallengeWindowPhase,
  sequential: boolean,
): PlayerId[] {
  const waiting = phase.eligible.filter((id) => !phase.passed.includes(id));
  if (!sequential) return waiting;
  const from = players.findIndex((p) => p.id === claimantOf(phase));
  for (let step = 1; step <= players.length; step++) {
    const id = (players[(from + step) % players.length] as { id: PlayerId }).id;
    if (waiting.includes(id)) return [id];
  }
  return [];
}

/** How many more coins this player can receive before hitting the cap. */
export function coinRoom(player: PlayerState): number {
  return MAX_COINS - player.coins;
}

/**
 * Coup is mandatory when EVERY living player holds at least 7 coins.
 * Evaluated from the current state, so it adapts as players are eliminated.
 */
export function isMandatoryCoup(state: GameState): boolean {
  const living = livingPlayers(state);
  return living.length >= 2 && living.every((p) => p.coins >= COUP_COST);
}

export function phaseWindowId(state: GameState): number | null {
  return state.phase.type === 'gameOver' ? null : state.phase.windowId;
}

/** Plain-data deep clone. State only ever holds JSON-compatible values. */
export function deepClone<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => deepClone(item)) as unknown as T;
  }
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      out[key] = deepClone(item);
    }
    return out as T;
  }
  return value;
}

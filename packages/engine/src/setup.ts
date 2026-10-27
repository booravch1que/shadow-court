import {
  MAX_PLAYERS,
  MIN_PLAYERS,
  ROLES,
  STARTING_COINS,
  STARTING_INFLUENCE,
  copiesPerRole,
} from './constants';
import { shuffle, type RngBox } from './rng';
import type { GameEvent, GameState, PlayerId, PlayerState, Role } from './types';

export interface CreateGameOptions {
  playerIds: PlayerId[];
  /** Seed for the game's PRNG. The server must pick it from a secure source. */
  seed: number;
  /**
   * Shuffle the seating order (the first seat then plays first). Defaults to true.
   * When false, `playerIds` is the seating order.
   */
  randomizeSeating?: boolean;
  /** Who plays first. Defaults to the first seat. */
  firstPlayerId?: PlayerId;
  /** Ask reaction windows one player at a time, clockwise. Defaults to false. */
  sequentialReactions?: boolean;
}

export function createGame(options: CreateGameOptions): { state: GameState; events: GameEvent[] } {
  const { playerIds } = options;
  if (playerIds.length < MIN_PLAYERS || playerIds.length > MAX_PLAYERS) {
    throw new RangeError(`A game needs ${MIN_PLAYERS}-${MAX_PLAYERS} players, got ${playerIds.length}.`);
  }
  if (new Set(playerIds).size !== playerIds.length || playerIds.some((id) => id === '')) {
    throw new Error('Player ids must be unique, non-empty strings.');
  }

  const box: RngBox = { rng: options.seed >>> 0 };

  const seating = [...playerIds];
  if (options.randomizeSeating ?? true) shuffle(box, seating);

  const firstPlayerId = options.firstPlayerId ?? (seating[0] as PlayerId);
  if (!seating.includes(firstPlayerId)) {
    throw new Error(`firstPlayerId ${firstPlayerId} is not seated in this game.`);
  }

  const deck: Role[] = [];
  const copies = copiesPerRole(seating.length);
  for (const role of ROLES) {
    for (let i = 0; i < copies; i++) deck.push(role);
  }
  shuffle(box, deck);

  const players: PlayerState[] = seating.map((id) => ({
    id,
    coins: STARTING_COINS,
    hand: [],
    revealed: [],
    consecutiveSkips: 0,
  }));
  for (let round = 0; round < STARTING_INFLUENCE; round++) {
    for (const player of players) {
      const card = deck.shift();
      if (card === undefined) throw new Error('Deck ran out while dealing.');
      player.hand.push(card);
    }
  }

  const state: GameState = {
    players,
    deck,
    activePlayerId: firstPlayerId,
    turn: 1,
    phase: { type: 'awaitingAction', windowId: 1 },
    windowCounter: 1,
    rng: box.rng,
    sequentialReactions: options.sequentialReactions ?? false,
  };

  const events: GameEvent[] = [
    { type: 'gameStarted', playerIds: seating, firstPlayerId },
    { type: 'turnStarted', playerId: firstPlayerId, turn: 1 },
  ];
  return { state, events };
}

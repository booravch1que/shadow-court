import { getLegalMoves, type LegalMoves } from './legal';
import { findPlayer, isMandatoryCoup } from './rules';
import type {
  AwaitingActionPhase,
  BlockChallengeWindowPhase,
  BlockWindowPhase,
  ChallengeWindowPhase,
  GameState,
  InfluenceLossPhase,
  PlayerId,
  Role,
} from './types';

/** Public information about one player. Never includes hidden cards. */
export interface PublicPlayer {
  id: PlayerId;
  coins: number;
  /** How many hidden cards the player still holds. */
  cardCount: number;
  /** Lost cards, face-up. */
  revealed: Role[];
  alive: boolean;
  consecutiveSkips: number;
}

/** The exchange phase as everyone else sees it: no cards, only who is choosing. */
export interface PublicExchangePhase {
  type: 'exchange';
  windowId: number;
  playerId: PlayerId;
}

export type PublicPhase =
  | AwaitingActionPhase
  | ChallengeWindowPhase
  | BlockWindowPhase
  | BlockChallengeWindowPhase
  | InfluenceLossPhase
  | PublicExchangePhase
  | { type: 'gameOver'; winnerId: PlayerId };

/** What one connected client is allowed to know. */
export interface GameView {
  /** The viewer's player id, or `null` for spectators. */
  viewerId: PlayerId | null;
  turn: number;
  activePlayerId: PlayerId;
  players: PublicPlayer[];
  /** Size of the draw pile. Its contents are never sent. */
  deckCount: number;
  /**
   * The draw pile from top to bottom as this viewer may know it: a role for each card shown to
   * the table or put back by the viewer themselves, `null` for every other card.
   */
  deckMemory: (Role | null)[];
  phase: PublicPhase;
  /** True while the active player is obliged to Coup. */
  mandatoryCoup: boolean;
  /** Reaction windows ask one player at a time, clockwise from the claimant. */
  sequentialReactions: boolean;
  /** Private data; `null` for spectators. */
  me: { hand: Role[]; moves: LegalMoves } | null;
}

/**
 * Builds the view a given viewer may see. This is the only way game state
 * should ever leave the server: hidden cards, the deck, the exchange options
 * of other players and the PRNG state are not part of the result.
 */
export function projectView(state: GameState, viewerId: PlayerId | null): GameView {
  const viewer = viewerId === null ? undefined : findPlayer(state, viewerId);

  const phase: PublicPhase =
    state.phase.type === 'exchange'
      ? { type: 'exchange', windowId: state.phase.windowId, playerId: state.phase.playerId }
      : state.phase;

  return {
    viewerId: viewer ? viewer.id : null,
    turn: state.turn,
    activePlayerId: state.activePlayerId,
    players: state.players.map((p) => ({
      id: p.id,
      coins: p.coins,
      cardCount: p.hand.length,
      revealed: [...p.revealed],
      alive: p.hand.length > 0,
      consecutiveSkips: p.consecutiveSkips,
    })),
    deckCount: state.deck.length,
    deckMemory: state.deck.map((role, i) => {
      const seen = state.deckSeen?.[i] ?? null;
      return seen === 'public' || (seen !== null && seen === viewer?.id) ? role : null;
    }),
    phase: structuredCopy(phase),
    mandatoryCoup: state.phase.type === 'awaitingAction' && isMandatoryCoup(state),
    sequentialReactions: state.sequentialReactions ?? false,
    me: viewer ? { hand: [...viewer.hand], moves: getLegalMoves(state, viewer.id) } : null,
  };
}

/** Phases hold only plain data, so a JSON round trip is a safe, dependency-free copy. */
function structuredCopy<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

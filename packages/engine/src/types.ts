/**
 * Core data model of the game engine.
 *
 * Everything in `GameState` is plain JSON-compatible data (no classes, no Dates,
 * no functions) so a state can be cloned, serialized, snapshotted and replayed.
 */

export type Role = 'governor' | 'assassin' | 'thief' | 'shaman' | 'duchess';

export type PlayerId = string;

export type ActionType =
  | 'income'
  | 'foreignAid'
  | 'coup'
  | 'tax'
  | 'steal'
  | 'assassinate'
  | 'exchange'
  | 'skip';

export interface PlayerState {
  id: PlayerId;
  coins: number;
  /** Hidden influence cards. An empty hand means the player is eliminated. */
  hand: Role[];
  /** Lost influence cards, face-up and public to everyone. */
  revealed: Role[];
  /** Turns skipped in a row. Any real action resets it. */
  consecutiveSkips: number;
}

/** An action that has been declared and is still being resolved. */
export interface PendingAction {
  actorId: PlayerId;
  action: ActionType;
  targetId: PlayerId | null;
  /** Coins the actor paid when declaring (Coup 7, Assassinate 3). */
  cost: number;
}

export interface PendingBlock {
  blockerId: PlayerId;
  /** The role the blocker claims to hold. */
  role: Role;
}

/** Why a player is losing an influence card. Used for UI wording and the log. */
export type LossReason =
  | 'challengeLost'
  | 'bluffCaught'
  | 'assassinated'
  | 'couped'
  | 'forfeit';

/**
 * What the game does once a pending influence loss has been resolved.
 * Modelled as data (not callbacks) so the state stays serializable.
 */
export type Continuation =
  | { kind: 'endTurn' }
  /** The action survived a challenge: open the block window, or resolve it. */
  | { kind: 'afterChallengePassed'; pending: PendingAction }
  /** Resolve the action immediately (a bluffed block was caught). */
  | { kind: 'resolve'; pending: PendingAction };

interface ResponseWindow {
  windowId: number;
  /** Players who may respond in this window. */
  eligible: PlayerId[];
  /** Players who already passed. A pass is final. */
  passed: PlayerId[];
}

export interface AwaitingActionPhase {
  type: 'awaitingAction';
  windowId: number;
}

export interface ChallengeWindowPhase extends ResponseWindow {
  type: 'challengeWindow';
  pending: PendingAction;
}

export interface BlockWindowPhase extends ResponseWindow {
  type: 'blockWindow';
  pending: PendingAction;
}

export interface BlockChallengeWindowPhase extends ResponseWindow {
  type: 'blockChallengeWindow';
  pending: PendingAction;
  block: PendingBlock;
}

export interface InfluenceLossPhase {
  type: 'influenceLoss';
  windowId: number;
  playerId: PlayerId;
  reason: LossReason;
  next: Continuation;
}

export interface ExchangePhase {
  type: 'exchange';
  windowId: number;
  playerId: PlayerId;
  /** The player's hand followed by the drawn cards. PRIVATE to that player. */
  options: Role[];
  /** How many cards the player must keep (their hand size before drawing). */
  keep: number;
}

export interface GameOverPhase {
  type: 'gameOver';
  winnerId: PlayerId;
}

export type Phase =
  | AwaitingActionPhase
  | ChallengeWindowPhase
  | BlockWindowPhase
  | BlockChallengeWindowPhase
  | InfluenceLossPhase
  | ExchangePhase
  | GameOverPhase;

export interface GameState {
  /** Seating order, clockwise. */
  players: PlayerState[];
  /** Hidden draw pile. Index 0 is the top. PRIVATE. */
  deck: Role[];
  activePlayerId: PlayerId;
  /** Starts at 1 and increases with every turn. */
  turn: number;
  phase: Phase;
  /** Last issued window id. Window ids only ever increase. */
  windowCounter: number;
  /** Internal PRNG state. PRIVATE. */
  rng: number;
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

/**
 * Every player command carries the `windowId` of the phase it answers. A command
 * for a window that has already closed is rejected, which is how simultaneous or
 * duplicated requests are resolved ("first valid response wins").
 */
export type PlayerCommand =
  | {
      type: 'declare';
      playerId: PlayerId;
      windowId: number;
      action: ActionType;
      targetId?: PlayerId;
    }
  | { type: 'challenge'; playerId: PlayerId; windowId: number }
  | { type: 'block'; playerId: PlayerId; windowId: number; role: Role }
  | { type: 'pass'; playerId: PlayerId; windowId: number }
  | { type: 'chooseInfluence'; playerId: PlayerId; windowId: number; role: Role }
  | { type: 'chooseExchange'; playerId: PlayerId; windowId: number; keep: Role[] };

/** Commands issued by the server rather than by a player. */
export type SystemCommand =
  /** A timer ran out for the given window. */
  | { type: 'timeout'; windowId: number }
  /** A player left for good (removed by the host). Their cards are revealed. */
  | { type: 'forfeit'; playerId: PlayerId };

export type Command = PlayerCommand | SystemCommand;

// ---------------------------------------------------------------------------
// Events (always public, language-neutral)
// ---------------------------------------------------------------------------

export type CoinCause =
  | 'income'
  | 'foreignAid'
  | 'tax'
  | 'steal'
  | 'coup'
  | 'assassination'
  | 'refund'
  | 'eliminated';

export type CancelReason = 'challenged' | 'blocked' | 'targetEliminated' | 'actorEliminated';

export type ChallengeContext = 'action' | 'block';

export type GameEvent =
  | { type: 'gameStarted'; playerIds: PlayerId[]; firstPlayerId: PlayerId }
  | { type: 'turnStarted'; playerId: PlayerId; turn: number }
  | { type: 'turnSkipped'; playerId: PlayerId }
  | {
      type: 'actionDeclared';
      actorId: PlayerId;
      action: ActionType;
      targetId: PlayerId | null;
      claim: Role | null;
      cost: number;
    }
  | { type: 'coinsChanged'; playerId: PlayerId; delta: number; cause: CoinCause }
  | { type: 'passed'; playerId: PlayerId; auto: boolean }
  | {
      type: 'blockDeclared';
      blockerId: PlayerId;
      role: Role;
      actorId: PlayerId;
      action: ActionType;
      targetId: PlayerId | null;
    }
  | {
      type: 'challenged';
      challengerId: PlayerId;
      accusedId: PlayerId;
      role: Role;
      context: ChallengeContext;
    }
  | {
      type: 'challengeResolved';
      challengerId: PlayerId;
      accusedId: PlayerId;
      role: Role;
      context: ChallengeContext;
      /** True when the accused was bluffing. */
      bluffCaught: boolean;
    }
  /** The accused showed the claimed card as proof. */
  | { type: 'cardRevealed'; playerId: PlayerId; role: Role }
  /** The shown card went back into the deck and was replaced by a random one. */
  | { type: 'cardReplaced'; playerId: PlayerId }
  | { type: 'actionCancelled'; actorId: PlayerId; action: ActionType; reason: CancelReason }
  | {
      type: 'actionResolved';
      actorId: PlayerId;
      action: ActionType;
      targetId: PlayerId | null;
      /** Coins actually gained by the actor (after the coin cap). */
      amount: number;
    }
  | { type: 'influenceLost'; playerId: PlayerId; role: Role; reason: LossReason }
  | { type: 'playerEliminated'; playerId: PlayerId }
  | { type: 'exchangeStarted'; playerId: PlayerId }
  | { type: 'exchangeCompleted'; playerId: PlayerId }
  | { type: 'timedOut'; playerId: PlayerId; during: 'turn' | 'influence' | 'exchange' }
  | { type: 'playerForfeited'; playerId: PlayerId }
  | { type: 'gameOver'; winnerId: PlayerId };

// ---------------------------------------------------------------------------
// Results
// ---------------------------------------------------------------------------

export type EngineErrorCode =
  | 'game_over'
  | 'unknown_player'
  | 'player_eliminated'
  | 'stale_window'
  | 'wrong_phase'
  | 'not_your_turn'
  | 'illegal_action'
  | 'invalid_target'
  | 'not_eligible'
  | 'already_responded'
  | 'invalid_block'
  | 'invalid_choice';

export interface EngineError {
  code: EngineErrorCode;
  message: string;
}

export type ReduceResult =
  | { ok: true; state: GameState; events: GameEvent[] }
  | { ok: false; error: EngineError };

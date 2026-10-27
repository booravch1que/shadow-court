import { ACTION_RULES, type ActionType, type GameView, type LossReason, type PlayerId, type Role } from '@shadow-court/engine';

/**
 * What the screen should be about right now, from this viewer's point of view.
 * The six situations the brief asks to keep visually distinct are separate modes.
 */
export type Mode =
  | 'myTurn'
  | 'waitingTurn'
  | 'canChallenge'
  | 'canBlock'
  | 'waitingReaction'
  | 'chooseLoss'
  | 'waitingLoss'
  | 'chooseExchange'
  | 'waitingExchange'
  | 'gameOver';

/** The action (or block) everybody is currently reacting to. */
export interface Claim {
  stage: 'action' | 'block';
  actorId: PlayerId;
  action: ActionType;
  targetId: PlayerId | null;
  /** Role the actor claims for the action itself, if any. */
  role: Role | null;
  block: { blockerId: PlayerId; role: Role } | null;
}

export interface UiStatus {
  mode: Mode;
  /** Whose input is awaited in turn / card-choice phases. */
  subjectId: PlayerId | null;
  reason: LossReason | null;
  claim: Claim | null;
  /** Players who still have to answer an open reaction window. */
  waitingOn: PlayerId[];
  passed: PlayerId[];
}

export type Relation = 'player' | 'eliminated' | 'spectator';

export function relationOf(view: GameView): Relation {
  if (!view.viewerId) return 'spectator';
  return view.players.find((p) => p.id === view.viewerId)?.alive ? 'player' : 'eliminated';
}

export function deriveStatus(view: GameView): UiStatus {
  const base: UiStatus = { mode: 'waitingTurn', subjectId: null, reason: null, claim: null, waitingOn: [], passed: [] };
  const phase = view.phase;
  const react = view.me?.moves.react ?? null;

  switch (phase.type) {
    case 'gameOver':
      return { ...base, mode: 'gameOver' };

    case 'awaitingAction': {
      const mine = view.viewerId !== null && view.viewerId === view.activePlayerId && relationOf(view) === 'player';
      return { ...base, mode: mine ? 'myTurn' : 'waitingTurn', subjectId: view.activePlayerId };
    }

    case 'challengeWindow':
    case 'blockWindow':
    case 'blockChallengeWindow': {
      const { pending } = phase;
      const claim: Claim = {
        stage: phase.type === 'blockChallengeWindow' ? 'block' : 'action',
        actorId: pending.actorId,
        action: pending.action,
        targetId: pending.targetId,
        role: ACTION_RULES[pending.action].claim,
        block: phase.type === 'blockChallengeWindow' ? phase.block : null,
      };
      let mode: Mode = 'waitingReaction';
      if (react) {
        if (phase.type === 'blockWindow' && react.blockRoles.length > 0) mode = 'canBlock';
        else if (phase.type !== 'blockWindow' && react.canChallenge) mode = 'canChallenge';
      }
      return {
        ...base,
        mode,
        claim,
        passed: [...phase.passed],
        waitingOn: phase.eligible.filter((id) => !phase.passed.includes(id)),
      };
    }

    case 'influenceLoss':
      return {
        ...base,
        mode: view.me?.moves.chooseInfluence ? 'chooseLoss' : 'waitingLoss',
        subjectId: phase.playerId,
        reason: phase.reason,
      };

    case 'exchange':
      return {
        ...base,
        mode: view.me?.moves.chooseExchange ? 'chooseExchange' : 'waitingExchange',
        subjectId: phase.playerId,
      };
  }
}

/** Seat positions (in percent of the table) for the opponents, clockwise from the viewer at the bottom. */
export function seatPositions(opponents: number, radiusX = 41, radiusY = 36): { x: number; y: number }[] {
  const total = opponents + 1;
  return Array.from({ length: opponents }, (_, i) => {
    const angle = Math.PI / 2 + (2 * Math.PI * (i + 1)) / total;
    return {
      x: Math.round((50 + radiusX * Math.cos(angle)) * 10) / 10,
      y: Math.round((50 + radiusY * Math.sin(angle)) * 10) / 10,
    };
  });
}

/** Players in clockwise order starting with the one after `selfId` (or the first seat for spectators). */
export function opponentsInOrder<T extends { id: PlayerId }>(players: T[], selfId: PlayerId | null): T[] {
  const at = selfId === null ? -1 : players.findIndex((p) => p.id === selfId);
  if (at === -1) return [...players];
  return [...players.slice(at + 1), ...players.slice(0, at)];
}

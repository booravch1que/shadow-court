import {
  ACTION_RULES,
  ASSASSINATE_COST,
  COUP_COST,
  MAX_CONSECUTIVE_SKIPS,
} from './constants';
import {
  coinRoom,
  findPlayer,
  isAlive,
  isMandatoryCoup,
  livingPlayers,
  phaseWindowId,
  respondersNow,
} from './rules';
import type { ActionType, Command, GameState, PlayerId, Role } from './types';

/** One action the active player may declare, with its legal targets if any. */
export interface LegalDeclaration {
  action: ActionType;
  /** Legal targets, or `null` when the action has no target. */
  targets: PlayerId[] | null;
}

export interface LegalMoves {
  /** Actions the player may declare. Non-empty only on their own turn. */
  declarations: LegalDeclaration[];
  /** True when the player must Coup this turn (everyone has 7+ coins). */
  mandatoryCoup: boolean;
  /** Open reaction window, if this player may respond to it. */
  react: {
    canChallenge: boolean;
    /** Roles this player may claim to block. */
    blockRoles: Role[];
    canPass: boolean;
  } | null;
  /** Roles the player may discard when they must lose influence. */
  chooseInfluence: Role[] | null;
  /** Pending Shaman exchange: choose `keep` cards out of `options`. */
  chooseExchange: { options: Role[]; keep: number } | null;
}

function emptyMoves(): LegalMoves {
  return {
    declarations: [],
    mandatoryCoup: false,
    react: null,
    chooseInfluence: null,
    chooseExchange: null,
  };
}

/**
 * The single source of truth for what the active player may declare.
 * The reducer validates against it and the UI renders from it.
 */
export function legalDeclarations(state: GameState, playerId: PlayerId): LegalDeclaration[] {
  if (state.phase.type !== 'awaitingAction' || state.activePlayerId !== playerId) return [];
  const player = findPlayer(state, playerId);
  if (!player || !isAlive(player)) return [];

  const opponents = livingPlayers(state)
    .filter((p) => p.id !== playerId)
    .map((p) => p.id);

  if (isMandatoryCoup(state)) {
    return [{ action: 'coup', targets: opponents }];
  }

  // Actions that would add nothing are disabled instead of being allowed to waste a turn.
  const canGain = coinRoom(player) > 0;
  const out: LegalDeclaration[] = [];
  const add = (action: ActionType) => {
    out.push({ action, targets: ACTION_RULES[action].targeted ? [...opponents] : null });
  };

  if (canGain) add('income');
  if (canGain) add('foreignAid');
  if (player.coins >= COUP_COST) add('coup');
  if (canGain) add('tax');
  if (canGain) add('steal');
  if (player.coins >= ASSASSINATE_COST) add('assassinate');
  add('exchange');
  if (player.consecutiveSkips < MAX_CONSECUTIVE_SKIPS) add('skip');
  return out;
}

export function getLegalMoves(state: GameState, playerId: PlayerId): LegalMoves {
  const moves = emptyMoves();
  const player = findPlayer(state, playerId);
  if (!player || !isAlive(player)) return moves;

  const phase = state.phase;
  switch (phase.type) {
    case 'awaitingAction':
      moves.declarations = legalDeclarations(state, playerId);
      moves.mandatoryCoup = state.activePlayerId === playerId && isMandatoryCoup(state);
      break;
    case 'challengeWindow':
    case 'blockChallengeWindow':
      if (respondersNow(state.players, phase, state.sequentialReactions ?? false).includes(playerId)) {
        moves.react = { canChallenge: true, blockRoles: [], canPass: true };
      }
      break;
    case 'blockWindow':
      if (respondersNow(state.players, phase, state.sequentialReactions ?? false).includes(playerId)) {
        moves.react = {
          canChallenge: false,
          blockRoles: [...ACTION_RULES[phase.pending.action].blockedBy],
          canPass: true,
        };
      }
      break;
    case 'influenceLoss':
      if (phase.playerId === playerId) moves.chooseInfluence = [...new Set(player.hand)];
      break;
    case 'exchange':
      if (phase.playerId === playerId) {
        moves.chooseExchange = { options: [...phase.options], keep: phase.keep };
      }
      break;
    case 'gameOver':
      break;
  }
  return moves;
}

/** Distinct ways to keep `keep` cards out of `options` (cards of equal role are interchangeable). */
function keepChoices(options: Role[], keep: number): Role[][] {
  const seen = new Set<string>();
  const out: Role[][] = [];
  const chosen: Role[] = [];
  const pick = (start: number) => {
    if (chosen.length === keep) {
      const key = [...chosen].sort().join(',');
      if (!seen.has(key)) {
        seen.add(key);
        out.push([...chosen]);
      }
      return;
    }
    for (let i = start; i < options.length; i++) {
      chosen.push(options[i] as Role);
      pick(i + 1);
      chosen.pop();
    }
  };
  pick(0);
  return out;
}

/** Every command the player could legally send right now. Used by bots and tests. */
export function enumerateCommands(state: GameState, playerId: PlayerId): Command[] {
  const windowId = phaseWindowId(state);
  if (windowId === null) return [];
  const moves = getLegalMoves(state, playerId);
  const commands: Command[] = [];

  for (const declaration of moves.declarations) {
    if (declaration.targets === null) {
      commands.push({ type: 'declare', playerId, windowId, action: declaration.action });
    } else {
      for (const targetId of declaration.targets) {
        commands.push({ type: 'declare', playerId, windowId, action: declaration.action, targetId });
      }
    }
  }
  if (moves.react) {
    if (moves.react.canChallenge) commands.push({ type: 'challenge', playerId, windowId });
    for (const role of moves.react.blockRoles) {
      commands.push({ type: 'block', playerId, windowId, role });
    }
    if (moves.react.canPass) commands.push({ type: 'pass', playerId, windowId });
  }
  if (moves.chooseInfluence) {
    for (const role of moves.chooseInfluence) {
      commands.push({ type: 'chooseInfluence', playerId, windowId, role });
    }
  }
  if (moves.chooseExchange) {
    for (const keep of keepChoices(moves.chooseExchange.options, moves.chooseExchange.keep)) {
      commands.push({ type: 'chooseExchange', playerId, windowId, keep });
    }
  }
  return commands;
}

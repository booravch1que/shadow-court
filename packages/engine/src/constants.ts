import type { ActionType, Role } from './types';

export const ROLES: readonly Role[] = ['governor', 'assassin', 'thief', 'shaman', 'duchess'];

export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 6;

export const STARTING_COINS = 2;
export const STARTING_INFLUENCE = 2;
/** A player can never hold more coins than this. */
export const MAX_COINS = 11;

export const COUP_COST = 7;
export const ASSASSINATE_COST = 3;
export const INCOME_GAIN = 1;
export const FOREIGN_AID_GAIN = 2;
export const TAX_GAIN = 3;
export const STEAL_AMOUNT = 2;
export const EXCHANGE_DRAW = 2;

/** A player may skip at most this many turns in a row. */
export const MAX_CONSECUTIVE_SKIPS = 2;

/** Copies of each role in the deck: 3 for 2-4 players, 4 for 5-6 players. */
export function copiesPerRole(playerCount: number): number {
  return playerCount <= 4 ? 3 : 4;
}

export interface ActionRule {
  /** Role the actor claims. `null` means no claim, so nothing to challenge. */
  claim: Role | null;
  /** Coins paid up front when the action is declared. */
  cost: number;
  /** Whether the action needs another living player as its target. */
  targeted: boolean;
  /** Roles that may be claimed to block this action. Empty = cannot be blocked. */
  blockedBy: readonly Role[];
}

export const ACTION_RULES: Readonly<Record<ActionType, ActionRule>> = {
  income: { claim: null, cost: 0, targeted: false, blockedBy: [] },
  foreignAid: { claim: null, cost: 0, targeted: false, blockedBy: ['governor'] },
  coup: { claim: null, cost: COUP_COST, targeted: true, blockedBy: [] },
  tax: { claim: 'governor', cost: 0, targeted: false, blockedBy: [] },
  steal: { claim: 'thief', cost: 0, targeted: true, blockedBy: ['thief', 'shaman'] },
  assassinate: { claim: 'assassin', cost: ASSASSINATE_COST, targeted: true, blockedBy: ['duchess'] },
  exchange: { claim: 'shaman', cost: 0, targeted: false, blockedBy: [] },
  skip: { claim: null, cost: 0, targeted: false, blockedBy: [] },
};

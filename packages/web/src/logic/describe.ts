import { ACTION_RULES, type ActionType, type GameEvent, type PlayerId, type Role } from '@shadow-court/engine';
import type { TFn } from '../i18n';

export type Tone = 'info' | 'good' | 'bad' | 'turn' | 'claim';

export interface LogLine {
  text: string;
  tone: Tone;
}

export interface DescribeContext {
  t: TFn;
  name: (id: PlayerId) => string;
}

export const roleName = (t: TFn, role: Role): string => t(`role.${role}`);
export const actionName = (t: TFn, action: ActionType): string => t(`action.${action}`);

/** Turns one public game event into a line for the history log, in the viewer's language. */
export function describeEvent(e: GameEvent, c: DescribeContext): LogLine | null {
  const { t, name } = c;
  switch (e.type) {
    case 'gameStarted':
      return { text: t('log.gameStarted', { first: name(e.firstPlayerId) }), tone: 'turn' };
    case 'turnStarted':
      return { text: t('log.turn', { name: name(e.playerId), turn: e.turn }), tone: 'turn' };
    case 'turnSkipped':
      return { text: t('log.skipped', { name: name(e.playerId) }), tone: 'info' };
    case 'actionDeclared': {
      const target = e.targetId ? name(e.targetId) : '';
      return {
        text: t(`log.do.${e.action}`, { name: name(e.actorId), target, cost: e.cost, role: e.claim ? roleName(t, e.claim) : '' }),
        tone: e.claim ? 'claim' : 'info',
      };
    }
    case 'blockDeclared':
      return {
        text: t('log.block', {
          name: name(e.blockerId),
          role: roleName(t, e.role),
          actor: name(e.actorId),
          action: actionName(t, e.action),
        }),
        tone: 'claim',
      };
    case 'challenged':
      return {
        text: t('log.challenged', { name: name(e.challengerId), accused: name(e.accusedId), role: roleName(t, e.role) }),
        tone: 'claim',
      };
    case 'challengeResolved':
      return e.bluffCaught
        ? { text: t('log.bluffCaught', { name: name(e.accusedId), role: roleName(t, e.role) }), tone: 'bad' }
        : { text: t('log.challengeFailed', { name: name(e.accusedId), role: roleName(t, e.role) }), tone: 'good' };
    case 'cardReplaced':
      return { text: t('log.cardReplaced', { name: name(e.playerId) }), tone: 'info' };
    case 'actionCancelled':
      return { text: t(`log.cancelled.${e.reason}`, { name: name(e.actorId), action: actionName(t, e.action) }), tone: 'bad' };
    case 'actionResolved': {
      if (e.action === 'steal') {
        return { text: t('log.steal', { name: name(e.actorId), target: e.targetId ? name(e.targetId) : '', count: e.amount }), tone: 'good' };
      }
      if (e.action === 'income' || e.action === 'foreignAid' || e.action === 'tax') {
        return { text: t('log.gain', { name: name(e.actorId), count: e.amount }), tone: 'good' };
      }
      return null;
    }
    case 'coinsChanged':
      return e.cause === 'refund' ? { text: t('log.refund', { name: name(e.playerId), count: e.delta }), tone: 'info' } : null;
    case 'influenceLost':
      return { text: t('log.lost', { name: name(e.playerId), role: roleName(t, e.role) }), tone: 'bad' };
    case 'playerEliminated':
      return { text: t('log.eliminated', { name: name(e.playerId) }), tone: 'bad' };
    case 'exchangeStarted':
      return { text: t('log.exchange', { name: name(e.playerId) }), tone: 'info' };
    case 'timedOut':
      return { text: t('log.timedOut', { name: name(e.playerId) }), tone: 'info' };
    case 'playerForfeited':
      return { text: t('log.forfeited', { name: name(e.playerId) }), tone: 'bad' };
    case 'gameOver':
      return { text: t('log.gameOver', { name: name(e.winnerId) }), tone: 'good' };
    case 'passed':
    case 'cardRevealed':
    case 'exchangeCompleted':
      return null;
  }
  return null;
}

/** Sounds worth playing for a batch of events. */
export type SoundCue = 'coin' | 'flip' | 'challenge' | 'lose' | 'win';

export function soundCues(events: GameEvent[]): SoundCue[] {
  const out = new Set<SoundCue>();
  for (const e of events) {
    if (e.type === 'coinsChanged' && e.delta > 0 && e.cause !== 'eliminated') out.add('coin');
    if (e.type === 'cardRevealed') out.add('flip');
    if (e.type === 'challenged') out.add('challenge');
    if (e.type === 'influenceLost') out.add('lose');
    if (e.type === 'gameOver') out.add('win');
  }
  return [...out];
}

/** Does the action need a claim (and so can be challenged)? */
export const isClaim = (action: ActionType): boolean => ACTION_RULES[action].claim !== null;

import { EXCHANGE_DRAW, type ActionType, type GameEvent, type PlayerId, type Role } from '@shadow-court/engine';

/**
 * Turns public game events into a script of small animations: coins flying between
 * the bank and the players, cards leaving and joining the deck, lost cards flipping
 * over on their way to the middle of the table, short captions over a seat.
 *
 * Pure data, so it can be tested without a browser. The director plays it.
 */

/** A spot on the screen, found at play time through `data-fx` attributes. */
export type Anchor =
  | { kind: 'coins'; playerId: PlayerId }
  | { kind: 'cards'; playerId: PlayerId }
  | { kind: 'seat'; playerId: PlayerId }
  | { kind: 'deck' }
  | { kind: 'bank' }
  | { kind: 'discard' };

/** What a seat shows is `value from the view - lag`, so effects can land before numbers change. */
export type LagKind = 'coins' | 'cards' | 'discard';

export interface Adjust {
  what: LagKind;
  playerId: PlayerId;
  by: number;
}

export type LabelTone = 'claim' | 'good' | 'bad' | 'info';

export type Label =
  | { key: 'fx.action'; action: ActionType; targetId: PlayerId | null }
  | { key: 'fx.block'; role: Role }
  | { key: 'fx.challenge' | 'fx.bluff' | 'fx.truth' | 'fx.pass' };

export type Sprite =
  | { type: 'coin'; steal?: boolean }
  /** `role: null` is a face-down card. With `flip`, it turns face-up before it moves. */
  | { type: 'card'; role: Role | null; flip: boolean }
  | { type: 'label'; label: Label; tone: LabelTone };

export interface Flight {
  sprite: Sprite;
  from: Anchor;
  to: Anchor;
  /** Start, in ms after the step begins. */
  delay: number;
  duration: number;
  /** Applied as soon as the step is queued, before anything moves. */
  onQueue: Adjust[];
  onStart: Adjust[];
  onLand: Adjust[];
}

export interface Step {
  flights: Flight[];
  /** How long the step holds the queue, in ms. Captions do not hold it for their whole life. */
  hold: number;
}

export const TIMING = {
  coin: 650,
  coinGap: 110,
  card: 700,
  cardGap: 140,
  flipCard: 1500,
  label: 1300,
  labelHold: 550,
  passHold: 250,
  pause: 150,
} as const;

const seat = (playerId: PlayerId): Anchor => ({ kind: 'seat', playerId });
const coins = (playerId: PlayerId): Anchor => ({ kind: 'coins', playerId });
const cards = (playerId: PlayerId): Anchor => ({ kind: 'cards', playerId });
const DECK: Anchor = { kind: 'deck' };
const BANK: Anchor = { kind: 'bank' };
const DISCARD: Anchor = { kind: 'discard' };
const adj = (what: LagKind, playerId: PlayerId, by: number): Adjust => ({ what, playerId, by });

function labelFlight(playerId: PlayerId, label: Label, tone: LabelTone): Flight {
  const at = seat(playerId);
  return {
    sprite: { type: 'label', label, tone },
    from: at,
    to: at,
    delay: 0,
    duration: TIMING.label,
    onQueue: [],
    onStart: [],
    onLand: [],
  };
}

/** `count` coins, one after another. The receiver's number only grows as each coin lands. */
function coinFlights(from: Anchor, to: Anchor, count: number, steal = false): Flight[] {
  return Array.from({ length: count }, (_, i): Flight => {
    const flight: Flight = {
      sprite: { type: 'coin', steal },
      from,
      to,
      delay: i * TIMING.coinGap,
      duration: TIMING.coin,
      onQueue: [],
      onStart: [],
      onLand: [],
    };
    // A paying player keeps showing the coin until it leaves; a receiving one gets it on landing.
    if (from.kind === 'coins') {
      flight.onQueue.push(adj('coins', from.playerId, -1));
      flight.onStart.push(adj('coins', from.playerId, 1));
    }
    if (to.kind === 'coins') {
      flight.onQueue.push(adj('coins', to.playerId, 1));
      flight.onLand.push(adj('coins', to.playerId, -1));
    }
    return flight;
  });
}

function step(flights: Flight[], hold?: number): Step {
  const end = Math.max(0, ...flights.map((f) => f.delay + f.duration));
  return { flights, hold: hold ?? end + TIMING.pause };
}

/** Builds the animation script for one batch of events, in order. */
export function buildSteps(events: readonly GameEvent[]): Step[] {
  const steps: Step[] = [];
  let passes: Flight[] = [];
  /** The victim's half of a theft, waiting for the thief's half. */
  let stolenFrom: { playerId: PlayerId; count: number } | null = null;

  const flushPasses = () => {
    if (passes.length === 0) return;
    steps.push(step(passes, TIMING.passHold));
    passes = [];
  };

  for (const e of events) {
    if (e.type !== 'passed') flushPasses();
    switch (e.type) {
      case 'gameStarted': {
        // Two cards each, dealt round by round from the deck.
        const flights: Flight[] = [];
        let n = 0;
        for (let round = 0; round < 2; round++) {
          for (const id of e.playerIds) {
            flights.push({
              sprite: { type: 'card', role: null, flip: false },
              from: DECK,
              to: cards(id),
              delay: n++ * TIMING.cardGap,
              duration: TIMING.card,
              onQueue: [adj('cards', id, 1)],
              onStart: [],
              onLand: [adj('cards', id, -1)],
            });
          }
        }
        steps.push(step(flights));
        break;
      }

      case 'actionDeclared':
        if (e.action === 'skip') break;
        steps.push(
          step(
            [labelFlight(e.actorId, { key: 'fx.action', action: e.action, targetId: e.targetId }, e.claim ? 'claim' : 'info')],
            TIMING.labelHold,
          ),
        );
        break;

      case 'turnSkipped':
        steps.push(step([labelFlight(e.playerId, { key: 'fx.action', action: 'skip', targetId: null }, 'info')], TIMING.labelHold));
        break;

      case 'passed':
        passes.push(labelFlight(e.playerId, { key: 'fx.pass' }, 'info'));
        break;

      case 'blockDeclared':
        steps.push(step([labelFlight(e.blockerId, { key: 'fx.block', role: e.role }, 'claim')], TIMING.labelHold));
        break;

      case 'challenged':
        steps.push(step([labelFlight(e.challengerId, { key: 'fx.challenge' }, 'bad')], TIMING.labelHold));
        break;

      case 'challengeResolved':
        steps.push(
          step(
            [labelFlight(e.accusedId, e.bluffCaught ? { key: 'fx.bluff' } : { key: 'fx.truth' }, e.bluffCaught ? 'bad' : 'good')],
            TIMING.labelHold,
          ),
        );
        break;

      case 'cardRevealed':
        // The proof: the card turns over and goes back into the deck. Its seat looks one card short until the
        // replacement arrives.
        steps.push(
          step([
            {
              sprite: { type: 'card', role: e.role, flip: true },
              from: cards(e.playerId),
              to: DECK,
              delay: 0,
              duration: TIMING.flipCard,
              onQueue: [],
              onStart: [adj('cards', e.playerId, 1)],
              onLand: [],
            },
          ]),
        );
        break;

      case 'cardReplaced':
        steps.push(
          step([
            {
              sprite: { type: 'card', role: null, flip: false },
              from: DECK,
              to: cards(e.playerId),
              delay: 0,
              duration: TIMING.card,
              onQueue: [],
              onStart: [],
              onLand: [adj('cards', e.playerId, -1)],
            },
          ]),
        );
        break;

      case 'influenceLost':
        // Turned face-up at the seat, then laid in the middle of the table for everyone to see.
        steps.push(
          step([
            {
              sprite: { type: 'card', role: e.role, flip: true },
              from: cards(e.playerId),
              to: DISCARD,
              delay: 0,
              duration: TIMING.flipCard,
              onQueue: [adj('cards', e.playerId, -1), adj('discard', e.playerId, 1)],
              onStart: [adj('cards', e.playerId, 1)],
              onLand: [adj('discard', e.playerId, -1)],
            },
          ]),
        );
        break;

      case 'exchangeStarted':
        // The Shaman draws two: the seat briefly holds the extra cards.
        steps.push(
          step(
            Array.from({ length: EXCHANGE_DRAW }, (_, i): Flight => ({
              sprite: { type: 'card', role: null, flip: false },
              from: DECK,
              to: cards(e.playerId),
              delay: i * TIMING.cardGap * 2,
              duration: TIMING.card,
              onQueue: [],
              onStart: [],
              onLand: [adj('cards', e.playerId, -1)],
            })),
          ),
        );
        break;

      case 'exchangeCompleted':
        steps.push(
          step(
            Array.from({ length: EXCHANGE_DRAW }, (_, i): Flight => ({
              sprite: { type: 'card', role: null, flip: false },
              from: cards(e.playerId),
              to: DECK,
              delay: i * TIMING.cardGap * 2,
              duration: TIMING.card,
              onQueue: [],
              onStart: [adj('cards', e.playerId, 1)],
              onLand: [],
            })),
          ),
        );
        break;

      case 'coinsChanged': {
        const n = Math.abs(e.delta);
        if (e.cause === 'steal') {
          if (e.delta < 0) {
            stolenFrom = { playerId: e.playerId, count: n };
          } else if (stolenFrom) {
            steps.push(step(coinFlights(coins(stolenFrom.playerId), coins(e.playerId), n, true)));
            stolenFrom = null;
          }
          break;
        }
        // Gains come out of the bank; anything paid or forfeited goes back into it.
        steps.push(step(e.delta > 0 ? coinFlights(BANK, coins(e.playerId), n) : coinFlights(coins(e.playerId), BANK, n)));
        break;
      }

      default:
        break;
    }
  }
  flushPasses();
  return steps;
}

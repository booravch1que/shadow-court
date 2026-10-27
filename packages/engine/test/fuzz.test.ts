import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  createGame,
  enumerateCommands,
  projectView,
  reduce,
  type Command,
  type GameEvent,
  type GameState,
  type PlayerId,
} from '../src';
import { assertInvariants } from './helpers';

/** Tiny independent PRNG for the bots, so they never touch the engine's own generator. */
function botRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const MAX_STEPS = 6000;

interface Coverage {
  counts: Map<string, number>;
}

function bump(coverage: Coverage, key: string): void {
  coverage.counts.set(key, (coverage.counts.get(key) ?? 0) + 1);
}

function record(events: GameEvent[], coverage: Coverage): void {
  for (const e of events) {
    bump(coverage, e.type);
    if (e.type === 'actionCancelled') bump(coverage, `cancelled:${e.reason}`);
    if (e.type === 'challengeResolved') bump(coverage, `challenge:${e.context}:${e.bluffCaught ? 'caught' : 'failed'}`);
    if (e.type === 'coinsChanged') bump(coverage, `coins:${e.cause}`);
    if (e.type === 'timedOut') bump(coverage, `timeout:${e.during}`);
    if (e.type === 'actionResolved') bump(coverage, `resolved:${e.action}`);
    if (e.type === 'influenceLost') bump(coverage, `lost:${e.reason}`);
  }
}

/** Plays one complete game with random legal moves, checking invariants after every step. */
function playRandomGame(seed: number, playerCount: number, coverage: Coverage): { state: GameState; steps: number } {
  const ids: PlayerId[] = Array.from({ length: playerCount }, (_, i) => `P${i + 1}`);
  const { state: initial, events: startEvents } = createGame({ playerIds: ids, seed });
  let state = initial;
  record(startEvents, coverage);
  const rand = botRng(seed ^ 0x9e3779b9);

  // Independent bookkeeping rebuilt only from public events.
  const coins = new Map<PlayerId, number>(ids.map((id) => [id, 2]));
  const lost = new Map<PlayerId, number>(ids.map((id) => [id, 0]));

  assertInvariants(state);
  let steps = 0;

  while (state.phase.type !== 'gameOver') {
    assert.ok(steps++ < MAX_STEPS, `seed ${seed} (${playerCount} players): game did not finish in ${MAX_STEPS} steps`);

    // Every command the engine says is legal must be accepted.
    const candidates: Command[] = [];
    for (const player of state.players) candidates.push(...enumerateCommands(state, player.id));
    assert.ok(candidates.length > 0, `seed ${seed}: no legal command in phase ${state.phase.type}`);

    let command = candidates[Math.floor(rand() * candidates.length)] as Command;
    const roll = rand();
    if (roll < 0.04) {
      command = { type: 'timeout', windowId: (state.phase as { windowId: number }).windowId };
    } else if (roll < 0.045) {
      const living = state.players.filter((p) => p.hand.length > 0);
      command = { type: 'forfeit', playerId: (living[Math.floor(rand() * living.length)] as { id: PlayerId }).id };
    }

    const snapshot = JSON.stringify(state);
    const result = reduce(state, command);
    assert.equal(JSON.stringify(state), snapshot, 'reduce must never mutate its input');
    assert.ok(result.ok, `seed ${seed}: a legal ${command.type} was rejected: ${!result.ok && result.error.message}`);
    if (!result.ok) throw new Error('unreachable');

    state = result.state;
    record(result.events, coverage);
    assertInvariants(state);

    // Coins and lost cards must be fully explained by the public event stream.
    for (const e of result.events) {
      if (e.type === 'coinsChanged') coins.set(e.playerId, (coins.get(e.playerId) ?? 0) + e.delta);
      if (e.type === 'influenceLost') lost.set(e.playerId, (lost.get(e.playerId) ?? 0) + 1);
    }
    for (const player of state.players) {
      assert.equal(coins.get(player.id), player.coins, `seed ${seed}: events do not explain ${player.id}'s coins`);
      assert.equal(lost.get(player.id), player.revealed.length, `seed ${seed}: events do not explain ${player.id}'s lost cards`);
    }

    // Views never carry hidden data for anyone.
    for (const viewer of [...ids, null]) {
      const view = projectView(state, viewer);
      const text = JSON.stringify({ ...view, me: null });
      assert.ok(!text.includes('"deck"') && !text.includes('"rng"') && !text.includes('"hand"'));
      if (state.phase.type === 'exchange' && viewer !== state.phase.playerId) {
        assert.equal(view.me?.moves.chooseExchange ?? null, null, 'exchange options leaked');
      }
    }
  }

  // Stale commands are always refused once the game is over.
  const over = reduce(state, { type: 'timeout', windowId: 1 });
  assert.ok(!over.ok && over.error.code === 'game_over');
  return { state, steps };
}

describe('fuzz: random legal games', () => {
  const coverage: Coverage = { counts: new Map() };
  // FUZZ_GAMES=2000 pnpm test  for a long soak run.
  const GAMES_PER_SIZE = Number(process.env['FUZZ_GAMES'] ?? 120);

  for (const playerCount of [2, 3, 4, 5, 6]) {
    it(`${GAMES_PER_SIZE} random ${playerCount}-player games finish with every invariant intact`, () => {
      let totalSteps = 0;
      for (let seed = 1; seed <= GAMES_PER_SIZE; seed++) {
        const { state, steps } = playRandomGame(seed * 7919 + playerCount, playerCount, coverage);
        totalSteps += steps;
        assert.equal(state.phase.type, 'gameOver');
        assert.equal(state.players.filter((p) => p.hand.length > 0).length, 1);
      }
      assert.ok(totalSteps > GAMES_PER_SIZE * 5, 'games should not end suspiciously fast');
    });
  }

  it('the same seed replays to exactly the same game', () => {
    const a = playRandomGame(31337, 4, { counts: new Map() });
    const b = playRandomGame(31337, 4, { counts: new Map() });
    assert.deepEqual(a.state, b.state);
    assert.equal(a.steps, b.steps);
  });

  it('actually exercised the interesting rules', () => {
    const wanted = [
      'challenge:action:caught',
      'challenge:action:failed',
      'challenge:block:caught',
      'challenge:block:failed',
      'cancelled:challenged',
      'cancelled:blocked',
      'cancelled:targetEliminated',
      'cancelled:actorEliminated',
      'coins:refund',
      'coins:steal',
      'coins:eliminated',
      'cardReplaced',
      'exchangeCompleted',
      'playerEliminated',
      'playerForfeited',
      'timeout:turn',
      'timeout:influence',
      'timeout:exchange',
      'resolved:assassinate',
      'resolved:coup',
      'resolved:tax',
      'resolved:steal',
      'resolved:foreignAid',
      'resolved:income',
      'lost:assassinated',
      'lost:couped',
      'lost:bluffCaught',
      'lost:challengeLost',
      'turnSkipped',
    ];
    const missing = wanted.filter((key) => !coverage.counts.get(key));
    assert.deepEqual(missing, [], `fuzzing never reached: ${missing.join(', ')}`);
  });
});

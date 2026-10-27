import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createGame, enumerateCommands, reduce, type GameEvent, type GameState } from '@shadow-court/engine';
import { buildSteps, type Flight, type Step } from '../src/fx/steps';

const flights = (steps: Step[]): Flight[] => steps.flatMap((s) => s.flights);

/** Once every flight has played, nothing may be left hidden or held back. */
function assertBalanced(steps: Step[]): void {
  const total = new Map<string, number>();
  for (const f of flights(steps)) {
    for (const a of [...f.onQueue, ...f.onStart, ...f.onLand]) {
      const key = `${a.what}:${a.playerId}`;
      total.set(key, (total.get(key) ?? 0) + a.by);
    }
  }
  for (const [key, value] of total) assert.equal(value, 0, `${key} is off by ${value}`);
}

test('income: one coin from the bank, counted when it lands', () => {
  const steps = buildSteps([
    { type: 'actionDeclared', actorId: 'a', action: 'income', targetId: null, claim: null, cost: 0 },
    { type: 'coinsChanged', playerId: 'a', delta: 1, cause: 'income' },
  ]);
  const coins = flights(steps).filter((f) => f.sprite.type === 'coin');
  assert.equal(coins.length, 1);
  assert.deepEqual(coins[0]?.from, { kind: 'bank' });
  assert.deepEqual(coins[0]?.onLand, [{ what: 'coins', playerId: 'a', by: -1 }]);
  assertBalanced(steps);
});

test('a theft flies straight from the victim to the thief', () => {
  const steps = buildSteps([
    { type: 'coinsChanged', playerId: 'v', delta: -2, cause: 'steal' },
    { type: 'coinsChanged', playerId: 't', delta: 2, cause: 'steal' },
  ]);
  const coins = flights(steps);
  assert.equal(coins.length, 2);
  for (const f of coins) {
    assert.deepEqual(f.sprite, { type: 'coin', steal: true });
    assert.deepEqual(f.from, { kind: 'coins', playerId: 'v' });
    assert.deepEqual(f.to, { kind: 'coins', playerId: 't' });
  }
  assertBalanced(steps);
});

test('spent coins go back to the bank', () => {
  const steps = buildSteps([{ type: 'coinsChanged', playerId: 'a', delta: -3, cause: 'assassination' }]);
  assert.equal(flights(steps).length, 3);
  assert.ok(flights(steps).every((f) => f.to.kind === 'bank'));
  assertBalanced(steps);
});

test('a lost card flips over and lands in the middle', () => {
  const steps = buildSteps([{ type: 'influenceLost', playerId: 'a', role: 'duchess', reason: 'couped' }]);
  const [card] = flights(steps);
  assert.deepEqual(card?.sprite, { type: 'card', role: 'duchess', flip: true });
  assert.deepEqual(card?.to, { kind: 'discard' });
  assertBalanced(steps);
});

test('the Shaman draws two cards and puts two back', () => {
  const steps = buildSteps([
    { type: 'exchangeStarted', playerId: 's' },
    { type: 'exchangeCompleted', playerId: 's' },
  ]);
  assert.equal(flights(steps).filter((f) => f.from.kind === 'deck').length, 2);
  assert.equal(flights(steps).filter((f) => f.to.kind === 'deck').length, 2);
  assertBalanced(steps);
});

test('passes in one batch share a step', () => {
  const steps = buildSteps([
    { type: 'passed', playerId: 'b', auto: true },
    { type: 'passed', playerId: 'c', auto: true },
  ]);
  assert.equal(steps.length, 1);
  assert.equal(steps[0]?.flights.length, 2);
});

test('whole random games always settle back to the real numbers', () => {
  for (let seed = 1; seed <= 30; seed++) {
    const created = createGame({ playerIds: ['a', 'b', 'c', 'd'], seed, sequentialReactions: seed % 2 === 0 });
    let state = created.state;
    const all: GameEvent[] = [...created.events];
    let pick = seed;
    for (let i = 0; i < 2000 && state.phase.type !== 'gameOver'; i++) {
      const commands = state.players.flatMap((p) => enumerateCommands(state as GameState, p.id));
      pick = (pick * 1103515245 + 12345) % 2 ** 31;
      const result = reduce(state, commands[pick % commands.length] ?? { type: 'timeout', windowId: 0 });
      assert.ok(result.ok);
      state = result.state;
      all.push(...result.events);
    }
    assertBalanced(buildSteps(all));
  }
});

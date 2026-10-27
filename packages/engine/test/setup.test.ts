import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ROLES, createGame, type Role } from '../src';
import { assertInvariants } from './helpers';

const ids = (n: number) => Array.from({ length: n }, (_, i) => `P${i + 1}`);

describe('createGame', () => {
  for (const count of [2, 3, 4, 5, 6]) {
    const copies = count <= 4 ? 3 : 4;
    it(`${count} players: ${copies} copies of each role (${copies * 5} cards)`, () => {
      const { state } = createGame({ playerIds: ids(count), seed: 7 });
      const all: Role[] = [...state.deck, ...state.players.flatMap((p) => p.hand)];
      assert.equal(all.length, copies * 5);
      for (const role of ROLES) assert.equal(all.filter((r) => r === role).length, copies);
      assertInvariants(state);
    });
  }

  it('deals 2 hidden cards and 2 coins to everyone, with no first-player adjustment', () => {
    for (const count of [2, 6]) {
      const { state } = createGame({ playerIds: ids(count), seed: 1 });
      for (const player of state.players) {
        assert.equal(player.hand.length, 2);
        assert.equal(player.coins, 2);
        assert.equal(player.revealed.length, 0);
      }
    }
  });

  it('leaves at least 7 cards in the deck so an exchange can always draw 2', () => {
    assert.equal(createGame({ playerIds: ids(4), seed: 1 }).state.deck.length, 7);
    assert.equal(createGame({ playerIds: ids(6), seed: 1 }).state.deck.length, 8);
  });

  it('starts at turn 1 with the first seat to act', () => {
    const { state, events } = createGame({ playerIds: ids(3), seed: 5, randomizeSeating: false });
    assert.equal(state.activePlayerId, 'P1');
    assert.equal(state.turn, 1);
    assert.equal(state.phase.type, 'awaitingAction');
    assert.deepEqual(events.map((e) => e.type), ['gameStarted', 'turnStarted']);
  });

  it('is fully deterministic for a given seed and differs between seeds', () => {
    const a = createGame({ playerIds: ids(5), seed: 99 }).state;
    const b = createGame({ playerIds: ids(5), seed: 99 }).state;
    const c = createGame({ playerIds: ids(5), seed: 100 }).state;
    assert.deepEqual(a, b);
    assert.notDeepEqual(a, c);
  });

  it('shuffles seating unless told not to', () => {
    const orders = new Set<string>();
    for (let seed = 0; seed < 30; seed++) {
      const { state } = createGame({ playerIds: ids(6), seed });
      orders.add(state.players.map((p) => p.id).join());
    }
    assert.ok(orders.size > 5, 'seating should vary between seeds');
    const fixed = createGame({ playerIds: ids(6), seed: 3, randomizeSeating: false });
    assert.deepEqual(fixed.state.players.map((p) => p.id), ids(6));
  });

  it('honours firstPlayerId and rejects strangers', () => {
    const { state } = createGame({ playerIds: ids(3), seed: 1, randomizeSeating: false, firstPlayerId: 'P3' });
    assert.equal(state.activePlayerId, 'P3');
    assert.throws(() => createGame({ playerIds: ids(3), seed: 1, firstPlayerId: 'nobody' }));
  });

  it('rejects bad player lists', () => {
    assert.throws(() => createGame({ playerIds: ids(1), seed: 1 }), RangeError);
    assert.throws(() => createGame({ playerIds: ids(7), seed: 1 }), RangeError);
    assert.throws(() => createGame({ playerIds: ['a', 'a'], seed: 1 }));
    assert.throws(() => createGame({ playerIds: ['a', ''], seed: 1 }));
  });
});

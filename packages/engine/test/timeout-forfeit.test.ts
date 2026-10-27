import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { assertInvariants, game } from './helpers';

const trio = (extra: { a?: object; b?: object; c?: object } = {}) =>
  game([
    { id: 'A', hand: ['governor', 'thief'], ...extra.a },
    { id: 'B', hand: ['duchess', 'shaman'], ...extra.b },
    { id: 'C', hand: ['assassin', 'duchess'], ...extra.c },
  ]);

describe('Timeouts', () => {
  it('a reaction window timing out passes for everyone who has not answered', () => {
    const g = trio().declare('A', 'tax').pass('B').timeout();
    const passes = g.eventsOfType('passed');
    assert.deepEqual(passes.map((p) => [p.playerId, p.auto]), [['B', false], ['C', true]]);
    assert.equal(g.player('A').coins, 5);
    assert.equal(g.state.activePlayerId, 'B');
  });

  it('a block window timing out lets the action resolve', () => {
    const g = trio().declare('A', 'foreignAid').timeout();
    assert.equal(g.player('A').coins, 4);
  });

  it('a block challenge window timing out lets the block stand', () => {
    const g = trio().declare('A', 'foreignAid').block('B', 'governor').timeout();
    assert.equal(g.player('A').coins, 2);
    assert.equal(g.eventsOfType('actionCancelled')[0]?.reason, 'blocked');
  });

  it('a timeout for a window that already closed is rejected', () => {
    const g = trio().declare('A', 'tax');
    const stale = g.windowId;
    g.pass('B', 'C');
    g.reject({ type: 'timeout', windowId: stale }, 'stale_window');
  });

  it('influence loss times out into a random discard, reproducibly for a given seed', () => {
    const run = () => {
      const g = game(
        [
          { id: 'A', hand: ['governor', 'thief'], coins: 7 },
          { id: 'B', hand: ['duchess', 'shaman'] },
        ],
        { seed: 4242 },
      ).declare('A', 'coup', 'B').timeout();
      return g;
    };
    const first = run();
    assert.equal(first.player('B').hand.length, 1);
    assert.equal(first.eventsOfType('timedOut')[0]?.during, 'influence');
    assert.deepEqual(first.state, run().state, 'same seed, same outcome');
    assertInvariants(first.state);
  });

  it('an exchange timing out keeps the original cards', () => {
    const g = game(
      [
        { id: 'A', hand: ['governor', 'thief'] },
        { id: 'B', hand: ['duchess', 'shaman'] },
      ],
      { deckTop: ['assassin', 'duchess'] },
    ).declare('A', 'exchange').pass('B');
    const deckBefore = g.state.deck.length;
    g.timeout();
    assert.deepEqual(g.player('A').hand, ['governor', 'thief']);
    assert.equal(g.state.deck.length, deckBefore + 2);
    assert.equal(g.eventsOfType('timedOut')[0]?.during, 'exchange');
    assertInvariants(g.state);
  });

  describe('turn timeout', () => {
    it('skips when allowed', () => {
      const g = trio().timeout();
      assert.equal(g.eventsOfType('turnSkipped').length, 1);
      assert.equal(g.state.activePlayerId, 'B');
    });

    it('takes Income once the skip limit is used', () => {
      const g = trio({ a: { skips: 2 } }).timeout();
      assert.equal(g.player('A').coins, 3);
    });

    it('Coups a random opponent when neither Skip nor Income is possible', () => {
      const g = trio({ a: { skips: 2, coins: 11 } }).timeout();
      assert.equal(g.player('A').coins, 4);
      assert.equal(g.eventsOfType('actionDeclared')[0]?.action, 'coup');
    });

    it('Coups when the Coup is mandatory', () => {
      const g = trio({ a: { coins: 7 }, b: { coins: 7 }, c: { coins: 7 } }).timeout();
      assert.equal(g.eventsOfType('actionDeclared')[0]?.action, 'coup');
      assert.equal(g.player('A').coins, 0);
    });
  });
});

describe('Forfeit (a player is removed)', () => {
  it('reveals their cards, returns their coins and passes the turn', () => {
    const g = trio({ a: { coins: 6 } }).forfeit('A');
    assert.deepEqual(g.player('A').revealed.sort(), ['governor', 'thief']);
    assert.equal(g.player('A').hand.length, 0);
    assert.equal(g.player('A').coins, 0);
    assert.equal(g.state.activePlayerId, 'B');
    assert.equal(g.eventsOfType('playerForfeited').length, 1);
    assertInvariants(g.state);
  });

  it('ends a two-player game in favour of the other player', () => {
    const g = game([
      { id: 'A', hand: ['governor', 'thief'] },
      { id: 'B', hand: ['duchess', 'shaman'] },
    ]).forfeit('B');
    assert.equal(g.phase.type === 'gameOver' && g.phase.winnerId, 'A');
    assertInvariants(g.state);
  });

  it('cancels a pending action when its actor leaves', () => {
    const g = trio().declare('A', 'tax').forfeit('A');
    assert.equal(g.eventsOfType('actionCancelled')[0]?.reason, 'actorEliminated');
    assert.equal(g.state.activePlayerId, 'B');
    assertInvariants(g.state);
  });

  it('cancels a pending action when its target leaves', () => {
    const g = trio().declare('A', 'steal', 'B').forfeit('B');
    assert.equal(g.eventsOfType('actionCancelled')[0]?.reason, 'targetEliminated');
    assert.equal(g.state.activePlayerId, 'C');
  });

  it('a bystander leaving can complete a reaction window', () => {
    const g = trio().declare('A', 'tax').pass('B').forfeit('C');
    assert.equal(g.player('A').coins, 5);
    assert.equal(g.state.activePlayerId, 'B');
  });

  it('a blocker leaving takes the block with them and the action goes ahead', () => {
    const g = trio().declare('A', 'foreignAid').block('C', 'governor').forfeit('C');
    assert.equal(g.player('A').coins, 4);
    assert.equal(g.state.activePlayerId, 'B');
  });

  it('a player who must choose a card leaves and the game moves on', () => {
    const g = trio({ a: { coins: 7 } }).declare('A', 'coup', 'B').forfeit('B');
    assert.equal(g.phase.type, 'awaitingAction');
    assert.equal(g.state.activePlayerId, 'C');
    assertInvariants(g.state);
  });

  it('a Shaman leaving mid-exchange returns the drawn cards', () => {
    const g = trio().declare('A', 'exchange').pass('B', 'C');
    g.forfeit('A');
    assert.equal(g.phase.type, 'awaitingAction');
    assertInvariants(g.state);
  });

  it('a forfeit that ends the game mid-exchange does not lose the drawn cards', () => {
    const g = game(
      [
        { id: 'A', hand: ['governor', 'thief'] },
        { id: 'B', hand: ['duchess', 'shaman'] },
      ],
      { deckTop: ['assassin', 'duchess'] },
    ).declare('A', 'exchange').pass('B');
    const before: string = g.phase.type;
    assert.equal(before, 'exchange');
    g.forfeit('B');
    assert.equal(g.phase.type === 'gameOver' && g.phase.winnerId, 'A');
    assert.equal(g.state.deck.length, 11);
    assertInvariants(g.state);
  });

  it('rejects unknown and already eliminated players', () => {
    const g = trio().forfeit('C');
    g.reject({ type: 'forfeit', playerId: 'Z' }, 'unknown_player');
    g.reject({ type: 'forfeit', playerId: 'C' }, 'player_eliminated');
  });
});

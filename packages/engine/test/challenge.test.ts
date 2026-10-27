import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { assertInvariants, game } from './helpers';

describe('Challenging an action claim', () => {
  it('bluff caught: the actor loses a card of their choice and the action fails', () => {
    const g = game([
      { id: 'A', hand: ['thief', 'duchess'] },
      { id: 'B', hand: ['shaman', 'assassin'] },
    ]);
    g.declare('A', 'tax').challenge('B');
    assert.equal(g.phase.type, 'influenceLoss');
    assert.equal(g.phase.type === 'influenceLoss' && g.phase.playerId, 'A');
    g.lose('A', 'duchess');
    assert.equal(g.player('A').coins, 2, 'tax did not pay');
    assert.deepEqual(g.player('A').revealed, ['duchess']);
    assert.equal(g.state.activePlayerId, 'B');
    assert.equal(g.eventsOfType('actionCancelled')[0]?.reason, 'challenged');
    assertInvariants(g.state);
  });

  it('challenge fails: the challenger loses a card, the accused redraws, the action goes ahead', () => {
    const g = game([
      { id: 'A', hand: ['governor', 'thief'] },
      { id: 'B', hand: ['shaman', 'assassin'] },
    ]);
    const deckSize = g.state.deck.length;
    g.declare('A', 'tax').challenge('B');
    assert.equal(g.eventsOfType('cardRevealed')[0]?.role, 'governor');
    assert.equal(g.eventsOfType('cardReplaced').length, 1);
    assert.equal(g.phase.type === 'influenceLoss' && g.phase.playerId, 'B');
    g.lose('B', 'assassin');
    assert.equal(g.player('A').hand.length, 2, 'the accused keeps the same number of cards');
    assert.equal(g.state.deck.length, deckSize, 'the shown card went back, a new one was drawn');
    assert.equal(g.player('A').coins, 5, 'tax pays after the failed challenge');
    assert.deepEqual(g.player('B').revealed, ['assassin']);
    assertInvariants(g.state);
  });

  it('a failed challenge on a blockable action still leaves room for a block', () => {
    const g = game([
      { id: 'A', hand: ['thief', 'duchess'] },
      { id: 'B', hand: ['shaman', 'assassin'] },
      { id: 'C', hand: ['governor', 'duchess'] },
    ]);
    g.declare('A', 'steal', 'B').challenge('C').lose('C', 'governor');
    assert.equal(g.phase.type, 'blockWindow');
    assert.deepEqual(g.phase.type === 'blockWindow' && g.phase.eligible, ['B', 'C']);
  });

  it('a third party (not the target) may challenge', () => {
    const g = game([
      { id: 'A', hand: ['duchess', 'duchess'] },
      { id: 'B', hand: ['shaman', 'assassin'] },
      { id: 'C', hand: ['governor', 'duchess'] },
    ]);
    g.declare('A', 'steal', 'B').challenge('C');
    assert.equal(g.eventsOfType('challenged')[0]?.challengerId, 'C');
    assert.equal(g.phase.type, 'awaitingAction', 'A held two identical cards, so the loss was automatic');
  });

  it('the first challenge wins and later ones are rejected as stale', () => {
    const g = game([
      { id: 'A', hand: ['thief', 'duchess'] },
      { id: 'B', hand: ['shaman', 'assassin'] },
      { id: 'C', hand: ['governor', 'duchess'] },
    ]);
    g.declare('A', 'tax');
    const windowId = g.windowId;
    g.challenge('B');
    g.reject({ type: 'challenge', playerId: 'C', windowId }, 'stale_window');
    g.reject({ type: 'pass', playerId: 'C', windowId }, 'stale_window');
  });

  it('the actor cannot challenge their own claim', () => {
    const g = game([
      { id: 'A', hand: ['governor', 'thief'] },
      { id: 'B', hand: ['shaman', 'assassin'] },
    ]).declare('A', 'tax');
    g.reject({ type: 'challenge', playerId: 'A', windowId: g.windowId }, 'not_eligible');
    g.reject({ type: 'pass', playerId: 'A', windowId: g.windowId }, 'not_eligible');
  });

  it('a pass is final: the same player can neither pass twice nor challenge afterwards', () => {
    const g = game([
      { id: 'A', hand: ['governor', 'thief'] },
      { id: 'B', hand: ['shaman', 'assassin'] },
      { id: 'C', hand: ['governor', 'duchess'] },
    ]).declare('A', 'tax');
    g.pass('B');
    g.reject({ type: 'pass', playerId: 'B', windowId: g.windowId }, 'already_responded');
    g.reject({ type: 'challenge', playerId: 'B', windowId: g.windowId }, 'already_responded');
    g.challenge('C');
  });

  it('a challenge cannot be raised outside a challenge window', () => {
    const g = game([
      { id: 'A', hand: ['governor', 'thief'] },
      { id: 'B', hand: ['shaman', 'assassin'] },
    ]);
    g.reject({ type: 'challenge', playerId: 'B', windowId: g.windowId }, 'wrong_phase');
  });

  it('once the claim has passed its window it cannot be challenged during the block window', () => {
    const g = game([
      { id: 'A', hand: ['thief', 'duchess'] },
      { id: 'B', hand: ['shaman', 'assassin'] },
    ]).declare('A', 'steal', 'B').pass('B');
    assert.equal(g.phase.type, 'blockWindow');
    g.reject({ type: 'challenge', playerId: 'B', windowId: g.windowId }, 'wrong_phase');
  });

  it('a one-card challenger is eliminated by a failed challenge', () => {
    const g = game([
      { id: 'A', hand: ['governor', 'thief'] },
      { id: 'B', hand: ['assassin'], revealed: ['shaman'] },
      { id: 'C', hand: ['duchess', 'governor'] },
    ]);
    g.declare('A', 'tax').challenge('B');
    assert.deepEqual(g.eventsOfType('playerEliminated').map((e) => e.playerId), ['B']);
    assert.equal(g.player('A').coins, 5, 'the action still resolves');
    assert.equal(g.state.activePlayerId, 'C');
    assertInvariants(g.state);
  });
});

describe('Assassination money and elimination rules', () => {
  const trio = (target = { hand: ['duchess', 'shaman'] as const }) =>
    game([
      { id: 'A', hand: ['assassin', 'thief'], coins: 5 },
      { id: 'B', ...target },
      { id: 'C', hand: ['governor', 'duchess'] },
    ] as Parameters<typeof game>[0]);

  it('pays 3 coins when declared', () => {
    const g = trio().declare('A', 'assassinate', 'B');
    assert.equal(g.player('A').coins, 2);
    assert.equal(g.eventsOfType('coinsChanged')[0]?.cause, 'assassination');
  });

  it('refunds the 3 coins when the Assassin is caught bluffing', () => {
    const g = game([
      { id: 'A', hand: ['thief', 'governor'], coins: 5 },
      { id: 'B', hand: ['duchess', 'shaman'] },
      { id: 'C', hand: ['governor', 'duchess'] },
    ]);
    g.declare('A', 'assassinate', 'B').challenge('C').lose('A', 'thief');
    assert.equal(g.player('A').coins, 5);
    assert.equal(g.player('B').hand.length, 2, 'the target is unharmed');
    assert.equal(g.eventsOfType('coinsChanged').at(-1)?.cause, 'refund');
  });

  it('keeps the coins spent when a challenge against a real Assassin fails', () => {
    const g = trio().declare('A', 'assassinate', 'B').challenge('C').lose('C', 'governor');
    assert.equal(g.player('A').coins, 2);
    assert.equal(g.phase.type, 'blockWindow', 'the assassination continues');
  });

  it('target challenges, loses, then still gets assassinated: they can lose two cards in one turn', () => {
    const g = trio();
    g.declare('A', 'assassinate', 'B').challenge('B').lose('B', 'duchess');
    assert.equal(g.phase.type, 'blockWindow');
    g.passAll();
    // B is down to one card, so the second loss needs no choice and happens automatically.
    assert.equal(g.phase.type, 'awaitingAction');
    assert.equal(g.player('B').hand.length, 0);
    assert.deepEqual(g.player('B').revealed, ['duchess', 'shaman']);
    assert.deepEqual(
      g.eventsOfType('influenceLost').filter((e) => e.playerId === 'B').map((e) => e.reason),
      ['challengeLost', 'assassinated'],
    );
    assert.equal(g.eventsOfType('playerEliminated')[0]?.playerId, 'B');
    assert.equal(g.state.activePlayerId, 'C');
    assertInvariants(g.state);
  });

  it('target eliminated by a failed challenge: the assassination is cancelled and nothing is refunded', () => {
    const g = trio({ hand: ['duchess'], revealed: ['shaman'] } as never);
    g.declare('A', 'assassinate', 'B').challenge('B');
    assert.equal(g.eventsOfType('playerEliminated')[0]?.playerId, 'B');
    assert.equal(g.eventsOfType('actionCancelled')[0]?.reason, 'targetEliminated');
    assert.equal(g.player('A').coins, 2, 'no refund');
    assert.equal(g.player('A').hand.length, 2);
    assert.equal(g.state.activePlayerId, 'C');
    assertInvariants(g.state);
  });

  it('a third party who fails a challenge does not stop the assassination', () => {
    const g = trio();
    g.declare('A', 'assassinate', 'B').challenge('C').lose('C', 'governor').passAll();
    assert.equal(g.phase.type, 'influenceLoss');
    assert.equal(g.phase.type === 'influenceLoss' && g.phase.playerId, 'B');
  });
});

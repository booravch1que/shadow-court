import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { assertInvariants, game } from './helpers';

const four = () =>
  game([
    { id: 'A', hand: ['thief', 'duchess'], coins: 5 },
    { id: 'B', hand: ['shaman', 'assassin'], coins: 5 },
    { id: 'C', hand: ['governor', 'duchess'] },
    { id: 'D', hand: ['thief', 'shaman'] },
  ]);

describe('Blocking Foreign Aid (Governor)', () => {
  it('any living player except the actor may block, even claiming a role they lack', () => {
    const g = four().declare('A', 'foreignAid');
    g.block('D', 'governor');
    assert.equal(g.phase.type, 'blockChallengeWindow');
    g.passAll();
    assert.equal(g.player('A').coins, 5, 'the block stood, so no coins');
    assert.equal(g.eventsOfType('actionCancelled')[0]?.reason, 'blocked');
    assert.equal(g.state.activePlayerId, 'B');
  });

  it('the actor cannot block their own action', () => {
    const g = four().declare('A', 'foreignAid');
    g.reject({ type: 'block', playerId: 'A', windowId: g.windowId, role: 'governor' }, 'not_eligible');
  });

  it('only the Governor can block it', () => {
    const g = four().declare('A', 'foreignAid');
    g.reject({ type: 'block', playerId: 'B', windowId: g.windowId, role: 'duchess' }, 'invalid_block');
    g.reject({ type: 'block', playerId: 'B', windowId: g.windowId, role: 'thief' }, 'invalid_block');
  });

  it('block bluff caught: the blocker loses a card, the block is void and the action resolves', () => {
    const g = four().declare('A', 'foreignAid').block('B', 'governor').challenge('A');
    assert.equal(g.phase.type === 'influenceLoss' && g.phase.playerId, 'B');
    g.lose('B', 'shaman');
    assert.equal(g.player('A').coins, 7);
    assert.equal(g.phase.type, 'awaitingAction', 'no second block is offered');
    assert.equal(g.state.activePlayerId, 'B');
    assertInvariants(g.state);
  });

  it('block upheld: the challenger loses a card and the action is cancelled', () => {
    const g = four().declare('A', 'foreignAid').block('C', 'governor').challenge('A');
    g.lose('A', 'thief');
    assert.equal(g.player('A').coins, 5);
    assert.deepEqual(g.player('A').revealed, ['thief']);
    assert.equal(g.eventsOfType('cardRevealed')[0]?.role, 'governor');
    assert.equal(g.state.activePlayerId, 'B');
    assertInvariants(g.state);
  });

  it('the blocked player and any bystander may challenge the block', () => {
    const g = four().declare('A', 'foreignAid').block('C', 'governor');
    assert.deepEqual(g.phase.type === 'blockChallengeWindow' && g.phase.eligible, ['A', 'B', 'D']);
    g.challenge('D');
    assert.equal(g.eventsOfType('challenged')[0]?.context, 'block');
  });

  it('the blocker cannot challenge their own block', () => {
    const g = four().declare('A', 'foreignAid').block('C', 'governor');
    g.reject({ type: 'challenge', playerId: 'C', windowId: g.windowId }, 'not_eligible');
  });

  it('a block cannot be blocked in turn', () => {
    const g = four().declare('A', 'foreignAid').block('C', 'governor');
    g.reject({ type: 'block', playerId: 'B', windowId: g.windowId, role: 'governor' }, 'wrong_phase');
  });

  it('the first block wins; a second blocker is rejected as stale', () => {
    const g = four().declare('A', 'foreignAid');
    const windowId = g.windowId;
    g.block('B', 'governor');
    g.reject({ type: 'block', playerId: 'C', windowId, role: 'governor' }, 'stale_window');
  });

  it('a block is not an option while the challenge window is still open', () => {
    const g = four().declare('A', 'steal', 'B');
    g.reject({ type: 'block', playerId: 'B', windowId: g.windowId, role: 'thief' }, 'wrong_phase');
  });
});

describe('Blocking Steal (Thief or Shaman)', () => {
  const stealing = () => four().declare('A', 'steal', 'B').pass('B', 'C', 'D');

  it('a bystander may protect the target, claiming Thief', () => {
    const g = stealing().block('D', 'thief').passAll();
    assert.equal(g.player('A').coins, 5);
    assert.equal(g.player('B').coins, 5);
  });

  it('a bystander may protect the target, claiming Shaman', () => {
    const g = stealing().block('C', 'shaman').passAll();
    assert.equal(g.player('B').coins, 5);
  });

  it('the target may block for themselves', () => {
    const g = stealing().block('B', 'shaman').passAll();
    assert.equal(g.player('B').coins, 5);
  });

  it('cannot be blocked with Governor or Duchess', () => {
    const g = stealing();
    g.reject({ type: 'block', playerId: 'C', windowId: g.windowId, role: 'governor' }, 'invalid_block');
    g.reject({ type: 'block', playerId: 'C', windowId: g.windowId, role: 'duchess' }, 'invalid_block');
  });

  it('the stolen coins move when nobody blocks', () => {
    const g = stealing().passAll();
    assert.equal(g.player('A').coins, 7);
    assert.equal(g.player('B').coins, 3);
  });

  it('a real blocker survives a challenge and the steal fails', () => {
    const g = stealing().block('D', 'thief').challenge('A').lose('A', 'thief');
    assert.equal(g.player('B').coins, 5);
    assert.equal(g.player('D').hand.length, 2);
  });

  it('a bluffed block is caught and the steal goes through', () => {
    const g = stealing().block('C', 'thief').challenge('B').lose('C', 'governor');
    assert.equal(g.player('A').coins, 7);
    assert.equal(g.player('B').coins, 3);
    assertInvariants(g.state);
  });
});

describe('Blocking Assassination (Duchess)', () => {
  const assassinating = () =>
    game([
      { id: 'A', hand: ['assassin', 'thief'], coins: 5 },
      { id: 'B', hand: ['shaman', 'governor'] },
      { id: 'C', hand: ['duchess', 'governor'] },
      { id: 'D', hand: ['thief', 'shaman'] },
    ]).declare('A', 'assassinate', 'B').pass('B', 'C', 'D');

  it('a bystander may protect the target and the 3 coins are not refunded', () => {
    const g = assassinating().block('C', 'duchess').passAll();
    assert.equal(g.player('B').hand.length, 2);
    assert.equal(g.player('A').coins, 2);
    assert.equal(g.state.activePlayerId, 'B');
  });

  it('the target may block for themselves with a bluff, and the bluff is caught', () => {
    const g = assassinating().block('B', 'duchess').challenge('A');
    g.lose('B', 'shaman');
    // The void block lets the assassination land on the same player, who has one card left.
    assert.equal(g.phase.type, 'awaitingAction');
    assert.equal(g.player('B').hand.length, 0);
    assert.deepEqual(
      g.eventsOfType('influenceLost').filter((e) => e.playerId === 'B').map((e) => e.reason),
      ['bluffCaught', 'assassinated'],
    );
    assertInvariants(g.state);
  });

  it('a target who is eliminated by a caught bluffed block cancels the assassination', () => {
    const g = game([
      { id: 'A', hand: ['assassin', 'thief'], coins: 5 },
      { id: 'B', hand: ['shaman'], revealed: ['governor'] },
      { id: 'C', hand: ['duchess', 'governor'] },
    ]).declare('A', 'assassinate', 'B').pass('B', 'C');
    g.block('B', 'duchess').challenge('A');
    assert.equal(g.eventsOfType('playerEliminated')[0]?.playerId, 'B');
    assert.equal(g.eventsOfType('actionCancelled')[0]?.reason, 'targetEliminated');
    assert.equal(g.player('A').coins, 2, 'no refund');
    assert.equal(g.state.activePlayerId, 'C');
    assertInvariants(g.state);
  });

  it('only the Duchess can block it', () => {
    const g = assassinating();
    g.reject({ type: 'block', playerId: 'C', windowId: g.windowId, role: 'thief' }, 'invalid_block');
    g.reject({ type: 'block', playerId: 'C', windowId: g.windowId, role: 'governor' }, 'invalid_block');
  });
});

describe('Coup cannot be reacted to', () => {
  it('goes straight to influence loss with no challenge or block window', () => {
    const g = game([
      { id: 'A', hand: ['thief', 'duchess'], coins: 7 },
      { id: 'B', hand: ['shaman', 'assassin'] },
    ]).declare('A', 'coup', 'B');
    assert.equal(g.phase.type, 'influenceLoss');
    g.reject({ type: 'block', playerId: 'B', windowId: g.windowId, role: 'duchess' }, 'wrong_phase');
    g.reject({ type: 'challenge', playerId: 'B', windowId: g.windowId }, 'wrong_phase');
  });
});

describe('Influence loss choices', () => {
  it('only the player who is losing may choose, and only a card they hold', () => {
    const g = game([
      { id: 'A', hand: ['thief', 'duchess'], coins: 7 },
      { id: 'B', hand: ['shaman', 'assassin'] },
    ]).declare('A', 'coup', 'B');
    g.reject({ type: 'chooseInfluence', playerId: 'A', windowId: g.windowId, role: 'thief' }, 'not_eligible');
    g.reject({ type: 'chooseInfluence', playerId: 'B', windowId: g.windowId, role: 'governor' }, 'invalid_choice');
    g.lose('B', 'assassin');
  });
});

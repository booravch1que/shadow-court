import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { getLegalMoves } from '../src';
import { assertInvariants, game } from './helpers';

const duo = (a = {}, b = {}) =>
  game([
    { id: 'A', hand: ['governor', 'thief'], ...a },
    { id: 'B', hand: ['duchess', 'shaman'], ...b },
  ]);

const trio = (a = {}, b = {}, c = {}) =>
  game([
    { id: 'A', hand: ['governor', 'thief'], ...a },
    { id: 'B', hand: ['duchess', 'shaman'], ...b },
    { id: 'C', hand: ['assassin', 'duchess'], ...c },
  ]);

describe('Income', () => {
  it('gives 1 coin immediately, with no reaction window, and passes the turn', () => {
    const g = duo().declare('A', 'income');
    assert.equal(g.player('A').coins, 3);
    assert.equal(g.state.activePlayerId, 'B');
    assert.equal(g.state.turn, 2);
    assert.equal(g.phase.type, 'awaitingAction');
    assertInvariants(g.state);
  });

  it('is not offered at 11 coins', () => {
    const g = duo({ coins: 11 });
    g.reject({ type: 'declare', playerId: 'A', windowId: g.windowId, action: 'income' }, 'illegal_action');
  });
});

describe('Foreign Aid', () => {
  it('opens a block window and pays 2 when everyone passes', () => {
    const g = trio().declare('A', 'foreignAid');
    assert.equal(g.phase.type, 'blockWindow');
    g.pass('B', 'C');
    assert.equal(g.player('A').coins, 4);
    assert.equal(g.state.activePlayerId, 'B');
  });

  it('is capped by the coin limit and reports what was really gained', () => {
    const g = duo({ coins: 10 }).declare('A', 'foreignAid').passAll();
    assert.equal(g.player('A').coins, 11);
    assert.equal(g.eventsOfType('actionResolved')[0]?.amount, 1);
  });

  it('is not offered at 11 coins', () => {
    const g = duo({ coins: 11 });
    g.reject({ type: 'declare', playerId: 'A', windowId: g.windowId, action: 'foreignAid' }, 'illegal_action');
  });

  it('cannot be challenged because it makes no claim', () => {
    const g = duo().declare('A', 'foreignAid');
    g.reject({ type: 'challenge', playerId: 'B', windowId: g.windowId }, 'wrong_phase');
  });
});

describe('Tax (Governor)', () => {
  it('opens a challenge window, then pays 3 with no block window', () => {
    const g = trio().declare('A', 'tax');
    assert.equal(g.phase.type, 'challengeWindow');
    g.pass('B', 'C');
    assert.equal(g.player('A').coins, 5);
    assert.equal(g.phase.type, 'awaitingAction');
  });

  it('is capped at 11 coins', () => {
    const g = duo({ coins: 10 }).declare('A', 'tax').passAll();
    assert.equal(g.player('A').coins, 11);
  });

  it('is not offered at 11 coins', () => {
    const g = duo({ coins: 11 });
    g.reject({ type: 'declare', playerId: 'A', windowId: g.windowId, action: 'tax' }, 'illegal_action');
  });
});

describe('Coup', () => {
  it('costs 7, cannot be reacted to, and makes the target choose a card', () => {
    const g = trio({ coins: 7 }).declare('A', 'coup', 'B');
    assert.equal(g.player('A').coins, 0);
    assert.equal(g.phase.type, 'influenceLoss');
    g.lose('B', 'duchess');
    assert.deepEqual(g.player('B').hand, ['shaman']);
    assert.deepEqual(g.player('B').revealed, ['duchess']);
    assert.equal(g.state.activePlayerId, 'B');
    assertInvariants(g.state);
  });

  it('is rejected below 7 coins', () => {
    const g = duo({ coins: 6 });
    g.reject({ type: 'declare', playerId: 'A', windowId: g.windowId, action: 'coup', targetId: 'B' }, 'illegal_action');
  });

  it('needs a living target other than yourself', () => {
    const g = game([
      { id: 'A', hand: ['governor', 'thief'], coins: 7 },
      { id: 'B', hand: ['duchess', 'shaman'] },
      { id: 'C', hand: [], revealed: ['assassin', 'duchess'], coins: 0 },
    ]);
    const base = { type: 'declare', playerId: 'A', windowId: g.windowId, action: 'coup' } as const;
    g.reject(base, 'invalid_target');
    g.reject({ ...base, targetId: 'A' }, 'invalid_target');
    g.reject({ ...base, targetId: 'C' }, 'invalid_target');
    g.reject({ ...base, targetId: 'nobody' }, 'invalid_target');
  });

  it('eliminates a one-card target automatically and ends a two-player game', () => {
    const g = duo({ coins: 7 }, { hand: ['duchess'], revealed: ['shaman'] }).declare('A', 'coup', 'B');
    assert.equal(g.phase.type, 'gameOver');
    assert.equal(g.phase.type === 'gameOver' && g.phase.winnerId, 'A');
    assert.equal(g.player('B').coins, 0);
    assert.deepEqual(g.eventsOfType('playerEliminated').map((e) => e.playerId), ['B']);
    assertInvariants(g.state);
  });

  it('returns an eliminated player\'s coins to the treasury', () => {
    const g = trio({ coins: 7 }, { hand: ['duchess'], revealed: ['shaman'], coins: 5 }).declare('A', 'coup', 'B');
    assert.equal(g.player('B').coins, 0);
    assert.equal(g.phase.type, 'awaitingAction');
    assert.equal(g.state.activePlayerId, 'C', 'turn skips the eliminated player');
  });

  it('still asks for a choice when both cards are identical, so the pair is not revealed', () => {
    const g = game([
      { id: 'A', hand: ['governor', 'thief'], coins: 7 },
      { id: 'B', hand: ['duchess', 'duchess'] },
    ]).declare('A', 'coup', 'B');
    assert.equal(g.phase.type === 'influenceLoss' && g.phase.playerId, 'B');
    g.lose('B', 'duchess');
    assert.equal(g.phase.type, 'awaitingAction');
    assert.deepEqual(g.player('B').hand, ['duchess']);
  });
});

describe('Skip', () => {
  it('does nothing and passes the turn', () => {
    const g = duo().declare('A', 'skip');
    assert.equal(g.player('A').coins, 2);
    assert.equal(g.player('A').consecutiveSkips, 1);
    assert.equal(g.state.activePlayerId, 'B');
  });

  it('is limited to 2 turns in a row', () => {
    const g = duo({ skips: 2 });
    g.reject({ type: 'declare', playerId: 'A', windowId: g.windowId, action: 'skip' }, 'illegal_action');
  });

  it('is reset by any real action', () => {
    const g = duo({ skips: 2 }).declare('A', 'income');
    assert.equal(g.player('A').consecutiveSkips, 0);
  });

  it('lets a player at 11 coins pass the time', () => {
    const g = duo({ coins: 11 }).declare('A', 'skip');
    assert.equal(g.player('A').coins, 11);
  });
});

describe('Mandatory Coup', () => {
  it('applies only when every living player has 7+ coins', () => {
    const g = trio({ coins: 7 }, { coins: 8 }, { coins: 9 });
    assert.equal(getLegalMoves(g.state, 'A').mandatoryCoup, true);
    assert.deepEqual(getLegalMoves(g.state, 'A').declarations.map((d) => d.action), ['coup']);
    g.reject({ type: 'declare', playerId: 'A', windowId: g.windowId, action: 'income' }, 'illegal_action');
    g.reject({ type: 'declare', playerId: 'A', windowId: g.windowId, action: 'skip' }, 'illegal_action');
    g.reject({ type: 'declare', playerId: 'A', windowId: g.windowId, action: 'tax' }, 'illegal_action');
    g.reject({ type: 'declare', playerId: 'A', windowId: g.windowId, action: 'assassinate', targetId: 'B' }, 'illegal_action');
  });

  it('is not triggered when one living player has fewer than 7 coins', () => {
    const g = trio({ coins: 11 }, { coins: 10 }, { coins: 6 });
    assert.equal(getLegalMoves(g.state, 'A').mandatoryCoup, false);
    assert.ok(getLegalMoves(g.state, 'A').declarations.some((d) => d.action === 'skip'));
  });

  it('is not triggered by 10 or 11 coins alone', () => {
    const g = duo({ coins: 11 }, { coins: 2 });
    assert.equal(getLegalMoves(g.state, 'A').mandatoryCoup, false);
    assert.ok(getLegalMoves(g.state, 'A').declarations.some((d) => d.action === 'coup'));
  });

  it('ignores eliminated players when it evaluates the condition', () => {
    const g = game([
      { id: 'A', hand: ['governor', 'thief'], coins: 7 },
      { id: 'B', hand: ['duchess', 'shaman'], coins: 7 },
      { id: 'C', hand: [], revealed: ['assassin', 'duchess'], coins: 0 },
    ]);
    assert.equal(getLegalMoves(g.state, 'A').mandatoryCoup, true);
  });

  it('starts applying mid-game as soon as the last poor player is eliminated', () => {
    const g = game([
      { id: 'A', hand: ['governor', 'thief'], coins: 9 },
      { id: 'B', hand: ['duchess', 'shaman'], coins: 8 },
      { id: 'C', hand: ['assassin'], revealed: ['duchess'], coins: 1 },
    ]);
    assert.equal(getLegalMoves(g.state, 'A').mandatoryCoup, false);
    g.declare('A', 'coup', 'C');
    assert.equal(g.player('A').coins, 2);
    assert.equal(g.state.activePlayerId, 'B');
    assert.equal(getLegalMoves(g.state, 'B').mandatoryCoup, false, 'A dropped below 7 after paying');
  });
});

describe('Steal (Thief)', () => {
  it('takes 2 coins after the challenge and block windows pass', () => {
    const g = duo({}, { coins: 5 }).declare('A', 'steal', 'B');
    assert.equal(g.phase.type, 'challengeWindow');
    g.pass('B');
    assert.equal(g.phase.type, 'blockWindow');
    g.pass('B');
    assert.equal(g.player('A').coins, 4);
    assert.equal(g.player('B').coins, 3);
  });

  it('takes only what the target has', () => {
    const one = duo({}, { coins: 1 }).declare('A', 'steal', 'B').passAll();
    assert.equal(one.player('A').coins, 3);
    assert.equal(one.player('B').coins, 0);
  });

  it('is still a legal action against a target with 0 coins', () => {
    const g = duo({}, { coins: 0 }).declare('A', 'steal', 'B').passAll();
    assert.equal(g.player('A').coins, 2);
    assert.equal(g.eventsOfType('actionResolved')[0]?.amount, 0);
    assert.equal(g.state.activePlayerId, 'B');
  });

  it('never takes more than the thief can hold, and the target loses only what is received', () => {
    const g = duo({ coins: 10 }, { coins: 5 }).declare('A', 'steal', 'B').passAll();
    assert.equal(g.player('A').coins, 11);
    assert.equal(g.player('B').coins, 4);
  });

  it('is not offered to a thief who already holds 11 coins', () => {
    const g = duo({ coins: 11 }, { coins: 5 });
    g.reject({ type: 'declare', playerId: 'A', windowId: g.windowId, action: 'steal', targetId: 'B' }, 'illegal_action');
  });

  it('needs a target', () => {
    const g = duo();
    g.reject({ type: 'declare', playerId: 'A', windowId: g.windowId, action: 'steal' }, 'invalid_target');
  });

  it('rejects a target on an action that has none', () => {
    const g = duo();
    g.reject({ type: 'declare', playerId: 'A', windowId: g.windowId, action: 'income', targetId: 'B' }, 'invalid_target');
  });
});

describe('Exchange (Shaman)', () => {
  it('draws 2 cards, keeps as many as before and returns the rest to the deck', () => {
    const g = duo({}, {}).declare('A', 'exchange').pass('B');
    assert.equal(g.phase.type, 'exchange');
    const g2 = game(
      [
        { id: 'A', hand: ['governor', 'thief'] },
        { id: 'B', hand: ['duchess', 'shaman'] },
      ],
      { deckTop: ['assassin', 'duchess'] },
    )
      .declare('A', 'exchange')
      .pass('B');
    assert.deepEqual(g2.phase.type === 'exchange' && g2.phase.options, ['governor', 'thief', 'assassin', 'duchess']);
    assertInvariants(g2.state);
    const deckBefore = g2.state.deck.length;
    g2.exchange('A', ['assassin', 'governor']);
    assert.deepEqual([...g2.player('A').hand].sort(), ['assassin', 'governor']);
    assert.equal(g2.state.deck.length, deckBefore + 2);
    assert.equal(g2.state.activePlayerId, 'B');
    assertInvariants(g2.state);
  });

  it('with one card left draws 2 and keeps exactly 1', () => {
    const g = game(
      [
        { id: 'A', hand: ['shaman'], revealed: ['thief'] },
        { id: 'B', hand: ['duchess', 'governor'] },
      ],
      { deckTop: ['assassin', 'duchess'] },
    )
      .declare('A', 'exchange')
      .pass('B');
    assert.equal(g.phase.type === 'exchange' && g.phase.keep, 1);
    g.reject({ type: 'chooseExchange', playerId: 'A', windowId: g.windowId, keep: ['shaman', 'assassin'] }, 'invalid_choice');
    g.exchange('A', ['assassin']);
    assert.deepEqual(g.player('A').hand, ['assassin']);
    assertInvariants(g.state);
  });

  it('rejects keeping the wrong number of cards or cards that were not offered', () => {
    const g = game(
      [
        { id: 'A', hand: ['governor', 'thief'] },
        { id: 'B', hand: ['duchess', 'shaman'] },
      ],
      { deckTop: ['assassin', 'duchess'] },
    )
      .declare('A', 'exchange')
      .pass('B');
    const base = { type: 'chooseExchange', playerId: 'A', windowId: g.windowId } as const;
    g.reject({ ...base, keep: ['governor'] }, 'invalid_choice');
    g.reject({ ...base, keep: ['governor', 'thief', 'assassin'] }, 'invalid_choice');
    g.reject({ ...base, keep: ['shaman', 'governor'] }, 'invalid_choice');
    g.reject({ ...base, keep: ['governor', 'governor'] }, 'invalid_choice');
    g.reject({ ...base, playerId: 'B', keep: ['duchess', 'shaman'] }, 'not_eligible');
  });
});

describe('Turn order', () => {
  it('goes clockwise and skips eliminated players', () => {
    const g = game([
      { id: 'A', hand: ['governor', 'thief'] },
      { id: 'B', hand: [], revealed: ['duchess', 'shaman'], coins: 0 },
      { id: 'C', hand: ['assassin', 'duchess'] },
    ]);
    g.declare('A', 'income');
    assert.equal(g.state.activePlayerId, 'C');
    g.declare('C', 'income');
    assert.equal(g.state.activePlayerId, 'A');
  });

  it('only lets the active player declare', () => {
    const g = duo();
    g.reject({ type: 'declare', playerId: 'B', windowId: g.windowId, action: 'income' }, 'not_your_turn');
  });

  it('rejects unknown and eliminated players', () => {
    const g = game([
      { id: 'A', hand: ['governor', 'thief'] },
      { id: 'B', hand: ['duchess', 'shaman'] },
      { id: 'C', hand: [], revealed: ['assassin', 'duchess'], coins: 0 },
    ]);
    g.reject({ type: 'declare', playerId: 'Z', windowId: g.windowId, action: 'income' }, 'unknown_player');
    g.reject({ type: 'declare', playerId: 'C', windowId: g.windowId, action: 'income' }, 'player_eliminated');
  });

  it('rejects commands for a stale window', () => {
    const g = duo();
    g.reject({ type: 'declare', playerId: 'A', windowId: g.windowId + 5, action: 'income' }, 'stale_window');
  });

  it('rejects everything once the game is over', () => {
    const g = duo({ coins: 7 }, { hand: ['duchess'], revealed: ['shaman'] }).declare('A', 'coup', 'B');
    g.reject({ type: 'declare', playerId: 'A', windowId: 1, action: 'income' }, 'game_over');
    g.reject({ type: 'timeout', windowId: 1 }, 'game_over');
  });
});

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createGame, getLegalMoves, projectView, respondersNow } from '../src';
import { assertInvariants, game } from './helpers';

const four = () =>
  game(
    [
      { id: 'A', hand: ['thief', 'duchess'], coins: 5 },
      { id: 'B', hand: ['shaman', 'assassin'], coins: 5 },
      { id: 'C', hand: ['governor', 'duchess'] },
      { id: 'D', hand: ['thief', 'shaman'] },
    ],
    { sequential: true },
  );

function waiting(g: ReturnType<typeof four>): string[] {
  const phase = g.phase;
  if (phase.type !== 'challengeWindow' && phase.type !== 'blockWindow' && phase.type !== 'blockChallengeWindow') {
    return [];
  }
  return respondersNow(g.state.players, phase, true);
}

describe('Sequential reactions', () => {
  it('asks one player at a time, clockwise from the actor', () => {
    const g = four().declare('A', 'tax');
    assert.deepEqual(waiting(g), ['B']);
    g.pass('B');
    assert.deepEqual(waiting(g), ['C']);
    g.pass('C');
    assert.deepEqual(waiting(g), ['D']);
    g.pass('D');
    assert.equal(g.player('A').coins, 8);
    assert.equal(g.phase.type, 'awaitingAction');
  });

  it('starts after the actor, wrapping around the table', () => {
    const g = four();
    g.state.activePlayerId = 'C';
    g.declare('C', 'tax');
    assert.deepEqual(waiting(g), ['D']);
    g.pass('D');
    assert.deepEqual(waiting(g), ['A']);
  });

  it('rejects players who are not being asked yet', () => {
    const g = four().declare('A', 'tax');
    g.reject({ type: 'challenge', playerId: 'C', windowId: g.windowId }, 'not_your_turn');
    g.reject({ type: 'pass', playerId: 'D', windowId: g.windowId }, 'not_your_turn');
    assert.equal(getLegalMoves(g.state, 'C').react, null);
    assert.ok(getLegalMoves(g.state, 'B').react?.canChallenge);
  });

  it('a block challenge window starts after the blocker', () => {
    const g = four().declare('A', 'foreignAid');
    g.pass('B');
    g.block('C', 'governor');
    assert.deepEqual(waiting(g), ['D']);
    g.pass('D');
    assert.deepEqual(waiting(g), ['A']);
    g.challenge('A');
    assert.equal(g.eventsOfType('challenged')[0]?.context, 'block');
    assertInvariants(g.state);
  });

  it('a timeout passes only the player being asked and moves on', () => {
    const g = four().declare('A', 'tax');
    const windowId = g.windowId;
    g.timeout();
    assert.deepEqual(
      g.eventsOfType('passed').map((e) => [e.playerId, e.auto]),
      [['B', true]],
    );
    assert.equal(g.windowId, windowId, 'the same window stays open');
    assert.deepEqual(waiting(g), ['C']);
    g.timeout().timeout();
    assert.equal(g.player('A').coins, 8);
  });

  it('skips a player who forfeits while being asked', () => {
    const g = four().declare('A', 'tax');
    g.forfeit('B');
    assert.deepEqual(waiting(g), ['C']);
    assertInvariants(g.state);
  });

  it('is off by default and carried into the view when on', () => {
    const plain = createGame({ playerIds: ['x', 'y'], seed: 1 });
    assert.equal(plain.state.sequentialReactions, false);
    const seq = createGame({ playerIds: ['x', 'y'], seed: 1, sequentialReactions: true });
    assert.equal(projectView(seq.state, 'x').sequentialReactions, true);
  });
});

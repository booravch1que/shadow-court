import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ROLES, projectView } from '../src';
import { game } from './helpers';

const ROLE_WORDS = [...ROLES];

function allKeys(value: unknown, out = new Set<string>()): Set<string> {
  if (Array.isArray(value)) value.forEach((v) => allKeys(v, out));
  else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      out.add(k);
      allKeys(v, out);
    }
  }
  return out;
}

const duo = () =>
  game(
    [
      { id: 'A', hand: ['governor', 'thief'] },
      { id: 'B', hand: ['duchess', 'shaman'] },
    ],
    { deckTop: ['assassin', 'duchess'] },
  );

describe('projectView', () => {
  it('gives a player their own hand and legal moves', () => {
    const view = projectView(duo().state, 'A');
    assert.deepEqual(view.me?.hand, ['governor', 'thief']);
    assert.ok(view.me?.moves.declarations.some((d) => d.action === 'tax'));
    assert.equal(view.viewerId, 'A');
  });

  it('never reveals other players\' cards, the deck or the PRNG state', () => {
    const view = projectView(duo().state, 'B');
    const publicPart = { ...view, me: null };
    const keys = allKeys(publicPart);
    for (const forbidden of ['hand', 'deck', 'rng', 'options']) {
      assert.ok(!keys.has(forbidden), `public view must not contain "${forbidden}"`);
    }
    const text = JSON.stringify(publicPart);
    for (const role of ROLE_WORDS) {
      assert.ok(!text.includes(role), `no role name may leak while nothing is revealed (found ${role})`);
    }
    assert.equal(view.deckCount, 11, '15 cards minus 4 dealt');
    assert.equal(view.players.find((p) => p.id === 'A')?.cardCount, 2);
  });

  it('spectators get the public view only', () => {
    const view = projectView(duo().state, null);
    assert.equal(view.me, null);
    assert.equal(view.viewerId, null);
    assert.equal(JSON.stringify(view).includes('governor'), false);
  });

  it('unknown viewers are treated as spectators', () => {
    assert.equal(projectView(duo().state, 'nobody').me, null);
  });

  it('shows revealed cards to everyone', () => {
    const g = game([
      { id: 'A', hand: ['governor'], revealed: ['thief'] },
      { id: 'B', hand: ['duchess', 'shaman'] },
    ]);
    assert.deepEqual(projectView(g.state, 'B').players[0]?.revealed, ['thief']);
    assert.equal(projectView(g.state, null).players[0]?.alive, true);
  });

  it('keeps exchange options private to the player exchanging', () => {
    const g = duo().declare('A', 'exchange').pass('B');
    const mine = projectView(g.state, 'A');
    assert.deepEqual(mine.me?.moves.chooseExchange?.options, ['governor', 'thief', 'assassin', 'duchess']);

    const theirs = projectView(g.state, 'B');
    assert.equal(theirs.me?.moves.chooseExchange, null);
    const text = JSON.stringify({ ...theirs, me: null });
    for (const role of ROLE_WORDS) assert.ok(!text.includes(role), `exchange leaked ${role}`);
    assert.deepEqual(theirs.phase, { type: 'exchange', windowId: g.windowId, playerId: 'A' });

    const spectator = projectView(g.state, null);
    assert.equal(spectator.me, null);
    assert.ok(!JSON.stringify(spectator).includes('assassin'));
  });

  it('is a copy: changing the view cannot change the game state', () => {
    const g = duo().declare('A', 'tax');
    const before = JSON.stringify(g.state);
    const view = projectView(g.state, 'A');
    view.me?.hand.push('duchess');
    view.players[0]?.revealed.push('duchess');
    if (view.phase.type === 'challengeWindow') view.phase.passed.push('B');
    assert.equal(JSON.stringify(g.state), before);
  });

  it('flags a mandatory Coup only on the active player\'s awaitingAction phase', () => {
    const g = game([
      { id: 'A', hand: ['governor', 'thief'], coins: 7 },
      { id: 'B', hand: ['duchess', 'shaman'], coins: 7 },
    ]);
    assert.equal(projectView(g.state, 'A').mandatoryCoup, true);
    assert.equal(projectView(g.state, 'B').me?.moves.mandatoryCoup, false, 'not B\'s turn');
  });

  it('tells each player what they may do in a reaction window', () => {
    const g = game([
      { id: 'A', hand: ['governor', 'thief'] },
      { id: 'B', hand: ['duchess', 'shaman'] },
      { id: 'C', hand: ['assassin', 'duchess'] },
    ]).declare('A', 'steal', 'B');
    assert.deepEqual(projectView(g.state, 'C').me?.moves.react, { canChallenge: true, blockRoles: [], canPass: true });
    assert.equal(projectView(g.state, 'A').me?.moves.react, null, 'the actor has nothing to answer');
    g.pass('B', 'C');
    assert.equal(g.phase.type, 'blockWindow');
    assert.deepEqual(projectView(g.state, 'C').me?.moves.react, {
      canChallenge: false,
      blockRoles: ['thief', 'shaman'],
      canPass: true,
    });
  });
});

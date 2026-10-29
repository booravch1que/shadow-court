import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { projectView } from '../src';
import { assertInvariants, game } from './helpers';

const unknown = (count: number) => Array.from({ length: count }, () => null);

const duo = () =>
  game(
    [
      { id: 'A', hand: ['governor', 'thief'] },
      { id: 'B', hand: ['duchess', 'shaman'] },
    ],
    { deckTop: ['assassin', 'duchess', 'shaman', 'governor'] },
  );

describe('deck memory', () => {
  it('starts with nothing known', () => {
    const g = duo();
    for (const viewer of ['A', 'B', null]) {
      assert.deepEqual(projectView(g.state, viewer).deckMemory, unknown(11));
    }
  });

  it('shows the Shaman, and only the Shaman, the cards they put under the deck', () => {
    const g = duo().declare('A', 'exchange').pass('B');
    g.exchange('A', ['assassin', 'governor']);
    assertInvariants(g.state);
    assert.deepEqual(projectView(g.state, 'A').deckMemory, [...unknown(9), 'thief', 'duchess']);
    assert.deepEqual(projectView(g.state, 'B').deckMemory, unknown(11));
    assert.deepEqual(projectView(g.state, null).deckMemory, unknown(11));
  });

  it('keeps earlier returns as they move up: a second exchange shows four cards', () => {
    const g = duo().declare('A', 'exchange').pass('B');
    g.exchange('A', ['assassin', 'governor']);
    g.declare('B', 'income');
    g.declare('A', 'exchange').pass('B');
    g.exchange('A', ['shaman', 'governor']);
    assertInvariants(g.state);
    assert.deepEqual(projectView(g.state, 'A').deckMemory, [...unknown(7), 'thief', 'duchess', 'assassin', 'governor']);
    assert.deepEqual(projectView(g.state, 'B').deckMemory, unknown(11));
  });

  it('shows everyone a card proven in a failed challenge, at the bottom', () => {
    const g = duo().declare('A', 'tax').challenge('B');
    g.lose('B', 'shaman');
    assertInvariants(g.state);
    for (const viewer of ['A', 'B', null]) {
      assert.deepEqual(projectView(g.state, viewer).deckMemory, [...unknown(10), 'governor']);
    }
  });

  it('forgets a known card once it is drawn off the top', () => {
    const g = duo();
    g.state.deckSeen = g.state.deck.map((_, i) => (i === 0 ? 'A' : null));
    assert.deepEqual(projectView(g.state, 'A').deckMemory, ['assassin', ...unknown(10)]);
    g.declare('A', 'income');
    g.declare('B', 'exchange').pass('A');
    g.exchange('B', ['assassin', 'duchess']);
    assertInvariants(g.state);
    assert.deepEqual(projectView(g.state, 'A').deckMemory, unknown(11));
  });
});

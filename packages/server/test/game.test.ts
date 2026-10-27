import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  Client,
  activeClient,
  assertContiguousEvents,
  assertNoLeaks,
  legalCommands,
  mulberry,
  playToEnd,
  setup,
} from './harness';

describe('complete games over the message layer', () => {
  for (const players of [2, 3, 4, 5, 6]) {
    it(`${players} bots play several games to the end, in sync, without leaking anything`, () => {
      for (let seed = 1; seed <= 6; seed++) {
        const { clients, sched } = setup(players, { preset: 'standard', seed: seed * 101 + players });
        const steps = playToEnd(clients, seed);
        assert.ok(steps > 3);

        const winners = new Set<string>();
        for (const c of clients) {
          const phase = c.view.phase;
          assert.equal(phase.type, 'gameOver');
          if (phase.type === 'gameOver') winners.add(phase.winnerId);
          assert.equal(c.room.status, 'ended');
          assertContiguousEvents(c);
          assertNoLeaks(c, clients);
          assert.equal(c.events.filter((e) => e.event.type === 'gameOver').length, 1);
        }
        assert.equal(winners.size, 1, 'everybody agrees on the winner');
        const winner = [...winners][0];
        assert.equal(clients[0]?.view.players.filter((p) => p.alive).map((p) => p.id).join(), winner);
        assert.equal(sched.pending, 0, 'no timer may outlive the game');
      }
    });
  }

  it('every client receives the same public events in the same order', () => {
    const { clients } = setup(4, { preset: 'none', seed: 9 });
    playToEnd(clients, 9);
    const first = JSON.stringify(clients[0]?.events);
    for (const c of clients) assert.equal(JSON.stringify(c.events), first);
  });

  it('each view carries the sequence number of the latest event it includes', () => {
    const { clients } = setup(3, { preset: 'none', seed: 4 });
    for (let i = 0; i < 12; i++) {
      const mover = clients.find((c) => legalCommands(c).length > 0);
      const cmd = mover && legalCommands(mover)[0];
      if (mover && cmd) mover.command(cmd);
      for (const c of clients) {
        assert.equal(c.last('game:view')?.seq, c.events.at(-1)?.seq);
      }
    }
  });
});

describe('server-authoritative rules', () => {
  it('first valid response wins: a second challenge for the same window is stale', () => {
    const { clients } = setup(3, { preset: 'none', seed: 3 });
    const actor = activeClient(clients);
    const [x, y] = clients.filter((c) => c !== actor) as [Client, Client];
    const windowId = actor.windowId;
    actor.command({ type: 'declare', windowId, action: 'tax' });

    const challengeWindow = x.windowId;
    x.command({ type: 'challenge', windowId: challengeWindow });
    assert.equal(x.errors.length, 0);
    y.command({ type: 'challenge', windowId: challengeWindow });
    assert.equal(y.lastError?.code, 'stale_window');
    assert.equal(x.events.filter((e) => e.event.type === 'challenged').length, 1);
  });

  it('a pass cannot be taken back or repeated', () => {
    const { clients } = setup(3, { preset: 'none', seed: 3 });
    const actor = activeClient(clients);
    const [x] = clients.filter((c) => c !== actor) as [Client];
    actor.command({ type: 'declare', windowId: actor.windowId, action: 'tax' });
    const windowId = x.windowId;
    x.command({ type: 'pass', windowId });
    x.command({ type: 'challenge', windowId });
    assert.equal(x.lastError?.code, 'already_responded');
  });

  it('identity comes from the connection: a client cannot act for another player', () => {
    const { clients } = setup(3, { preset: 'none', seed: 5 });
    const actor = activeClient(clients);
    const [thief] = clients.filter((c) => c !== actor) as [Client];
    const windowId = actor.windowId;

    thief.command({ type: 'declare', windowId, action: 'income' });
    assert.equal(thief.lastError?.code, 'not_your_turn');

    // A hand-crafted message that names the active player is treated like any other:
    // the extra field is dropped and the request is judged as coming from the sender.
    thief.raw('game:command', { command: { type: 'declare', windowId, action: 'income', playerId: actor.selfId } });
    assert.equal(thief.errors.at(-1)?.code, 'not_your_turn');
    assert.equal(actor.view.turn, 1, 'nothing happened');
  });

  it('rejects stale windows, illegal actions and bad targets with the engine\'s reason', () => {
    const { clients } = setup(3, { preset: 'none', seed: 5 });
    const actor = activeClient(clients);
    const windowId = actor.windowId;
    actor.command({ type: 'declare', windowId: windowId - 1, action: 'income' });
    assert.equal(actor.lastError?.code, 'stale_window');
    actor.command({ type: 'declare', windowId, action: 'coup', targetId: clients.find((c) => c !== actor)?.selfId });
    assert.equal(actor.lastError?.code, 'illegal_action', 'only 2 coins');
    actor.command({ type: 'declare', windowId, action: 'steal', targetId: actor.selfId });
    assert.equal(actor.lastError?.code, 'invalid_target');
    actor.command({ type: 'chooseInfluence', windowId, role: 'thief' });
    assert.equal(actor.lastError?.code, 'wrong_phase', 'nobody has to lose influence right now');
    assert.equal(actor.view.turn, 1);
  });

  it('players never see another player\'s hand, even right after dealing', () => {
    const { clients } = setup(5, { preset: 'none', seed: 77 });
    for (const c of clients) {
      assertNoLeaks(c, clients);
      const mine = c.view.me?.hand ?? [];
      assert.equal(mine.length, 2);
      assert.ok(c.view.players.every((p) => p.cardCount === 2 && p.revealed.length === 0));
    }
  });

  it('a game picks different decks for different seeds but is replayable for the same one', () => {
    const run = (seed: number) => {
      const { clients } = setup(3, { preset: 'none', seed });
      return clients.map((c) => c.view.me?.hand.join('+')).join('|') + clients.map((c) => c.view.activePlayerId).join();
    };
    assert.equal(run(11), run(11));
    assert.notEqual(run(11), run(12));
  });

  it('bots that only use offered moves are never refused (offered = allowed)', () => {
    const rand = mulberry(2024);
    for (let seed = 1; seed <= 5; seed++) {
      const { clients } = setup(4, { preset: 'none', seed });
      for (let step = 0; step < 400 && clients[0]?.view.phase.type !== 'gameOver'; step++) {
        const all = clients.flatMap((c) => legalCommands(c).map((command) => ({ c, command })));
        const pick = all[Math.floor(rand() * all.length)];
        assert.ok(pick);
        pick.c.command(pick.command);
        assert.equal(pick.c.errors.length, 0, `rejected: ${JSON.stringify(pick.command)} ${pick.c.lastError?.code}`);
      }
    }
  });
});

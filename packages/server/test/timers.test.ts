import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Client, activeClient, legalCommands, mulberry, setup } from './harness';

const SECOND = 1000;

describe('turn timer', () => {
  it('standard preset: 60 s, then the turn is skipped for the player', () => {
    const { clients, sched } = setup(2);
    const start = sched.now();
    assert.equal(clients[0]?.deadline, start + 60 * SECOND, 'clients are told the absolute deadline');
    const first = activeClient(clients).selfId;

    sched.advance(60 * SECOND - 1);
    assert.equal(clients[0]?.view.turn, 1);
    sched.advance(1);
    assert.equal(clients[0]?.view.turn, 2);
    assert.notEqual(clients[0]?.view.activePlayerId, first);
    assert.ok(clients[0]?.events.some((e) => e.event.type === 'timedOut' && e.event.during === 'turn'));
    assert.ok(clients[0]?.events.some((e) => e.event.type === 'turnSkipped'));
    assert.equal(clients[0]?.deadline, sched.now() + 60 * SECOND, 'the next turn has a fresh deadline');
  });

  it('fast is half as long and relaxed twice as long', () => {
    const fast = setup(2, { preset: 'fast' });
    assert.equal(fast.clients[0]?.deadline, fast.sched.now() + 30 * SECOND);
    const relaxed = setup(2, { preset: 'relaxed' });
    assert.equal(relaxed.clients[0]?.deadline, relaxed.sched.now() + 120 * SECOND);
  });

  it('"no timers" never forces anything and shows no deadline', () => {
    const { clients, sched } = setup(2, { preset: 'none' });
    assert.equal(clients[0]?.deadline, null);
    assert.equal(sched.pending, 0);
    sched.advance(10 * 60 * 60 * SECOND);
    assert.equal(clients[0]?.view.turn, 1);
  });

  it('acting in time replaces the timer; the old deadline does nothing', () => {
    const { clients, sched } = setup(2);
    sched.advance(40 * SECOND);
    const actor = activeClient(clients);
    actor.command({ type: 'declare', windowId: actor.windowId, action: 'income' });
    assert.equal(clients[0]?.view.turn, 2);
    assert.equal(clients[0]?.deadline, sched.now() + 60 * SECOND);

    sched.advance(30 * SECOND); // the first deadline (20 s away) would have passed by now
    assert.equal(clients[0]?.view.turn, 2, 'the new player still has time');
    assert.equal(sched.pending, 1);
  });

  it('keeps running when the player on turn is disconnected', () => {
    const { clients, sched } = setup(2);
    const actor = activeClient(clients);
    actor.disconnect();
    const other = clients.find((c) => c !== actor) as Client;
    sched.advance(60 * SECOND);
    assert.equal(other.view.turn, 2, 'the table does not freeze');
  });
});

describe('reaction and card timers', () => {
  it('a reaction window lasts 20 s, then everyone who has not answered passes', () => {
    const { clients, sched } = setup(3);
    const actor = activeClient(clients);
    actor.command({ type: 'declare', windowId: actor.windowId, action: 'tax' });
    assert.equal(actor.view.phase.type, 'challengeWindow');
    assert.equal(actor.deadline, sched.now() + 20 * SECOND);

    const [first] = clients.filter((c) => c !== actor) as [Client];
    first.command({ type: 'pass', windowId: first.windowId });
    sched.advance(20 * SECOND);

    const events = actor.events.map((e) => e.event);
    assert.equal(events.filter((e) => e.type === 'passed' && e.auto).length, 1, 'only the silent player is auto-passed');
    assert.ok(events.some((e) => e.type === 'actionResolved' && e.action === 'tax'));
    assert.equal(actor.view.players.find((p) => p.id === actor.selfId)?.coins, 5);
  });

  it('choosing a card to lose gets 30 s, then a random card is discarded', () => {
    // Play random legal moves (without letting time pass) until somebody must choose a card.
    const rand = mulberry(99);
    for (let attempt = 1; attempt <= 40; attempt++) {
      const { clients, sched } = setup(3, { seed: attempt, preset: 'standard' });
      for (let step = 0; step < 300; step++) {
        const phase = clients[0]?.view.phase;
        if (!phase || phase.type === 'gameOver') break;
        if (phase.type === 'influenceLoss') {
          const loser = clients.find((c) => c.selfId === phase.playerId) as Client;
          const before = loser.view.players.find((p) => p.id === loser.selfId)?.cardCount;
          assert.equal(loser.deadline, sched.now() + 30 * SECOND);
          sched.advance(30 * SECOND);
          assert.equal(loser.view.players.find((p) => p.id === loser.selfId)?.cardCount, (before ?? 0) - 1);
          assert.ok(loser.events.some((e) => e.event.type === 'timedOut' && e.event.during === 'influence'));
          return;
        }
        const all = clients.flatMap((c) => legalCommands(c).map((command) => ({ c, command })));
        const pick = all[Math.floor(rand() * all.length)];
        if (!pick) break;
        pick.c.command(pick.command);
      }
    }
    assert.fail('never reached a card choice');
  });
});

describe('away players', () => {
  const awayOf = (c: Client, who: Client) => c.room.participants.find((p) => p.id === who.selfId)?.away;

  it('three missed timers in a row mark a player Away; their windows shrink to 5 s', () => {
    const { clients, sched } = setup(2);
    const [a, b] = clients as [Client, Client];

    for (let i = 0; i < 40 && !(awayOf(a, a) && awayOf(a, b)); i++) sched.advance(60 * SECOND);
    assert.equal(awayOf(a, a), true);
    assert.equal(awayOf(a, b), true);
    assert.equal(a.room.participants.every((p) => p.away), true, 'everyone is told');

    // Everyone being waited for is Away, so the clock is short.
    assert.equal(a.deadline, sched.now() + 5 * SECOND);
  });

  it('acting clears the Away mark and the missed-timer count', () => {
    const { clients, sched } = setup(2);
    const [a, b] = clients as [Client, Client];
    for (let i = 0; i < 40 && !(awayOf(a, a) && awayOf(a, b)); i++) sched.advance(60 * SECOND);

    const actor = activeClient(clients);
    actor.command({ type: 'declare', windowId: actor.windowId, action: 'income' });
    assert.equal(actor.errors.length, 0);
    assert.equal(awayOf(a, actor), false);
    const other = clients.find((c) => c !== actor) as Client;
    assert.equal(awayOf(a, other), true);

    // One miss after returning is just one miss, not an instant Away.
    sched.advance(60 * SECOND);
    assert.equal(awayOf(a, actor), false);
  });

  it('only an Away or disconnected player can be removed; the host can then do it', () => {
    const { clients, sched } = setup(3);
    const host = clients[0] as Client;
    const quiet = clients.find((c) => c !== host && !c.isActive) as Client;
    host.send('room:kick', { playerId: quiet.selfId });
    assert.equal(host.lastError?.code, 'not_allowed');

    // Keep the others playing while one stays silent.
    for (let i = 0; i < 80 && !awayOf(host, quiet); i++) {
      for (const c of clients) {
        if (c === quiet) continue;
        const mine = legalCommands(c)[0];
        if (mine && c.view.phase.type !== 'gameOver') c.command(mine);
      }
      sched.advance(25 * SECOND);
    }
    assert.equal(awayOf(host, quiet), true);
    host.send('room:kick', { playerId: quiet.selfId });
    assert.deepEqual(quiet.last('room:closed'), { reason: 'kicked' });
    assert.equal(host.view.players.find((p) => p.id === quiet.selfId)?.alive, false);
  });

  it('no timers means nobody is ever marked Away', () => {
    const { clients, sched } = setup(2, { preset: 'none' });
    sched.advance(24 * 60 * 60 * SECOND);
    assert.equal(clients[0]?.room.participants.some((p) => p.away), false);
  });
});

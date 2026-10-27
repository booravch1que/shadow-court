import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  Client,
  activeClient,
  assertNoLeaks,
  byId,
  legalCommands,
  playToEnd,
  setup,
} from './harness';

const TWO_HOURS = 2 * 60 * 60 * 1000;

describe('reconnecting', () => {
  it('a refreshed page gets the same seat, hand and up-to-date table back', () => {
    const { server, clients, code } = setup(3, { preset: 'none', seed: 21 });
    const target = clients.find((c) => !c.isActive && c !== clients[0]) as Client;
    const handBefore = [...(target.view.me?.hand ?? [])];
    const { selfId, token } = target.joined;

    target.disconnect();
    const others = clients.filter((c) => c !== target);
    assert.equal(others[0]?.room.participants.find((p) => p.id === selfId)?.connected, false);

    const mover = activeClient(others);
    mover.command({ type: 'declare', windowId: mover.windowId, action: 'income' });

    const fresh = new Client(server).send('room:rejoin', { code, token });
    assert.equal(fresh.joined.selfId, selfId);
    assert.equal(fresh.joined.kind, 'player');
    assert.deepEqual(fresh.view.me?.hand, handBefore);
    assert.equal(fresh.view.turn, 2, 'sees what happened while away');
    assert.equal(others[0]?.room.participants.find((p) => p.id === selfId)?.connected, true);

    // The returning player can act again once it is their turn.
    const everyone = [...others, fresh];
    for (let i = 0; i < 4; i++) {
      const turnOf = activeClient(everyone);
      turnOf.command({ type: 'declare', windowId: turnOf.windowId, action: 'income' });
      if (turnOf === fresh) break;
    }
    assert.equal(fresh.errors.length, 0);
    assert.ok(fresh.view.turn >= 3);
    assertNoLeaks(fresh, clients);
  });

  it('a wrong token or room is refused', () => {
    const { server, code } = setup(2, { start: false });
    const c = new Client(server);
    c.send('room:rejoin', { code, token: 'not-a-real-token' });
    assert.equal(c.lastError?.code, 'bad_token');
    c.send('room:rejoin', { code: 'ZZZZZ', token: 'x' });
    assert.equal(c.lastError?.code, 'room_not_found');
  });

  it('rejoining on a second connection replaces the first, which is told and cut off', () => {
    const { server, clients, code } = setup(2, { preset: 'none' });
    const old = clients[1] as Client;
    const fresh = new Client(server).send('room:rejoin', { code, token: old.token });
    assert.deepEqual(old.last('room:closed'), { reason: 'replaced' });
    old.send('emote:send', { emote: '👍' });
    assert.equal(old.lastError?.code, 'not_in_room');
    assert.equal(fresh.joined.selfId, old.selfId);
    // The stale connection closing later must not unseat the new one.
    old.disconnect();
    assert.equal(clients[0]?.room.participants.find((p) => p.id === old.selfId)?.connected, true);
  });

  it('a player cannot hold two rooms with one connection', () => {
    const { server, clients } = setup(2, { start: false });
    const other = new Client(server).send('room:create', { nickname: 'Solo' });
    other.send('room:rejoin', { code: clients[0]?.room.code ?? '', token: clients[0]?.token ?? '' });
    assert.equal(other.lastError?.code, 'already_in_room');
  });
});

describe('host', () => {
  it('passes to the longest-connected player when the host drops, and is not taken back', () => {
    const { server, clients, code } = setup(3, { start: false });
    const [host, second, third] = clients as [Client, Client, Client];
    host.disconnect();
    assert.equal(second.room.hostId, second.selfId);
    second.disconnect();
    assert.equal(third.room.hostId, third.selfId);

    const back = new Client(server).send('room:rejoin', { code, token: host.token });
    assert.equal(back.room.hostId, third.selfId, 'returning does not reclaim host');
    back.send('lobby:start');
    assert.equal(back.lastError?.code, 'not_host');
    third.send('lobby:start');
    assert.equal(third.room.status, 'playing', 'the new host starts with the two connected players');
  });

  it('works mid-game too, and the game carries on', () => {
    const { clients } = setup(3, { preset: 'none' });
    const [host, second] = clients as [Client, Client];
    host.disconnect();
    assert.equal(second.room.hostId, second.selfId);
    assert.equal(second.room.status, 'playing');
  });

  it('keeps the old host when nobody else is connected', () => {
    const { clients } = setup(2, { start: false });
    const [host, guest] = clients as [Client, Client];
    guest.disconnect();
    host.disconnect();
    assert.equal(host.room.hostId, host.selfId);
  });
});

describe('removing and leaving mid-game', () => {
  it('the host can remove a disconnected player: they are eliminated and lose their seat', () => {
    const { server, clients, code } = setup(3, { preset: 'none', seed: 8 });
    const [host, , victim] = clients as [Client, Client, Client];
    const victimId = victim.selfId;
    victim.disconnect();
    host.send('room:kick', { playerId: victimId });
    assert.equal(host.errors.length, 0);
    assert.equal(host.view.players.find((p) => p.id === victimId)?.alive, false);
    assert.equal(host.view.players.find((p) => p.id === victimId)?.coins, 0);
    assert.ok(!host.room.participants.some((p) => p.id === victimId));

    const back = new Client(server).send('room:rejoin', { code, token: victim.token });
    assert.equal(back.lastError?.code, 'bad_token');
  });

  it('a connected, active player cannot be removed during a game', () => {
    const { clients } = setup(3, { preset: 'none' });
    const [host, , other] = clients as [Client, Client, Client];
    host.send('room:kick', { playerId: other.selfId });
    assert.equal(host.lastError?.code, 'not_allowed');
    assert.equal(host.view.players.every((p) => p.alive), true);
  });

  it('only the host may remove anyone', () => {
    const { clients } = setup(3, { preset: 'none' });
    const [, a, b] = clients as [Client, Client, Client];
    b.disconnect();
    a.send('room:kick', { playerId: b.selfId });
    assert.equal(a.lastError?.code, 'not_host');
  });

  it('leaving forfeits: in a two-player game the other player wins', () => {
    const { clients } = setup(2, { preset: 'none' });
    const [host, guest] = clients as [Client, Client];
    guest.send('room:leave');
    const phase = host.view.phase;
    assert.equal(phase.type === 'gameOver' && phase.winnerId, host.selfId);
    assert.equal(host.room.status, 'ended');
    assert.equal(host.room.participants.length, 1);
  });

  it('a leaver in a bigger game does not stall it, even when it was their turn', () => {
    const { clients } = setup(4, { preset: 'none', seed: 13 });
    const actor = activeClient(clients);
    actor.send('room:leave');
    const rest = clients.filter((c) => c !== actor);
    assert.equal(rest[0]?.view.players.filter((p) => p.alive).length, 3);
    assert.notEqual(rest[0]?.view.activePlayerId, actor.selfId);
    playToEnd(rest, 5);
    assert.equal(rest[0]?.room.status, 'ended');
  });
});

describe('spectators', () => {
  it('can join mid-game, see only public information, and cannot act', () => {
    const { server, clients, code } = setup(3, { preset: 'none', seed: 2 });
    const watcher = new Client(server).send('room:join', { code, nickname: 'Watcher' });
    assert.equal(watcher.joined.kind, 'spectator');
    assert.equal(watcher.view.me, null);
    assert.equal(watcher.view.viewerId, null);
    assert.equal(watcher.view.players.length, 3);

    const actor = activeClient(clients);
    watcher.command({ type: 'declare', windowId: actor.windowId, action: 'income' });
    assert.equal(watcher.lastError?.code, 'not_allowed');
    watcher.send('room:kick', { playerId: actor.selfId });
    assert.equal(watcher.lastError?.code, 'not_host');

    actor.command({ type: 'declare', windowId: actor.windowId, action: 'income' });
    assert.equal(watcher.view.turn, 2, 'follows the game live');
    playToEnd(clients, 3);
    assert.equal(watcher.view.phase.type, 'gameOver');
    assertNoLeaks(watcher, [...clients, watcher]);
  });

  it('a spectator who leaves or drops does not disturb the game', () => {
    const { server, clients, code } = setup(2, { preset: 'none' });
    const watcher = new Client(server).send('room:join', { code, nickname: 'Watcher' });
    watcher.send('room:leave');
    assert.equal(clients[0]?.room.participants.length, 2);
    assert.equal(clients[0]?.view.players.every((p) => p.alive), true);
  });

  it('eliminated players keep watching and receive only public data', () => {
    const { clients } = setup(3, { preset: 'none', seed: 31 });
    for (let i = 0; i < 600 && clients.every((c) => c.view.players.find((p) => p.id === c.selfId)?.alive); i++) {
      const all = clients.flatMap((c) => legalCommands(c).map((command) => ({ c, command })));
      const pick = all[i % all.length];
      if (!pick) break;
      pick.c.command(pick.command);
    }
    const dead = clients.find((c) => !c.view.players.find((p) => p.id === c.selfId)?.alive);
    if (dead) {
      assert.deepEqual(dead.view.me?.hand, []);
      assertNoLeaks(dead, clients);
    }
  });
});

describe('room lifetime', () => {
  it('is deleted two hours after the last person disconnects', () => {
    const { server, sched, clients, code } = setup(2, { start: false });
    clients.forEach((c) => c.disconnect());
    sched.advance(TWO_HOURS - 1_000);
    assert.equal(server.roomCount, 1);
    sched.advance(1_000);
    assert.equal(server.roomCount, 0);
    const late = new Client(server).send('room:rejoin', { code, token: clients[0]?.token ?? 'x' });
    assert.equal(late.lastError?.code, 'room_not_found');
  });

  it('survives if somebody comes back in time, and the countdown restarts when they leave again', () => {
    const { server, sched, clients, code } = setup(2, { start: false });
    clients.forEach((c) => c.disconnect());
    sched.advance(TWO_HOURS - 60_000);
    const back = new Client(server).send('room:rejoin', { code, token: clients[0]?.token ?? '' });
    assert.equal(back.lastError, undefined);
    sched.advance(TWO_HOURS);
    assert.equal(server.roomCount, 1, 'someone is connected, so it stays');
    back.disconnect();
    sched.advance(TWO_HOURS - 1);
    assert.equal(server.roomCount, 1);
    sched.advance(1);
    assert.equal(server.roomCount, 0);
  });

  it('a room that is deleted stops all of its timers', () => {
    const { server, sched, clients } = setup(2, { preset: 'standard' });
    clients.forEach((c) => c.disconnect());
    sched.advance(TWO_HOURS + 1_000);
    assert.equal(server.roomCount, 0);
    assert.equal(sched.pending, 0);
  });
});

describe('play again', () => {
  const finished = (players: number, seed = 5) => {
    const s = setup(players, { preset: 'none', seed });
    playToEnd(s.clients, seed);
    return s;
  };

  it('is refused while a game is running', () => {
    const { clients } = setup(2, { preset: 'none' });
    clients[0]?.send('room:playAgain');
    assert.equal(clients[0]?.lastError?.code, 'wrong_status');
  });

  it('starts a fresh game automatically once everybody present is ready', () => {
    const { clients } = finished(2);
    const [a, b] = clients as [Client, Client];
    const lastSeq = a.events.at(-1)?.seq ?? 0;

    a.send('room:playAgain');
    assert.equal(a.room.status, 'ended');
    assert.equal(a.room.participants.find((p) => p.id === a.selfId)?.ready, true);

    b.send('room:playAgain');
    assert.equal(a.room.status, 'playing');
    assert.equal(a.view.phase.type, 'awaitingAction');
    assert.equal(a.view.players.every((p) => p.alive && p.coins === 2 && p.cardCount === 2), true);
    assert.ok((a.events.at(-1)?.seq ?? 0) > lastSeq, 'event numbers keep counting up');
    assert.equal(a.room.participants.some((p) => p.ready), false);
  });

  it('the host can start with those who are ready; the others become spectators', () => {
    const { clients } = finished(3, 17);
    const [host, b, c] = clients as [Client, Client, Client];
    b.send('room:playAgain');
    c.send('room:playAgain');
    assert.equal(host.room.status, 'ended', 'not everybody is ready yet');
    host.send('lobby:start');
    assert.equal(host.room.status, 'playing');
    assert.equal(host.room.participants.find((p) => p.id === host.selfId)?.kind, 'spectator');
    assert.equal(host.view.me, null);
    assert.equal(b.view.players.length, 2);
    assert.deepEqual(new Set(b.view.players.map((p) => p.id)), new Set([b.selfId, c.selfId]));
  });

  it('cannot start a rematch with fewer than two ready players', () => {
    const { clients } = finished(2, 6);
    clients[0]?.send('room:playAgain');
    clients[0]?.send('lobby:start');
    assert.equal(clients[0]?.lastError?.code, 'not_enough_players');
  });

  it('a spectator can ask to play and takes a seat in the rematch', () => {
    const { server, clients, code } = finished(2, 12);
    const late = new Client(server).send('room:join', { code, nickname: 'Latecomer' });
    assert.equal(late.joined.kind, 'spectator');
    late.send('room:playAgain');
    clients[0]?.send('room:playAgain');
    clients[1]?.send('room:playAgain');
    assert.equal(late.room.status, 'playing');
    assert.equal(late.view.players.length, 3);
    assert.equal(late.view.me?.hand.length, 2);
  });
});

describe('sanity', () => {
  it('byId finds clients by seat', () => {
    const { clients } = setup(2, { start: false });
    assert.equal(byId(clients, clients[1]?.selfId ?? ''), clients[1]);
  });
});

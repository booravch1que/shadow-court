import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { CODE_ALPHABET } from '@shadow-court/protocol';
import { Client, setup } from './harness';

describe('creating and joining', () => {
  it('creates a room with a valid code and makes the creator the host', () => {
    const { clients, code } = setup(1, { start: false });
    const host = clients[0] as Client;
    assert.equal(code.length, 5);
    assert.ok([...code].every((c) => CODE_ALPHABET.includes(c)));
    assert.equal(host.joined.kind, 'player');
    assert.equal(host.room.hostId, host.selfId);
    assert.equal(host.room.status, 'lobby');
    assert.equal(host.room.participants.length, 1);
    assert.ok(host.token.length >= 32);
  });

  it('lets others join by code, whatever its case or spacing, and tells everyone', () => {
    const { server, clients, code } = setup(1, { start: false });
    const guest = new Client(server).send('room:join', { code: ` ${code.toLowerCase()} `, nickname: '  Zoe  ' });
    assert.equal(guest.joined.code, code);
    assert.deepEqual(clients[0]?.room.participants.map((p) => p.nickname), ['Host', 'Zoe']);
    assert.deepEqual(guest.room, clients[0]?.room);
  });

  it('never gives two participants the same id or token', () => {
    const { clients } = setup(6, { start: false });
    assert.equal(new Set(clients.map((c) => c.selfId)).size, 6);
    assert.equal(new Set(clients.map((c) => c.token)).size, 6);
  });

  it('rejects unknown rooms, taken nicknames (any case) and bad nicknames', () => {
    const { server, code } = setup(1, { start: false });
    const guest = new Client(server);
    guest.send('room:join', { code: 'ZZZZZ', nickname: 'Bob' });
    assert.equal(guest.lastError?.code, 'room_not_found');
    guest.send('room:join', { code, nickname: 'hOsT' });
    assert.equal(guest.lastError?.code, 'nickname_taken');
    guest.send('room:join', { code, nickname: '<b>' });
    assert.equal(guest.lastError?.code, 'invalid_payload');
    assert.equal(guest.all('room:joined').length, 0);
  });

  it('survives garbage without throwing', () => {
    const { server } = setup(1, { start: false });
    const c = new Client(server);
    for (const [event, payload] of [
      [undefined, undefined],
      [{}, {}],
      ['room:create', 'str'],
      ['room:create', []],
      ['__proto__', { nickname: 'x' }],
      ['game:command', { command: { type: 'declare', windowId: 'x' } }],
      ['room:kick', { playerId: 5 }],
    ] as const) {
      c.raw(event, payload);
      assert.equal(c.lastError?.code, 'invalid_payload');
    }
  });

  it('refuses room messages from someone who has not joined, and a second join while seated', () => {
    const { server, code, clients } = setup(1, { start: false });
    const outsider = new Client(server);
    outsider.send('lobby:start');
    assert.equal(outsider.lastError?.code, 'not_in_room');
    outsider.command({ type: 'pass', windowId: 1 });
    assert.equal(outsider.lastError?.code, 'not_in_room');
    clients[0]?.send('room:join', { code, nickname: 'Again' });
    assert.equal(clients[0]?.lastError?.code, 'already_in_room');
  });

  it('seats at most 6 players; extra people watch, or are turned away if spectators are off', () => {
    const { server, code, clients } = setup(6, { start: false });
    const seventh = new Client(server).send('room:join', { code, nickname: 'Seventh' });
    assert.equal(seventh.joined.kind, 'spectator');

    clients[0]?.send('lobby:settings', { allowSpectators: false });
    const eighth = new Client(server).send('room:join', { code, nickname: 'Eighth' });
    assert.equal(eighth.lastError?.code, 'room_full');
  });

  it('caps spectators at 10', () => {
    const { server, code } = setup(6, { start: false });
    for (let i = 0; i < 10; i++) {
      assert.equal(new Client(server).send('room:join', { code, nickname: `Watcher${i}` }).joined.kind, 'spectator');
    }
    const late = new Client(server).send('room:join', { code, nickname: 'TooMany' });
    assert.equal(late.lastError?.code, 'spectators_full');
  });

  it('limits join attempts per connection and recovers after the window', () => {
    const { server, sched } = setup(1, { start: false });
    const c = new Client(server);
    for (let i = 0; i < 10; i++) c.send('room:join', { code: 'ZZZZZ', nickname: 'Bob' });
    assert.equal(c.lastError?.code, 'room_not_found');
    c.send('room:join', { code: 'ZZZZZ', nickname: 'Bob' });
    assert.equal(c.lastError?.code, 'rate_limited');
    sched.advance(61_000);
    c.send('room:join', { code: 'ZZZZZ', nickname: 'Bob' });
    assert.equal(c.lastError?.code, 'room_not_found');
  });
});

describe('lobby controls', () => {
  it('only the host can start, and only with two connected players', () => {
    const { clients } = setup(2, { start: false });
    const [host, guest] = clients as [Client, Client];
    guest.send('lobby:start');
    assert.equal(guest.lastError?.code, 'not_host');
    guest.disconnect();
    host.send('lobby:start');
    assert.equal(host.lastError?.code, 'not_enough_players');
    assert.equal(host.room.status, 'lobby');
  });

  it('starting deals everyone a personal view, in random seating', () => {
    const { clients } = setup(4);
    for (const c of clients) {
      assert.equal(c.room.status, 'playing');
      assert.equal(c.view.viewerId, c.selfId);
      assert.equal(c.view.me?.hand.length, 2);
      assert.equal(c.view.players.length, 4);
      assert.ok(c.view.players.every((p) => p.coins === 2 && p.cardCount === 2));
    }
    assert.equal(clients.filter((c) => c.isActive).length, 1);
  });

  it('only the host can change settings, and not during a game', () => {
    const { clients } = setup(2, { start: false });
    const [host, guest] = clients as [Client, Client];
    guest.send('lobby:settings', { timerPreset: 'fast' });
    assert.equal(guest.lastError?.code, 'not_host');
    host.send('lobby:settings', { timerPreset: 'fast', allowSpectators: false });
    assert.deepEqual(guest.room.settings, { timerPreset: 'fast', allowSpectators: false });
    host.send('lobby:start');
    host.send('lobby:settings', { timerPreset: 'relaxed' });
    assert.equal(host.lastError?.code, 'wrong_status');
  });

  it('a second start is refused while a game runs', () => {
    const { clients } = setup(2);
    clients[0]?.send('lobby:start');
    assert.equal(clients[0]?.lastError?.code, 'wrong_status');
  });

  it('a lobby seat whose owner disconnected is released at start; the rest play', () => {
    const { server, code, clients } = setup(1, { start: false });
    const a = new Client(server).send('room:join', { code, nickname: 'Ann' });
    const ghost = new Client(server).send('room:join', { code, nickname: 'Ghost' });
    ghost.disconnect();
    assert.equal(clients[0]?.room.participants.find((p) => p.nickname === 'Ghost')?.connected, false);
    clients[0]?.send('lobby:start');
    assert.equal(clients[0]?.room.status, 'playing');
    assert.equal(clients[0]?.view.players.length, 2);
    assert.ok(!clients[0]?.room.participants.some((p) => p.nickname === 'Ghost'));
    assert.equal(a.view.players.length, 2);
  });

  it('the host can remove anyone from the lobby; the removed client is told', () => {
    const { clients } = setup(3, { start: false });
    const [host, guest, other] = clients as [Client, Client, Client];
    guest.send('room:kick', { playerId: other.selfId });
    assert.equal(guest.lastError?.code, 'not_host');
    host.send('room:kick', { playerId: other.selfId });
    assert.deepEqual(other.last('room:closed'), { reason: 'kicked' });
    assert.equal(host.room.participants.length, 2);
    host.send('room:kick', { playerId: host.selfId });
    assert.equal(host.lastError?.code, 'invalid_target');
    other.send('room:rejoin', { code: host.room.code, token: other.token });
    assert.equal(other.lastError?.code, 'bad_token');
  });

  it('leaving the lobby frees the seat, and the last one out deletes the room', () => {
    const { server, clients } = setup(2, { start: false });
    clients[1]?.send('room:leave');
    assert.equal(clients[0]?.room.participants.length, 1);
    clients[0]?.send('room:leave');
    assert.equal(server.roomCount, 0);
  });
});

describe('emotes', () => {
  it('are broadcast to everyone, validated, and rate limited', () => {
    const { clients, sched } = setup(3, { start: false });
    const [a, b, c] = clients as [Client, Client, Client];
    a.send('emote:send', { emote: '👍' });
    for (const x of [a, b, c]) assert.deepEqual(x.last('emote'), { fromId: a.selfId, emote: '👍' });
    a.send('emote:send', { emote: '😂' });
    assert.equal(a.lastError?.code, 'rate_limited');
    assert.equal(b.all('emote').length, 1);
    sched.advance(1_000);
    a.send('emote:send', { emote: '😂' });
    assert.equal(b.all('emote').length, 2);
    a.raw('emote:send', { emote: 'hello there' });
    assert.equal(a.lastError?.code, 'invalid_payload');
  });
});

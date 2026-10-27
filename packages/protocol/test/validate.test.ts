import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { CODE_ALPHABET, normalizeNickname, normalizeRoomCode, parseClientMessage } from '../src';

const parse = (event: unknown, payload?: unknown) => parseClientMessage(event, payload);

describe('nicknames', () => {
  it('trims and collapses whitespace', () => {
    assert.deepEqual(normalizeNickname('  Ann   Lee '), { ok: true, value: 'Ann Lee' });
  });
  it('accepts Cyrillic and other letters', () => {
    assert.deepEqual(normalizeNickname('Иван'), { ok: true, value: 'Иван' });
  });
  it('enforces 2-16 characters', () => {
    assert.equal(normalizeNickname('a').ok, false);
    assert.equal(normalizeNickname('x'.repeat(17)).ok, false);
    assert.equal(normalizeNickname('x'.repeat(16)).ok, true);
  });
  it('rejects markup, control characters and non-strings', () => {
    assert.equal(normalizeNickname('<b>hi</b>').ok, false);
    assert.equal(normalizeNickname('ab\u0000cd').ok, false);
    assert.equal(normalizeNickname(42).ok, false);
  });
});

describe('room codes', () => {
  it('uppercases and trims', () => {
    assert.deepEqual(normalizeRoomCode(' abcde '), { ok: true, value: 'ABCDE' });
  });
  it('rejects wrong length and look-alike characters', () => {
    assert.equal(normalizeRoomCode('ABCD').ok, false);
    assert.equal(normalizeRoomCode('ABCDO').ok, false);
    assert.equal(normalizeRoomCode('ABCD1').ok, false);
  });
  it('the alphabet has no ambiguous characters', () => {
    for (const c of 'IL O01'.replace(' ', '')) assert.ok(!CODE_ALPHABET.includes(c));
  });
});

describe('parseClientMessage', () => {
  it('accepts well-formed messages and normalizes them', () => {
    assert.deepEqual(parse('room:join', { code: 'abcde', nickname: ' Zoe ' }), {
      ok: true,
      value: { event: 'room:join', data: { code: 'ABCDE', nickname: 'Zoe' } },
    });
    assert.equal(parse('room:leave').ok, true);
    assert.equal(parse('lobby:start', null).ok, true);
  });

  it('rejects unknown events, non-object payloads and bad types', () => {
    assert.equal(parse('hack:me', {}).ok, false);
    assert.equal(parse(42, {}).ok, false);
    assert.equal(parse('room:create', 'text').ok, false);
    assert.equal(parse('room:create', { nickname: 5 }).ok, false);
    assert.equal(parse('room:rejoin', { code: 'ABCDE', token: '' }).ok, false);
  });

  it('validates lobby settings', () => {
    assert.equal(parse('lobby:settings', { timerPreset: 'fast', allowSpectators: false }).ok, true);
    assert.equal(parse('lobby:settings', { timerPreset: 'turbo' }).ok, false);
    assert.equal(parse('lobby:settings', { allowSpectators: 'yes' }).ok, false);
  });

  it('validates emotes', () => {
    assert.equal(parse('emote:send', { emote: '👍' }).ok, true);
    assert.equal(parse('emote:send', { emote: '<script>' }).ok, false);
  });

  describe('game commands', () => {
    const cmd = (command: unknown) => parse('game:command', { command });

    it('accepts every command type', () => {
      assert.equal(cmd({ type: 'declare', windowId: 3, action: 'steal', targetId: 'p2' }).ok, true);
      assert.equal(cmd({ type: 'declare', windowId: 3, action: 'income' }).ok, true);
      assert.equal(cmd({ type: 'challenge', windowId: 3 }).ok, true);
      assert.equal(cmd({ type: 'pass', windowId: 3 }).ok, true);
      assert.equal(cmd({ type: 'block', windowId: 3, role: 'duchess' }).ok, true);
      assert.equal(cmd({ type: 'chooseInfluence', windowId: 3, role: 'thief' }).ok, true);
      assert.equal(cmd({ type: 'chooseExchange', windowId: 3, keep: ['thief', 'shaman'] }).ok, true);
    });

    it('rejects bad window ids, actions, roles and key lists', () => {
      assert.equal(cmd({ type: 'pass', windowId: -1 }).ok, false);
      assert.equal(cmd({ type: 'pass', windowId: 1.5 }).ok, false);
      assert.equal(cmd({ type: 'pass', windowId: '3' }).ok, false);
      assert.equal(cmd({ type: 'declare', windowId: 1, action: 'win' }).ok, false);
      assert.equal(cmd({ type: 'block', windowId: 1, role: 'king' }).ok, false);
      assert.equal(cmd({ type: 'chooseExchange', windowId: 1, keep: [] }).ok, false);
      assert.equal(cmd({ type: 'chooseExchange', windowId: 1, keep: ['thief', 'thief', 'thief'] }).ok, false);
      assert.equal(cmd({ type: 'explode', windowId: 1 }).ok, false);
      assert.equal(cmd('pass').ok, false);
    });

    it('drops fields the client invented, such as a playerId', () => {
      const result = cmd({ type: 'challenge', windowId: 2, playerId: 'someone-else', isAdmin: true });
      assert.deepEqual(result, { ok: true, value: { event: 'game:command', data: { command: { type: 'challenge', windowId: 2 } } } });
    });
  });
});

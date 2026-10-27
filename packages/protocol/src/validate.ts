import { ROLES, type Role } from '@shadow-court/engine';
import {
  ACTION_TYPES,
  CODE_ALPHABET,
  CODE_LENGTH,
  EMOTES,
  NICKNAME_MAX,
  NICKNAME_MIN,
  TIMER_PRESETS,
  type ClientCommand,
  type ClientMessage,
  type Emote,
  type TimerPreset,
} from './events';

export type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };

const ok = <T>(value: T): Parsed<T> => ({ ok: true, value });
const bad = (error: string): Parsed<never> => ({ ok: false, error });

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const MAX_ID_LENGTH = 64;
const MAX_TOKEN_LENGTH = 128;

function parseId(value: unknown, what: string): Parsed<string> {
  if (typeof value !== 'string' || value.length === 0 || value.length > MAX_ID_LENGTH) {
    return bad(`${what} must be a non-empty string.`);
  }
  return ok(value);
}

function parseRole(value: unknown): Parsed<Role> {
  return typeof value === 'string' && (ROLES as readonly string[]).includes(value)
    ? ok(value as Role)
    : bad('Unknown role.');
}

function parseWindowId(value: unknown): Parsed<number> {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
    ? ok(value)
    : bad('windowId must be a non-negative integer.');
}

/** Trims, collapses inner whitespace and checks length and characters. */
export function normalizeNickname(raw: unknown): Parsed<string> {
  if (typeof raw !== 'string') return bad('Nickname must be text.');
  const name = raw.normalize('NFC').replace(/\s+/gu, ' ').trim();
  const length = [...name].length;
  if (length < NICKNAME_MIN || length > NICKNAME_MAX) {
    return bad(`Nickname must be ${NICKNAME_MIN}-${NICKNAME_MAX} characters.`);
  }
  if (!/^[\p{L}\p{N} _.'-]+$/u.test(name)) {
    return bad('Nickname may only contain letters, digits, spaces and _ . \' -');
  }
  return ok(name);
}

/** Uppercases and trims a room code. Returns an error if it cannot be a valid code. */
export function normalizeRoomCode(raw: unknown): Parsed<string> {
  if (typeof raw !== 'string') return bad('Room code must be text.');
  const code = raw.trim().toUpperCase();
  if (code.length !== CODE_LENGTH || ![...code].every((c) => CODE_ALPHABET.includes(c))) {
    return bad('That is not a valid room code.');
  }
  return ok(code);
}

export function parseClientCommand(raw: unknown): Parsed<ClientCommand> {
  if (!isRecord(raw)) return bad('Command must be an object.');
  const windowId = parseWindowId(raw['windowId']);
  if (!windowId.ok) return windowId;
  const w = windowId.value;

  switch (raw['type']) {
    case 'declare': {
      const action = raw['action'];
      if (typeof action !== 'string' || !(ACTION_TYPES as readonly string[]).includes(action)) {
        return bad('Unknown action.');
      }
      const command: ClientCommand = { type: 'declare', windowId: w, action: action as (typeof ACTION_TYPES)[number] };
      if (raw['targetId'] !== undefined && raw['targetId'] !== null) {
        const target = parseId(raw['targetId'], 'targetId');
        if (!target.ok) return target;
        command.targetId = target.value;
      }
      return ok(command);
    }
    case 'challenge':
      return ok({ type: 'challenge', windowId: w });
    case 'pass':
      return ok({ type: 'pass', windowId: w });
    case 'block': {
      const role = parseRole(raw['role']);
      return role.ok ? ok({ type: 'block', windowId: w, role: role.value }) : role;
    }
    case 'chooseInfluence': {
      const role = parseRole(raw['role']);
      return role.ok ? ok({ type: 'chooseInfluence', windowId: w, role: role.value }) : role;
    }
    case 'chooseExchange': {
      const keep = raw['keep'];
      if (!Array.isArray(keep) || keep.length < 1 || keep.length > 2) return bad('keep must list 1-2 roles.');
      const roles: Role[] = [];
      for (const item of keep) {
        const role = parseRole(item);
        if (!role.ok) return role;
        roles.push(role.value);
      }
      return ok({ type: 'chooseExchange', windowId: w, keep: roles });
    }
    default:
      return bad('Unknown command type.');
  }
}

/**
 * Validates one raw socket message. Unknown fields are dropped, so nothing a client
 * invents (such as a `playerId` inside a command) ever reaches the server logic.
 */
export function parseClientMessage(event: unknown, payload: unknown): Parsed<ClientMessage> {
  if (typeof event !== 'string') return bad('Event name must be text.');
  const data = payload === undefined || payload === null ? {} : payload;
  if (!isRecord(data)) return bad('Payload must be an object.');

  switch (event) {
    case 'room:create': {
      const nickname = normalizeNickname(data['nickname']);
      return nickname.ok ? ok({ event, data: { nickname: nickname.value } }) : nickname;
    }
    case 'room:join': {
      const code = normalizeRoomCode(data['code']);
      if (!code.ok) return code;
      const nickname = normalizeNickname(data['nickname']);
      return nickname.ok ? ok({ event, data: { code: code.value, nickname: nickname.value } }) : nickname;
    }
    case 'room:rejoin': {
      const code = normalizeRoomCode(data['code']);
      if (!code.ok) return code;
      const token = data['token'];
      if (typeof token !== 'string' || token.length === 0 || token.length > MAX_TOKEN_LENGTH) {
        return bad('Invalid token.');
      }
      return ok({ event, data: { code: code.value, token } });
    }
    case 'room:leave':
    case 'lobby:start':
    case 'room:playAgain':
      return ok({ event, data: {} });
    case 'lobby:settings': {
      const out: { timerPreset?: TimerPreset; allowSpectators?: boolean; sequentialReactions?: boolean } = {};
      if (data['timerPreset'] !== undefined) {
        const preset = data['timerPreset'];
        if (typeof preset !== 'string' || !(TIMER_PRESETS as readonly string[]).includes(preset)) {
          return bad('Unknown timer preset.');
        }
        out.timerPreset = preset as TimerPreset;
      }
      if (data['allowSpectators'] !== undefined) {
        if (typeof data['allowSpectators'] !== 'boolean') return bad('allowSpectators must be true or false.');
        out.allowSpectators = data['allowSpectators'];
      }
      if (data['sequentialReactions'] !== undefined) {
        if (typeof data['sequentialReactions'] !== 'boolean') return bad('sequentialReactions must be true or false.');
        out.sequentialReactions = data['sequentialReactions'];
      }
      return ok({ event, data: out });
    }
    case 'room:kick': {
      const id = parseId(data['playerId'], 'playerId');
      return id.ok ? ok({ event, data: { playerId: id.value } }) : id;
    }
    case 'game:command': {
      const command = parseClientCommand(data['command']);
      return command.ok ? ok({ event, data: { command: command.value } }) : command;
    }
    case 'emote:send': {
      const emote = data['emote'];
      if (typeof emote !== 'string' || !(EMOTES as readonly string[]).includes(emote)) {
        return bad('Unknown emote.');
      }
      return ok({ event, data: { emote: emote as Emote } });
    }
    default:
      return bad(`Unknown event "${event.slice(0, 40)}".`);
  }
}

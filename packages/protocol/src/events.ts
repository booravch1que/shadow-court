import type { ActionType, GameEvent, GameView, PlayerId, Role } from '@shadow-court/engine';

// ---------------------------------------------------------------------------
// Shared constants
// ---------------------------------------------------------------------------

export const TIMER_PRESETS = ['relaxed', 'standard', 'fast', 'none'] as const;
export type TimerPreset = (typeof TIMER_PRESETS)[number];

export const EMOTES = ['👍', '😂', '😱', '🤔', '👏', '😈'] as const;
export type Emote = (typeof EMOTES)[number];

export const NICKNAME_MIN = 2;
export const NICKNAME_MAX = 16;

/** Room codes avoid look-alike characters: no I, L, O, 0 or 1. */
export const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const CODE_LENGTH = 5;

export const ACTION_TYPES = [
  'income',
  'foreignAid',
  'coup',
  'tax',
  'steal',
  'assassinate',
  'exchange',
  'skip',
] as const satisfies readonly ActionType[];

// ---------------------------------------------------------------------------
// Client -> server
// ---------------------------------------------------------------------------

/**
 * A player's move. It deliberately has no `playerId`: the server always uses the
 * identity bound to the connection, so a client can never act for someone else.
 */
export type ClientCommand =
  | { type: 'declare'; windowId: number; action: ActionType; targetId?: PlayerId }
  | { type: 'challenge'; windowId: number }
  | { type: 'block'; windowId: number; role: Role }
  | { type: 'pass'; windowId: number }
  | { type: 'chooseInfluence'; windowId: number; role: Role }
  | { type: 'chooseExchange'; windowId: number; keep: Role[] };

export interface ClientPayloads {
  'room:create': { nickname: string };
  'room:join': { code: string; nickname: string };
  'room:rejoin': { code: string; token: string };
  'room:leave': Record<string, never>;
  'lobby:settings': { timerPreset?: TimerPreset; allowSpectators?: boolean; sequentialReactions?: boolean };
  'lobby:start': Record<string, never>;
  'room:kick': { playerId: PlayerId };
  'game:command': { command: ClientCommand };
  'room:playAgain': Record<string, never>;
  'emote:send': { emote: Emote };
}

export type ClientEventName = keyof ClientPayloads;

export type ClientMessage = {
  [E in ClientEventName]: { event: E; data: ClientPayloads[E] };
}[ClientEventName];

// ---------------------------------------------------------------------------
// Server -> client
// ---------------------------------------------------------------------------

export type RoomStatus = 'lobby' | 'playing' | 'ended';
export type ParticipantKind = 'player' | 'spectator';

export interface RoomSettings {
  timerPreset: TimerPreset;
  allowSpectators: boolean;
  /** Reactions are asked one player at a time, clockwise, instead of all at once. */
  sequentialReactions: boolean;
}

export interface PublicParticipant {
  id: PlayerId;
  nickname: string;
  kind: ParticipantKind;
  connected: boolean;
  /** Missed three timers in a row. The host may remove them. */
  away: boolean;
  /** Pressed "Play again" after a game. */
  ready: boolean;
  isHost: boolean;
}

export interface RoomStateData {
  code: string;
  status: RoomStatus;
  hostId: PlayerId;
  settings: RoomSettings;
  participants: PublicParticipant[];
}

export interface NumberedEvent {
  /** Strictly increasing within a room, so clients can detect gaps and replay order. */
  seq: number;
  event: GameEvent;
}

export interface ServerPayloads {
  /** Sent to the connection that just created, joined or rejoined a room. */
  'room:joined': {
    code: string;
    /** Secret. Store it in the browser to get the same seat back after a refresh. */
    token: string;
    selfId: PlayerId;
    kind: ParticipantKind;
  };
  'room:state': RoomStateData;
  /** Full snapshot for this viewer. Safe to render without any earlier message. */
  'game:view': {
    /** Sequence number of the latest event included in this snapshot. */
    seq: number;
    view: GameView;
    /** Absolute deadline of the current window in epoch milliseconds, or null. */
    deadline: number | null;
    /** The server's clock when this was sent. Clients use it to correct for clock drift. */
    now: number;
  };
  /** Public, ordered events for the log and animations. */
  'game:events': { events: NumberedEvent[] };
  emote: { fromId: PlayerId; emote: Emote };
  /** The room is gone for this connection (kicked, expired). */
  'room:closed': { reason: 'kicked' | 'expired' | 'replaced' };
  error: { code: string; message: string };
}

export type ServerEventName = keyof ServerPayloads;

export type ServerMessage = {
  [E in ServerEventName]: { event: E; data: ServerPayloads[E] };
}[ServerEventName];

export const SERVER_EVENTS = [
  'room:joined',
  'room:state',
  'game:view',
  'game:events',
  'emote',
  'room:closed',
  'error',
] as const satisfies readonly ServerEventName[];

import type { GameEvent, GameView, PlayerId } from '@shadow-court/engine';
import type {
  ClientCommand,
  ClientEventName,
  Emote,
  RoomSettings,
  RoomStateData,
  ServerMessage,
  ServerPayloads,
} from '@shadow-court/protocol';
import { detectLang, type Lang } from './i18n';
import { soundCues, type SoundCue } from './logic/describe';
import type { KeyValueStore } from './net/storage';
import { createStore, type Store } from './store';

export type ConnStatus = 'connecting' | 'online' | 'offline';

/** One line of history. `event: null` marks a gap (events missed while offline). */
export interface LogEntry {
  seq: number;
  event: GameEvent | null;
}

export interface EmoteBubble {
  id: number;
  fromId: PlayerId;
  emote: Emote;
}

export interface Toast {
  id: number;
  code: string;
  message: string;
}

export interface AppState {
  conn: ConnStatus;
  lang: Lang;
  sound: boolean;
  nickname: string;
  /** Room code from an invitation link, to prefill the join form. */
  inviteCode: string;
  joined: ServerPayloads['room:joined'] | null;
  room: RoomStateData | null;
  view: GameView | null;
  /** When the current window ends, on this device's clock. */
  deadlineAt: number | null;
  log: LogEntry[];
  emotes: EmoteBubble[];
  toast: Toast | null;
  closed: 'kicked' | 'expired' | 'replaced' | null;
  rejoining: boolean;
}

export interface AppEnv {
  send: (event: ClientEventName, data?: unknown) => void;
  storage: KeyValueStore;
  now: () => number;
  setTimeout: (fn: () => void, ms: number) => unknown;
  /** Called after a room is joined or left, to tidy the address bar. */
  onUrlChange?: (code: string | null) => void;
  /** Called with sound cues when the player has sound turned on. */
  onCue?: (cues: SoundCue[]) => void;
  /** Called with every batch of new game events, for animations. */
  onEvents?: (events: GameEvent[]) => void;
  /** Called right after a new game view has been stored. */
  onView?: () => void;
  browserLanguage?: string;
  initialInvite?: string;
}

const KEY = { session: 'sc.session', nick: 'sc.nick', lang: 'sc.lang', sound: 'sc.sound' } as const;
const MAX_LOG = 400;
const TOAST_MS = 4500;
const EMOTE_MS = 3200;

export class AppController {
  readonly store: Store<AppState>;
  private counter = 0;

  constructor(private readonly env: AppEnv) {
    this.store = createStore<AppState>({
      conn: 'connecting',
      lang: detectLang(env.storage.getItem(KEY.lang), env.browserLanguage),
      sound: env.storage.getItem(KEY.sound) === '1',
      nickname: env.storage.getItem(KEY.nick) ?? '',
      inviteCode: (env.initialInvite ?? '').toUpperCase(),
      joined: null,
      room: null,
      view: null,
      deadlineAt: null,
      log: [],
      emotes: [],
      toast: null,
      closed: null,
      rejoining: false,
    });
  }

  // -------------------------------------------------------------------------
  // From the network
  // -------------------------------------------------------------------------

  handleStatus(status: ConnStatus): void {
    this.store.set({ conn: status });
    if (status !== 'online') return;
    // A new connection has no seat yet: claim the old one with the saved token.
    const saved = this.loadSession();
    if (saved) {
      this.store.set({ rejoining: true });
      this.env.send('room:rejoin', saved);
    }
  }

  handleMessage(message: ServerMessage): void {
    switch (message.event) {
      case 'room:joined': {
        const previous = this.store.get().joined;
        const sameSeat = previous?.selfId === message.data.selfId && previous.code === message.data.code;
        this.saveSession({ code: message.data.code, token: message.data.token });
        this.store.set({
          joined: message.data,
          rejoining: false,
          closed: null,
          inviteCode: '',
          ...(sameSeat ? {} : { view: null, log: [], deadlineAt: null, emotes: [] }),
        });
        this.env.onUrlChange?.(message.data.code);
        return;
      }
      case 'room:state':
        this.store.set({ room: message.data });
        return;
      case 'game:view': {
        const { deadline, now, view } = message.data;
        this.store.set({ view, deadlineAt: deadline === null ? null : this.env.now() + (deadline - now) });
        this.env.onView?.();
        return;
      }
      case 'game:events':
        this.appendEvents(message.data.events);
        return;
      case 'emote': {
        const bubble: EmoteBubble = { id: ++this.counter, ...message.data };
        this.store.set((s) => ({ emotes: [...s.emotes.slice(-5), bubble] }));
        this.env.setTimeout(
          () => this.store.set((s) => ({ emotes: s.emotes.filter((e) => e.id !== bubble.id) })),
          EMOTE_MS,
        );
        return;
      }
      case 'room:closed':
        this.clearRoom();
        this.store.set({ closed: message.data.reason });
        return;
      case 'error': {
        const { code, message: text } = message.data;
        if (this.store.get().rejoining && (code === 'bad_token' || code === 'room_not_found')) {
          this.clearRoom();
          this.store.set({ rejoining: false });
        }
        this.showToast(code, text);
        return;
      }
    }
  }

  private appendEvents(events: { seq: number; event: GameEvent }[]): void {
    const state = this.store.get();
    const lastSeq = state.log.filter((l) => l.event !== null).at(-1)?.seq ?? 0;
    const fresh = events.filter((e) => e.seq > lastSeq);
    if (fresh.length === 0) return;

    const entries: LogEntry[] = [];
    const first = fresh[0];
    if (first && lastSeq > 0 && first.seq > lastSeq + 1) entries.push({ seq: lastSeq + 0.5, event: null });
    entries.push(...fresh);
    this.store.set({ log: [...state.log, ...entries].slice(-MAX_LOG) });

    this.env.onEvents?.(fresh.map((e) => e.event));
    if (state.sound) this.env.onCue?.(soundCues(fresh.map((e) => e.event)));
  }

  // -------------------------------------------------------------------------
  // From the user
  // -------------------------------------------------------------------------

  setLang(lang: Lang): void {
    this.env.storage.setItem(KEY.lang, lang);
    this.store.set({ lang });
  }

  setSound(on: boolean): void {
    this.env.storage.setItem(KEY.sound, on ? '1' : '0');
    this.store.set({ sound: on });
  }

  setNickname(nickname: string): void {
    this.env.storage.setItem(KEY.nick, nickname);
    this.store.set({ nickname });
  }

  createRoom(nickname: string): void {
    this.setNickname(nickname);
    this.env.send('room:create', { nickname });
  }

  joinRoom(code: string, nickname: string): void {
    this.setNickname(nickname);
    this.env.send('room:join', { code, nickname });
  }

  leaveRoom(): void {
    this.env.send('room:leave');
    this.clearRoom();
  }

  startGame(): void {
    this.env.send('lobby:start');
  }

  updateSettings(patch: Partial<RoomSettings>): void {
    this.env.send('lobby:settings', patch);
  }

  kick(playerId: PlayerId): void {
    this.env.send('room:kick', { playerId });
  }

  command(command: ClientCommand): void {
    this.env.send('game:command', { command });
  }

  playAgain(): void {
    this.env.send('room:playAgain');
  }

  sendEmote(emote: Emote): void {
    this.env.send('emote:send', { emote });
  }

  dismissToast(): void {
    this.store.set({ toast: null });
  }

  dismissClosed(): void {
    this.store.set({ closed: null });
  }

  // -------------------------------------------------------------------------

  private showToast(code: string, message: string): void {
    const toast: Toast = { id: ++this.counter, code, message };
    this.store.set({ toast });
    this.env.setTimeout(() => {
      if (this.store.get().toast?.id === toast.id) this.store.set({ toast: null });
    }, TOAST_MS);
  }

  private clearRoom(): void {
    this.env.storage.removeItem(KEY.session);
    this.store.set({ joined: null, room: null, view: null, deadlineAt: null, log: [], emotes: [] });
    this.env.onUrlChange?.(null);
  }

  private saveSession(session: { code: string; token: string }): void {
    this.env.storage.setItem(KEY.session, JSON.stringify(session));
  }

  private loadSession(): { code: string; token: string } | null {
    try {
      const raw = this.env.storage.getItem(KEY.session);
      if (!raw) return null;
      const parsed: unknown = JSON.parse(raw);
      if (
        typeof parsed === 'object' && parsed !== null &&
        typeof (parsed as Record<string, unknown>)['code'] === 'string' &&
        typeof (parsed as Record<string, unknown>)['token'] === 'string'
      ) {
        return parsed as { code: string; token: string };
      }
    } catch {
      // fall through
    }
    return null;
  }
}

/** Nickname for a participant id, with a harmless fallback. */
export function nameIn(room: RoomStateData | null, id: PlayerId): string {
  return room?.participants.find((p) => p.id === id)?.nickname ?? '…';
}

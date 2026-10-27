import {
  createGame,
  projectView,
  reduce,
  type GameEvent,
  type GameState,
  type PlayerCommand,
  type PlayerId,
} from '@shadow-court/engine';
import type {
  ClientCommand,
  Emote,
  ParticipantKind,
  PublicParticipant,
  RoomSettings,
  RoomStateData,
  RoomStatus,
  ServerMessage,
} from '@shadow-court/protocol';
import { TIMER_MULTIPLIER, type Connection, type ServerDeps, type TimerHandle } from './deps';

export type RoomResult = { ok: true } | { ok: false; code: string; message: string };
const OK: RoomResult = { ok: true };
const fail = (code: string, message: string): RoomResult => ({ ok: false, code, message });

interface Participant {
  id: PlayerId;
  /** Secret that proves ownership of this seat after a reconnect. */
  token: string;
  nickname: string;
  kind: ParticipantKind;
  conn: Connection | null;
  connectedSince: number | null;
  away: boolean;
  strikes: number;
  ready: boolean;
  lastEmoteAt: number;
}

/** What a room needs from the server that owns it. */
export interface RoomHooks {
  bind(conn: Connection, participantId: PlayerId): void;
  unbind(conn: Connection): void;
  destroy(): void;
}

/**
 * One game room: lobby, seating, the authoritative game state, timers and the
 * per-viewer snapshots. It talks to clients only through `Connection.send`, so it
 * knows nothing about sockets. Everything runs synchronously on one thread, which
 * is what makes "first valid response wins" free of locking.
 */
export class Room {
  status: RoomStatus = 'lobby';
  settings: RoomSettings = { timerPreset: 'standard', allowSpectators: true };

  private readonly participants = new Map<PlayerId, Participant>();
  private readonly byToken = new Map<string, PlayerId>();
  private hostId: PlayerId = '';
  private game: GameState | null = null;
  private seq = 0;
  private timer: TimerHandle | null = null;
  private deadline: number | null = null;
  private expiry: TimerHandle | null = null;

  constructor(
    readonly code: string,
    private readonly deps: ServerDeps,
    private readonly hooks: RoomHooks,
  ) {}

  // -------------------------------------------------------------------------
  // Joining, leaving, reconnecting
  // -------------------------------------------------------------------------

  join(conn: Connection, nickname: string): RoomResult {
    const wanted = nickname.toLowerCase();
    for (const p of this.participants.values()) {
      if (p.nickname.toLowerCase() === wanted) return fail('nickname_taken', 'That nickname is already used in this room.');
    }

    const { maxPlayers, maxSpectators } = this.deps.config;
    let kind: ParticipantKind;
    if (this.status === 'lobby' && this.count('player') < maxPlayers) {
      kind = 'player';
    } else if (!this.settings.allowSpectators) {
      return fail(this.status === 'lobby' ? 'room_full' : 'spectators_disabled', 'You cannot join this room right now.');
    } else if (this.count('spectator') >= maxSpectators) {
      return fail('spectators_full', 'This room has no space left for spectators.');
    } else {
      kind = 'spectator';
    }

    const participant: Participant = {
      id: this.deps.random.hex(6),
      token: this.deps.random.hex(24),
      nickname,
      kind,
      conn: null,
      connectedSince: null,
      away: false,
      strikes: 0,
      ready: false,
      lastEmoteAt: Number.NEGATIVE_INFINITY,
    };
    this.participants.set(participant.id, participant);
    this.byToken.set(participant.token, participant.id);
    if (this.hostId === '') this.hostId = participant.id;

    this.attach(participant, conn);
    this.welcome(participant);
    return OK;
  }

  rejoin(conn: Connection, token: string): RoomResult {
    const id = this.byToken.get(token);
    const participant = id === undefined ? undefined : this.participants.get(id);
    if (!participant) return fail('bad_token', 'That seat is no longer available.');

    const old = participant.conn;
    if (old && old !== conn) {
      old.send({ event: 'room:closed', data: { reason: 'replaced' } });
      this.hooks.unbind(old);
    }
    this.attach(participant, conn);
    this.welcome(participant);
    return OK;
  }

  /** The connection dropped. The seat is kept so a refresh or reconnect gets it back. */
  detach(participantId: PlayerId, conn: Connection): void {
    const p = this.participants.get(participantId);
    if (!p || p.conn !== conn) return; // already replaced by a newer connection
    p.conn = null;
    p.connectedSince = null;
    this.hooks.unbind(conn);
    if (this.hostId === p.id) this.migrateHost();
    this.afterPresenceChange();
  }

  /** The participant chose to leave for good. */
  leave(participantId: PlayerId): RoomResult {
    if (!this.participants.has(participantId)) return fail('not_in_room', 'You are not in this room.');
    this.remove(participantId);
    return OK;
  }

  kick(requesterId: PlayerId, targetId: PlayerId): RoomResult {
    if (requesterId !== this.hostId) return fail('not_host', 'Only the host can remove players.');
    const target = this.participants.get(targetId);
    if (!target || targetId === requesterId) return fail('invalid_target', 'You cannot remove that participant.');
    if (this.status === 'playing' && target.kind === 'player' && this.isAlive(target.id)) {
      if (!target.away && target.conn !== null) {
        return fail('not_allowed', 'Only players who are away or disconnected can be removed during a game.');
      }
    }
    this.remove(targetId, 'kicked');
    return OK;
  }

  private remove(id: PlayerId, notify?: 'kicked'): void {
    const p = this.participants.get(id);
    if (!p) return;

    const conn = p.conn;
    p.conn = null;
    p.connectedSince = null;
    if (conn) {
      if (notify) conn.send({ event: 'room:closed', data: { reason: notify } });
      this.hooks.unbind(conn);
    }

    if (this.status === 'playing' && p.kind === 'player' && this.game && this.isAlive(id)) {
      const result = reduce(this.game, { type: 'forfeit', playerId: id });
      if (result.ok) this.commit(result.state, result.events);
    }

    this.participants.delete(id);
    this.byToken.delete(p.token);
    if (this.hostId === id) {
      this.hostId = '';
      this.migrateHost();
    }
    if (this.participants.size === 0) {
      this.hooks.destroy();
      return;
    }
    this.afterPresenceChange();
  }

  // -------------------------------------------------------------------------
  // Lobby
  // -------------------------------------------------------------------------

  updateSettings(requesterId: PlayerId, patch: Partial<RoomSettings>): RoomResult {
    if (requesterId !== this.hostId) return fail('not_host', 'Only the host can change settings.');
    if (this.status === 'playing') return fail('wrong_status', 'Settings cannot change during a game.');
    this.settings = { ...this.settings, ...patch };
    this.broadcastState();
    return OK;
  }

  start(requesterId: PlayerId): RoomResult {
    if (requesterId !== this.hostId) return fail('not_host', 'Only the host can start the game.');
    if (this.status === 'playing') return fail('wrong_status', 'A game is already running.');
    return this.beginGame();
  }

  /** After a game: ask for a rematch. When everybody present is ready it starts by itself. */
  playAgain(participantId: PlayerId): RoomResult {
    const p = this.participants.get(participantId);
    if (!p) return fail('not_in_room', 'You are not in this room.');
    if (this.status !== 'ended') return fail('wrong_status', 'There is no finished game to replay.');
    if (p.kind === 'spectator') {
      if (this.count('player') >= this.deps.config.maxPlayers) return fail('room_full', 'All seats are taken.');
      p.kind = 'player';
    }
    p.ready = true;

    const present = this.connectedPlayers();
    if (present.length >= 2 && present.every((x) => x.ready)) return this.beginGame();
    this.broadcastState();
    return OK;
  }

  private beginGame(): RoomResult {
    const rematch = this.status === 'ended';
    const seated = this.connectedPlayers().filter((p) => !rematch || p.ready);
    if (seated.length < 2) return fail('not_enough_players', 'At least 2 connected players are needed.');

    // Everyone who is not playing watches. Disconnected seats are released.
    for (const p of [...this.participants.values()]) {
      if (seated.includes(p)) continue;
      if (p.conn === null && p.kind === 'player') {
        this.participants.delete(p.id);
        this.byToken.delete(p.token);
      } else {
        p.kind = 'spectator';
      }
    }
    for (const p of seated) {
      p.strikes = 0;
      p.away = false;
      p.ready = false;
    }
    if (!this.participants.has(this.hostId)) this.migrateHost();

    const { state, events } = createGame({
      playerIds: seated.map((p) => p.id),
      seed: this.deps.random.int(2 ** 32),
    });
    this.status = 'playing';
    this.commit(state, events);
    this.broadcastState();
    return OK;
  }

  // -------------------------------------------------------------------------
  // Playing
  // -------------------------------------------------------------------------

  command(participantId: PlayerId, command: ClientCommand): RoomResult {
    const p = this.participants.get(participantId);
    if (!p || p.kind !== 'player' || this.status !== 'playing' || !this.game) {
      return fail('not_allowed', 'You are not playing in a running game.');
    }
    // The identity always comes from the connection, never from the client.
    const result = reduce(this.game, { ...command, playerId: p.id } as PlayerCommand);
    if (!result.ok) return fail(result.error.code, result.error.message);

    const wasAway = p.away;
    p.strikes = 0;
    p.away = false;
    this.commit(result.state, result.events);
    if (wasAway) this.broadcastState();
    return OK;
  }

  emote(participantId: PlayerId, emote: Emote): RoomResult {
    const p = this.participants.get(participantId);
    if (!p) return fail('not_in_room', 'You are not in this room.');
    const now = this.deps.scheduler.now();
    if (now - p.lastEmoteAt < this.deps.config.emoteCooldownMs) return fail('rate_limited', 'Slow down a little.');
    p.lastEmoteAt = now;
    this.sendAll({ event: 'emote', data: { fromId: p.id, emote } });
    return OK;
  }

  /** Applies a new state: numbers the events, picks the next timer, tells everyone. */
  private commit(state: GameState, events: GameEvent[]): void {
    this.game = state;
    const numbered = events.map((event) => ({ seq: ++this.seq, event }));

    const finished = state.phase.type === 'gameOver';
    if (finished) {
      this.status = 'ended';
      this.clearTimer();
      for (const p of this.participants.values()) p.ready = false;
    } else {
      this.armTimer();
    }

    if (numbered.length > 0) this.sendAll({ event: 'game:events', data: { events: numbered } });
    for (const p of this.participants.values()) this.sendView(p);
    if (finished) this.broadcastState();
  }

  private armTimer(): void {
    this.clearTimer();
    const game = this.game;
    const ms = game ? this.timerLength(game) : null;
    if (!game || ms === null || game.phase.type === 'gameOver') return;

    const windowId = game.phase.windowId;
    this.deadline = this.deps.scheduler.now() + ms;
    this.timer = this.deps.scheduler.setTimeout(() => this.onTimeout(windowId), ms);
  }

  private clearTimer(): void {
    if (this.timer !== null) this.deps.scheduler.clearTimeout(this.timer);
    this.timer = null;
    this.deadline = null;
  }

  /** How long the current phase may last, or `null` for no timer. */
  private timerLength(game: GameState): number | null {
    const preset = this.settings.timerPreset;
    if (preset === 'none') return null;
    const cfg = this.deps.config;
    const phase = game.phase;

    let base: number;
    let awaited: PlayerId[];
    switch (phase.type) {
      case 'awaitingAction':
        base = cfg.turnMs;
        awaited = [game.activePlayerId];
        break;
      case 'challengeWindow':
      case 'blockWindow':
      case 'blockChallengeWindow':
        base = cfg.reactionMs;
        awaited = phase.eligible.filter((id) => !phase.passed.includes(id));
        break;
      case 'influenceLoss':
      case 'exchange':
        base = cfg.cardMs;
        awaited = [phase.playerId];
        break;
      case 'gameOver':
        return null;
    }

    const full = Math.round(base * TIMER_MULTIPLIER[preset]);
    const onlyAway = awaited.length > 0 && awaited.every((id) => this.participants.get(id)?.away === true);
    return onlyAway ? Math.min(full, cfg.awayMs) : full;
  }

  private onTimeout(windowId: number): void {
    this.timer = null;
    if (this.status !== 'playing' || !this.game) return;
    const result = reduce(this.game, { type: 'timeout', windowId });
    if (!result.ok) return; // the window already moved on

    const awayChanged = this.applyStrikes(result.events);
    this.commit(result.state, result.events);
    if (awayChanged) this.broadcastState();
  }

  /** Counts missed timers. Returns true when somebody just became Away. */
  private applyStrikes(events: GameEvent[]): boolean {
    let changed = false;
    for (const e of events) {
      const missed = (e.type === 'passed' && e.auto) || e.type === 'timedOut' ? e.playerId : null;
      if (missed === null) continue;
      const p = this.participants.get(missed);
      if (!p) continue;
      p.strikes += 1;
      if (p.strikes >= this.deps.config.awayStrikes && !p.away) {
        p.away = true;
        changed = true;
      }
    }
    return changed;
  }

  // -------------------------------------------------------------------------
  // Presence, host, expiry
  // -------------------------------------------------------------------------

  private attach(p: Participant, conn: Connection): void {
    p.conn = conn;
    p.connectedSince = this.deps.scheduler.now();
    this.hooks.bind(conn, p.id);
    this.clearExpiry();
  }

  private welcome(p: Participant): void {
    this.send(p, { event: 'room:joined', data: { code: this.code, token: p.token, selfId: p.id, kind: p.kind } });
    this.broadcastState();
    this.sendView(p);
  }

  /** Host rights go to the longest-connected player (spectators only if no player is connected). */
  private migrateHost(): void {
    const current = this.participants.get(this.hostId);
    if (current?.conn) return;
    const longest = (list: Participant[]) =>
      list.filter((p) => p.conn !== null).sort((a, b) => (a.connectedSince ?? 0) - (b.connectedSince ?? 0))[0];
    const all = [...this.participants.values()];
    const next = longest(all.filter((p) => p.kind === 'player')) ?? longest(all);
    if (next) this.hostId = next.id;
  }

  private afterPresenceChange(): void {
    if (this.connectedAll().length === 0) this.scheduleExpiry();
    this.broadcastState();
  }

  private scheduleExpiry(): void {
    if (this.expiry !== null) return;
    this.expiry = this.deps.scheduler.setTimeout(() => {
      this.expiry = null;
      this.hooks.destroy();
    }, this.deps.config.roomExpiryMs);
  }

  private clearExpiry(): void {
    if (this.expiry !== null) this.deps.scheduler.clearTimeout(this.expiry);
    this.expiry = null;
  }

  /** Stops all timers and releases every connection. Called by the owner when the room is deleted. */
  dispose(reason: 'expired' | null = null): void {
    this.clearTimer();
    this.clearExpiry();
    for (const p of this.participants.values()) {
      if (!p.conn) continue;
      if (reason) p.conn.send({ event: 'room:closed', data: { reason } });
      this.hooks.unbind(p.conn);
      p.conn = null;
    }
  }

  // -------------------------------------------------------------------------
  // Output
  // -------------------------------------------------------------------------

  private roomState(): RoomStateData {
    const participants: PublicParticipant[] = [...this.participants.values()].map((p) => ({
      id: p.id,
      nickname: p.nickname,
      kind: p.kind,
      connected: p.conn !== null,
      away: p.away,
      ready: p.ready,
      isHost: p.id === this.hostId,
    }));
    return { code: this.code, status: this.status, hostId: this.hostId, settings: { ...this.settings }, participants };
  }

  private broadcastState(): void {
    this.sendAll({ event: 'room:state', data: this.roomState() });
  }

  private sendView(p: Participant): void {
    if (!this.game || !p.conn) return;
    const view = projectView(this.game, p.kind === 'player' ? p.id : null);
    this.send(p, { event: 'game:view', data: { seq: this.seq, view, deadline: this.deadline, now: this.deps.scheduler.now() } });
  }

  private send(p: Participant, message: ServerMessage): void {
    p.conn?.send(message);
  }

  private sendAll(message: ServerMessage): void {
    for (const p of this.participants.values()) this.send(p, message);
  }

  // -------------------------------------------------------------------------
  // Small helpers
  // -------------------------------------------------------------------------

  private count(kind: ParticipantKind): number {
    let n = 0;
    for (const p of this.participants.values()) if (p.kind === kind) n += 1;
    return n;
  }

  private connectedAll(): Participant[] {
    return [...this.participants.values()].filter((p) => p.conn !== null);
  }

  private connectedPlayers(): Participant[] {
    return this.connectedAll().filter((p) => p.kind === 'player');
  }

  private isAlive(id: PlayerId): boolean {
    const player = this.game?.players.find((x) => x.id === id);
    return player !== undefined && player.hand.length > 0;
  }

  /** Number of participants, for the server's bookkeeping. */
  get size(): number {
    return this.participants.size;
  }
}

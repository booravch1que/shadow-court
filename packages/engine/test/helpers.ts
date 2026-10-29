import assert from 'node:assert/strict';
import {
  MAX_COINS,
  ROLES,
  copiesPerRole,
  reduce,
  type ActionType,
  type Command,
  type EngineErrorCode,
  type GameEvent,
  type GameState,
  type PlayerId,
  type ReduceResult,
  type Role,
} from '../src';

export interface PlayerSpec {
  id: PlayerId;
  coins?: number;
  hand: Role[];
  revealed?: Role[];
  skips?: number;
}

export interface BuildOptions {
  active?: PlayerId;
  /** Cards that must sit on top of the deck, first element on top. */
  deckTop?: Role[];
  seed?: number;
  /** Reaction windows ask one player at a time. */
  sequential?: boolean;
}

/** Builds a valid mid-game state from a compact description. */
export function buildState(specs: PlayerSpec[], options: BuildOptions = {}): GameState {
  const remaining: Role[] = [];
  for (const role of ROLES) {
    for (let i = 0; i < copiesPerRole(specs.length); i++) remaining.push(role);
  }
  const take = (role: Role) => {
    const at = remaining.indexOf(role);
    assert.ok(at !== -1, `buildState: not enough ${role} cards for ${specs.length} players`);
    remaining.splice(at, 1);
  };
  for (const spec of specs) {
    for (const role of [...spec.hand, ...(spec.revealed ?? [])]) take(role);
  }
  const top = options.deckTop ?? [];
  for (const role of top) take(role);

  return {
    players: specs.map((spec) => ({
      id: spec.id,
      coins: spec.coins ?? 2,
      hand: [...spec.hand],
      revealed: [...(spec.revealed ?? [])],
      consecutiveSkips: spec.skips ?? 0,
    })),
    deck: [...top, ...remaining],
    activePlayerId: options.active ?? (specs[0] as PlayerSpec).id,
    turn: 1,
    phase: { type: 'awaitingAction', windowId: 1 },
    windowCounter: 1,
    rng: options.seed ?? 12345,
    sequentialReactions: options.sequential ?? false,
  };
}

/** Thin stateful wrapper that feeds commands to the reducer and records events. */
export class TestGame {
  state: GameState;
  events: GameEvent[] = [];

  constructor(state: GameState) {
    this.state = state;
  }

  get windowId(): number {
    assert.notEqual(this.state.phase.type, 'gameOver', 'game is over');
    return (this.state.phase as { windowId: number }).windowId;
  }

  get phase(): GameState['phase'] {
    return this.state.phase;
  }

  player(id: PlayerId) {
    const found = this.state.players.find((p) => p.id === id);
    assert.ok(found, `no player ${id}`);
    return found;
  }

  /** Sends a command and throws if it is rejected. */
  send(command: Command): this {
    const result = reduce(this.state, command);
    assert.ok(
      result.ok,
      `${command.type} was rejected: ${result.ok ? '' : `${result.error.code} (${result.error.message})`}`,
    );
    this.state = result.state;
    this.events.push(...result.events);
    return this;
  }

  /** Sends a command and returns the raw result, applying it only if it succeeded. */
  try(command: Command): ReduceResult {
    const result = reduce(this.state, command);
    if (result.ok) {
      this.state = result.state;
      this.events.push(...result.events);
    }
    return result;
  }

  /** Asserts that a command is rejected with the given code and changes nothing. */
  reject(command: Command, code: EngineErrorCode): this {
    const before = JSON.stringify(this.state);
    const result = reduce(this.state, command);
    assert.equal(result.ok, false, `${command.type} should have been rejected`);
    if (!result.ok) assert.equal(result.error.code, code);
    assert.equal(JSON.stringify(this.state), before, 'a rejected command must not change the state');
    return this;
  }

  declare(playerId: PlayerId, action: ActionType, targetId?: PlayerId): this {
    return this.send({ type: 'declare', playerId, windowId: this.windowId, action, targetId });
  }
  pass(...playerIds: PlayerId[]): this {
    for (const playerId of playerIds) this.send({ type: 'pass', playerId, windowId: this.windowId });
    return this;
  }
  /** Everyone still eligible passes, window after window, until a non-reaction phase is reached. */
  passAll(): this {
    for (;;) {
      const phase = this.state.phase;
      if (
        phase.type !== 'challengeWindow' &&
        phase.type !== 'blockWindow' &&
        phase.type !== 'blockChallengeWindow'
      ) {
        return this;
      }
      const waiting = phase.eligible.filter((id) => !phase.passed.includes(id));
      this.pass(waiting[0] as PlayerId);
    }
  }
  challenge(playerId: PlayerId): this {
    return this.send({ type: 'challenge', playerId, windowId: this.windowId });
  }
  block(playerId: PlayerId, role: Role): this {
    return this.send({ type: 'block', playerId, windowId: this.windowId, role });
  }
  lose(playerId: PlayerId, role: Role): this {
    return this.send({ type: 'chooseInfluence', playerId, windowId: this.windowId, role });
  }
  exchange(playerId: PlayerId, keep: Role[]): this {
    return this.send({ type: 'chooseExchange', playerId, windowId: this.windowId, keep });
  }
  timeout(): this {
    return this.send({ type: 'timeout', windowId: this.windowId });
  }
  forfeit(playerId: PlayerId): this {
    return this.send({ type: 'forfeit', playerId });
  }

  eventsOfType<T extends GameEvent['type']>(type: T): Extract<GameEvent, { type: T }>[] {
    return this.events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);
  }
}

export function game(specs: PlayerSpec[], options: BuildOptions = {}): TestGame {
  return new TestGame(buildState(specs, options));
}

/**
 * Checks the invariants that must hold in every reachable state:
 * cards are conserved, coins stay within bounds, the phase agrees with who is alive.
 */
export function assertInvariants(state: GameState): void {
  const playerCount = state.players.length;
  const expectedCards = ROLES.length * copiesPerRole(playerCount);

  let held = 0;
  const counts = new Map<Role, number>();
  const count = (role: Role) => counts.set(role, (counts.get(role) ?? 0) + 1);

  for (const player of state.players) {
    assert.equal(player.hand.length + player.revealed.length, 2, `${player.id} must always own 2 cards`);
    assert.ok(player.coins >= 0 && player.coins <= MAX_COINS, `${player.id} coins out of range: ${player.coins}`);
    if (player.hand.length === 0) assert.equal(player.coins, 0, 'an eliminated player holds no coins');
    held += player.hand.length + player.revealed.length;
    player.hand.forEach(count);
    player.revealed.forEach(count);
  }
  state.deck.forEach(count);

  // Cards drawn for an exchange live in the phase until they are returned.
  let inExchange = 0;
  if (state.phase.type === 'exchange') {
    inExchange = state.phase.options.length - state.phase.keep;
    state.phase.options.slice(state.phase.keep).forEach(count);
  }

  assert.equal(held + state.deck.length + inExchange, expectedCards, 'card conservation violated');
  if (state.deckSeen) assert.equal(state.deckSeen.length, state.deck.length, 'deckSeen must track the deck card for card');
  for (const role of ROLES) {
    assert.equal(counts.get(role), copiesPerRole(playerCount), `wrong number of ${role} cards`);
  }

  const living = state.players.filter((p) => p.hand.length > 0);
  assert.ok(living.length >= 1, 'at least one player must be alive');
  if (state.phase.type === 'gameOver') {
    assert.equal(living.length, 1, 'game over requires exactly one survivor');
    assert.equal(living[0]?.id, state.phase.winnerId);
  } else {
    assert.ok(living.length >= 2, 'a running game needs at least two living players');
    const active = state.players.find((p) => p.id === state.activePlayerId);
    assert.ok(active, 'active player must exist');
  }
}

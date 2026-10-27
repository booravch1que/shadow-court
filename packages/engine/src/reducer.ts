import {
  ACTION_RULES,
  EXCHANGE_DRAW,
  FOREIGN_AID_GAIN,
  INCOME_GAIN,
  STEAL_AMOUNT,
  TAX_GAIN,
} from './constants';
import { legalDeclarations } from './legal';
import { randomInt, shuffle } from './rng';
import {
  coinRoom,
  deepClone,
  findPlayer,
  getPlayer,
  isAlive,
  livingIdsExcept,
  livingPlayers,
} from './rules';
import type {
  ActionType,
  BlockChallengeWindowPhase,
  BlockWindowPhase,
  CancelReason,
  ChallengeContext,
  ChallengeWindowPhase,
  CoinCause,
  Command,
  Continuation,
  EngineError,
  EngineErrorCode,
  GameEvent,
  GameState,
  LossReason,
  PendingAction,
  PlayerCommand,
  PlayerId,
  PlayerState,
  ReduceResult,
  Role,
  SystemCommand,
} from './types';

type Events = GameEvent[];
type ResponseWindowPhase = ChallengeWindowPhase | BlockWindowPhase | BlockChallengeWindowPhase;

const fail = (code: EngineErrorCode, message: string): EngineError => ({ code, message });

/**
 * Applies one command to the game state.
 *
 * Pure: the input state is never modified. On success it returns the next state
 * plus the public events that describe what happened. On failure the state is
 * untouched and the error says why the command was rejected.
 */
export function reduce(state: GameState, command: Command): ReduceResult {
  const draft = deepClone(state);
  const events: Events = [];
  const error = dispatch(draft, command, events);
  return error ? { ok: false, error } : { ok: true, state: draft, events };
}

// ---------------------------------------------------------------------------
// Dispatch and validation
// ---------------------------------------------------------------------------

function dispatch(s: GameState, command: Command, ev: Events): EngineError | null {
  if (s.phase.type === 'gameOver') return fail('game_over', 'The game is over.');

  if (command.type === 'timeout') return handleTimeout(s, command, ev);
  if (command.type === 'forfeit') return handleForfeit(s, command, ev);

  const player = findPlayer(s, command.playerId);
  if (!player) return fail('unknown_player', `Unknown player ${command.playerId}.`);
  if (!isAlive(player)) return fail('player_eliminated', 'Eliminated players cannot act.');
  if (command.windowId !== s.phase.windowId) {
    return fail('stale_window', 'That response window is no longer open.');
  }

  switch (command.type) {
    case 'declare':
      return handleDeclare(s, player, command, ev);
    case 'pass':
      return handlePass(s, player, ev);
    case 'challenge':
      return handleChallenge(s, player, ev);
    case 'block':
      return handleBlock(s, player, command, ev);
    case 'chooseInfluence':
      return handleChooseInfluence(s, player, command, ev);
    case 'chooseExchange':
      return handleChooseExchange(s, player, command, ev);
  }
}

function nextWindowId(s: GameState): number {
  s.windowCounter += 1;
  return s.windowCounter;
}

// ---------------------------------------------------------------------------
// Declaring an action
// ---------------------------------------------------------------------------

function handleDeclare(
  s: GameState,
  actor: PlayerState,
  command: Extract<PlayerCommand, { type: 'declare' }>,
  ev: Events,
): EngineError | null {
  if (s.phase.type !== 'awaitingAction') {
    return fail('wrong_phase', 'Actions can only be declared at the start of a turn.');
  }
  if (s.activePlayerId !== actor.id) return fail('not_your_turn', 'It is not your turn.');

  const option = legalDeclarations(s, actor.id).find((o) => o.action === command.action);
  if (!option) return fail('illegal_action', `${command.action} is not available right now.`);

  let targetId: PlayerId | null = null;
  if (option.targets) {
    if (!command.targetId || !option.targets.includes(command.targetId)) {
      return fail('invalid_target', 'Choose another living player as the target.');
    }
    targetId = command.targetId;
  } else if (command.targetId !== undefined) {
    return fail('invalid_target', 'This action has no target.');
  }

  performDeclaration(s, actor, command.action, targetId, ev);
  return null;
}

function performDeclaration(
  s: GameState,
  actor: PlayerState,
  action: ActionType,
  targetId: PlayerId | null,
  ev: Events,
): void {
  if (action === 'skip') {
    actor.consecutiveSkips += 1;
    ev.push({ type: 'turnSkipped', playerId: actor.id });
    endTurn(s, ev);
    return;
  }

  const rule = ACTION_RULES[action];
  actor.consecutiveSkips = 0;
  const pending: PendingAction = { actorId: actor.id, action, targetId, cost: rule.cost };
  ev.push({
    type: 'actionDeclared',
    actorId: actor.id,
    action,
    targetId,
    claim: rule.claim,
    cost: rule.cost,
  });

  if (rule.cost > 0) {
    actor.coins -= rule.cost;
    ev.push({
      type: 'coinsChanged',
      playerId: actor.id,
      delta: -rule.cost,
      cause: action === 'coup' ? 'coup' : 'assassination',
    });
  }

  if (rule.claim) openChallengeWindow(s, pending);
  else if (rule.blockedBy.length > 0) openBlockWindow(s, pending);
  else resolveAction(s, pending, ev);
}

function openChallengeWindow(s: GameState, pending: PendingAction): void {
  s.phase = {
    type: 'challengeWindow',
    windowId: nextWindowId(s),
    pending,
    eligible: livingIdsExcept(s, pending.actorId),
    passed: [],
  };
}

function openBlockWindow(s: GameState, pending: PendingAction): void {
  s.phase = {
    type: 'blockWindow',
    windowId: nextWindowId(s),
    pending,
    eligible: livingIdsExcept(s, pending.actorId),
    passed: [],
  };
}

// ---------------------------------------------------------------------------
// Reaction windows: pass, challenge, block
// ---------------------------------------------------------------------------

function isResponseWindow(phase: GameState['phase']): phase is ResponseWindowPhase {
  return (
    phase.type === 'challengeWindow' ||
    phase.type === 'blockWindow' ||
    phase.type === 'blockChallengeWindow'
  );
}

function windowComplete(phase: ResponseWindowPhase): boolean {
  return phase.eligible.every((id) => phase.passed.includes(id));
}

function checkResponder(phase: ResponseWindowPhase, player: PlayerState): EngineError | null {
  if (!phase.eligible.includes(player.id)) {
    return fail('not_eligible', 'You cannot respond to this.');
  }
  if (phase.passed.includes(player.id)) {
    return fail('already_responded', 'You already passed. A pass is final.');
  }
  return null;
}

function handlePass(s: GameState, player: PlayerState, ev: Events): EngineError | null {
  const phase = s.phase;
  if (!isResponseWindow(phase)) return fail('wrong_phase', 'There is nothing to pass on.');
  const error = checkResponder(phase, player);
  if (error) return error;

  phase.passed.push(player.id);
  ev.push({ type: 'passed', playerId: player.id, auto: false });
  if (windowComplete(phase)) closeWindowPassed(s, ev);
  return null;
}

/** Every eligible player passed (or timed out): the window closes without a reaction. */
function closeWindowPassed(s: GameState, ev: Events): void {
  const phase = s.phase;
  switch (phase.type) {
    case 'challengeWindow':
      afterChallengePassed(s, phase.pending, ev);
      break;
    case 'blockWindow':
      resolveAction(s, phase.pending, ev);
      break;
    case 'blockChallengeWindow':
      // The block stands, so the action is cancelled.
      cancelAction(s, phase.pending, 'blocked', ev);
      break;
    default:
      break;
  }
}

function handleChallenge(s: GameState, challenger: PlayerState, ev: Events): EngineError | null {
  const phase = s.phase;
  let accusedId: PlayerId;
  let role: Role;
  let context: ChallengeContext;
  if (phase.type === 'challengeWindow') {
    const claim = ACTION_RULES[phase.pending.action].claim;
    if (!claim) return fail('wrong_phase', 'This action makes no claim to challenge.');
    accusedId = phase.pending.actorId;
    role = claim;
    context = 'action';
  } else if (phase.type === 'blockChallengeWindow') {
    accusedId = phase.block.blockerId;
    role = phase.block.role;
    context = 'block';
  } else {
    return fail('wrong_phase', 'There is nothing to challenge right now.');
  }
  const error = checkResponder(phase, challenger);
  if (error) return error;

  resolveChallenge(s, phase.pending, challenger, getPlayer(s, accusedId), role, context, ev);
  return null;
}

function resolveChallenge(
  s: GameState,
  pending: PendingAction,
  challenger: PlayerState,
  accused: PlayerState,
  role: Role,
  context: ChallengeContext,
  ev: Events,
): void {
  ev.push({ type: 'challenged', challengerId: challenger.id, accusedId: accused.id, role, context });
  const cardIndex = accused.hand.indexOf(role);
  const bluffCaught = cardIndex === -1;
  ev.push({
    type: 'challengeResolved',
    challengerId: challenger.id,
    accusedId: accused.id,
    role,
    context,
    bluffCaught,
  });

  if (bluffCaught) {
    if (context === 'action') {
      // The action fails. A caught Assassin gets the coins back.
      if (pending.cost > 0) {
        const actor = getPlayer(s, pending.actorId);
        actor.coins += pending.cost;
        ev.push({ type: 'coinsChanged', playerId: actor.id, delta: pending.cost, cause: 'refund' });
      }
      ev.push({
        type: 'actionCancelled',
        actorId: pending.actorId,
        action: pending.action,
        reason: 'challenged',
      });
      beginInfluenceLoss(s, accused.id, 'bluffCaught', { kind: 'endTurn' }, ev);
    } else {
      // The block was a bluff, so it is void and the action goes ahead.
      beginInfluenceLoss(s, accused.id, 'bluffCaught', { kind: 'resolve', pending }, ev);
    }
    return;
  }

  // The accused really holds the role: show it, swap it for a fresh card.
  ev.push({ type: 'cardRevealed', playerId: accused.id, role });
  replaceCard(s, accused, cardIndex);
  ev.push({ type: 'cardReplaced', playerId: accused.id });

  if (context === 'action') {
    // The action stands, subject to any remaining legal reactions (a block).
    beginInfluenceLoss(
      s,
      challenger.id,
      'challengeLost',
      { kind: 'afterChallengePassed', pending },
      ev,
    );
  } else {
    // The block stands, so the action is cancelled.
    ev.push({
      type: 'actionCancelled',
      actorId: pending.actorId,
      action: pending.action,
      reason: 'blocked',
    });
    beginInfluenceLoss(s, challenger.id, 'challengeLost', { kind: 'endTurn' }, ev);
  }
}

/** Puts the card at `index` back into the deck, reshuffles, and deals a fresh one in its place. */
function replaceCard(s: GameState, player: PlayerState, index: number): void {
  s.deck.push(player.hand[index] as Role);
  shuffle(s, s.deck);
  player.hand[index] = s.deck.shift() as Role;
}

function handleBlock(
  s: GameState,
  blocker: PlayerState,
  command: Extract<PlayerCommand, { type: 'block' }>,
  ev: Events,
): EngineError | null {
  const phase = s.phase;
  if (phase.type !== 'blockWindow') return fail('wrong_phase', 'There is nothing to block right now.');
  const error = checkResponder(phase, blocker);
  if (error) return error;
  if (!ACTION_RULES[phase.pending.action].blockedBy.includes(command.role)) {
    return fail('invalid_block', `${command.role} cannot block this action.`);
  }

  ev.push({
    type: 'blockDeclared',
    blockerId: blocker.id,
    role: command.role,
    actorId: phase.pending.actorId,
    action: phase.pending.action,
    targetId: phase.pending.targetId,
  });
  s.phase = {
    type: 'blockChallengeWindow',
    windowId: nextWindowId(s),
    pending: phase.pending,
    block: { blockerId: blocker.id, role: command.role },
    eligible: livingIdsExcept(s, blocker.id),
    passed: [],
  };
  return null;
}

// ---------------------------------------------------------------------------
// Resolving actions
// ---------------------------------------------------------------------------

/** The action survived its challenge window (or the challenge failed). */
function afterChallengePassed(s: GameState, pending: PendingAction, ev: Events): void {
  if (!ensureActionValid(s, pending, ev)) return;
  if (ACTION_RULES[pending.action].blockedBy.length > 0) openBlockWindow(s, pending);
  else resolveAction(s, pending, ev);
}

/** An action whose actor or target has been eliminated is cancelled. Returns false if so. */
function ensureActionValid(s: GameState, pending: PendingAction, ev: Events): boolean {
  if (!isAlive(getPlayer(s, pending.actorId))) {
    cancelAction(s, pending, 'actorEliminated', ev);
    return false;
  }
  if (pending.targetId !== null && !isAlive(getPlayer(s, pending.targetId))) {
    cancelAction(s, pending, 'targetEliminated', ev);
    return false;
  }
  return true;
}

function cancelAction(s: GameState, pending: PendingAction, reason: CancelReason, ev: Events): void {
  ev.push({ type: 'actionCancelled', actorId: pending.actorId, action: pending.action, reason });
  endTurn(s, ev);
}

/** Gives the player up to `amount` coins, respecting the cap. Returns what was actually gained. */
function gainCoins(
  player: PlayerState,
  amount: number,
  cause: CoinCause,
  ev: Events,
): number {
  const gained = Math.min(amount, coinRoom(player));
  if (gained > 0) {
    player.coins += gained;
    ev.push({ type: 'coinsChanged', playerId: player.id, delta: gained, cause });
  }
  return gained;
}

function resolveAction(s: GameState, pending: PendingAction, ev: Events): void {
  if (!ensureActionValid(s, pending, ev)) return;
  const actor = getPlayer(s, pending.actorId);
  const target = pending.targetId !== null ? getPlayer(s, pending.targetId) : null;

  let amount = 0;
  switch (pending.action) {
    case 'income':
      amount = gainCoins(actor, INCOME_GAIN, 'income', ev);
      break;
    case 'foreignAid':
      amount = gainCoins(actor, FOREIGN_AID_GAIN, 'foreignAid', ev);
      break;
    case 'tax':
      amount = gainCoins(actor, TAX_GAIN, 'tax', ev);
      break;
    case 'steal': {
      // The target only loses what the thief can actually receive.
      const stolen = Math.min(STEAL_AMOUNT, (target as PlayerState).coins, coinRoom(actor));
      if (stolen > 0) {
        (target as PlayerState).coins -= stolen;
        actor.coins += stolen;
        ev.push({ type: 'coinsChanged', playerId: (target as PlayerState).id, delta: -stolen, cause: 'steal' });
        ev.push({ type: 'coinsChanged', playerId: actor.id, delta: stolen, cause: 'steal' });
      }
      amount = stolen;
      break;
    }
    case 'coup':
    case 'assassinate':
    case 'exchange':
    case 'skip':
      break;
  }

  ev.push({
    type: 'actionResolved',
    actorId: actor.id,
    action: pending.action,
    targetId: pending.targetId,
    amount,
  });

  switch (pending.action) {
    case 'coup':
      beginInfluenceLoss(s, (target as PlayerState).id, 'couped', { kind: 'endTurn' }, ev);
      return;
    case 'assassinate':
      beginInfluenceLoss(s, (target as PlayerState).id, 'assassinated', { kind: 'endTurn' }, ev);
      return;
    case 'exchange':
      startExchange(s, actor, ev);
      return;
    default:
      endTurn(s, ev);
  }
}

// ---------------------------------------------------------------------------
// Influence loss, elimination, winning
// ---------------------------------------------------------------------------

function beginInfluenceLoss(
  s: GameState,
  playerId: PlayerId,
  reason: LossReason,
  next: Continuation,
  ev: Events,
): void {
  const player = getPlayer(s, playerId);
  if (!isAlive(player)) {
    proceed(s, next, ev);
    return;
  }
  const distinct = new Set(player.hand);
  if (distinct.size === 1) {
    // No real choice (one card left, or two identical cards): lose it automatically.
    loseCard(s, player, player.hand[0] as Role, reason, ev);
    proceed(s, next, ev);
    return;
  }
  s.phase = { type: 'influenceLoss', windowId: nextWindowId(s), playerId, reason, next };
}

function loseCard(s: GameState, player: PlayerState, role: Role, reason: LossReason, ev: Events): void {
  player.hand.splice(player.hand.indexOf(role), 1);
  player.revealed.push(role);
  ev.push({ type: 'influenceLost', playerId: player.id, role, reason });
  if (player.hand.length === 0) eliminate(s, player, ev);
}

function eliminate(s: GameState, player: PlayerState, ev: Events): void {
  if (player.coins > 0) {
    ev.push({ type: 'coinsChanged', playerId: player.id, delta: -player.coins, cause: 'eliminated' });
    player.coins = 0; // back to the (unlimited) treasury
  }
  ev.push({ type: 'playerEliminated', playerId: player.id });

  const living = livingPlayers(s);
  if (living.length === 1) {
    const winner = living[0] as PlayerState;
    // Cards drawn for an unfinished exchange live only in the phase: put them back
    // before it is replaced, so no card ever disappears.
    if (s.phase.type === 'exchange') returnToDeck(s, s.phase.options.slice(s.phase.keep));
    s.phase = { type: 'gameOver', winnerId: winner.id };
    ev.push({ type: 'gameOver', winnerId: winner.id });
  }
}

function proceed(s: GameState, next: Continuation, ev: Events): void {
  if (s.phase.type === 'gameOver') return;
  switch (next.kind) {
    case 'endTurn':
      endTurn(s, ev);
      break;
    case 'afterChallengePassed':
      afterChallengePassed(s, next.pending, ev);
      break;
    case 'resolve':
      resolveAction(s, next.pending, ev);
      break;
  }
}

function handleChooseInfluence(
  s: GameState,
  player: PlayerState,
  command: Extract<PlayerCommand, { type: 'chooseInfluence' }>,
  ev: Events,
): EngineError | null {
  const phase = s.phase;
  if (phase.type !== 'influenceLoss') return fail('wrong_phase', 'Nobody has to lose influence now.');
  if (phase.playerId !== player.id) return fail('not_eligible', 'Another player is choosing a card.');
  if (!player.hand.includes(command.role)) {
    return fail('invalid_choice', 'You do not hold that card.');
  }
  loseCard(s, player, command.role, phase.reason, ev);
  proceed(s, phase.next, ev);
  return null;
}

// ---------------------------------------------------------------------------
// Turn flow
// ---------------------------------------------------------------------------

function endTurn(s: GameState, ev: Events): void {
  if (s.phase.type === 'gameOver') return;
  const count = s.players.length;
  const from = s.players.findIndex((p) => p.id === s.activePlayerId);
  for (let step = 1; step <= count; step++) {
    const candidate = s.players[(from + step) % count] as PlayerState;
    if (isAlive(candidate)) {
      s.activePlayerId = candidate.id;
      break;
    }
  }
  s.turn += 1;
  s.phase = { type: 'awaitingAction', windowId: nextWindowId(s) };
  ev.push({ type: 'turnStarted', playerId: s.activePlayerId, turn: s.turn });
}

// ---------------------------------------------------------------------------
// Shaman exchange
// ---------------------------------------------------------------------------

function startExchange(s: GameState, actor: PlayerState, ev: Events): void {
  const drawn = s.deck.splice(0, EXCHANGE_DRAW);
  s.phase = {
    type: 'exchange',
    windowId: nextWindowId(s),
    playerId: actor.id,
    options: [...actor.hand, ...drawn],
    keep: actor.hand.length,
  };
  ev.push({ type: 'exchangeStarted', playerId: actor.id });
}

function returnToDeck(s: GameState, cards: Role[]): void {
  s.deck.push(...cards);
  shuffle(s, s.deck);
}

/** True when `keep` is a sub-multiset of `options`. */
function isSubMultiset(options: Role[], keep: Role[]): boolean {
  const pool = [...options];
  for (const role of keep) {
    const at = pool.indexOf(role);
    if (at === -1) return false;
    pool.splice(at, 1);
  }
  return true;
}

function handleChooseExchange(
  s: GameState,
  player: PlayerState,
  command: Extract<PlayerCommand, { type: 'chooseExchange' }>,
  ev: Events,
): EngineError | null {
  const phase = s.phase;
  if (phase.type !== 'exchange') return fail('wrong_phase', 'There is no exchange in progress.');
  if (phase.playerId !== player.id) return fail('not_eligible', 'Another player is exchanging.');
  if (command.keep.length !== phase.keep || !isSubMultiset(phase.options, command.keep)) {
    return fail('invalid_choice', `Keep exactly ${phase.keep} of the offered cards.`);
  }

  const leftover = [...phase.options];
  for (const role of command.keep) leftover.splice(leftover.indexOf(role), 1);
  player.hand = [...command.keep];
  returnToDeck(s, leftover);
  ev.push({ type: 'exchangeCompleted', playerId: player.id });
  endTurn(s, ev);
  return null;
}

// ---------------------------------------------------------------------------
// Timeouts
// ---------------------------------------------------------------------------

function handleTimeout(
  s: GameState,
  command: Extract<SystemCommand, { type: 'timeout' }>,
  ev: Events,
): EngineError | null {
  const phase = s.phase;
  if (phase.type === 'gameOver') return fail('game_over', 'The game is over.');
  if (command.windowId !== phase.windowId) {
    return fail('stale_window', 'That response window is no longer open.');
  }

  switch (phase.type) {
    case 'challengeWindow':
    case 'blockWindow':
    case 'blockChallengeWindow':
      // Everybody who has not answered passes.
      for (const id of phase.eligible) {
        if (!phase.passed.includes(id)) {
          phase.passed.push(id);
          ev.push({ type: 'passed', playerId: id, auto: true });
        }
      }
      closeWindowPassed(s, ev);
      return null;

    case 'influenceLoss': {
      const player = getPlayer(s, phase.playerId);
      ev.push({ type: 'timedOut', playerId: player.id, during: 'influence' });
      const role = player.hand[randomInt(s, player.hand.length)] as Role;
      loseCard(s, player, role, phase.reason, ev);
      proceed(s, phase.next, ev);
      return null;
    }

    case 'exchange':
      // Keep the original hand; the drawn cards go back.
      ev.push({ type: 'timedOut', playerId: phase.playerId, during: 'exchange' });
      returnToDeck(s, phase.options.slice(phase.keep));
      ev.push({ type: 'exchangeCompleted', playerId: phase.playerId });
      endTurn(s, ev);
      return null;

    case 'awaitingAction': {
      const player = getPlayer(s, s.activePlayerId);
      ev.push({ type: 'timedOut', playerId: player.id, during: 'turn' });
      autoPlay(s, player, ev);
      return null;
    }
  }
}

/** Turn timeout: Skip if legal, else Income, else Coup a random opponent. */
function autoPlay(s: GameState, player: PlayerState, ev: Events): void {
  const options = legalDeclarations(s, player.id);
  if (options.some((o) => o.action === 'skip')) {
    performDeclaration(s, player, 'skip', null, ev);
    return;
  }
  if (options.some((o) => o.action === 'income')) {
    performDeclaration(s, player, 'income', null, ev);
    return;
  }
  const choice = options.find((o) => o.action === 'coup') ?? (options[0] as (typeof options)[number]);
  const targets = choice.targets;
  const targetId = targets ? (targets[randomInt(s, targets.length)] as PlayerId) : null;
  performDeclaration(s, player, choice.action, targetId, ev);
}

// ---------------------------------------------------------------------------
// Forfeit (a player is removed mid-game)
// ---------------------------------------------------------------------------

function handleForfeit(
  s: GameState,
  command: Extract<SystemCommand, { type: 'forfeit' }>,
  ev: Events,
): EngineError | null {
  const player = findPlayer(s, command.playerId);
  if (!player) return fail('unknown_player', `Unknown player ${command.playerId}.`);
  if (!isAlive(player)) return fail('player_eliminated', 'That player is already eliminated.');

  ev.push({ type: 'playerForfeited', playerId: player.id });
  while (player.hand.length > 0) {
    loseCard(s, player, player.hand[0] as Role, 'forfeit', ev);
  }
  if (s.phase.type === 'gameOver') return null;
  repairPhaseAfterElimination(s, player.id, ev);
  return null;
}

function dropFromWindow(phase: ResponseWindowPhase, id: PlayerId): void {
  phase.eligible = phase.eligible.filter((x) => x !== id);
  phase.passed = phase.passed.filter((x) => x !== id);
}

/**
 * A player was removed while the game was in the middle of something. Whatever
 * was waiting on them is settled so the game can never get stuck.
 */
function repairPhaseAfterElimination(s: GameState, id: PlayerId, ev: Events): void {
  const phase = s.phase;
  switch (phase.type) {
    case 'awaitingAction':
      if (s.activePlayerId === id) endTurn(s, ev);
      return;

    case 'challengeWindow':
    case 'blockWindow':
      if (phase.pending.actorId === id) return cancelAction(s, phase.pending, 'actorEliminated', ev);
      if (phase.pending.targetId === id) return cancelAction(s, phase.pending, 'targetEliminated', ev);
      dropFromWindow(phase, id);
      if (windowComplete(phase)) closeWindowPassed(s, ev);
      return;

    case 'blockChallengeWindow':
      if (phase.pending.actorId === id) return cancelAction(s, phase.pending, 'actorEliminated', ev);
      if (phase.pending.targetId === id) return cancelAction(s, phase.pending, 'targetEliminated', ev);
      // A blocker who leaves takes the block with them: the action goes ahead.
      if (phase.block.blockerId === id) return resolveAction(s, phase.pending, ev);
      dropFromWindow(phase, id);
      if (windowComplete(phase)) closeWindowPassed(s, ev);
      return;

    case 'influenceLoss':
      if (phase.playerId === id) proceed(s, phase.next, ev);
      return;

    case 'exchange':
      if (phase.playerId === id) {
        returnToDeck(s, phase.options.slice(phase.keep));
        endTurn(s, ev);
      }
      return;

    case 'gameOver':
      return;
  }
}

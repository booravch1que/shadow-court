# Game Rules (consolidated specification)

This is the single source of truth for the rules the engine implements. It merges the
original brief, the owner's answers (Q1-Q14) and the recommended defaults the owner
accepted (Q15-Q38). Where this file and the code disagree, that is a bug in one of them.

Working title: **Shadow Court**.

## 1. Setup

| Item | Rule |
|---|---|
| Players | 2-6 |
| Roles | Governor, Assassin, Thief, Shaman, Duchess |
| Deck | 2-4 players: 3 copies of each role (15 cards). 5-6 players: 4 copies (20 cards). |
| Hand | Every player is dealt 2 hidden influence cards |
| Coins | Every player starts with 2 coins, in every player count. No first-player adjustment. |
| Treasury | Unlimited |
| Coin cap | A player can never hold more than **11** coins |
| Seating | Random. The first seat plays first. Turns go clockwise. |

Lost influence cards are revealed face-up and stay public. A player with 0 hidden cards
is eliminated and their coins return to the treasury. The last living player wins, and
the game ends immediately, even if an action was pending.

## 2. Actions

On their turn the active player declares exactly one action.

| Action | Claim | Cost | Effect | Challengeable | Blockable by |
|---|---|---|---|---|---|
| Income | none | 0 | +1 coin | no | nobody |
| Foreign Aid | none | 0 | +2 coins | no | Governor |
| Coup | none | 7 | Target loses 1 influence | no | nobody |
| Tax | Governor | 0 | +3 coins | yes | nobody |
| Steal | Thief | 0 | Take up to 2 coins from the target | yes | Thief, Shaman |
| Assassinate | Assassin | 3 | Target loses 1 influence | yes | Duchess |
| Exchange | Shaman | 0 | Draw 2, keep as many as you held | yes | nobody |
| Skip | none | 0 | Do nothing | no | nobody |

Targeted actions (Coup, Steal, Assassinate) need another **living** player. No self-targeting.
Costs are paid when the action is declared and checked at that moment.

### Coin cap

- Gains are capped: Tax at 10 coins gives 1.
- An action that would give 0 coins is **not offered**: Income, Foreign Aid, Tax and Steal
  are unavailable at 11 coins. Skip, Exchange, Assassinate and Coup are still available.
- Steal moves `min(2, target's coins, thief's room under 11)`. The target loses only what
  the thief actually receives. Stealing from a player with 0 coins is legal and moves 0.

### Skipping and mandatory Coup

- A player may skip, but at most **2 turns in a row**. The third turn must be a real action.
  Any non-skip action resets the counter.
- **Coup is mandatory when every living player holds at least 7 coins.** It is evaluated
  at the start of each turn from the current living players and balances. The active
  player must Coup another living player. Skip and all other actions are unavailable.
- Holding 10 or 11 coins does **not** force a Coup by itself.

## 3. Bluffing and challenges

A player never has to hold the role they claim. Any living player other than the claimant
may challenge a role claim, whether or not they are involved in the action.

- **Bluff caught** (accused does not hold the role): the accused loses one influence card of
  their choice, and the challenged action or block fails.
- **Challenge fails** (accused holds the role): the accused shows the card, draws a replacement
  from the top of the deck, and the shown card goes to the bottom of the deck. The challenger loses
  one influence card of their choice. The action or block stands.
- If the loser has a single card, it is lost automatically. With two identical cards the loser
  still chooses, so the instant resolution does not reveal the pair.

## 4. Reaction order

Each reaction window is answered with explicit **Pass** (final), **Challenge** or **Block**.
A window closes early once every eligible player has answered, and on the first valid
challenge or block. Anything arriving later for that window is rejected as stale. Every
player command carries the `windowId` of the window it answers, which is how simultaneous
and duplicate requests are resolved ("first valid response wins").

1. **Challenge window**, only for actions that make a claim. Eligible: every living player
   except the actor.
2. **Block window**, only for blockable actions. Eligible: every living player except the
   actor, including the target (who has no priority). The blocker names the role they claim.
   The first valid block wins.
3. **Block challenge window.** Eligible: every living player except the blocker, including
   the actor. Counter-blocking is not allowed.

Once an action has passed its challenge window, its original claim can no longer be
challenged, even if it is blocked later.

### Outcomes

| Situation | Result |
|---|---|
| Action challenged, bluff caught | Action cancelled. Actor loses a card. Coins paid are refunded. Turn ends. |
| Action challenged, challenge fails | Challenger loses a card. The action continues to the block window (or resolves). |
| Block challenged, bluff caught | Blocker loses a card. The block is void and the action resolves. No second block. |
| Block challenged, challenge fails | Challenger loses a card. The block stands and the action is cancelled. |
| Everyone passes a block window | The action resolves. |
| Everyone passes a block challenge window | The block stands and the action is cancelled. |

### Money rules for the Assassin

- The 3 coins are paid when declaring.
- Refunded only if the Assassin is caught bluffing.
- Not refunded if blocked by a real or unchallenged Duchess.
- Not refunded if the challenge fails and the assassination continues.
- Not refunded if the target is eliminated before the assassination lands.

### Elimination during resolution

- If the actor or the target is eliminated before an action resolves, the action is cancelled.
  Coins already paid stay spent, except for the caught-bluff refund above.
- A target with 2 cards can lose both in one turn (failed challenge, then the assassination).
- Eliminated players cannot act, challenge or block, but keep watching.

## 5. Timers and timeouts

Presets chosen by the host: Relaxed (about 2x), **Standard**, Fast (about 0.5x), No timers.

| Timer | Standard |
|---|---|
| Turn | 60 s |
| Reaction window | 20 s |
| Card choice (influence loss, exchange) | 30 s |

On timeout:

- Reaction window: everyone who has not answered passes.
- Influence loss: a random card is discarded.
- Exchange: the original cards are kept.
- Turn: Skip if legal, otherwise Income, otherwise Coup on a random opponent.

Timers live in the server. The engine only receives a `timeout` command for a window id.

## 6. Players leaving

- **Forfeit** (host removes a player): their cards are revealed and discarded, their coins go
  back to the treasury, and anything waiting on them is settled so the game cannot get stuck.
- A blocker who forfeits takes the block with them, and the action goes ahead.
- Disconnected players keep their seat. Timers keep running. Three consecutive timeouts mark
  a player Away (server concern).

## 7. Hidden information

The server holds the full state. Each client receives only a personalized view: public state
plus the viewer's own hand and legal moves. Never sent to anyone: other players' hands, the
deck order, the PRNG state and another player's exchange options. Spectators and eliminated
players receive the public view only.

## 8. Randomness

The engine uses a seeded PRNG (mulberry32) stored inside the game state, so every game is
exactly replayable in tests. It is not cryptographically secure, so **the server must seed
each game from a secure source** (`crypto.randomInt` or similar).

## 9. Engine decisions not covered by the owner's answers

These small decisions follow the accepted plan and can be changed:

- The skip counter resets after any non-skip action.
- Exchange with 1 card left draws 2 and keeps 1. The rest go back to the deck, reshuffled.
- A player cannot be both the actor and a responder in the same window.
- Reaction windows exclude eliminated players; a player eliminated mid-window is dropped from it.

## 10. Rooms and sessions (server behaviour)

Implemented in `packages/server`; the engine knows nothing about any of this.

- **Rooms:** 2-6 players, up to 10 spectators, 5-character codes without I, L, O, 0, 1.
  Nicknames are 2-16 characters and unique per room (case-insensitive).
- **Identity:** each participant gets a secret token. A refresh or reconnect with the token
  returns the same seat and a fresh snapshot. A command's player is always the identity bound
  to the connection; fields a client invents are dropped. A second connection with the same
  token replaces the first.
- **Host:** the creator. If the host disconnects or leaves, host rights go to the
  longest-connected player (spectators only if no player is connected). Returning does not
  reclaim them. Only the host starts, changes settings (not during a game) and removes people.
- **Seats in the lobby:** a disconnected player keeps their seat until the game starts, then
  it is released.
- **Removing players:** in the lobby the host can remove anyone. During a game only players
  who are Away or disconnected can be removed (they forfeit). Leaving mid-game also forfeits.
- **Away:** three consecutive missed timers. The player's windows shrink to 5 s while every
  player being waited for is Away. Any action clears the mark. With "No timers" nobody is
  ever Away.
- **Spectators:** receive the public view only. They can join mid-game if the host allows it.
  Eliminated players keep their seat as a viewer and receive only public data.
- **Rematch:** after a game, "Play again" marks a player ready (a spectator takes a seat if
  one is free). When every connected player is ready a new game starts by itself. The host can
  also start with whoever is ready; the others become spectators.
- **Emotes:** a fixed set, one per second per person. No free-text chat.
- **Expiry:** a room with nobody connected is deleted after 2 hours. Rooms live in memory,
  so a server restart ends every game.
- **Limits:** at most 10 create/join/rejoin attempts per connection per minute. Per-IP limits
  belong to the transport adapter.
- **Events:** public game events are numbered 1..N per room and sent in order; every view
  carries the number of the latest event it includes.

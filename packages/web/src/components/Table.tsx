import type { GameView } from '@shadow-court/engine';
import { nameIn } from '../controller';
import { useApp, useT } from '../hooks';
import { opponentsInOrder, seatPositions, type UiStatus } from '../logic/ui-state';
import { CardBack, Coin, RoleCard } from './Cards';
import { ClaimView } from './Claim';
import { useFx } from './Fx';
import { Seat } from './Seat';

const BOTTOM = { x: 50, y: 88 };

/** The players around the table, and in the middle what is going on right now. */
export function Table({ view, status }: { view: GameView; status: UiStatus }) {
  const t = useT();
  const room = useApp((s) => s.room);
  const self = view.viewerId ? view.players.find((p) => p.id === view.viewerId) : undefined;

  // The viewer sits at the bottom; everyone else follows clockwise. A spectator
  // sees the first seat at the bottom instead.
  const others = opponentsInOrder(view.players, view.viewerId);
  const ring = self ? [self, ...others] : others;
  const around = seatPositions(ring.length - 1);

  const claim = status.claim;
  const phase = view.phase;
  const awaitedModes = ['waitingTurn', 'myTurn', 'waitingLoss', 'chooseLoss', 'waitingExchange', 'chooseExchange'];

  return (
    <div className="table" data-count={ring.length}>
      <div className="table-felt" />
      <div className="table-center">
        <Tabletop view={view} />
        {claim ? (
          <ClaimView claim={claim} />
        ) : phase.type === 'influenceLoss' ? (
          <p className="center-note">{t('center.losing', { name: nameIn(room, phase.playerId) })}</p>
        ) : phase.type === 'exchange' ? (
          <p className="center-note">{t('center.exchanging', { name: nameIn(room, phase.playerId) })}</p>
        ) : phase.type === 'awaitingAction' ? (
          <p className="center-note">{t('center.turnOf', { name: nameIn(room, view.activePlayerId) })}</p>
        ) : null}
        <p className="center-meta">{t('center.turn', { turn: view.turn })}</p>
      </div>
      {ring.map((player, index) => {
        const pos = index === 0 ? BOTTOM : (around[index - 1] ?? BOTTOM);
        return (
          <Seat
            key={player.id}
            player={player}
            name={nameIn(room, player.id)}
            participant={room?.participants.find((p) => p.id === player.id)}
            isSelf={player.id === view.viewerId}
            isTurn={phase.type === 'awaitingAction' && view.activePlayerId === player.id}
            isAwaited={
              status.waitingOn.includes(player.id) ||
              (awaitedModes.includes(status.mode) && status.subjectId === player.id)
            }
            isActor={claim?.actorId === player.id}
            isTarget={claim?.targetId === player.id}
            isBlocker={claim?.block?.blockerId === player.id}
            passed={status.passed.includes(player.id)}
            x={pos.x}
            y={pos.y}
          />
        );
      })}
    </div>
  );
}

/** The deck, the bank, and every lost card face-up in the middle for all to see. */
function Tabletop({ view }: { view: GameView }) {
  const t = useT();
  const room = useApp((s) => s.room);
  // Cards still flipping over on their way here are not shown yet.
  const inFlight = useFx((s) => s.lag.discard);
  const lost = view.players.flatMap((p) =>
    p.revealed
      .slice(0, Math.max(0, p.revealed.length - (inFlight[p.id] ?? 0)))
      .map((role, i) => ({ role, owner: p.id, key: `${p.id}:${i}` })),
  );

  return (
    <div className="tabletop">
      <div className="pile" data-fx="deck">
        <span className="pile-stack">
          <CardBack size="xs" />
          <CardBack size="xs" />
          <CardBack size="xs" />
        </span>
        <span className="pile-label">
          {t('center.deckLabel')} · {view.deckCount}
        </span>
      </div>
      <div className="discard" data-fx="discard" aria-label={t('center.discard')}>
        {lost.length === 0 ? (
          <span className="discard-empty">{t('center.discard')}</span>
        ) : (
          lost.map((card) => (
            <span key={card.key} className="discard-card" title={nameIn(room, card.owner)}>
              <RoleCard role={card.role} size="xs" />
            </span>
          ))
        )}
      </div>
      <div className="pile" data-fx="bank">
        <span className="pile-stack bank-stack">
          <Coin />
          <Coin />
          <Coin />
          <Coin />
        </span>
        <span className="pile-label">{t('center.bank')}</span>
      </div>
    </div>
  );
}

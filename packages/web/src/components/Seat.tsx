import type { PublicPlayer } from '@shadow-court/engine';
import type { PublicParticipant } from '@shadow-court/protocol';
import type { CSSProperties } from 'react';
import { useT } from '../hooks';
import { CardBack, CoinCount } from './Cards';
import { useLag } from './Fx';

export interface SeatProps {
  player: PublicPlayer;
  name: string;
  participant?: PublicParticipant;
  isSelf: boolean;
  /** It is this player's turn. */
  isTurn: boolean;
  /** The game is waiting for this player to do something. */
  isAwaited: boolean;
  isActor: boolean;
  isTarget: boolean;
  isBlocker: boolean;
  passed: boolean;
  x: number;
  y: number;
}

/** One player around the table: name, hidden cards, lost cards, coins and status tags. */
export function Seat(props: SeatProps) {
  const { player, participant } = props;
  const t = useT();
  const coinLag = useLag('coins', player.id);
  const cardLag = useLag('cards', player.id);
  const backs = Math.max(0, player.cardCount - cardLag);
  const gone = Math.max(0, player.revealed.length - useLag('discard', player.id));
  const tags: { key: string; cls: string }[] = [];
  if (!player.alive) tags.push({ key: 'seat.out', cls: 'tag-out' });
  else {
    if (props.isTurn) tags.push({ key: 'seat.turn', cls: 'tag-turn' });
    if (props.isBlocker) tags.push({ key: 'seat.blocks', cls: 'tag-block' });
    else if (props.isActor) tags.push({ key: 'seat.claims', cls: 'tag-claim' });
    if (props.isTarget) tags.push({ key: 'seat.target', cls: 'tag-target' });
    if (props.passed) tags.push({ key: 'seat.passed', cls: 'tag-pass' });
    if (participant && !participant.connected) tags.push({ key: 'seat.offline', cls: 'tag-off' });
    else if (participant?.away) tags.push({ key: 'seat.away', cls: 'tag-off' });
  }

  const classes = [
    'seat',
    props.isSelf ? 'seat-self' : '',
    !player.alive ? 'seat-dead' : '',
    props.isTurn ? 'seat-turn' : '',
    props.isAwaited && player.alive ? 'seat-awaited' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className={classes}
      style={{ '--x': `${props.x}%`, '--y': `${props.y}%` } as CSSProperties}
      data-player={player.id}
      data-fx={`seat:${player.id}`}
    >
      <div className="seat-head">
        {participant?.isHost && <span className="crown" title={t('lobby.host')}>♛</span>}
        <span className="seat-name">{props.name}</span>
      </div>
      <div className="seat-cards" data-fx={`cards:${player.id}`}>
        {Array.from({ length: backs }, (_, i) => (
          <CardBack key={`b${i}`} size="sm" />
        ))}
        {Array.from({ length: gone }, (_, i) => (
          <span key={`e${i}`} className="card-gone" title={t('card.lost')} />
        ))}
      </div>
      <div className="seat-foot">
        <span data-fx={`coins:${player.id}`}>
          <CoinCount value={player.coins - coinLag} />
        </span>
        {tags.map((tag) => (
          <span key={tag.key} className={`tag ${tag.cls}`}>
            {t(tag.key)}
          </span>
        ))}
      </div>
    </div>
  );
}

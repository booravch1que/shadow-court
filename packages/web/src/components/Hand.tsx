import type { GameView } from '@shadow-court/engine';
import { nameIn } from '../controller';
import { useApp, useT } from '../hooks';
import { relationOf } from '../logic/ui-state';
import { CoinCount, RoleCard } from './Cards';
import { useLag } from './Fx';

/** The viewer's own cards and coins. Spectators and eliminated players see a short note instead. */
export function Hand({ view }: { view: GameView }) {
  const t = useT();
  const room = useApp((s) => s.room);
  const relation = relationOf(view);
  const me = view.players.find((p) => p.id === view.viewerId);
  const coinLag = useLag('coins', view.viewerId ?? '');

  if (relation === 'spectator') {
    return <div className="hand hand-note">{t('hand.spectating')}</div>;
  }
  if (!me) return null;
  return (
    <div className="hand">
      <div className="hand-info">
        <span className="hand-name">{nameIn(room, me.id)}</span>
        <span data-fx={`coins:${me.id}`}>
          <CoinCount value={me.coins - coinLag} big />
        </span>
      </div>
      <div className="card-row" data-fx={`cards:${me.id}`}>
        {view.me?.hand.map((role, i) => <RoleCard key={`${role}${i}`} role={role} size="lg" />)}
        {me.revealed.map((role, i) => <RoleCard key={`l${role}${i}`} role={role} size="sm" state="lost" />)}
      </div>
      {relation === 'eliminated' && <p className="muted">{t('hand.eliminated')}</p>}
    </div>
  );
}

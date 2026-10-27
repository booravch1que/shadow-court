import type { GameView } from '@shadow-court/engine';
import { nameIn } from '../controller';
import { RoleCard } from '../components/Cards';
import { useApp, useController, useT } from '../hooks';

/** Winner announcement and rematch controls, shown over the finished table. */
export function End({ view }: { view: GameView }) {
  const t = useT();
  const app = useController();
  const room = useApp((s) => s.room);
  const joined = useApp((s) => s.joined);
  if (view.phase.type !== 'gameOver' || !room || !joined) return null;

  const winnerId = view.phase.winnerId;
  const youWon = winnerId === joined.selfId;
  const me = room.participants.find((p) => p.id === joined.selfId);
  const isHost = room.hostId === joined.selfId;
  const ready = room.participants.filter((p) => p.ready);
  const everyone = room.participants.filter((p) => p.kind === 'player' && p.connected);
  const standings = [...view.players].sort((a, b) => Number(b.alive) - Number(a.alive) || b.revealed.length - a.revealed.length);

  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="end-title">
      <div className="end sheet">
        <p className="end-crown" aria-hidden="true">♛</p>
        <h2 id="end-title" className="end-title">
          {youWon ? t('end.youWon') : t('end.winner', { name: nameIn(room, winnerId) })}
        </h2>
        <ul className="standings">
          {standings.map((p) => (
            <li key={p.id} className={`standing${p.id === winnerId ? ' winner' : ''}`}>
              <span className="standing-name">{nameIn(room, p.id)}</span>
              <span className="standing-cards">
                {p.revealed.map((role, i) => <RoleCard key={i} role={role} size="xs" state="lost" />)}
              </span>
            </li>
          ))}
        </ul>
        <div className="button-row">
          <button type="button" className="btn btn-primary btn-lg" disabled={me?.ready} onClick={() => app.playAgain()}>
            {me?.ready ? t('end.waiting') : t('end.playAgain')}
          </button>
          {isHost && ready.length >= 2 && ready.length < everyone.length && (
            <button type="button" className="btn btn-secondary" onClick={() => app.startGame()}>
              {t('end.startNow', { count: ready.length })}
            </button>
          )}
          <button type="button" className="btn btn-ghost" onClick={() => app.leaveRoom()}>
            {t('end.leave')}
          </button>
        </div>
        <p className="muted small">{t('end.ready', { ready: ready.length, total: everyone.length })}</p>
      </div>
    </div>
  );
}

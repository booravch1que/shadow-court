import { useState } from 'react';
import { useApp, useT } from '../hooks';
import { deriveStatus, relationOf } from '../logic/ui-state';
import { Hand } from '../components/Hand';
import { Banner, ControlPanel } from '../components/Panels';
import { EmoteBar, EmoteFloat, Log, TimerBar } from '../components/Chrome';
import { Table } from '../components/Table';
import { End } from './End';

export function Game() {
  const t = useT();
  const view = useApp((s) => s.view);
  const [logOpen, setLogOpen] = useState(false);
  if (!view) return <main className="loading">{t('loading')}</main>;

  const status = deriveStatus(view);
  const relation = relationOf(view);
  const over = view.phase.type === 'gameOver';

  return (
    <main className={`game mode-${status.mode}`}>
      <section className="stage">
        <Table view={view} status={status} />
        {relation !== 'player' && (
          <p className="watching">{relation === 'spectator' ? t('game.spectating') : t('game.eliminated')}</p>
        )}
      </section>

      <section className="dock">
        {!over && <Banner view={view} status={status} />}
        {!over && <TimerBar />}
        {!over && <ControlPanel view={view} status={status} />}
        <Hand view={view} />
        <EmoteBar />
      </section>

      <aside className={`log-col${logOpen ? ' open' : ''}`}>
        <button type="button" className="log-toggle" onClick={() => setLogOpen((o) => !o)} aria-expanded={logOpen}>
          {logOpen ? t('log.hide') : t('log.show')}
        </button>
        <Log />
      </aside>

      <EmoteFloat />
      {over && <End view={view} />}
    </main>
  );
}



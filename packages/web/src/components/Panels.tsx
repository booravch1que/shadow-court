import { ACTION_RULES, MAX_COINS, type ActionType, type GameView, type Role } from '@shadow-court/engine';
import { useState } from 'react';
import { nameIn } from '../controller';
import { useApp, useController, useT } from '../hooks';
import type { UiStatus } from '../logic/ui-state';
import { RoleCard } from './Cards';
import { ClaimView, RoleChip } from './Claim';

const ACTION_ORDER: ActionType[] = ['income', 'foreignAid', 'tax', 'steal', 'exchange', 'assassinate', 'coup', 'skip'];

function windowIdOf(view: GameView): number {
  return view.phase.type === 'gameOver' ? 0 : view.phase.windowId;
}

/** One line that says, in a distinct colour, what the viewer is expected to do (or wait for). */
export function Banner({ view, status }: { view: GameView; status: UiStatus }) {
  const t = useT();
  const room = useApp((s) => s.room);
  const name = (id: string | null) => (id ? nameIn(room, id) : '');
  const waiting = status.waitingOn.map((id) => nameIn(room, id)).join(', ');

  let text: string;
  switch (status.mode) {
    case 'myTurn':
      text = view.mandatoryCoup ? t('banner.mandatoryCoup') : t('banner.myTurn');
      break;
    case 'waitingTurn':
      text = t('banner.waitingTurn', { name: name(status.subjectId) });
      break;
    case 'canChallenge':
      text = status.claim?.stage === 'block' ? t('banner.canChallengeBlock') : t('banner.canChallenge');
      break;
    case 'canBlock':
      text = t('banner.canBlock');
      break;
    case 'waitingReaction':
      text = waiting ? t('banner.waitingReaction', { names: waiting }) : t('banner.resolving');
      break;
    case 'chooseLoss':
      text = t('banner.chooseLoss');
      break;
    case 'waitingLoss':
      text = t('banner.waitingLoss', { name: name(status.subjectId) });
      break;
    case 'chooseExchange':
      text = t('banner.chooseExchange');
      break;
    case 'waitingExchange':
      text = t('banner.waitingExchange', { name: name(status.subjectId) });
      break;
    case 'gameOver':
      text = t('banner.gameOver');
      break;
  }
  return (
    <div className={`banner banner-${status.mode}`} role="status" aria-live="polite">
      {text}
    </div>
  );
}

function whyDisabled(action: ActionType, view: GameView): string {
  const me = view.players.find((p) => p.id === view.viewerId);
  const coins = me?.coins ?? 0;
  if (view.mandatoryCoup && action !== 'coup') return 'why.mandatory';
  const cost = ACTION_RULES[action].cost;
  if (cost > coins) return 'why.needCoins';
  if (action === 'skip') return 'why.skipLimit';
  if (coins >= MAX_COINS) return 'why.full';
  return 'why.unavailable';
}

/** The eight actions. Targeted ones open a second step to pick the target. */
export function ActionBar({ view }: { view: GameView }) {
  const t = useT();
  const app = useController();
  const room = useApp((s) => s.room);
  const [picking, setPicking] = useState<ActionType | null>(null);
  const offered = new Map((view.me?.moves.declarations ?? []).map((d) => [d.action, d]));
  const windowId = windowIdOf(view);

  if (picking) {
    const targets = offered.get(picking)?.targets ?? [];
    return (
      <div className="panel">
        <h3 className="panel-title">{t('actions.pickTarget', { action: t(`action.${picking}`) })}</h3>
        <div className="chips">
          {targets.map((id) => (
            <button
              key={id}
              type="button"
              className="btn btn-target"
              onClick={() => {
                app.command({ type: 'declare', windowId, action: picking, targetId: id });
                setPicking(null);
              }}
            >
              {nameIn(room, id)}
            </button>
          ))}
        </div>
        <button type="button" className="btn btn-ghost" onClick={() => setPicking(null)}>
          {t('actions.cancel')}
        </button>
      </div>
    );
  }

  return (
    <div className="panel">
      <div className="actions">
        {ACTION_ORDER.map((action) => {
          const declaration = offered.get(action);
          const rule = ACTION_RULES[action];
          const reason = declaration ? null : t(whyDisabled(action, view), { count: rule.cost });
          return (
            <button
              key={action}
              type="button"
              className={`action action-${action}${rule.claim ? ' is-claim' : ''}`}
              disabled={!declaration}
              title={reason ?? undefined}
              onClick={() => {
                if (!declaration) return;
                if (declaration.targets) setPicking(action);
                else app.command({ type: 'declare', windowId, action });
              }}
            >
              <span className="action-name">{t(`action.${action}`)}</span>
              <span className="action-desc">{reason ?? t(`action.${action}.desc`)}</span>
              <span className="action-tags">
                {rule.cost > 0 && <span className="pill pill-cost">−{rule.cost}</span>}
                {rule.claim && <span className={`pill pill-role role-${rule.claim}`}>{t(`role.${rule.claim}`)}</span>}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Challenge / Block / Pass. */
export function ReactionPanel({ view, status }: { view: GameView; status: UiStatus }) {
  const t = useT();
  const app = useController();
  const room = useApp((s) => s.room);
  const react = view.me?.moves.react;
  const windowId = windowIdOf(view);
  const claim = status.claim;
  if (!react || !claim) return null;
  const imTarget = claim.targetId === view.viewerId;

  return (
    <div className="panel">
      <ClaimView claim={claim} />
      {imTarget && claim.stage === 'action' && <p className="warn">{t('reaction.targetsYou')}</p>}
      <div className="button-row">
        {react.canChallenge && (
          <button type="button" className="btn btn-danger" onClick={() => app.command({ type: 'challenge', windowId })}>
            {t('reaction.challenge')}
          </button>
        )}
        {react.blockRoles.map((role: Role) => (
          <button key={role} type="button" className="btn btn-block" onClick={() => app.command({ type: 'block', windowId, role })}>
            {t('reaction.blockAs', { role: t(`role.${role}`) })}
          </button>
        ))}
        <button type="button" className="btn btn-ghost" onClick={() => app.command({ type: 'pass', windowId })}>
          {t('reaction.pass')}
        </button>
      </div>
      {status.passed.length > 0 && (
        <p className="muted small">{t('reaction.passed', { names: status.passed.map((id) => nameIn(room, id)).join(', ') })}</p>
      )}
    </div>
  );
}

/** What to show while somebody else has the move. */
export function WaitingPanel({ view, status }: { view: GameView; status: UiStatus }) {
  const t = useT();
  const room = useApp((s) => s.room);
  const claim = status.claim;
  const iPassed = view.viewerId !== null && status.passed.includes(view.viewerId);
  return (
    <div className="panel panel-quiet">
      {claim && <ClaimView claim={claim} />}
      {iPassed && <p className="muted small">{t('reaction.youPassed')}</p>}
      {status.waitingOn.length > 0 && (
        <p className="muted small">{t('reaction.stillDeciding', { names: status.waitingOn.map((id) => nameIn(room, id)).join(', ') })}</p>
      )}
      {!claim && <p className="muted">{t('waiting.generic')}</p>}
    </div>
  );
}

/** Choose which influence card to lose. */
export function LossPicker({ view, status }: { view: GameView; status: UiStatus }) {
  const t = useT();
  const app = useController();
  const hand = view.me?.hand ?? [];
  const windowId = windowIdOf(view);
  return (
    <div className="panel">
      <h3 className="panel-title">{t(`loss.${status.reason ?? 'forfeit'}`)}</h3>
      <div className="card-row">
        {hand.map((role, i) => (
          <RoleCard
            key={`${role}${i}`}
            role={role}
            size="md"
            caption={t('loss.pick')}
            onClick={() => app.command({ type: 'chooseInfluence', windowId, role })}
          />
        ))}
      </div>
    </div>
  );
}

/** Shaman: look at the options and keep as many as you had. */
export function ExchangePicker({ view }: { view: GameView }) {
  const t = useT();
  const app = useController();
  const [chosen, setChosen] = useState<number[]>([]);
  const exchange = view.me?.moves.chooseExchange;
  if (!exchange) return null;
  const windowId = windowIdOf(view);
  const toggle = (index: number) =>
    setChosen((current) =>
      current.includes(index) ? current.filter((i) => i !== index) : current.length < exchange.keep ? [...current, index] : current,
    );
  return (
    <div className="panel">
      <h3 className="panel-title">{t('exchange.title', { count: exchange.keep })}</h3>
      <div className="card-row">
        {exchange.options.map((role, i) => (
          <RoleCard
            key={`${role}${i}`}
            role={role}
            size="md"
            state={chosen.includes(i) ? 'selected' : 'normal'}
            caption={i >= exchange.keep ? t('exchange.new') : t('exchange.yours')}
            onClick={() => toggle(i)}
          />
        ))}
      </div>
      <button
        type="button"
        className="btn btn-primary"
        disabled={chosen.length !== exchange.keep}
        onClick={() => {
          app.command({ type: 'chooseExchange', windowId, keep: chosen.map((i) => exchange.options[i] as Role) });
          setChosen([]);
        }}
      >
        {t('exchange.confirm', { chosen: chosen.length, count: exchange.keep })}
      </button>
    </div>
  );
}

/** Picks the right panel for the current situation. */
export function ControlPanel({ view, status }: { view: GameView; status: UiStatus }) {
  switch (status.mode) {
    case 'myTurn':
      return <ActionBar view={view} />;
    case 'canChallenge':
    case 'canBlock':
      return <ReactionPanel view={view} status={status} />;
    case 'chooseLoss':
      return <LossPicker view={view} status={status} />;
    case 'chooseExchange':
      return <ExchangePicker view={view} />;
    default:
      return <WaitingPanel view={view} status={status} />;
  }
}

export { RoleChip };

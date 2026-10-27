import type { Role } from '@shadow-court/engine';
import { useT } from '../hooks';
import { RoleArt } from './RoleArt';

export type CardSize = 'xs' | 'sm' | 'md' | 'lg';
export type CardState = 'normal' | 'lost' | 'selected' | 'dim';

interface RoleCardProps {
  role: Role;
  size?: CardSize;
  state?: CardState;
  onClick?: () => void;
  disabled?: boolean;
  /** Extra line under the card, e.g. "Lose this". */
  caption?: string;
  className?: string;
}

/** A face-up role card. Clickable when `onClick` is given. */
export function RoleCard({ role, size = 'md', state = 'normal', onClick, disabled, caption, className }: RoleCardProps) {
  const t = useT();
  const body = (
    <>
      <span className="card-name">{t(`role.${role}`)}</span>
      <RoleArt role={role} className="card-art" />
      {(size === 'md' || size === 'lg') && <span className="card-blurb">{t(`role.${role}.blurb`)}</span>}
      {state === 'lost' && <span className="card-lost-mark">{t('card.lost')}</span>}
    </>
  );
  const cls = `card role-${role} size-${size} state-${state}${onClick ? ' is-button' : ''}${className ? ` ${className}` : ''}`;
  return (
    <span className="card-slot">
      {onClick ? (
        <button type="button" className={cls} onClick={onClick} disabled={disabled} aria-pressed={state === 'selected'}>
          {body}
        </button>
      ) : (
        <span className={cls} role="img" aria-label={t(`role.${role}`)}>
          {body}
        </span>
      )}
      {caption && <span className="card-caption">{caption}</span>}
    </span>
  );
}

/** A face-down card. */
export function CardBack({ size = 'sm' }: { size?: CardSize }) {
  const t = useT();
  return (
    <span className={`card card-back size-${size}`} role="img" aria-label={t('card.hidden')}>
      <svg viewBox="0 0 60 80" aria-hidden="true" focusable="false">
        <rect x="5" y="5" width="50" height="70" rx="5" className="back-frame" />
        <path d="M30 18 L37 34 L30 50 L23 34 Z" className="back-gem" />
        <path d="M14 66 L46 66 M14 14 L46 14" className="back-line" />
        <circle cx="30" cy="34" r="3" className="back-eye" />
      </svg>
    </span>
  );
}

export function Coin({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" className={`coin ${className ?? ''}`} aria-hidden="true" focusable="false">
      <circle cx="10" cy="10" r="9" className="coin-rim" />
      <circle cx="10" cy="10" r="6.2" className="coin-face" />
      <path d="M10 6 v8 M7.6 8 h4 a1.6 1.6 0 0 1 0 3.2 h-4" className="coin-mark" />
    </svg>
  );
}

/** Coin icon followed by a number. The `key` restarts the bump animation when the number changes. */
export function CoinCount({ value, big }: { value: number; big?: boolean }) {
  const t = useT();
  return (
    <span className={`coins${big ? ' coins-big' : ''}`} aria-label={t('coins', { count: value })}>
      <Coin />
      <span className="coins-n" key={value}>
        {value}
      </span>
    </span>
  );
}

import type { PlayerId } from '@shadow-court/engine';
import { useEffect, useLayoutEffect, useRef, useSyncExternalStore } from 'react';
import { nameIn } from '../controller';
import { fx, type FxState, type SpriteState } from '../fx/director';
import type { Label, LagKind } from '../fx/steps';
import { useApp, useT } from '../hooks';
import { CardBack, Coin, RoleCard } from './Cards';

/** Subscribes to the animation state. The selector must return a stable value. */
export function useFx<T>(selector: (state: FxState) => T): T {
  return useSyncExternalStore(fx.store.subscribe, () => selector(fx.store.get()));
}

/** How far a seat's number should trail the real one while effects are still on their way. */
export function useLag(what: LagKind, playerId: PlayerId): number {
  return useFx((s) => s.lag[what][playerId] ?? 0);
}

/** Everything that flies over the table. Sits above the page and never takes clicks. */
export function FxLayer() {
  const sprites = useFx((s) => s.sprites);
  // Leaving the game screen drops whatever is still in flight.
  useEffect(() => () => fx.flush(), []);
  return (
    <div className="fx-layer" aria-hidden="true">
      {sprites.map((s) => (
        <FxSprite key={s.id} sprite={s} />
      ))}
    </div>
  );
}

function FxSprite({ sprite }: { sprite: SpriteState }) {
  const ref = useRef<HTMLDivElement>(null);
  const { flight, x0, y0, x1, y1 } = sprite;
  const kind = flight.sprite.type;

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el?.animate) return;
    const at = (x: number, y: number, scale = 1) => `translate(${x}px, ${y}px) scale(${scale})`;
    const midX = (x0 + x1) / 2;
    const midY = Math.min(y0, y1) - 50;
    let frames: Keyframe[];
    if (kind === 'label') {
      frames = [
        { transform: at(x0, y0 - 20, 0.6), opacity: 0 },
        { transform: at(x0, y0 - 34, 1.08), opacity: 1, offset: 0.15 },
        { transform: at(x0, y0 - 38, 1), opacity: 1, offset: 0.75 },
        { transform: at(x0, y0 - 56, 1), opacity: 0 },
      ];
    } else if (kind === 'card' && flight.sprite.type === 'card' && flight.sprite.flip) {
      // Stay put while the card turns over, then travel.
      frames = [
        { transform: at(x0, y0, 1), opacity: 0 },
        { transform: at(x0, y0 - 10, 1.5), opacity: 1, offset: 0.08 },
        { transform: at(x0, y0 - 10, 1.5), offset: 0.5 },
        { transform: at(midX, midY, 1.3), offset: 0.75 },
        { transform: at(x1, y1, 0.9), opacity: 1 },
      ];
    } else {
      frames = [
        { transform: at(x0, y0, 0.8), opacity: 0 },
        { transform: at(x0, y0, 1), opacity: 1, offset: 0.08 },
        { transform: at(midX, midY, 1.2), offset: 0.5 },
        { transform: at(x1, y1, 0.9), opacity: 1, offset: 0.92 },
        { transform: at(x1, y1, 0.8), opacity: 0 },
      ];
    }
    const animation = el.animate(frames, { duration: flight.duration, easing: 'ease-in-out', fill: 'forwards' });
    return () => animation.cancel();
  }, [flight, kind, x0, y0, x1, y1]);

  let body;
  if (flight.sprite.type === 'coin') {
    body = <Coin className={`fx-coin${flight.sprite.steal ? ' fx-steal' : ''}`} />;
  } else if (flight.sprite.type === 'card') {
    const { role, flip } = flight.sprite;
    body =
      role && flip ? (
        <span className="fx-flip" style={{ animationDuration: `${Math.round(flight.duration * 0.35)}ms` }}>
          <span className="fx-face fx-back">
            <CardBack size="sm" />
          </span>
          <span className="fx-face fx-front">
            <RoleCard role={role} size="sm" />
          </span>
        </span>
      ) : (
        <CardBack size="sm" />
      );
  } else {
    body = (
      <span className={`fx-label fx-tone-${flight.sprite.tone}`}>
        <LabelText label={flight.sprite.label} />
      </span>
    );
  }

  return (
    <div ref={ref} className={`fx-sprite fx-${kind}`}>
      <div className="fx-center">{body}</div>
    </div>
  );
}

function LabelText({ label }: { label: Label }) {
  const t = useT();
  const room = useApp((s) => s.room);
  switch (label.key) {
    case 'fx.action':
      return (
        <>
          {t(`action.${label.action}`)}
          {label.targetId && ` → ${nameIn(room, label.targetId)}`}
        </>
      );
    case 'fx.block':
      return <>{t('fx.block', { role: t(`role.${label.role}`) })}</>;
    default:
      return <>{t(label.key)}</>;
  }
}

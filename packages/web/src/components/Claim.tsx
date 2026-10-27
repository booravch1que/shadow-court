import type { Role } from '@shadow-court/engine';
import { nameIn } from '../controller';
import { useApp, useT } from '../hooks';
import type { Claim } from '../logic/ui-state';
import { RoleArt } from './RoleArt';

/** A small round role emblem with its name. */
export function RoleChip({ role }: { role: Role }) {
  const t = useT();
  return (
    <span className={`role-chip role-${role}`}>
      <RoleArt role={role} className="role-chip-art" />
      <span className="sr-only">{t(`role.${role}`)}</span>
    </span>
  );
}

/** "Ann claims Governor: Tax" or "Bob blocks with Duchess", with the role emblem. */
export function ClaimView({ claim }: { claim: Claim }) {
  const t = useT();
  const room = useApp((s) => s.room);
  const name = (id: string) => nameIn(room, id);

  if (claim.stage === 'block' && claim.block) {
    return (
      <div className="claim claim-block">
        <RoleChip role={claim.block.role} />
        <p className="claim-text">
          {t('claim.block', {
            name: name(claim.block.blockerId),
            role: t(`role.${claim.block.role}`),
            actor: name(claim.actorId),
            action: t(`action.${claim.action}`),
          })}
        </p>
      </div>
    );
  }
  return (
    <div className="claim">
      {claim.role && <RoleChip role={claim.role} />}
      <p className="claim-text">
        {claim.targetId
          ? t('claim.actionOn', { name: name(claim.actorId), action: t(`action.${claim.action}`), target: name(claim.targetId) })
          : t('claim.action', { name: name(claim.actorId), action: t(`action.${claim.action}`) })}
      </p>
      {claim.role && (
        <p className="claim-sub">{t('claim.says', { name: name(claim.actorId), role: t(`role.${claim.role}`) })}</p>
      )}
    </div>
  );
}

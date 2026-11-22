import type { AvatarId } from '@shadow-court/protocol';
import { avatarSvg } from '../art/avatar-art';
import { useT } from '../hooks';

export type AvatarSize = 'sm' | 'md' | 'lg';

/** A player's round portrait. Decorative unless `label` is set. */
export function Avatar({ id, size = 'md', label }: { id: AvatarId; size?: AvatarSize; label?: boolean }) {
  const t = useT();
  return (
    <svg
      viewBox="0 0 100 100"
      className={`avatar avatar-${size}`}
      role={label ? 'img' : undefined}
      aria-label={label ? t(`avatar.${id}`) : undefined}
      aria-hidden={label ? undefined : true}
      focusable="false"
      dangerouslySetInnerHTML={{ __html: avatarSvg(id) }}
    />
  );
}

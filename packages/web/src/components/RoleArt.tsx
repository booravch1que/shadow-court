import type { Role } from '@shadow-court/engine';
import type { CardStyle } from '@shadow-court/protocol';
import { emblemSvg } from '../art/card-art';
import { useCardStyle } from '../hooks';

/**
 * Emblem for each role, drawn in code (no image files). 100x100 canvas. The emblem set,
 * medallion and colours follow the room's card style; pass `cardStyle` to show another.
 */
export function RoleArt({ role, className, cardStyle }: { role: Role; className?: string; cardStyle?: CardStyle }) {
  const roomStyle = useCardStyle();
  return (
    <svg
      viewBox="0 0 100 100"
      className={className}
      aria-hidden="true"
      focusable="false"
      dangerouslySetInnerHTML={{ __html: emblemSvg(cardStyle ?? roomStyle, role) }}
    />
  );
}

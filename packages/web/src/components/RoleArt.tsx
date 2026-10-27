import type { Role } from '@shadow-court/engine';
import type { ReactNode } from 'react';

/**
 * Emblem for each role, drawn in code (no image files). 100x100 canvas. Shapes use
 * `currentColor` for the main figure, so a card can recolor it through CSS.
 */
export function RoleArt({ role, className }: { role: Role; className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} role="img" aria-hidden="true" focusable="false">
      <circle cx="50" cy="50" r="46" className="art-ring" />
      <circle cx="50" cy="50" r="40" className="art-disc" />
      {ART[role]}
    </svg>
  );
}

const ART: Record<Role, ReactNode> = {
  governor: (
    <g>
      <path d="M22 66 L26 36 L39 50 L50 27 L61 50 L74 36 L78 66 Z" fill="currentColor" />
      <rect x="22" y="68" width="56" height="9" rx="3" fill="currentColor" />
      <circle cx="26" cy="34" r="4" fill="currentColor" />
      <circle cx="50" cy="24" r="4.5" fill="currentColor" />
      <circle cx="74" cy="34" r="4" fill="currentColor" />
      <circle cx="50" cy="72.5" r="2.6" className="art-cut" />
      <circle cx="36" cy="72.5" r="2" className="art-cut" />
      <circle cx="64" cy="72.5" r="2" className="art-cut" />
    </g>
  ),
  assassin: (
    <g>
      <path d="M50 12 L59 52 L50 62 L41 52 Z" fill="currentColor" />
      <path d="M50 16 L50 58" className="art-cut" strokeWidth="1.6" />
      <rect x="31" y="60" width="38" height="6" rx="3" fill="currentColor" />
      <rect x="46" y="66" width="8" height="17" rx="3" fill="currentColor" />
      <circle cx="50" cy="87" r="4.5" fill="currentColor" />
      <path d="M72 30 C72 36 67 39 67 43 A5 5 0 0 0 77 43 C77 39 72 36 72 30 Z" className="art-drop" />
    </g>
  ),
  thief: (
    <g>
      <path d="M50 13 C28 13 19 38 21 66 L79 66 C81 38 72 13 50 13 Z" fill="currentColor" />
      <ellipse cx="50" cy="47" rx="16" ry="18" className="art-cut" />
      <ellipse cx="43" cy="45" rx="3.6" ry="2.2" className="art-eye" />
      <ellipse cx="57" cy="45" rx="3.6" ry="2.2" className="art-eye" />
      <path d="M21 66 L79 66 L74 84 L26 84 Z" fill="currentColor" opacity="0.85" />
      <circle cx="50" cy="75" r="5" className="art-cut" />
      <path d="M48 75 h4 M50 73 v4" stroke="currentColor" strokeWidth="1.4" />
    </g>
  ),
  shaman: (
    <g>
      <path d="M31 88 L60 20" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
      <circle cx="62" cy="16" r="8" fill="currentColor" />
      <circle cx="62" cy="16" r="3.4" className="art-eye" />
      <path d="M56 28 C46 30 42 38 44 46 C50 42 54 36 56 28 Z" fill="currentColor" opacity="0.9" />
      <path d="M50 38 C38 42 34 52 38 60 C46 55 50 48 50 38 Z" fill="currentColor" opacity="0.75" />
      <path d="M62 62 a11 11 0 1 1 -11 -11 a18 18 0 1 1 18 18" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" />
    </g>
  ),
  duchess: (
    <g>
      <path d="M17 70 Q50 26 83 70" fill="none" stroke="currentColor" strokeWidth="6" strokeLinecap="round" />
      <path d="M50 20 L58 34 L50 48 L42 34 Z" fill="currentColor" />
      <path d="M26 46 L32 54 L26 62 L20 54 Z" fill="currentColor" />
      <path d="M74 46 L80 54 L74 62 L68 54 Z" fill="currentColor" />
      <circle cx="38" cy="36" r="3.4" fill="currentColor" />
      <circle cx="62" cy="36" r="3.4" fill="currentColor" />
      <path d="M30 78 C40 72 60 72 70 78 L66 86 C58 82 42 82 34 86 Z" fill="currentColor" opacity="0.85" />
      <path d="M50 24 L54 34 L50 42 L46 34 Z" className="art-cut" />
    </g>
  ),
};

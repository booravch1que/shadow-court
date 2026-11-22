import type { Role } from '@shadow-court/engine';
import type { CardStyle } from '@shadow-court/protocol';

/*
 * Card designs, drawn in code. A style decides the paper and role colours, the frame
 * over the face, the back, and how role emblems look (which of three emblem sets,
 * the medallion shape, and solid / inverse / outline rendering). The role's colour
 * always stays its own, so a card can be read at a glance whatever the style.
 */

type Glyphs = Record<Role, string>;
type GlyphSet = 'A' | 'B' | 'C';
type FrameId = 'none' | 'filigree' | 'stars' | 'vine' | 'deco' | 'crystal' | 'flames' | 'rope' | 'facets' | 'mist' | 'sun' | 'petals' | 'rivets';
type BadgeId = 'circle' | 'shield' | 'diamond' | 'hexagon' | 'octagon' | 'arch' | 'flower' | 'stars' | 'sun' | 'rope' | 'gear' | 'frost';
export type IconMode = 'solid' | 'inverse' | 'outline';

interface Palette {
  frame: FrameId;
  accent: string;
  bg1: string;
  bg2: string;
  border: string;
  ink: string;
  cut: string;
  disc: string;
  backBorder: string;
  /** governor, assassin, thief, shaman, duchess */
  roles: [string, string, string, string, string];
}

const PALETTES: Record<CardStyle, Palette> = {
  classic: { frame: 'none', accent: '#6e5428', bg1: '#ecdcb6', bg2: '#d8c392', border: '#6e5428', ink: '#4b3a22', cut: '#ecdcb6', disc: 'rgb(255 255 255 / 35%)', backBorder: '#6c4d93',
    roles: ['#7a4cb8', '#b0302a', '#2f7f7a', '#577f2f', '#b86a22'] },
  crimson: { frame: 'filigree', accent: '#b8862e', bg1: '#f7eee2', bg2: '#e8d2b8', border: '#7a1622', ink: '#4a2a22', cut: '#f7eee2', disc: 'rgb(255 255 255 / 45%)', backBorder: '#7a1622',
    roles: ['#5b2a86', '#a3121f', '#1f5f5a', '#3f6a1f', '#b5651d'] },
  moon: { frame: 'stars', accent: '#5a6c9a', bg1: '#eef2fa', bg2: '#c9d3e8', border: '#2f3f6e', ink: '#2a3350', cut: '#eef2fa', disc: 'rgb(255 255 255 / 50%)', backBorder: '#3a4c8a',
    roles: ['#4b3fa0', '#a52f50', '#1f6c8a', '#2f7a66', '#a8733a'] },
  forest: { frame: 'vine', accent: '#5a7a2a', bg1: '#eef0dc', bg2: '#cdd6a8', border: '#4a3a1f', ink: '#3a3a1f', cut: '#eef0dc', disc: 'rgb(255 255 255 / 40%)', backBorder: '#2f5a35',
    roles: ['#6a3f8a', '#962a1e', '#22665a', '#3f6a12', '#9a5a14'] },
  noir: { frame: 'deco', accent: '#d4af37', bg1: '#221e18', bg2: '#0c0b09', border: '#d4af37', ink: '#d9cfb8', cut: '#17140f', disc: 'rgb(255 255 255 / 6%)', backBorder: '#d4af37',
    roles: ['#b996ff', '#ff6b5b', '#4fd1c5', '#9bd65a', '#f2b45a'] },
  frost: { frame: 'crystal', accent: '#4f86b4', bg1: '#f7fbfe', bg2: '#d3e6f4', border: '#3f6f98', ink: '#25425e', cut: '#f7fbfe', disc: 'rgb(255 255 255 / 60%)', backBorder: '#4f86b4',
    roles: ['#5d4fc4', '#c0394b', '#1f7f98', '#3f8a5a', '#c07a2a'] },
  ember: { frame: 'flames', accent: '#d0561a', bg1: '#fcebd2', bg2: '#efc08a', border: '#8a2c0c', ink: '#4a2410', cut: '#fcebd2', disc: 'rgb(255 255 255 / 40%)', backBorder: '#a5380f',
    roles: ['#7a2f8a', '#b81d10', '#1f6f66', '#5a7a12', '#c4560c'] },
  sea: { frame: 'rope', accent: '#2f7a7a', bg1: '#eaf5f0', bg2: '#bfdcd0', border: '#1f5a5f', ink: '#1f3e3e', cut: '#eaf5f0', disc: 'rgb(255 255 255 / 45%)', backBorder: '#11686e',
    roles: ['#4f3a8a', '#a8302e', '#0f6a7a', '#3a7a3a', '#b2702a'] },
  amethyst: { frame: 'facets', accent: '#8a5ac8', bg1: '#f6effc', bg2: '#d9c6f0', border: '#4a2a7a', ink: '#3a2a55', cut: '#f6effc', disc: 'rgb(255 255 255 / 45%)', backBorder: '#5a2f92',
    roles: ['#6a2fb0', '#b02a4a', '#1f6f7a', '#4a7a2a', '#b8661e'] },
  spectral: { frame: 'mist', accent: '#3f8a6a', bg1: '#e3e7e3', bg2: '#aeb8b2', border: '#2f3a36', ink: '#2a332f', cut: '#e3e7e3', disc: 'rgb(255 255 255 / 40%)', backBorder: '#3f4a4c',
    roles: ['#5d4a8a', '#8f2a35', '#22706a', '#4a6a2f', '#8a5f2a'] },
  desert: { frame: 'sun', accent: '#d98c2a', bg1: '#fbecd0', bg2: '#ebc48a', border: '#8a4a1a', ink: '#4a2a10', cut: '#fbecd0', disc: 'rgb(255 255 255 / 40%)', backBorder: '#a8521f',
    roles: ['#6b3a8a', '#a3261a', '#1e6a72', '#5e7a1c', '#c26a10'] },
  sakura: { frame: 'petals', accent: '#e07a9a', bg1: '#fff7f9', bg2: '#f7d8e1', border: '#b0577a', ink: '#5a2a3a', cut: '#fff7f9', disc: 'rgb(255 255 255 / 55%)', backBorder: '#b0577a',
    roles: ['#7a4cb8', '#c0304a', '#2a8580', '#5a8a3a', '#d07a3a'] },
  clockwork: { frame: 'rivets', accent: '#8a5a2a', bg1: '#f1dfc6', bg2: '#d4b08a', border: '#5a3a24', ink: '#3a2614', cut: '#f1dfc6', disc: 'rgb(255 255 255 / 35%)', backBorder: '#6a4428',
    roles: ['#5f3a7a', '#9a2a1a', '#2a5f5a', '#556b2f', '#a5641c'] },
};

// ---------------------------------------------------------------- emblems (100x100)
const ART: Glyphs = {
  governor: `<path d="M22 66 L26 36 L39 50 L50 27 L61 50 L74 36 L78 66 Z" fill="currentColor"/><rect x="22" y="68" width="56" height="9" rx="3" fill="currentColor"/><circle cx="26" cy="34" r="4" fill="currentColor"/><circle cx="50" cy="24" r="4.5" fill="currentColor"/><circle cx="74" cy="34" r="4" fill="currentColor"/><circle cx="50" cy="72.5" r="2.6" class="art-cut"/><circle cx="36" cy="72.5" r="2" class="art-cut"/><circle cx="64" cy="72.5" r="2" class="art-cut"/>`,
  assassin: `<path d="M50 12 L59 52 L50 62 L41 52 Z" fill="currentColor"/><path d="M50 16 L50 58" class="art-cut" stroke-width="1.6"/><rect x="31" y="60" width="38" height="6" rx="3" fill="currentColor"/><rect x="46" y="66" width="8" height="17" rx="3" fill="currentColor"/><circle cx="50" cy="87" r="4.5" fill="currentColor"/><path d="M72 30 C72 36 67 39 67 43 A5 5 0 0 0 77 43 C77 39 72 36 72 30 Z" class="art-drop"/>`,
  thief: `<path d="M50 13 C28 13 19 38 21 66 L79 66 C81 38 72 13 50 13 Z" fill="currentColor"/><ellipse cx="50" cy="47" rx="16" ry="18" class="art-cut"/><ellipse cx="43" cy="45" rx="3.6" ry="2.2" class="art-eye"/><ellipse cx="57" cy="45" rx="3.6" ry="2.2" class="art-eye"/><path d="M21 66 L79 66 L74 84 L26 84 Z" fill="currentColor" opacity="0.85"/><circle cx="50" cy="75" r="5" class="art-cut"/><path d="M48 75 h4 M50 73 v4" stroke="currentColor" stroke-width="1.4"/>`,
  shaman: `<path d="M31 88 L60 20" stroke="currentColor" stroke-width="5" stroke-linecap="round"/><circle cx="62" cy="16" r="8" fill="currentColor"/><circle cx="62" cy="16" r="3.4" class="art-eye"/><path d="M56 28 C46 30 42 38 44 46 C50 42 54 36 56 28 Z" fill="currentColor" opacity="0.9"/><path d="M50 38 C38 42 34 52 38 60 C46 55 50 48 50 38 Z" fill="currentColor" opacity="0.75"/><path d="M62 62 a11 11 0 1 1 -11 -11 a18 18 0 1 1 18 18" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round"/>`,
  duchess: `<path d="M17 70 Q50 26 83 70" fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round"/><path d="M50 20 L58 34 L50 48 L42 34 Z" fill="currentColor"/><path d="M26 46 L32 54 L26 62 L20 54 Z" fill="currentColor"/><path d="M74 46 L80 54 L74 62 L68 54 Z" fill="currentColor"/><circle cx="38" cy="36" r="3.4" fill="currentColor"/><circle cx="62" cy="36" r="3.4" fill="currentColor"/><path d="M30 78 C40 72 60 72 70 78 L66 86 C58 82 42 82 34 86 Z" fill="currentColor" opacity="0.85"/><path d="M50 24 L54 34 L50 42 L46 34 Z" class="art-cut"/>`,
};

const DAGGER = `<path d="M50 12 L55 50 L45 50 Z" fill="currentColor"/><rect x="39" y="50" width="22" height="5" rx="2.5" fill="currentColor"/><rect x="47" y="55" width="6" height="15" rx="2.5" fill="currentColor"/><circle cx="50" cy="73" r="3.6" fill="currentColor"/>`;
const GLYPHS: Record<GlyphSet, Glyphs> = {
  A: ART,
  B: {
    governor: `<path d="M26 84 V42 H34 V50 H42 V42 H58 V50 H66 V42 H74 V84 Z" fill="currentColor"/><path d="M43 84 V71 A7 7 0 0 1 57 71 V84 Z" class="art-cut"/><rect x="46.5" y="55" width="7" height="9" rx="3.5" class="art-cut"/><path d="M50 42 V18" stroke="currentColor" stroke-width="2.4"/><path d="M50 18 L66 23 L50 29 Z" fill="currentColor"/>`,
    assassin: `<path d="M50 16 C33 16 25 29 25 43 C25 53 31 60 36 62 V70 H64 V62 C69 60 75 53 75 43 C75 29 67 16 50 16 Z" fill="currentColor"/><circle cx="40.5" cy="44" r="7" class="art-cut"/><circle cx="59.5" cy="44" r="7" class="art-cut"/><path d="M50 52 L54 60 H46 Z" class="art-cut"/><rect x="38" y="70" width="24" height="10" rx="3" fill="currentColor"/><path d="M44 70 V80 M50 70 V80 M56 70 V80" class="art-line" stroke-width="1.6"/><path d="M78 56 C78 62 73 65 73 69 A5 5 0 0 0 83 69 C83 65 78 62 78 56 Z" class="art-drop"/>`,
    thief: `<path d="M35 40 C21 54 23 84 50 84 C77 84 79 54 65 40 Z" fill="currentColor"/><path d="M36 40 L31 26 L42 33 L50 22 L58 33 L69 26 L64 40 Z" fill="currentColor" opacity=".85"/><path d="M34 41 Q50 47 66 41" class="art-line" stroke-width="2.2"/><circle cx="50" cy="64" r="10" class="art-cut"/><circle cx="50" cy="64" r="6.5" fill="currentColor"/><path d="M50 60 V68 M47 62 H53" class="art-line" stroke-width="1.6"/>`,
    shaman: `${[-50,-25,0,25,50].map(a => `<ellipse cx="50" cy="16" rx="4.6" ry="13" fill="currentColor" opacity="${a ? .75 : .95}" transform="rotate(${a} 50 34)"/>`).join('')}<path d="M20 94 C22 78 32 70 44 68 L50 74 L56 68 C68 70 78 78 80 94 Z" fill="currentColor" opacity=".85"/><path d="M35 30 C35 21 65 21 65 30 L63 55 C61 64 55 69 50 69 C45 69 39 64 37 55 Z" fill="currentColor"/><path d="M41 31 L45.5 35 L50 31 L54.5 35 L59 31" class="art-line" stroke-width="1.8" stroke-linejoin="round"/><path d="M39 41 L47 43.5 L39 46.5 Z M61 41 L53 43.5 L61 46.5 Z" class="art-cut"/><path d="M50 46 V54" class="art-line" stroke-width="1.6"/><rect x="44" y="58" width="12" height="3.4" rx="1.7" class="art-cut"/>${[38,44,50,56,62].map((x, i) => `<circle cx="${x}" cy="${76 + Math.abs(i - 2) * -1.5}" r="1.8" class="art-cut"/>`).join('')}`,
    duchess: `<path d="M50 80 L16 46 A48 48 0 0 1 84 46 Z" fill="currentColor"/><path d="M50 80 L22 40 M50 80 L35 30 M50 80 L50 27 M50 80 L65 30 M50 80 L78 40" class="art-line" stroke-width="1.5"/><path d="M20 44 A44 44 0 0 1 80 44" class="art-line" stroke-width="1.5"/><circle cx="50" cy="80" r="5" fill="currentColor"/><circle cx="50" cy="80" r="2" class="art-cut"/>`,
  },
  C: {
    governor: `<path d="M50 34 V88" stroke="currentColor" stroke-width="6" stroke-linecap="round"/><circle cx="50" cy="24" r="12" fill="currentColor"/><path d="M38 24 H62 M50 12 V36" class="art-line" stroke-width="1.8"/><path d="M50 4 V12 M46 7.5 H54" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><rect x="41" y="48" width="18" height="6" rx="3" fill="currentColor"/><rect x="43" y="70" width="14" height="5" rx="2.5" fill="currentColor"/><circle cx="50" cy="51" r="1.6" class="art-cut"/>`,
    assassin: `<g transform="rotate(-38 50 46)">${DAGGER}</g><g transform="rotate(38 50 46)">${DAGGER}</g><path d="M50 74 C50 80 45 83 45 87 A5 5 0 0 0 55 87 C55 83 50 80 50 74 Z" class="art-drop"/>`,
    thief: `<path d="M16 42 Q33 30 50 40 Q67 30 84 42 Q84 60 66 60 Q56 60 50 51 Q44 60 34 60 Q16 60 16 42 Z" fill="currentColor"/><ellipse cx="35" cy="46" rx="7" ry="4.5" class="art-cut"/><ellipse cx="65" cy="46" rx="7" ry="4.5" class="art-cut"/><path d="M16 44 L8 56 M84 44 L92 56" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><circle cx="50" cy="76" r="9" fill="currentColor"/><circle cx="50" cy="76" r="5.5" class="art-line" stroke-width="1.6"/>`,
    shaman: `<path d="M36 17 L12 12 L18 24 L36 29 Z M64 17 L88 12 L82 24 L64 29 Z" fill="currentColor" opacity=".8"/><rect x="36" y="12" width="28" height="20" rx="4" fill="currentColor"/><circle cx="43" cy="19.5" r="2.6" class="art-cut"/><circle cx="57" cy="19.5" r="2.6" class="art-cut"/><path d="M45 24 H55 L50 31 Z" class="art-cut"/><rect x="38" y="35" width="24" height="23" rx="3" fill="currentColor"/><ellipse cx="44" cy="42.5" rx="3.6" ry="2.4" class="art-cut"/><ellipse cx="56" cy="42.5" rx="3.6" ry="2.4" class="art-cut"/><rect x="43" y="49.5" width="14" height="3.2" rx="1.6" class="art-cut"/><rect x="38" y="61" width="24" height="22" rx="3" fill="currentColor"/><circle cx="44" cy="67.5" r="2.6" class="art-cut"/><circle cx="56" cy="67.5" r="2.6" class="art-cut"/><ellipse cx="50" cy="76" rx="5" ry="3" class="art-cut"/><rect x="32" y="85" width="36" height="6" rx="2" fill="currentColor"/>`,
    duchess: `<path d="M50 20 C35 20 29 33 33 43 C37 54 63 54 67 43 C71 33 65 20 50 20 Z" fill="currentColor"/><path d="M50 28 C43 30 43 40 50 40 C57 40 57 33 52 32 M42 44 C46 48 54 48 58 44" class="art-line" stroke-width="2"/><path d="M50 51 V88" stroke="currentColor" stroke-width="4" stroke-linecap="round"/><path d="M50 72 C40 62 30 66 28 70 C34 76 44 76 50 72 Z M50 64 C60 54 70 58 72 62 C66 68 56 68 50 64 Z" fill="currentColor"/>`,
  },
};


// ---------------------------------------------------------------- medallions
const pts = (n: number, r: number, rot = 0) => Array.from({ length: n }, (_, i) => { const a = rot + i * 2 * Math.PI / n; return `${(50 + Math.cos(a) * r).toFixed(1)} ${(50 + Math.sin(a) * r).toFixed(1)}`; });
const poly = (n: number, r: number, rot: number) => `M${pts(n, r, rot).join(' L')} Z`;
const wavy = (r: number, amp: number, k: number) => `M${Array.from({ length: 120 }, (_, i) => { const a = i * 2 * Math.PI / 120; const rr = r + amp * Math.cos(k * a); return `${(50 + Math.cos(a) * rr).toFixed(1)} ${(50 + Math.sin(a) * rr).toFixed(1)}`; }).join(' L')} Z`;
const shaped = (d: string, scale = .86) => `<path d="${d}" class="art-ring" stroke-linejoin="round"/><path d="${d}" class="art-disc" transform="translate(50 50) scale(${scale}) translate(-50 -50)"/>`;
const BADGES: Record<BadgeId, { s: number; draw: () => string }> = {
  circle:  { s: 1,   draw: () => `<circle cx="50" cy="50" r="46" class="art-ring"/><circle cx="50" cy="50" r="40" class="art-disc"/>` },
  shield:  { s: .82, draw: () => shaped('M50 4 L90 14 V48 C90 72 72 88 50 96 C28 88 10 72 10 48 V14 Z') },
  diamond: { s: .7,  draw: () => shaped('M50 2 L98 50 L50 98 L2 50 Z', .84) },
  hexagon: { s: .84, draw: () => shaped(poly(6, 47, Math.PI / 6)) },
  octagon: { s: .86, draw: () => shaped(poly(8, 47, Math.PI / 8)) },
  arch:    { s: .82, draw: () => shaped('M12 96 V42 A38 38 0 0 1 88 42 V96 Z') },
  flower:  { s: .82, draw: () => shaped(wavy(42, 5, 8)) },
  stars:   { s: .84, draw: () => `<circle cx="50" cy="50" r="44" class="art-ring" stroke-dasharray="1 5" stroke-linecap="round"/><circle cx="50" cy="50" r="38" class="art-disc"/><circle cx="50" cy="50" r="38" class="art-ring" stroke-width="1.4"/>` + pts(4, 44, -Math.PI / 4).map(p => { const [x, y] = p.split(' ').map(Number); return `<path d="M${x} ${y - 6} L${x + 1.6} ${y - 1.6} L${x + 6} ${y} L${x + 1.6} ${y + 1.6} L${x} ${y + 6} L${x - 1.6} ${y + 1.6} L${x - 6} ${y} L${x - 1.6} ${y - 1.6} Z" class="art-accent"/>`; }).join('') },
  sun:     { s: .76, draw: () => pts(16, 0).map((_, i) => { const a = i * Math.PI / 8; const r2 = i % 2 ? 44 : 48; return `<path d="M${(50 + Math.cos(a) * 38).toFixed(1)} ${(50 + Math.sin(a) * 38).toFixed(1)} L${(50 + Math.cos(a) * r2).toFixed(1)} ${(50 + Math.sin(a) * r2).toFixed(1)}" class="art-accent-line" stroke-width="3" stroke-linecap="round"/>`; }).join('') + `<circle cx="50" cy="50" r="36" class="art-ring"/><circle cx="50" cy="50" r="32" class="art-disc"/>` },
  rope:    { s: .9,  draw: () => `<circle cx="50" cy="50" r="45" class="art-ring" stroke-width="5" stroke-dasharray="5 2.5"/><circle cx="50" cy="50" r="40" class="art-disc"/>` },
  gear:    { s: .74, draw: () => { const c = 2 * Math.PI * 42, seg = (c / 24).toFixed(2); return `<circle cx="50" cy="50" r="42" class="art-accent-line" stroke-width="9" stroke-dasharray="${seg} ${seg}"/><circle cx="50" cy="50" r="38" class="art-ring"/><circle cx="50" cy="50" r="36" class="art-disc"/>`; } },
  frost:   { s: .8,  draw: () => shaped(poly(6, 46, Math.PI / 6)) + pts(6, 47, Math.PI / 6).map(p => { const [x, y] = p.split(' ').map(Number); return `<circle cx="${x}" cy="${y}" r="3.4" class="art-accent"/>`; }).join('') },
};

/* which emblems, medallion and fill style each deck uses */

const ICONS: Record<CardStyle, { set: GlyphSet; badge: BadgeId; mode: IconMode }> = {
  classic:   { set: 'A', badge: 'circle',  mode: 'solid' },
  crimson:   { set: 'C', badge: 'shield',  mode: 'inverse' },
  moon:      { set: 'C', badge: 'stars',   mode: 'outline' },
  forest:    { set: 'B', badge: 'arch',    mode: 'solid' },
  noir:      { set: 'A', badge: 'diamond', mode: 'outline' },
  frost:     { set: 'C', badge: 'frost',   mode: 'solid' },
  ember:     { set: 'A', badge: 'shield',  mode: 'inverse' },
  sea:       { set: 'B', badge: 'rope',    mode: 'solid' },
  amethyst:  { set: 'C', badge: 'octagon', mode: 'inverse' },
  spectral:  { set: 'B', badge: 'arch',    mode: 'outline' },
  desert:    { set: 'B', badge: 'sun',     mode: 'inverse' },
  sakura:    { set: 'C', badge: 'flower',  mode: 'solid' },
  clockwork: { set: 'B', badge: 'gear',    mode: 'outline' },
};

// ---------------------------------------------------------------- face frames (86x124)
const corners = (m: string) => {
  const motif = `<g transform="scale(.7)">${m}</g>`;
  return `<g>${motif}</g><g transform="translate(86 0) scale(-1 1)">${motif}</g>` +
  `<g transform="translate(0 124) scale(1 -1)">${motif}</g><g transform="translate(86 124) scale(-1 -1)">${motif}</g>`;
};
const inner = (c: string, w = 1, dash = '') => `<rect x="4" y="4" width="78" height="116" rx="6" fill="none" stroke="${c}" stroke-width="${w}" ${dash ? `stroke-dasharray="${dash}"` : ''}/>`;
const FRAMES: Record<FrameId, (c: string) => string> = {
  none: () => '',
  filigree: (c: string) => inner(c, .8) + corners(`<path d="M4 22 V10 Q4 4 10 4 H22" fill="none" stroke="${c}" stroke-width="1.6"/><path d="M8 18 Q8 8 18 8 M11 12 a2.4 2.4 0 1 1 3 3" fill="none" stroke="${c}" stroke-width="1"/><circle cx="7" cy="7" r="1.6" fill="${c}"/>`),
  stars: (c: string) => inner(c, .7, '1 2.5') + corners(`<path d="M10 4 L11.3 8.7 L16 10 L11.3 11.3 L10 16 L8.7 11.3 L4 10 L8.7 8.7 Z" fill="${c}"/>`),
  vine: (c: string) => inner(c, .8) + corners(`<path d="M4 30 Q10 18 6 8 Q14 12 26 4" fill="none" stroke="${c}" stroke-width="1.2"/><path d="M9 20 q6 -3 6 -9 q-6 2 -6 9z M16 9 q3 -1 5 2 q-4 2 -5 -2z" fill="${c}"/>`),
  deco: (c: string) => `<rect x="3.5" y="3.5" width="79" height="117" rx="5" fill="none" stroke="${c}" stroke-width="1"/><rect x="6.5" y="6.5" width="73" height="111" rx="3" fill="none" stroke="${c}" stroke-width=".5"/>` + corners(`<path d="M6.5 22 H10 V14 H14 V10 H22 V6.5" fill="none" stroke="${c}" stroke-width="1"/><path d="M6.5 6.5 L16 16" stroke="${c}" stroke-width=".8"/>`),
  crystal: (c: string) => inner(c, .8) + corners(`<path d="M10 3 L14 10 L10 17 L6 10 Z" fill="none" stroke="${c}" stroke-width="1.1"/><path d="M10 6 L12 10 L10 14 L8 10 Z" fill="${c}"/><path d="M15 10 H24 M10 18 V26" stroke="${c}" stroke-width=".8"/>`),
  flames: (c: string) => inner(c, .8) + corners(`<path d="M8 20 C4 14 8 10 7 4 C12 8 10 12 14 14 C14 10 16 9 18 7 C20 12 18 18 14 20 Z" fill="${c}"/>`),
  rope: (c: string) => `<rect x="4" y="4" width="78" height="116" rx="6" fill="none" stroke="${c}" stroke-width="2" stroke-dasharray="2.4 1.6"/><rect x="6.5" y="6.5" width="73" height="111" rx="4.5" fill="none" stroke="${c}" stroke-width=".5"/>` + corners(`<circle cx="9" cy="9" r="3.4" fill="none" stroke="${c}" stroke-width="1.2"/><circle cx="9" cy="9" r="1.2" fill="${c}"/>`),
  facets: (c: string) => inner(c, .8) + corners(`<path d="M4 4 L18 4 L4 18 Z" fill="${c}" opacity=".85"/><path d="M4 18 L18 4 L14 14 Z" fill="${c}" opacity=".45"/>`),
  mist: (c: string) => `<path d="M4 108 q8 -4 16 0 t16 0 t16 0 t16 0 t14 0 M4 114 q8 -4 16 0 t16 0 t16 0 t16 0 t14 0" fill="none" stroke="${c}" stroke-width=".9" opacity=".7"/>` + inner(c, .6) + corners(`<circle cx="10" cy="10" r="3.2" fill="none" stroke="${c}" stroke-width="1"/><circle cx="10" cy="10" r="1.2" fill="${c}"/>`),
  sun: (c: string) => inner(c, .8) + corners(`<circle cx="4" cy="4" r="6" fill="${c}"/>${[0,1,2,3,4].map(i => { const a = i * Math.PI / 8 + Math.PI / 16 * 0; const x1 = 4 + Math.cos(a) * 9, y1 = 4 + Math.sin(a) * 9, x2 = 4 + Math.cos(a) * 17, y2 = 4 + Math.sin(a) * 17; return `<path d="M${x1.toFixed(1)} ${y1.toFixed(1)} L${x2.toFixed(1)} ${y2.toFixed(1)}" stroke="${c}" stroke-width="1.4" stroke-linecap="round"/>`; }).join('')}`),
  petals: (c: string) => inner(c, .7) + corners(`<g transform="translate(11 11)">${[0,72,144,216,288].map(a => `<ellipse cx="0" cy="-4" rx="2.6" ry="4" fill="${c}" opacity=".8" transform="rotate(${a})"/>`).join('')}<circle r="1.6" fill="#fff6c8"/></g>`),
  rivets: (c: string) => `<rect x="4" y="4" width="78" height="116" rx="4" fill="none" stroke="${c}" stroke-width="1.6"/>` + corners(`<circle cx="9" cy="9" r="2.6" fill="${c}"/><circle cx="8.3" cy="8.3" r=".9" fill="#fff" opacity=".5"/><circle cx="9" cy="36" r="1.4" fill="${c}"/><circle cx="30" cy="9" r="1.4" fill="${c}"/>`),
};


// ---------------------------------------------------------------- backs (60x84)
const frameBack = (a: string, w = 1) => `<rect x="4" y="4" width="52" height="76" rx="4" fill="none" stroke="${a}" stroke-width="${w}"/>`;
const BACKS: Record<CardStyle, (u: string) => string> = {
  classic: (u: string) => {
    const g = `${u}g`;
    return `<defs><linearGradient id="${g}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3b2a4f"/><stop offset="1" stop-color="#231633"/></linearGradient></defs>
    <rect width="60" height="84" fill="url(#${g})"/><rect x="5" y="5" width="50" height="74" rx="5" fill="none" stroke="#b88cf0" stroke-width="1.5"/>
    <path d="M30 20 L37 38 L30 56 L23 38 Z" fill="#b88cf0" opacity=".85"/><path d="M14 69 L46 69 M14 15 L46 15" stroke="#b88cf0" opacity=".6"/><circle cx="30" cy="38" r="3" fill="#231633"/>`;
  },
  crimson: (u: string) => {
    const g = `${u}g`, p = `${u}p`;
    const rose = [0, 72, 144, 216, 288].map(a => `<ellipse cx="0" cy="-6" rx="4.6" ry="6" fill="#c0283a" stroke="#d9a441" stroke-width=".6" transform="rotate(${a})"/>`).join('');
    return `<defs><linearGradient id="${g}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#6e1421"/><stop offset="1" stop-color="#2a0509"/></linearGradient>
      <pattern id="${p}" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><path d="M0 0 H8 M0 0 V8" stroke="#d9a441" stroke-width=".35" opacity=".45"/></pattern></defs>
    <rect width="60" height="84" fill="url(#${g})"/><rect x="4" y="4" width="52" height="76" rx="4" fill="url(#${p})"/>
    ${frameBack('#d9a441', 1.2)}<rect x="6.5" y="6.5" width="47" height="71" rx="3" fill="none" stroke="#d9a441" stroke-width=".5"/>
    <circle cx="30" cy="42" r="14" fill="#2a0509" stroke="#d9a441" stroke-width="1"/>
    <g transform="translate(30 42)">${rose}<g transform="rotate(36) scale(.6)">${rose}</g><circle r="2.6" fill="#d9a441"/></g>`;
  },
  moon: (u: string) => {
    const g = `${u}g`;
    const stars = [[12,14,.9],[46,12,.7],[20,26,.5],[50,30,.8],[10,48,.6],[48,58,.9],[16,70,.7],[42,72,.5],[30,10,.5],[38,24,.4],[22,60,.4]]
      .map(([x,y,r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#e8eeff"/>`).join('');
    return `<defs><radialGradient id="${g}" cx=".5" cy=".45" r=".75"><stop offset="0" stop-color="#2a3d78"/><stop offset="1" stop-color="#0b1230"/></radialGradient></defs>
    <rect width="60" height="84" fill="url(#${g})"/>${stars}
    <rect x="4" y="4" width="52" height="76" rx="4" fill="none" stroke="#cfd8ee" stroke-width=".8" stroke-dasharray="1 2"/>
    <circle cx="30" cy="42" r="13" fill="#e9eefb"/><circle cx="36" cy="38" r="11.5" fill="#1a2a5a"/>
    <path d="M44 50 L45.2 53.8 L49 55 L45.2 56.2 L44 60 L42.8 56.2 L39 55 L42.8 53.8 Z" fill="#e9eefb"/>`;
  },
  forest: (u: string) => {
    const g = `${u}g`;
    const leaf = (x: number, y: number, a: number, s = 1) => `<path d="M0 0 C3 -4 8 -4 10 0 C8 4 3 4 0 0 Z" fill="#a8c66c" transform="translate(${x} ${y}) rotate(${a}) scale(${s})"/>`;
    return `<defs><linearGradient id="${g}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#255a35"/><stop offset="1" stop-color="#0e2416"/></linearGradient></defs>
    <rect width="60" height="84" fill="url(#${g})"/>${frameBack('#a8c66c', .9)}
    <path d="M8 76 Q14 60 8 46 Q2 32 10 16 M52 8 Q46 22 52 38 Q58 54 50 68" fill="none" stroke="#a8c66c" stroke-width=".8" opacity=".7"/>
    ${leaf(8,60,-120,.7)}${leaf(9,30,-60,.7)}${leaf(52,24,120,.7)}${leaf(52,54,60,.7)}
    <g transform="translate(30 42)"><path d="M0 -20 C12 -12 14 4 0 20 C-14 4 -12 -12 0 -20 Z" fill="#a8c66c"/><path d="M0 -16 V18 M0 -6 L-6 -11 M0 0 L7 -6 M0 6 L-7 1 M0 12 L6 7" stroke="#1a3d24" stroke-width="1.1" fill="none" stroke-linecap="round"/></g>`;
  },
  noir: () => {
    const rays = Array.from({ length: 24 }, (_, i) => { const a = i * Math.PI / 12; return `<path d="M30 42 L${(30 + Math.cos(a) * 60).toFixed(1)} ${(42 + Math.sin(a) * 60).toFixed(1)}" stroke="#d4af37" stroke-width=".4" opacity=".35"/>`; }).join('');
    return `<rect width="60" height="84" fill="#0d0c0a"/>${rays}
    <rect x="3.5" y="3.5" width="53" height="77" rx="3" fill="none" stroke="#d4af37" stroke-width="1"/><rect x="6" y="6" width="48" height="72" rx="2" fill="none" stroke="#d4af37" stroke-width=".4"/>
    <path d="M30 22 L42 42 L30 62 L18 42 Z" fill="#0d0c0a" stroke="#d4af37" stroke-width="1.2"/><path d="M30 28 L38 42 L30 56 L22 42 Z" fill="#d4af37"/>
    <path d="M30 28 L30 56 M22 42 L38 42" stroke="#0d0c0a" stroke-width=".6"/>
    <path d="M6 16 H12 V12 H16 V6 M54 16 H48 V12 H44 V6 M6 68 H12 V72 H16 V78 M54 68 H48 V72 H44 V78" fill="none" stroke="#d4af37" stroke-width=".8"/>`;
  },
  frost: (u: string) => {
    const g = `${u}g`;
    const arm = `<path d="M0 0 V-16 M0 -10 L-4 -14 M0 -10 L4 -14 M0 -5 L-3 -8 M0 -5 L3 -8" stroke="#1d4f7a" stroke-width="1.3" stroke-linecap="round" fill="none"/>`;
    const flake = [0, 60, 120, 180, 240, 300].map(a => `<g transform="rotate(${a})">${arm}</g>`).join('');
    const tiny = (x: number, y: number) => `<g transform="translate(${x} ${y}) scale(.25)" opacity=".6">${flake}</g>`;
    return `<defs><linearGradient id="${g}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e6f3fb"/><stop offset="1" stop-color="#9cc2e0"/></linearGradient></defs>
    <rect width="60" height="84" fill="url(#${g})"/>${frameBack('#1d4f7a', .9)}
    ${tiny(12,14)}${tiny(48,14)}${tiny(12,70)}${tiny(48,70)}
    <g transform="translate(30 42)">${flake}<circle r="2.4" fill="#1d4f7a"/></g>`;
  },
  ember: (u: string) => {
    const g = `${u}g`;
    const embers = [[12,70,.9],[48,66,.7],[18,58,.5],[44,20,.6],[14,22,.7],[50,40,.5],[10,40,.4],[38,74,.5]].map(([x,y,r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#ffcf6a"/>`).join('');
    return `<defs><radialGradient id="${g}" cx=".5" cy=".75" r=".9"><stop offset="0" stop-color="#a5380f"/><stop offset="1" stop-color="#2b0d04"/></radialGradient></defs>
    <rect width="60" height="84" fill="url(#${g})"/>${embers}${frameBack('#ffb347', 1)}
    <path d="M30 18 C34 28 44 32 42 48 C41 58 35 64 30 64 C25 64 18 58 18 48 C18 40 22 36 24 30 C26 36 28 38 30 38 C28 30 28 24 30 18 Z" fill="#ff8a2a"/>
    <path d="M30 34 C33 40 37 44 36 52 C35 58 32 60 30 60 C27 60 24 57 24 52 C24 48 26 46 27 43 C28 46 29 47 30 47 C29 42 29 38 30 34 Z" fill="#ffd36a"/>`;
  },
  sea: (u: string) => {
    const g = `${u}g`;
    const waves = [16, 24, 60, 68].map(y => `<path d="M6 ${y} q3 -3 6 0 t6 0 t6 0 t6 0 t6 0 t6 0 t6 0 t6 0" fill="none" stroke="#8fe0d2" stroke-width=".7" opacity=".55"/>`).join('');
    return `<defs><linearGradient id="${g}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#11686e"/><stop offset="1" stop-color="#06292d"/></linearGradient></defs>
    <rect width="60" height="84" fill="url(#${g})"/>${waves}
    <rect x="4" y="4" width="52" height="76" rx="4" fill="none" stroke="#8fe0d2" stroke-width="1.6" stroke-dasharray="2 1.4"/>
    <g transform="translate(30 42)"><circle r="12" fill="none" stroke="#8fe0d2" stroke-width=".8"/>
      <path d="M0 -15 L3 -3 L15 0 L3 3 L0 15 L-3 3 L-15 0 L-3 -3 Z" fill="#8fe0d2"/>
      <path d="M0 -15 L3 -3 L0 0 Z M15 0 L3 3 L0 0 Z M0 15 L-3 3 L0 0 Z M-15 0 L-3 -3 L0 0 Z" fill="#0b4448" opacity=".55"/>
      <path d="M-8 -8 L-1.5 -1.5 M8 -8 L1.5 -1.5 M-8 8 L-1.5 1.5 M8 8 L1.5 1.5" stroke="#8fe0d2" stroke-width="1"/></g>`;
  },
  amethyst: (u: string) => {
    const g = `${u}g`, p = `${u}p`;
    return `<defs><linearGradient id="${g}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#5a2f92"/><stop offset="1" stop-color="#1d0d38"/></linearGradient>
      <pattern id="${p}" width="10" height="17.32" patternUnits="userSpaceOnUse"><path d="M5 0 L10 8.66 L5 17.32 L0 8.66 Z" fill="none" stroke="#e0c3ff" stroke-width=".3" opacity=".35"/></pattern></defs>
    <rect width="60" height="84" fill="url(#${g})"/><rect width="60" height="84" fill="url(#${p})"/>${frameBack('#e0c3ff', 1)}
    <g transform="translate(30 42)">
      <path d="M-12 -6 L-6 -16 L6 -16 L12 -6 L0 18 Z" fill="#b48ae8"/>
      <path d="M-12 -6 L12 -6 L0 18 Z" fill="#8a5ac8"/><path d="M-6 -16 L0 -6 L6 -16 Z" fill="#e0c3ff"/>
      <path d="M-12 -6 L-6 -16 L0 -6 Z M12 -6 L6 -16 L0 -6 Z" fill="#cfb0f4"/><path d="M0 -6 L0 18 L12 -6 Z" fill="#6a3aa8"/>
      <path d="M-12 -6 L-6 -16 L6 -16 L12 -6 L0 18 Z M-12 -6 H12" fill="none" stroke="#f3e6ff" stroke-width=".6"/></g>`;
  },
  spectral: (u: string) => {
    const g = `${u}g`;
    const mist = [20, 64, 70].map((y, i) => `<path d="M2 ${y} q7 -4 14 0 t14 0 t14 0 t14 0" fill="none" stroke="#9fe6c8" stroke-width="${i ? .6 : .8}" opacity=".45"/>`).join('');
    const rays = Array.from({ length: 12 }, (_, i) => { const a = i * Math.PI / 6; return `<path d="M${(30 + Math.cos(a) * 15).toFixed(1)} ${(42 + Math.sin(a) * 15).toFixed(1)} L${(30 + Math.cos(a) * 20).toFixed(1)} ${(42 + Math.sin(a) * 20).toFixed(1)}" stroke="#9fe6c8" stroke-width=".9" stroke-linecap="round" opacity=".7"/>`; }).join('');
    return `<defs><radialGradient id="${g}" cx=".5" cy=".5" r=".75"><stop offset="0" stop-color="#3f4a4c"/><stop offset="1" stop-color="#121417"/></radialGradient></defs>
    <rect width="60" height="84" fill="url(#${g})"/>${mist}${frameBack('#9fe6c8', .7)}${rays}
    <path d="M14 42 Q30 26 46 42 Q30 58 14 42 Z" fill="#dff7ec"/><circle cx="30" cy="42" r="6.5" fill="#2f8a6a"/><circle cx="30" cy="42" r="3" fill="#0b0f0e"/><circle cx="31.5" cy="40.5" r="1" fill="#fff"/>`;
  },
  desert: (u: string) => {
    const g = `${u}g`;
    const rays = Array.from({ length: 16 }, (_, i) => { const a = i * Math.PI / 8; return `<path d="M${(30 + Math.cos(a) * 12).toFixed(1)} ${(36 + Math.sin(a) * 12).toFixed(1)} L${(30 + Math.cos(a) * (i % 2 ? 16 : 19)).toFixed(1)} ${(36 + Math.sin(a) * (i % 2 ? 16 : 19)).toFixed(1)}" stroke="#ffe0a3" stroke-width="1.4" stroke-linecap="round"/>`; }).join('');
    return `<defs><linearGradient id="${g}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d98c45"/><stop offset="1" stop-color="#7a3d1a"/></linearGradient></defs>
    <rect width="60" height="84" fill="url(#${g})"/>
    <circle cx="30" cy="36" r="10" fill="#ffe0a3"/>${rays}
    <path d="M0 66 Q16 56 32 64 T60 60 V84 H0 Z" fill="#a8521f"/><path d="M0 74 Q20 66 40 74 T60 72 V84 H0 Z" fill="#7a3510"/>
    ${frameBack('#ffe0a3', 1)}`;
  },
  sakura: (u: string) => {
    const g = `${u}g`;
    const flower = (x: number, y: number, s: number, r = 0) => `<g transform="translate(${x} ${y}) rotate(${r}) scale(${s})">${[0,72,144,216,288].map(a => `<path d="M0 0 C-3 -3 -3 -7 0 -8 C3 -7 3 -3 0 0 Z" fill="#fff4f7" transform="rotate(${a})"/>`).join('')}<circle r="1.3" fill="#d9577f"/></g>`;
    return `<defs><linearGradient id="${g}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f5c9d6"/><stop offset="1" stop-color="#d98aa5"/></linearGradient></defs>
    <rect width="60" height="84" fill="url(#${g})"/>
    <path d="M4 70 C16 62 22 52 28 50 C36 46 40 38 52 30 M22 55 C20 48 22 44 26 40 M40 39 C44 42 48 42 54 40" fill="none" stroke="#7a2846" stroke-width="1.6" stroke-linecap="round"/>
    ${flower(28,48,1.3,10)}${flower(40,36,1,30)}${flower(24,40,.9,-20)}${flower(52,29,.8)}${flower(16,62,.9,40)}${flower(46,62,.5)}${flower(14,20,.5)}${flower(44,14,.6,15)}
    ${frameBack('#7a2846', .9)}`;
  },
  clockwork: (u: string) => {
    const g = `${u}g`;
    const gear = (x: number, y: number, r: number, teeth: number, fill: string) => {
      const circ = 2 * Math.PI * r, seg = circ / teeth / 2;
      return `<g transform="translate(${x} ${y})"><circle r="${r}" fill="none" stroke="${fill}" stroke-width="3.4" stroke-dasharray="${seg.toFixed(2)} ${seg.toFixed(2)}"/><circle r="${(r - 1.2).toFixed(1)}" fill="${fill}"/><circle r="${(r * .4).toFixed(1)}" fill="#2a1a10"/></g>`;
    };
    return `<defs><linearGradient id="${g}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#6a4428"/><stop offset="1" stop-color="#24160c"/></linearGradient></defs>
    <rect width="60" height="84" fill="url(#${g})"/>
    <rect x="4" y="4" width="52" height="76" rx="3" fill="none" stroke="#e0a060" stroke-width="1.3"/>
    ${[[8,8],[52,8],[8,76],[52,76]].map(([x,y]) => `<circle cx="${x}" cy="${y}" r="1.6" fill="#e0a060"/>`).join('')}
    ${gear(26, 38, 11, 12, '#e0a060')}${gear(40, 54, 7, 8, '#b87a3a')}${gear(38, 26, 5, 7, '#c98d4a')}`;
  },
};


// ---------------------------------------------------------------- public helpers

const ROLE_ORDER: Role[] = ['governor', 'assassin', 'thief', 'shaman', 'duchess'];

/** CSS custom properties for a style. Put them on any element that contains cards. */
export function cardStyleVars(style: CardStyle): Record<string, string> {
  const p = PALETTES[style] ?? PALETTES.classic;
  const vars: Record<string, string> = {
    '--c-accent': p.accent,
    '--c-bg1': p.bg1,
    '--c-bg2': p.bg2,
    '--c-border': p.border,
    '--c-ink': p.ink,
    '--c-cut': p.cut,
    '--c-disc': p.disc,
    '--c-back-border': p.backBorder,
  };
  ROLE_ORDER.forEach((role, i) => (vars[`--cr-${role}`] = p.roles[i] as string));
  return vars;
}

export function iconMode(style: CardStyle): IconMode {
  return (ICONS[style] ?? ICONS.classic).mode;
}

const emblemCache = new Map<string, string>();

/** Markup for a role emblem inside a 100x100 viewBox. */
export function emblemSvg(style: CardStyle, role: Role): string {
  const key = `${style}:${role}`;
  let svg = emblemCache.get(key);
  if (svg === undefined) {
    const ic = ICONS[style] ?? ICONS.classic;
    const b = BADGES[ic.badge];
    const t = b.s === 1 ? '' : ` transform="translate(50 50) scale(${b.s}) translate(-50 -50)"`;
    svg = `${b.draw()}<g class="glyph"${t}>${GLYPHS[ic.set][role]}</g>`;
    emblemCache.set(key, svg);
  }
  return svg;
}

/** Markup for the ornament drawn over a card face (86x124 viewBox, stretched), or '' for none. */
export function frameSvg(style: CardStyle): string {
  const p = PALETTES[style] ?? PALETTES.classic;
  return FRAMES[p.frame](p.accent);
}

/**
 * Markup for a card back (60x84 viewBox). `uid` keeps gradient and pattern ids unique
 * on the page; it must be a valid XML id fragment.
 */
export function backSvg(style: CardStyle, uid: string): string {
  return (BACKS[style] ?? BACKS.classic)(uid);
}

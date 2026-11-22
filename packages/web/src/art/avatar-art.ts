import type { AvatarId } from '@shadow-court/protocol';

/*
 * Player portraits, drawn in code on a 100x100 canvas and shown inside a circle.
 * Each entry is [background colour, drawing].
 */
const SK = { light: '#f2cfa8', mid: '#d9a777', tan: '#b97c52', dark: '#7d4f33', pale: '#efe3d3' };
const bodyP = (c: string) => `<path d="M12 104 C14 82 30 74 50 74 C70 74 86 82 88 104 Z" fill="${c}"/>`;
const neck = (s: string) => `<path d="M43 58 L43 76 Q50 80 57 76 L57 58 Z" fill="${s}"/><path d="M43 66 Q50 70 57 66 L57 62 L43 62 Z" fill="#000" opacity=".12"/>`;
const head = (s: string) => `<circle cx="34" cy="49" r="3.6" fill="${s}"/><circle cx="66" cy="49" r="3.6" fill="${s}"/><ellipse cx="50" cy="47" rx="16" ry="18.5" fill="${s}"/>`;
const eyes = (y = 48, c = '#2a1d10') => `<circle cx="44" cy="${y}" r="2.1" fill="${c}"/><circle cx="56" cy="${y}" r="2.1" fill="${c}"/><circle cx="44.7" cy="${y - .7}" r=".6" fill="#fff"/><circle cx="56.7" cy="${y - .7}" r=".6" fill="#fff"/>`;
const blush = `<circle cx="39.5" cy="54" r="3" fill="#e8706a" opacity=".28"/><circle cx="60.5" cy="54" r="3" fill="#e8706a" opacity=".28"/>`;
const brows = (c: string, y = 43) => `<path d="M40.5 ${y} Q44 ${y - 2} 47 ${y}" fill="none" stroke="${c}" stroke-width="1.5" stroke-linecap="round"/><path d="M53 ${y} Q56 ${y - 2} 59.5 ${y}" fill="none" stroke="${c}" stroke-width="1.5" stroke-linecap="round"/>`;

const DRAW: Record<AvatarId, [string, () => string]> = {
  king: ['#5a3a8a', () => `${bodyP('#a3262a')}<path d="M24 86 Q50 98 76 86 L80 96 Q50 108 20 96 Z" fill="#f4efe6"/>${[30,40,50,60,70].map(x => `<circle cx="${x}" cy="${x === 50 ? 96 : 93}" r="1.2" fill="#1a1a1a"/>`).join('')}
    ${neck(SK.light)}${head(SK.light)}
    <path d="M34 46 C34 34 41 30 50 30 C59 30 66 34 66 46 C63 40 58 38 50 38 C42 38 37 40 34 46 Z" fill="#8a6038"/>
    <path d="M34 50 C34 66 42 75 50 75 C58 75 66 66 66 50 C62 58 56 61 50 61 C44 61 38 58 34 50 Z" fill="#8a5a30"/>
    <path d="M42 57.5 Q46 54 50 56 Q54 54 58 57.5 Q54 59.5 50 58.5 Q46 59.5 42 57.5 Z" fill="#6a4020"/>
    ${eyes(48)}${brows('#6a4020')}
    <path d="M32 34 L33 15 L41 24 L50 11 L59 24 L67 15 L68 34 Z" fill="#e0b455" stroke="#a87a20" stroke-width="1"/>
    <rect x="32" y="30" width="36" height="6" rx="1.5" fill="#c99a3a" stroke="#a87a20" stroke-width=".8"/>
    <circle cx="41" cy="33" r="1.8" fill="#c0283a"/><circle cx="50" cy="33" r="2.2" fill="#2f6fc0"/><circle cx="59" cy="33" r="1.8" fill="#c0283a"/>
    <circle cx="33" cy="15" r="1.8" fill="#e0b455"/><circle cx="50" cy="11" r="2" fill="#e0b455"/><circle cx="67" cy="15" r="1.8" fill="#e0b455"/>`],

  queen: ['#2f6f8f', () => `<path d="M28 50 C26 26 38 22 50 22 C62 22 74 26 72 50 C74 64 77 78 72 90 L28 90 C23 78 26 64 28 50 Z" fill="#7a2a1a"/>
    ${bodyP('#1f4f6f')}<path d="M36 76 Q50 92 64 76" fill="none" stroke="#e8e2d4" stroke-width="0"/>
    ${neck(SK.light)}${[38,42,46,50,54,58,62].map((x, i) => `<circle cx="${x}" cy="${78 + Math.sin(i / 6 * Math.PI) * 5}" r="1.6" fill="#f4efe6"/>`).join('')}
    ${head(SK.light)}
    <path d="M33 47 C32 31 42 26 50 26 C59 26 68 31 67 47 C62 37 54 34 46 37 C40 39 36 42 33 47 Z" fill="#7a2a1a"/>
    <path d="M37 29 L41 20 L45 26 L50 15 L55 26 L59 20 L63 29 Q50 25 37 29 Z" fill="#e6ecf4" stroke="#9aa8bb" stroke-width=".8"/>
    <circle cx="50" cy="22" r="2" fill="#3fb0d0"/>
    ${eyes(48)}<path d="M41.5 46 L40 45 M58.5 46 L60 45" stroke="#2a1d10" stroke-width="1"/>${brows('#5a1a10', 43.5)}${blush}
    <path d="M46.5 56.5 Q50 59.5 53.5 56.5 Q50 57.6 46.5 56.5 Z" fill="#c03040" stroke="#c03040" stroke-width="1.2" stroke-linejoin="round"/>`],

  knight: ['#8a6a3a', () => `<path d="M52 24 C56 8 74 2 86 12 C76 10 66 14 60 28 Z" fill="#b0302a"/><path d="M54 24 C60 12 70 8 80 10" fill="none" stroke="#e0584a" stroke-width="1"/>
    ${bodyP('#8f99a6')}<ellipse cx="25" cy="90" rx="15" ry="11" fill="#a9b3bf" stroke="#5f6873" stroke-width="1.2"/><ellipse cx="75" cy="90" rx="15" ry="11" fill="#a9b3bf" stroke="#5f6873" stroke-width="1.2"/>
    <rect x="38" y="64" width="24" height="14" rx="3" fill="#7d8794" stroke="#5f6873" stroke-width="1"/>
    <path d="M30 64 C30 34 38 21 50 21 C62 21 70 34 70 64 Q50 71 30 64 Z" fill="#b7c0cb" stroke="#5f6873" stroke-width="1.5"/>
    <path d="M50 21 L50 68" stroke="#8a939e" stroke-width="1.4"/>
    <rect x="33" y="42" width="34" height="5" rx="2" fill="#1a1a1a"/>
    ${[[41,55],[44,58],[41,61],[59,55],[56,58],[59,61]].map(([x,y]) => `<circle cx="${x}" cy="${y}" r="1" fill="#3a3f46"/>`).join('')}
    <path d="M35 36 Q38 27 46 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity=".45"/>`],

  jester: ['#e0a83a', () => `${bodyP('#2f6b3a')}<path d="M20 86 L28 76 L35 88 L42.5 76 L50 90 L57.5 76 L65 88 L72 76 L80 86 L82 96 L18 96 Z" fill="#b0302a"/>
    ${[28,42.5,57.5,72].map(x => `<circle cx="${x}" cy="76" r="2" fill="#f2c94c" stroke="#a87a20" stroke-width=".6"/>`).join('')}
    ${neck(SK.light)}${head('#f6ece0')}
    <path d="M42 51 L44 47 L46 51 L44 55 Z" fill="#2f6b3a"/><path d="M54 51 L56 47 L58 51 L56 55 Z" fill="#b0302a"/>
    ${eyes(46)}<circle cx="50" cy="52" r="2.6" fill="#d0303a"/>
    <path d="M42.5 56 Q50 64 57.5 56" fill="none" stroke="#7a2a2a" stroke-width="1.8" stroke-linecap="round"/>
    <path d="M50 35 C44 19 26 13 12 25 C22 23 30 29 32 41 Q41 35 50 35 Z" fill="#b0302a"/>
    <path d="M50 35 C56 19 74 13 88 25 C78 23 70 29 68 41 Q59 35 50 35 Z" fill="#2f6b3a"/>
    <path d="M42 35 C42 21 46 11 50 7 C54 11 58 21 58 35 Q50 33 42 35 Z" fill="#6a3f9a"/>
    <path d="M32 38 Q50 30 68 38 L68 43 Q50 35 32 43 Z" fill="#e0b455"/>
    ${[[12,25],[88,25],[50,7]].map(([x,y]) => `<circle cx="${x}" cy="${y}" r="4" fill="#f2c94c" stroke="#a87a20" stroke-width="1"/>`).join('')}`],

  monk: ['#4a5a3a', () => `<path d="M16 104 C16 70 25 24 50 20 C75 24 84 70 84 104 Z" fill="#6b4a2b"/>
    <path d="M30 60 C30 40 38 28 50 28 C62 28 70 40 70 60 C70 72 60 78 50 78 C40 78 30 72 30 60 Z" fill="#2a1a0e"/>
    <ellipse cx="50" cy="54" rx="14" ry="16" fill="${SK.mid}"/>
    <path d="M42 52 Q45 54.5 48 52 M52 52 Q55 54.5 58 52" fill="none" stroke="#2a1d10" stroke-width="1.5" stroke-linecap="round"/>
    <path d="M41 47.5 Q44 46 47 47.5 M53 47.5 Q56 46 59 47.5" fill="none" stroke="#5a3a20" stroke-width="1.3" stroke-linecap="round"/>
    <path d="M46 61 Q50 63.5 54 61" fill="none" stroke="#7a3a2a" stroke-width="1.4" stroke-linecap="round"/>
    <path d="M24 88 C34 80 40 82 50 86 C60 82 66 80 76 88" fill="none" stroke="#4a3018" stroke-width="2"/>
    <path d="M36 90 Q50 96 64 90" fill="none" stroke="#d9c38a" stroke-width="2.2"/><path d="M58 92 L60 102 M62 91 L65 101" stroke="#d9c38a" stroke-width="1.8" stroke-linecap="round"/>`],

  witch: ['#2b1f3d', () => `<circle cx="20" cy="22" r="9" fill="#e8e2c0" opacity=".7"/><circle cx="24" cy="19" r="8" fill="#2b1f3d"/>
    <path d="M30 42 C26 60 25 78 28 94 L72 94 C75 78 74 60 70 42 Z" fill="#c0552a"/>
    ${bodyP('#3a2a4a')}${neck('#d4e4bc')}${head('#d4e4bc')}
    <path d="M34 46 C36 40 40 38 44 38 L56 38 C60 38 64 40 66 46 L66 40 L34 40 Z" fill="#c0552a"/>
    <ellipse cx="44" cy="48" rx="2.6" ry="2.2" fill="#3a9a4a"/><ellipse cx="56" cy="48" rx="2.6" ry="2.2" fill="#3a9a4a"/><circle cx="44" cy="48" r="1.1" fill="#111"/><circle cx="56" cy="48" r="1.1" fill="#111"/>
    <path d="M40.5 44 L47 45 M53 45 L59.5 43" stroke="#7a3010" stroke-width="1.5" stroke-linecap="round"/>
    <path d="M45 57 Q51 60 56 55.5" fill="none" stroke="#6a2a3a" stroke-width="1.5" stroke-linecap="round"/>
    <ellipse cx="50" cy="38" rx="33" ry="6.5" fill="#1e1428"/>
    <path d="M34 38 C38 26 44 16 52 5 C55 10 59 13 64 11 C60 19 64 28 66 38 Z" fill="#2a1d3a"/>
    <path d="M35.5 34 L64.5 34 L65.5 38 L34.5 38 Z" fill="#7a4cb8"/><rect x="46.5" y="33.5" width="7" height="5" rx="1" fill="none" stroke="#e0b455" stroke-width="1.2"/>`],

  bard: ['#2c7a5e', () => `${bodyP('#8a2a3a')}<path d="M40 74 L50 84 L60 74" fill="#f4efe6"/>${[80,86,92].map(y => `<path d="M46 ${y} L54 ${y + 3} M54 ${y} L46 ${y + 3}" stroke="#e0b455" stroke-width="1"/>`).join('')}
    ${neck(SK.light)}${head(SK.light)}
    <path d="M33 48 C30 32 42 27 50 28 C60 27 70 33 67 48 C64 41 60 39 56 41 C50 37 42 39 33 48 Z" fill="#e0b04a"/>
    <circle cx="33" cy="50" r="4" fill="#e0b04a"/><circle cx="67" cy="50" r="4" fill="#e0b04a"/>
    <path d="M29 37 C29 25 50 20 71 28 C75 31 73 37 67 38 C54 35 40 36 29 37 Z" fill="#5a2a7a"/>
    <path d="M62 27 C70 15 82 10 92 7 C86 16 78 24 65 31 Z" fill="#f2d04a" stroke="#b8901a" stroke-width=".8"/><path d="M64 29 C72 21 80 15 90 9" fill="none" stroke="#b8901a" stroke-width=".7"/>
    <circle cx="44" cy="48" r="2.1" fill="#2a1d10"/><circle cx="44.7" cy="47.3" r=".6" fill="#fff"/>
    <path d="M53.5 48.5 Q56 46 58.5 48.5" fill="none" stroke="#2a1d10" stroke-width="1.6" stroke-linecap="round"/>
    ${brows('#a8781a')}${blush}<path d="M44.5 55 Q50 62 55.5 55 Z" fill="#6a2020"/>`],

  alchemist: ['#5a3a1e', () => `${[[16,30,3],[22,20,2],[82,64,3],[78,52,2],[86,40,1.5]].map(([x,y,r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="#7fd08a" stroke-width="1" opacity=".7"/>`).join('')}
    ${bodyP('#2f4a6a')}<path d="M36 76 L50 92 L64 76" fill="#25384f"/>
    ${neck(SK.light)}${head(SK.light)}
    ${[[32,40,8],[36,30,8],[46,25,9],[57,25,9],[66,31,8],[69,41,7]].map(([x,y,r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#ecebe6"/>`).join('')}
    <rect x="33" y="33" width="34" height="3" fill="#5a3a20"/>
    <circle cx="43" cy="35" r="6" fill="#8fd0c0" stroke="#b8863a" stroke-width="2.2"/><circle cx="57" cy="35" r="6" fill="#8fd0c0" stroke="#b8863a" stroke-width="2.2"/>
    <path d="M40 33 L42 31 M54 33 L56 31" stroke="#fff" stroke-width="1.2" stroke-linecap="round"/>
    ${eyes(48.5)}<path d="M40 44.5 Q44 42.5 47.5 44.5 M52.5 44.5 Q56 42.5 60 44.5" fill="none" stroke="#ecebe6" stroke-width="2.2" stroke-linecap="round"/>
    <path d="M38 58 Q44 53.5 50 56.5 Q56 53.5 62 58 Q56 61.5 50 59 Q44 61.5 38 58 Z" fill="#ecebe6"/>`],

  pirate: ['#1f4e6b', () => `${bodyP('#3a2a20')}<path d="M40 74 L50 90 L60 74 Z" fill="#f4efe6"/><path d="M28 80 L40 74 L44 92 Z M72 80 L60 74 L56 92 Z" fill="#2a1d14"/>
    ${neck(SK.tan)}${head(SK.tan)}
    <path d="M36 54 C38 66 44 70 50 70 C56 70 62 66 64 54 C60 60 56 62 50 62 C44 62 40 60 36 54 Z" fill="#2a1d14" opacity=".22"/>
    <path d="M33 42 C33 28 42 24 50 24 C60 24 67 28 67 42 Q50 34 33 42 Z" fill="#b0302a"/>
    ${[[42,30],[52,28],[60,33],[46,36],[38,36]].map(([x,y]) => `<circle cx="${x}" cy="${y}" r="1.1" fill="#f4efe6"/>`).join('')}
    <path d="M66 38 L80 42 L76 47 Z" fill="#b0302a"/><path d="M66 40 L76 53 L70 54 Z" fill="#8a2020"/>
    <path d="M33 40.5 L67 52.5" stroke="#111" stroke-width="1.4"/><ellipse cx="44" cy="48" rx="5" ry="4.2" fill="#111"/>
    <circle cx="56" cy="48" r="2.1" fill="#2a1d10"/><circle cx="56.7" cy="47.3" r=".6" fill="#fff"/>
    <path d="M53 44 Q56 42.5 59.5 44" fill="none" stroke="#2a1d10" stroke-width="1.5" stroke-linecap="round"/>
    <path d="M44 57 Q50 61.5 56 57" fill="none" stroke="#5a2a1a" stroke-width="1.6" stroke-linecap="round"/><rect x="51" y="58" width="2.4" height="2" fill="#e0b455"/>
    <circle cx="33" cy="54" r="2.6" fill="none" stroke="#e0b455" stroke-width="1.2"/>`],

  plague: ['#2f3e3e', () => `${bodyP('#1a1a1a')}<path d="M30 76 Q50 70 70 76 L66 90 Q50 84 34 90 Z" fill="#262626"/>
    <ellipse cx="50" cy="47" rx="17" ry="19" fill="#c9a77a"/>
    <path d="M44 52 C50 51 60 54 82 78 C64 72 54 67 45 62 Z" fill="#b08a5a" stroke="#6a4a2a" stroke-width="1"/>
    <path d="M50 56 C58 60 66 66 76 74" fill="none" stroke="#6a4a2a" stroke-width=".8"/>
    <circle cx="43" cy="44" r="5.4" fill="#f2a33a" stroke="#3a2a1a" stroke-width="2.2"/><circle cx="57" cy="44" r="5.4" fill="#f2a33a" stroke="#3a2a1a" stroke-width="2.2"/>
    <circle cx="41.5" cy="42.5" r="1.4" fill="#fff" opacity=".8"/><circle cx="55.5" cy="42.5" r="1.4" fill="#fff" opacity=".8"/>
    <ellipse cx="50" cy="31" rx="31" ry="6" fill="#141414"/><path d="M36 31 L38 11 Q50 8 62 11 L64 31 Z" fill="#222"/>
    <path d="M37.2 25 L62.8 25 L63.4 30 L36.6 30 Z" fill="#6a1a1a"/>`],

  fox: ['#2d5a3d', () => `${bodyP('#2f4a7a')}<path d="M34 76 Q50 84 66 76 L62 70 Q50 76 38 70 Z" fill="#e0b455"/>
    <path d="M28 42 L30 12 L47 30 Z" fill="#e07a2a"/><path d="M72 42 L70 12 L53 30 Z" fill="#e07a2a"/>
    <path d="M32 35 L32.5 18 L42 29 Z" fill="#3a1a0a"/><path d="M68 35 L67.5 18 L58 29 Z" fill="#3a1a0a"/>
    <path d="M24 44 C26 30 38 25 50 25 C62 25 74 30 76 44 C74 58 62 70 50 76 C38 70 26 58 24 44 Z" fill="#e07a2a"/>
    <path d="M26 48 C32 52 40 54 46 60 C48 66 49 71 50 76 C38 70 28 60 26 48 Z" fill="#f6efe4"/><path d="M74 48 C68 52 60 54 54 60 C52 66 51 71 50 76 C62 70 72 60 74 48 Z" fill="#f6efe4"/>
    <path d="M36 44 Q41 40.5 46 44 Q41 46.5 36 44 Z" fill="#2a1d10"/><path d="M54 44 Q59 40.5 64 44 Q59 46.5 54 44 Z" fill="#2a1d10"/>
    <circle cx="42" cy="43.3" r=".7" fill="#fff"/><circle cx="60" cy="43.3" r=".7" fill="#fff"/>
    <ellipse cx="50" cy="66" rx="3.6" ry="2.6" fill="#1a1a1a"/>`],

  raven: ['#7a9cbf', () => `${bodyP('#1e1e26')}<path d="M30 84 Q40 76 50 80 Q60 76 70 84" fill="none" stroke="#3a4a6a" stroke-width="1.4"/><path d="M26 94 Q38 86 50 90 Q62 86 74 94" fill="none" stroke="#3a4a6a" stroke-width="1.4"/>
    <path d="M30 32 L26 20 L36 27 L36 16 L44 26 Z" fill="#23232d"/>
    <circle cx="46" cy="48" r="21" fill="#23232d"/>
    <path d="M34 36 Q42 30 52 32" fill="none" stroke="#5a6a9a" stroke-width="1.4" stroke-linecap="round" opacity=".7"/>
    <path d="M58 46 L86 54 L60 56 Z" fill="#4a4a54"/><path d="M60 56 L82 56 L59 62 Z" fill="#363640"/><path d="M58 46 L86 54" stroke="#6a6a74" stroke-width=".8"/>
    <circle cx="50" cy="43" r="5.2" fill="#f0f0f0"/><circle cx="51" cy="43" r="2.8" fill="#111"/><circle cx="52" cy="42" r=".9" fill="#fff"/>`],

  cat: ['#7a2f4a', () => `${bodyP('#2a3a6a')}${[30,38,46,54,62,70].map(x => `<circle cx="${x}" cy="${78 + Math.abs(x - 50) / 6}" r="5.6" fill="#f4efe6" stroke="#d6cdbb" stroke-width=".6"/>`).join('')}
    <path d="M30 42 L30 18 L46 32 Z" fill="#8a8f99"/><path d="M70 42 L70 18 L54 32 Z" fill="#8a8f99"/>
    <path d="M33 36 L33 24 L42 32 Z" fill="#e8a0b0"/><path d="M67 36 L67 24 L58 32 Z" fill="#e8a0b0"/>
    <ellipse cx="50" cy="50" rx="21" ry="18" fill="#8a8f99"/>
    <path d="M42 34 L44 40 M50 32 L50 39 M58 34 L56 40" stroke="#6a6f79" stroke-width="2" stroke-linecap="round"/>
    <ellipse cx="50" cy="58" rx="9" ry="6.5" fill="#c9ccd3"/>
    <ellipse cx="42" cy="48" rx="4" ry="3.6" fill="#f2c94c"/><ellipse cx="58" cy="48" rx="4" ry="3.6" fill="#f2c94c"/>
    <ellipse cx="42" cy="48" rx="1.1" ry="3.2" fill="#111"/><ellipse cx="58" cy="48" rx="1.1" ry="3.2" fill="#111"/>
    <circle cx="58" cy="48" r="6.2" fill="none" stroke="#e0b455" stroke-width="1.3"/><path d="M64 50 Q70 58 66 70" fill="none" stroke="#e0b455" stroke-width=".9"/>
    <path d="M47.5 55 L52.5 55 L50 58 Z" fill="#d0707a"/><path d="M50 58 Q47 61 45 59.5 M50 58 Q53 61 55 59.5" fill="none" stroke="#3a3a42" stroke-width="1.1" stroke-linecap="round"/>
    <path d="M38 57 L26 55 M38 59 L27 61 M62 57 L74 55 M62 59 L73 61" stroke="#f4f4f4" stroke-width=".8" stroke-linecap="round"/>`],

  owl: ['#2a3550', () => `${[[14,16],[84,22],[20,70],[88,64],[10,44]].map(([x,y]) => `<circle cx="${x}" cy="${y}" r="1" fill="#e8eeff" opacity=".8"/>`).join('')}
    ${bodyP('#7a5a3a')}${[[40,86],[50,84],[60,86],[45,94],[55,94]].map(([x,y]) => `<path d="M${x - 3} ${y} L${x} ${y + 3} L${x + 3} ${y}" fill="none" stroke="#c9a77a" stroke-width="1.2"/>`).join('')}
    <path d="M30 36 L26 14 L42 28 Z" fill="#6a4a2c"/><path d="M70 36 L74 14 L58 28 Z" fill="#6a4a2c"/>
    <path d="M25 54 C23 34 34 24 50 26 C66 24 77 34 75 54 C72 72 28 72 25 54 Z" fill="#8a6a44"/>
    <circle cx="40.5" cy="47" r="11" fill="#e3cfa4"/><circle cx="59.5" cy="47" r="11" fill="#e3cfa4"/>
    <circle cx="40.5" cy="47" r="7" fill="#f2a33a"/><circle cx="59.5" cy="47" r="7" fill="#f2a33a"/>
    <circle cx="40.5" cy="47" r="3.6" fill="#111"/><circle cx="59.5" cy="47" r="3.6" fill="#111"/>
    <circle cx="42" cy="45.5" r="1.2" fill="#fff"/><circle cx="61" cy="45.5" r="1.2" fill="#fff"/>
    <path d="M46.5 53 L53.5 53 L50 61 Z" fill="#e0b455"/>`],

  mask: ['#6b1b2a', () => `<circle cx="50" cy="22" r="10" fill="#2a1a14"/><path d="M30 50 C28 30 40 26 50 26 C60 26 72 30 70 50 L68 66 L32 66 Z" fill="#2a1a14"/>
    ${bodyP('#1a1a2a')}${neck(SK.dark)}<path d="M42 76 Q50 82 58 76" fill="none" stroke="#e0b455" stroke-width="1.4"/><circle cx="50" cy="81" r="2.2" fill="#c0283a" stroke="#e0b455" stroke-width=".8"/>
    ${head(SK.dark)}
    <path d="M34 44 C34 32 42 29 50 29 C58 29 66 32 66 44 C62 36 56 34 50 35 C44 34 38 36 34 44 Z" fill="#2a1a14"/>
    <path d="M32 45 Q40 39 50 45 Q60 39 68 45 Q68 53 60 53 Q54 53 50 49 Q46 53 40 53 Q32 53 32 45 Z" fill="#e0b455" stroke="#a87a20" stroke-width="1"/>
    <ellipse cx="42" cy="47" rx="4" ry="2.4" fill="#1a0e0a"/><ellipse cx="58" cy="47" rx="4" ry="2.4" fill="#1a0e0a"/>
    <circle cx="42.6" cy="46.6" r=".8" fill="#fff"/><circle cx="58.6" cy="46.6" r=".8" fill="#fff"/>
    <path d="M66 44 C76 32 80 22 78 10 C72 22 66 32 62 42 Z" fill="#b0302a"/><path d="M67 45 C80 38 88 30 90 20 C82 30 74 36 64 43 Z" fill="#2f8a8a"/>
    <path d="M46.5 58 Q50 61 53.5 58 Q50 59 46.5 58 Z" fill="#b02838" stroke="#b02838" stroke-width="1.4" stroke-linejoin="round"/>`],
};

const cache = new Map<AvatarId, string>();

/** The full SVG markup inside a 100x100 viewBox: background square plus the portrait. */
export function avatarSvg(id: AvatarId): string {
  let svg = cache.get(id);
  if (svg === undefined) {
    const [bg, draw] = DRAW[id] ?? DRAW.king;
    svg = `<rect width="100" height="100" fill="${bg}"/>${draw()}`;
    cache.set(id, svg);
  }
  return svg;
}

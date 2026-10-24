import sharp from 'sharp';

/** Drawn items for the demo posts, so the screenshots need no real photos. */
const ITEMS = {
  wallet: {
    surface: ['#c9a27a', '#a77a52'],
    shapes: `
      <rect x="420" y="215" width="300" height="130" rx="14" fill="#2f6fdc"/>
      <rect x="330" y="260" width="540" height="390" rx="38" fill="#1d1d21"/>
      <rect x="352" y="282" width="496" height="346" rx="26" fill="none" stroke="#4a4a52" stroke-width="5" stroke-dasharray="16 11"/>
      <rect x="720" y="390" width="170" height="130" rx="22" fill="#28282d"/>
      <circle cx="790" cy="455" r="14" fill="#8d8f96"/>`,
  },
  keys: {
    surface: ['#d9dde3', '#b5bcc6'],
    shapes: `
      <circle cx="560" cy="330" r="92" fill="none" stroke="#b9bdc5" stroke-width="18"/>
      <path d="M600 410 L700 640 L740 625 L725 590 L760 578 L748 548 L712 560 L640 395 Z" fill="#c8ccd3"/>
      <rect x="330" y="420" width="190" height="260" rx="58" fill="#202227" transform="rotate(-14 425 550)"/>
      <circle cx="420" cy="500" r="24" fill="#3c4048" transform="rotate(-14 425 550)"/>
      <circle cx="420" cy="580" r="24" fill="#3c4048" transform="rotate(-14 425 550)"/>
      <rect x="610" y="170" width="150" height="210" rx="40" fill="#1f5fd6" transform="rotate(22 685 275)"/>
      <circle cx="685" cy="215" r="18" fill="#d9dde3" transform="rotate(22 685 275)"/>`,
  },
  umbrella: {
    surface: ['#9fb2bc', '#7f939e'],
    shapes: `
      <path d="M560 150 L640 150 L690 640 L510 640 Z" fill="#1f3f8f"/>
      <path d="M600 150 L612 640 L588 640 Z" fill="#2c54b3"/>
      <rect x="585" y="110" width="30" height="50" rx="8" fill="#16295c"/>
      <rect x="586" y="640" width="28" height="90" fill="#6b4a2b"/>
      <path d="M600 728 q0 60 -60 60 q-40 0 -40 -40" fill="none" stroke="#6b4a2b" stroke-width="30" stroke-linecap="round"/>`,
  },
  earbuds: {
    surface: ['#e8e2d8', '#cfc7ba'],
    shapes: `
      <rect x="400" y="260" width="400" height="360" rx="130" fill="#fbfbfb"/>
      <path d="M400 390 H800" stroke="#dedede" stroke-width="5"/>
      <circle cx="600" cy="470" r="9" fill="#58c25a"/>
      <rect x="575" y="590" width="50" height="16" rx="8" fill="#e3e3e3"/>`,
  },
  calculator: {
    surface: ['#d9dde3', '#b5bcc6'],
    shapes: `
      <rect x="430" y="140" width="340" height="620" rx="34" fill="#2b2e35"/>
      <rect x="470" y="190" width="260" height="110" rx="10" fill="#b8c7a5"/>
      ${[0, 1, 2, 3, 4, 5]
        .flatMap((row) =>
          [0, 1, 2, 3].map(
            (col) =>
              `<rect x="${478 + col * 64}" y="${340 + row * 64}" width="48" height="44" rx="10" fill="${row === 5 && col === 3 ? '#e2683c' : '#4a4e58'}"/>`,
          ),
        )
        .join('')}`,
  },
  bottle: {
    surface: ['#7f9a86', '#62806b'],
    shapes: `
      <rect x="520" y="110" width="160" height="90" rx="20" fill="#27323a"/>
      <rect x="490" y="190" width="220" height="580" rx="70" fill="#9aa5ad"/>
      <rect x="520" y="230" width="34" height="500" rx="17" fill="#c3ccd2"/>
      <rect x="490" y="420" width="220" height="70" fill="#2e8f8a"/>`,
  },
  backpack: {
    surface: ['#b0a596', '#90857a'],
    shapes: `
      <rect x="380" y="200" width="440" height="560" rx="110" fill="#5b6470"/>
      <path d="M520 205 q80 -110 160 0" fill="none" stroke="#454c56" stroke-width="30"/>
      <rect x="450" y="470" width="300" height="230" rx="50" fill="#4a525d"/>
      <path d="M470 520 H730" stroke="#353b44" stroke-width="10"/>
      <rect x="585" y="300" width="30" height="110" rx="12" fill="#353b44"/>`,
  },
  books: {
    surface: ['#c9a27a', '#a77a52'],
    shapes: `
      <rect x="340" y="560" width="520" height="90" rx="10" fill="#8c2f39"/>
      <rect x="370" y="470" width="470" height="90" rx="10" fill="#2f5d8c"/>
      <rect x="350" y="380" width="490" height="90" rx="10" fill="#3f7d4f"/>
      <rect x="390" y="290" width="440" height="90" rx="10" fill="#d1a33a"/>
      <path d="M360 605 H840 M390 515 H820 M370 425 H820 M410 335 H810" stroke="#f3eee4" stroke-width="6" opacity="0.6"/>`,
  },
  phone: {
    surface: ['#d9dde3', '#b5bcc6'],
    shapes: `
      <rect x="455" y="140" width="290" height="600" rx="48" fill="#1c1d21"/>
      <rect x="475" y="175" width="250" height="530" rx="30" fill="#3a4f7a"/>
      <rect x="560" y="158" width="80" height="16" rx="8" fill="#0f1013"/>`,
  },
} as const;

export type DemoItem = keyof typeof ITEMS;

/** A tabletop with a soft shadow under the item, saved as a JPEG like a phone photo. */
export function demoPhoto(item: DemoItem): Promise<Buffer> {
  const { surface, shapes } = ITEMS[item];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="900" viewBox="0 0 1200 900">
    <defs>
      <linearGradient id="surface" x1="0" y1="0" x2="0.3" y2="1">
        <stop offset="0" stop-color="${surface[0]}"/>
        <stop offset="1" stop-color="${surface[1]}"/>
      </linearGradient>
      <filter id="shadow" x="-30%" y="-30%" width="160%" height="160%">
        <feDropShadow dx="0" dy="22" stdDeviation="24" flood-opacity="0.35"/>
      </filter>
    </defs>
    <rect width="1200" height="900" fill="url(#surface)"/>
    <g filter="url(#shadow)">${shapes}</g>
  </svg>`;
  return sharp(Buffer.from(svg)).jpeg({ quality: 88 }).toBuffer();
}

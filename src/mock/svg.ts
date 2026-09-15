// Small SVG stand-ins for uploaded certificates and drawn signatures in the seeded data.

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] ?? c);
}

function toDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export interface CertificateInput {
  kicker: string;
  title: string;
  holder: string;
  reference: string;
  issuer: string;
  issued: string;
  expires?: string | null;
}

export function certificateDataUrl(o: CertificateInput): string {
  const rows: [string, string][] = [
    ['Holder', o.holder],
    ['Reference', o.reference],
    ['Issued by', o.issuer],
    ['Issued', o.issued],
  ];
  if (o.expires) rows.push(['Valid until', o.expires]);
  const lines = rows
    .map(
      ([k, v], i) =>
        `<text x="96" y="${186 + i * 36}" font-family="Helvetica, Arial, sans-serif" font-size="13" fill="#6b7280">${esc(k)}</text>` +
        `<text x="236" y="${186 + i * 36}" font-family="Helvetica, Arial, sans-serif" font-size="15" fill="#111827">${esc(v)}</text>`,
    )
    .join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="440" viewBox="0 0 640 440">
<rect width="640" height="440" fill="#fcfcfe"/>
<rect x="14" y="14" width="612" height="412" fill="none" stroke="#1f3a68" stroke-width="3"/>
<rect x="22" y="22" width="596" height="396" fill="none" stroke="#9fb3d6"/>
<text x="320" y="76" text-anchor="middle" font-family="Georgia, serif" font-size="12" letter-spacing="3" fill="#5a6b8c">${esc(o.kicker.toUpperCase())}</text>
<text x="320" y="112" text-anchor="middle" font-family="Georgia, serif" font-size="24" fill="#1f3a68">${esc(o.title)}</text>
<line x1="170" y1="134" x2="470" y2="134" stroke="#9fb3d6"/>
${lines}
<circle cx="536" cy="362" r="36" fill="none" stroke="#b91c1c" stroke-width="2" opacity=".55"/>
<text x="536" y="366" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="10" letter-spacing="1" fill="#b91c1c" opacity=".7">CERTIFIED</text>
</svg>`;
  return toDataUrl(svg);
}

export function signatureDataUrl(name: string, seed = 7): string {
  const rnd = mulberry32(seed + hashString(name));
  let x = 18;
  const y = 64;
  let d = `M ${x} ${y}`;
  for (const ch of name) {
    if (ch === ' ') {
      x += 16;
      d += ` M ${x.toFixed(1)} ${(y + (rnd() * 8 - 4)).toFixed(1)}`;
      continue;
    }
    const h = 16 + rnd() * 24;
    const w = 9 + rnd() * 9;
    d += ` c ${(w * 0.2).toFixed(1)} ${(-h).toFixed(1)} ${(w * 0.8).toFixed(1)} ${(-h).toFixed(1)} ${(w * 0.5).toFixed(1)} ${(-h * 0.4).toFixed(1)}`;
    d += ` s ${(w * 0.1).toFixed(1)} ${(h * 0.9).toFixed(1)} ${(w * 0.6).toFixed(1)} ${(h * 0.4).toFixed(1)}`;
    x += w * 1.1;
  }
  d += ' q 22 14 64 -6';
  const width = Math.max(220, Math.round(x + 90));
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="110" viewBox="0 0 ${width} 110"><path d="${d}" fill="none" stroke="#1b2a55" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  return toDataUrl(svg);
}

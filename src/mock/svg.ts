// Small SVG stand-ins for the certificates uploaded in the seeded data.

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

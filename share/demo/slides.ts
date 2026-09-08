/**
 * Fabricated slide imagery for the demo.
 *
 * The markup is generated rather than committed, so the repo carries no binary
 * weight and every machine renders the same pixels. It is then rasterized to a
 * PNG data URL through `<Image>` + `<canvas>`, the way a real capture arrives —
 * which matters downstream: `lib/files.ts:urlExt` falls back to `png` for any
 * URL without a parseable extension, so an SVG data URI would ship SVG bytes in
 * `.png` zip entries, and `lib/pdf.ts` would embed a vector it never rasterized.
 *
 * A data URL is same-origin, so `crossOrigin = 'anonymous'` leaves the canvas
 * untainted and Download-all / Save-as-PDF run their real code paths.
 */

const SERIF = "Georgia, 'Times New Roman', serif";

/** Deck content, shared with the desktop and web demos so all three tell one story. */
export const SLIDE_DECK: Array<{ title: string; lines: string[]; formula: string }> = [
  {
    title: 'Compact Operators',
    lines: ['maps bounded sets to relatively compact sets', 'a limit of finite-rank operators'],
    formula: 'T ∈ K(X, Y)  ⟺  T(B_X) relatively compact',
  },
  {
    title: 'The Spectrum of a Compact Operator',
    lines: ['σ(T) is at most countable', 'every non-zero spectral point is an eigenvalue'],
    formula: 'σ(T) \\ {0} = { λ : λ is an eigenvalue of T }',
  },
  {
    title: 'The Fredholm Alternative',
    lines: ['either (I − T)x = y is solvable', 'or the homogeneous equation has a non-zero solution'],
    formula: 'dim N(I − T) = dim N(I − T*)',
  },
  {
    title: 'Self-Adjoint Compact Operators',
    lines: ['all eigenvalues are real', 'the eigenvectors form an orthonormal basis'],
    formula: 'T = Σ λ_n ⟨·, e_n⟩ e_n',
  },
  {
    title: 'The Adjoint Operator',
    lines: ['⟨T x, y⟩ = ⟨x, T* y⟩ for all x, y', 'T is self-adjoint when T = T*'],
    formula: '‖T‖ = sup_{‖x‖=1} ‖T x‖',
  },
  {
    title: 'Uniform Convergence',
    lines: ['convergence is uniform in x', 'continuity passes to the limit'],
    formula: 'sup_x |f_n(x) − f(x)| → 0',
  },
  {
    title: 'Interchanging Limits',
    lines: ['uniform convergence on a compact set', 'limit and integral commute'],
    formula: 'lim ∫ f_n = ∫ lim f_n',
  },
  {
    title: 'The Open Mapping Theorem',
    lines: ['a surjective bounded operator is open', 'completeness is what makes it work'],
    formula: 'T ∈ B(X, Y) onto  ⟹  T open',
  },
];

const XML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
};

function esc(text: string): string {
  return text.replace(/[&<>"]/g, (c) => XML_ESCAPES[c]);
}

/** One lecture slide, 16:9 at 1280×720, in the same ink-on-paper hand as the app. */
function slideSvg(index: number): string {
  const slide = SLIDE_DECK[index % SLIDE_DECK.length];
  const body = slide.lines
    .map(
      (line, i) =>
        `<circle cx="118" cy="${292 + i * 62}" r="5" fill="#8a8580"/>` +
        `<text x="146" y="${300 + i * 62}" font-family="${SERIF}" font-size="30" fill="#2f2c28">${esc(line)}</text>`,
    )
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720">
  <rect width="1280" height="720" fill="#fbfaf8"/>
  <text x="104" y="176" font-family="${SERIF}" font-size="50" fill="#151412">${esc(slide.title)}</text>
  <path d="M104 208h420" stroke="#151412" stroke-width="3"/>
  ${body}
  <rect x="104" y="546" width="1072" height="94" fill="#f1efeb"/>
  <text x="140" y="606" font-family="${SERIF}" font-size="36" font-style="italic" fill="#2f2c28">${esc(slide.formula)}</text>
</svg>`;
}

async function rasterize(markup: string): Promise<string> {
  const source = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`;
  const image = new Image();
  image.decoding = 'sync';
  const loaded = await new Promise<boolean>((resolve) => {
    image.onload = () => resolve(true);
    image.onerror = () => resolve(false);
    image.src = source;
  });
  if (!loaded) return source;

  const canvas = document.createElement('canvas');
  canvas.width = 1280;
  canvas.height = 720;
  const ctx = canvas.getContext('2d');
  if (!ctx) return source;
  ctx.drawImage(image, 0, 0, 1280, 720);
  return canvas.toDataURL('image/png');
}

let cache: string[] | null = null;

/** PNG data URLs for the whole deck, rasterized once per page load. */
export async function slideImages(): Promise<string[]> {
  if (!cache) {
    cache = await Promise.all(SLIDE_DECK.map((_, i) => rasterize(slideSvg(i))));
  }
  return cache;
}

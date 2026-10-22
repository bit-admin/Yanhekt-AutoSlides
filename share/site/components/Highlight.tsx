/** Bolds the query words in a piece of text, the way result snippets do. */

export function Highlight({ text, words }: { text: string; words: string[] }) {
  if (words.length === 0) return <>{text}</>;
  const lower = text.toLowerCase();
  const marks: Array<[number, number]> = [];
  for (const w of words) {
    let from = 0;
    for (;;) {
      const i = lower.indexOf(w, from);
      if (i < 0) break;
      marks.push([i, i + w.length]);
      from = i + w.length;
    }
  }
  if (marks.length === 0) return <>{text}</>;
  marks.sort((a, b) => a[0] - b[0]);
  const merged: Array<[number, number]> = [];
  for (const m of marks) {
    const last = merged[merged.length - 1];
    if (last && m[0] <= last[1]) last[1] = Math.max(last[1], m[1]);
    else merged.push([...m]);
  }
  const out: React.ReactNode[] = [];
  let at = 0;
  merged.forEach(([s, e], i) => {
    if (s > at) out.push(text.slice(at, s));
    out.push(<b key={i}>{text.slice(s, e)}</b>);
    at = e;
  });
  if (at < text.length) out.push(text.slice(at));
  return <>{out}</>;
}

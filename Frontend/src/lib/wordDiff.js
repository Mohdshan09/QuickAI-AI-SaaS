// Minimal word-level diff (LCS) for highlighting tailored-resume changes.
// Returns tokens for both sides: { original: [{text, removed}], tailored: [{text, added}] }.
// Whitespace tokens are preserved and never marked, so spacing stays intact.

const tokenize = (s) => String(s ?? "").split(/(\s+)/).filter((t) => t !== "");
const isSpace = (t) => /^\s+$/.test(t);

export function wordDiff(original, tailored) {
  const a = tokenize(original);
  const b = tokenize(tailored);

  // LCS table over tokens (case-insensitive so casing tweaks don't over-highlight).
  const eq = (x, y) => x.toLowerCase() === y.toLowerCase();
  const n = a.length;
  const m = b.length;
  const dp = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = eq(a[i], b[j]) ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const origOut = [];
  const tailOut = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (eq(a[i], b[j])) {
      origOut.push({ text: a[i], removed: false });
      tailOut.push({ text: b[j], added: false });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      origOut.push({ text: a[i], removed: !isSpace(a[i]) });
      i++;
    } else {
      tailOut.push({ text: b[j], added: !isSpace(b[j]) });
      j++;
    }
  }
  while (i < n) origOut.push({ text: a[i], removed: !isSpace(a[i]) }), i++;
  while (j < m) tailOut.push({ text: b[j], added: !isSpace(b[j]) }), j++;

  return { original: origOut, tailored: tailOut };
}

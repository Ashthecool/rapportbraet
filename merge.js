// Three-way merge for the board: combines two people's changes to the same starting point (the base).
// A change only one side made always goes in, and when both changed the same words, both versions are kept.
// Nothing is ever dropped silently, which is what keeps people from saving over each other.

const MAX_CELLS = 4e6; // Longest-common-subsequence table size. Beyond this, the middle counts as one big change.

// Index pairs of the items x and y have in common, in order.
function commonPairs(x, y) {
  let start = 0;
  while (start < x.length && start < y.length && x[start] === y[start]) start++;
  let endX = x.length; let endY = y.length;
  while (endX > start && endY > start && x[endX - 1] === y[endY - 1]) { endX--; endY--; }
  const pairs = [];
  for (let i = 0; i < start; i++) pairs.push([i, i]);
  const n = endX - start; const m = endY - start;
  if (n && m && n * m <= MAX_CELLS) {
    const w = m + 1;
    const table = new Uint32Array((n + 1) * w);
    for (let i = n - 1; i >= 0; i--) {
      for (let j = m - 1; j >= 0; j--) {
        table[i * w + j] = x[start + i] === y[start + j]
          ? table[(i + 1) * w + j + 1] + 1
          : Math.max(table[(i + 1) * w + j], table[i * w + j + 1]);
      }
    }
    for (let i = 0, j = 0; i < n && j < m;) {
      if (x[start + i] === y[start + j]) { pairs.push([start + i, start + j]); i++; j++; }
      else if (table[(i + 1) * w + j] >= table[i * w + j + 1]) i++;
      else j++;
    }
  }
  for (let k = 0; k < x.length - endX; k++) pairs.push([endX + k, endY + k]);
  return pairs;
}

// Splits base, mine and theirs (lists of strings) into stretches. Each is { same: [...] } or { base, mine, theirs },
// where a stretch of the second kind is index ranges that differ from the base on at least one side.
function stretches(base, mine, theirs) {
  const inMine = new Map(commonPairs(base, mine));
  const inTheirs = new Map(commonPairs(base, theirs));
  const out = [];
  let b = 0; let m = 0; let t = 0;
  for (let k = 0; k <= base.length; k++) {
    const end = k === base.length;
    if (!end && !(inMine.has(k) && inTheirs.has(k))) continue;
    const toM = end ? mine.length : inMine.get(k);
    const toT = end ? theirs.length : inTheirs.get(k);
    if (b < k || m < toM || t < toT) out.push({ base: [b, k], mine: [m, toM], theirs: [t, toT] });
    if (!end) out.push({ same: base[k] });
    b = k + 1; m = toM + 1; t = toT + 1;
  }
  return out;
}

const sameList = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);

function mergeLists(base, mine, theirs, onClash) {
  const out = [];
  for (const part of stretches(base, mine, theirs)) {
    if ('same' in part) { out.push(part.same); continue; }
    const b = base.slice(...part.base); const m = mine.slice(...part.mine); const t = theirs.slice(...part.theirs);
    if (sameList(m, b) || sameList(m, t)) out.push(...t);
    else if (sameList(t, b)) out.push(...m);
    else out.push(...onClash(b, m, t));
  }
  return out;
}

// Paragraphs first, then words inside a paragraph both people changed.
function mergeText(base, mine, theirs) {
  if (mine === theirs || theirs === base) return mine;
  if (mine === base) return theirs;
  const words = (t) => t.split(/(\s+)/).filter(Boolean);
  const keepBoth = (_, m, t) => {
    const a = m.join(''); const b = t.join('');
    return [a, /\s$/.test(a) || /^\s/.test(b) || !a ? '' : ' ', b];
  };
  return mergeLists(base.split('\n'), mine.split('\n'), theirs.split('\n'), (b, m, t) => {
    if (!b.join('').trim()) return [...m, ...t]; // Both added new paragraphs here, so each keeps its own.
    return mergeLists(words(b.join('\n')), words(m.join('\n')), words(t.join('\n')), keepBoth).join('').split('\n');
  }).join('\n');
}

// Rows have no ids, so a row is known by its contents.
const rowKey = (it) => JSON.stringify(Object.entries(it).filter(([, v]) => v).sort());
const sameRows = (a, b) => JSON.stringify(a.map(rowKey)) === JSON.stringify(b.map(rowKey));

function mergeRow(base, mine, theirs, isChoice) {
  const out = {};
  for (const k of new Set([...Object.keys(base), ...Object.keys(mine), ...Object.keys(theirs)])) {
    const [b, m, t] = [base[k] ?? '', mine[k] ?? '', theirs[k] ?? ''];
    // A choice (who is responsible) can't hold two values, so a real clash goes to whoever saves now.
    out[k] = isChoice(k) ? (m !== b ? m : t) : mergeText(String(b), String(m), String(t));
  }
  return out;
}

// isChoice(fieldKey) says which fields are picked from a list rather than written.
function mergeItems(base, mine, theirs, isChoice = () => false) {
  const byKey = new Map([...base, ...mine, ...theirs].map((it) => [rowKey(it), it]));
  const rows = (keys) => keys.map((k) => byKey.get(k));
  const merged = mergeLists(base.map(rowKey), mine.map(rowKey), theirs.map(rowKey), (b, m, t) => {
    const inBase = new Set(b);
    // Rows that line up one to one are the same rows edited, so they merge field by field. A row moved counts as not lining up.
    const lines = (list) => list.every((k, i) => k === b[i] || !inBase.has(k));
    if (b.length === m.length && b.length === t.length && lines(m) && lines(t)) {
      return b.map((k, i) => {
        const row = mergeRow(byKey.get(k), byKey.get(m[i]), byKey.get(t[i]), isChoice);
        const key = rowKey(row);
        byKey.set(key, row);
        return key;
      });
    }
    // Otherwise: keep what either side added or edited, and drop only what one side removed and the other left alone.
    const inMine = new Set(m); const inTheirs = new Set(t);
    return [...m.filter((k) => !inBase.has(k) || inTheirs.has(k)), ...t.filter((k) => !inBase.has(k) && !inMine.has(k))];
  });
  // A row that was moved also counts as added, so an old row one side has since changed could come back. It stays gone.
  const inMine = new Set(mine.map(rowKey)); const inTheirs = new Set(theirs.map(rowKey)); const inBase = new Set(base.map(rowKey));
  return rows(merged.filter((k) => !inBase.has(k) || (inMine.has(k) && inTheirs.has(k))));
}

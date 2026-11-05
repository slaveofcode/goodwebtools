// Tool search for the launcher popup: ranks tools by how well their English or
// Indonesian name, keywords and summary match the query.

const norm = s => (s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '');

function scoreToken(tool, token) {
  let best = 0;
  for (const name of [tool.name, tool.nameId]) {
    const n = norm(name);
    if (!n) continue;
    if (n === token) best = Math.max(best, 100);
    else if (n.startsWith(token)) best = Math.max(best, 80);
    else if (n.split(/[^a-z0-9]+/).some(w => w.startsWith(token))) best = Math.max(best, 60);
    else if (n.includes(token)) best = Math.max(best, 40);
  }
  for (const k of tool.keywords || []) {
    const kw = norm(k);
    if (kw.startsWith(token)) best = Math.max(best, 30);
    else if (kw.includes(token)) best = Math.max(best, 20);
  }
  if (best === 0 && (norm(tool.summary).includes(token) || norm(tool.summaryId).includes(token))) best = 10;
  if (best === 0 && norm(tool.id).includes(token)) best = 10;
  return best;
}

/** Tools matching every word of the query, best first (ties keep registry order). */
export function searchTools(tools, query, limit = 8) {
  const tokens = norm(query).split(/\s+/).filter(Boolean);
  if (!tokens.length) return [];
  const scored = [];
  tools.forEach((tool, i) => {
    let total = 0;
    for (const t of tokens) {
      const s = scoreToken(tool, t);
      if (!s) return;
      total += s;
    }
    scored.push({ tool, total, i });
  });
  scored.sort((a, b) => b.total - a.total || a.i - b.i);
  return scored.slice(0, limit).map(s => s.tool);
}

/** Move a tool id to the front of a recents list (deduped, capped). */
export function pushRecent(list, id, max = 8) {
  return [id, ...(list || []).filter(x => x !== id)].slice(0, max);
}

/** Add or remove a favorite. */
export function toggleFavorite(list, id) {
  const l = list || [];
  return l.includes(id) ? l.filter(x => x !== id) : [...l, id];
}

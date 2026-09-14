// Try recent neighbours first, then interleave distant mural regions. Every
// eligible target is still searched on every detection: there is no locked zone.
export function createTargetSearchOrder(targets) {
  const groups = new Map();
  for (const target of targets) {
    const key = target.sourceBank || 'all';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(target.targetIndex);
  }
  const lists = [...groups.values()], balanced = [];
  for (let row = 0; row < Math.max(...lists.map(list => list.length), 0); row++) {
    for (const list of lists) if (row < list.length) balanced.push(list[row]);
  }
  const byIndex = new Map(targets.map(target => [target.targetIndex, target]));
  let cursor = 0, lastMatched = -1, recentMisses = 0;
  return {
    next(available) {
      const allowed = new Set(available), result = [];
      const add = index => { if (allowed.delete(index)) result.push(index); };
      const last = byIndex.get(lastMatched);
      // A few misses release the local priority, so moving to the far end of
      // the wall cannot keep the viewer searching the previous location first.
      if (last && recentMisses < 3) {
        [...targets].sort((a, b) => Math.hypot(a.x-last.x, a.y-last.y)-Math.hypot(b.x-last.x, b.y-last.y))
          .slice(0, 6).forEach(target => add(target.targetIndex));
      }
      for (let n = 0; n < balanced.length; n++) add(balanced[(cursor+n)%balanced.length]);
      available.forEach(add);
      cursor = balanced.length ? (cursor+1)%balanced.length : 0;
      return result;
    },
    matched(index) { if (byIndex.has(index)) { lastMatched = index; recentMisses = 0; } else recentMisses++; }
  };
}

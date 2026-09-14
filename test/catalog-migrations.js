/* Retire only the untouched, unreviewed positions seeded in the first prototype.
   Artwork pages, user edits, confirmed links and publication choices are retained. */
(() => {
  'use strict';
  const candidates = new Map([
    ['001', {x:0.03844547780354818,y:0.7501857850609757}],
    ['023', {x:0.056125116984049477,y:0.5596783623198448}],
    ['042', {x:0.06300577290852864,y:0.7824872137437638}]
  ]);
  function removeLegacyCandidates(catalog) {
    const removed = [];
    const items = catalog.items.map(item => {
      const seed = candidates.get(item.id), mapping = item.mapping;
      if (!seed || !mapping || mapping.confirmed !== false || item.publish !== false || item.wallRegion != null || mapping.x !== seed.x || mapping.y !== seed.y) return item;
      removed.push(item.id);
      return {...item,mapping:null};
    });
    return {catalog:removed.length ? {...catalog,items} : catalog,removed};
  }
  window.YoyojinCatalogMigrations = Object.freeze({removeLegacyCandidates});
})();

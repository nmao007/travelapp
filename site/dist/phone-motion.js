// A visual hint while provider metadata loads; never replace a known category.
export function phonePlaceSymbol(record, symbol) {
  if (symbol !== 'pin' || record.primaryType || record.category || record.types?.length) return symbol;
  const name = record.name || '';
  if (/\b(hotel|hostel|resort)\b/i.test(name)) return 'stay';
  if (/\b(cafe|café|restaurant|bakery|brewery)\b/i.test(name)) return 'food';
  if (/\b(museum|museu|gallery|archaeological|castle|palace|cathedral|temple)\b/i.test(name)) return 'landmark';
  if (/\b(stadium|arena)\b/i.test(name)) return 'sports';
  if (/\b(park|gardens|beach)\b/i.test(name)) return 'leaf';
  return symbol;
}

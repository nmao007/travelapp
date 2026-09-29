import type { ExpressionSpecification, Map as MapLibreMap } from 'maplibre-gl';

/** Prefer a sourced English map label; retain the map style's own label when unavailable. */
export function preferEnglishMapLabels(map: MapLibreMap): void {
  for (const layer of map.getStyle().layers || []) {
    if (layer.type !== 'symbol' || !/place|poi|park|water|airport|settlement/i.test(layer.id)) continue;
    const field = layer.layout?.['text-field'];
    if (!field || !JSON.stringify(field).includes('name')) continue;
    try {
      const fallback = typeof field === 'string' ? ['get', 'name'] : field;
      map.setLayoutProperty(layer.id, 'text-field', ['coalesce', ['get', 'name:en'], fallback] as unknown as ExpressionSpecification);
    } catch { /* An upstream style may use a nonstandard expression; keep its original label. */ }
  }
}

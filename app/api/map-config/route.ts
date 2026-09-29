import { NextResponse } from 'next/server';
import mapPackage from 'maplibre-gl/package.json';
export const dynamic = 'force-dynamic';
export function GET() {
  const googleKey = process.env.GOOGLE_MAPS_BROWSER_KEY;
  const googleMapId = process.env.GOOGLE_MAP_ID;
  // OpenFreeMap permits commercial use without a key. Custom styles must be reviewed.
  const style = process.env.MAP_STYLE_URL || 'https://tiles.openfreemap.org/styles/liberty';
  try {if (new URL(style).protocol !== 'https:') throw new Error();}
  catch {return NextResponse.json({error:'Map style configuration is invalid.'},{status:503});}
  const fallback = {style,workerUrl:`/maps/maplibre-${mapPackage.version}/maplibre-gl-worker.mjs`};
  if (googleKey && googleMapId) return NextResponse.json({ provider: 'google', googleKey, googleMapId, ...fallback }, { headers: { 'Cache-Control': 'no-store' } });
  return NextResponse.json({provider:'openfreemap',...fallback},{headers:{'Cache-Control':'no-store'}});
}

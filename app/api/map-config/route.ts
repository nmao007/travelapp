import { NextResponse } from 'next/server';
import mapPackage from 'maplibre-gl/package.json';
export const dynamic = 'force-dynamic';
export function GET() {
  // OpenFreeMap permits commercial use without a key. Custom styles must be reviewed.
  const style = process.env.MAP_STYLE_URL || 'https://tiles.openfreemap.org/styles/positron';
  try {if (new URL(style).protocol !== 'https:') throw new Error();}
  catch {return NextResponse.json({error:'Map style configuration is invalid.'},{status:503});}
  return NextResponse.json({style,workerUrl:`/maps/maplibre-${mapPackage.version}/maplibre-gl-worker.mjs`},{headers:{'Cache-Control':'no-store'}});
}

import { NextResponse } from 'next/server';
import { PlaceSearchError, PlaceSearchService } from '@/lib/place-service';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
declare global { var tripPilotPlaceSearch: PlaceSearchService | undefined; }
export async function GET(request: Request) {
  const url = new URL(request.url);
  // A proxy isolates provider policy and keeps the native/web clients independent of vendor endpoints.
  // A hosted provider or an explicitly reviewed single-server setup is required before deployment.
  const endpoint = process.env.PLACES_SERVICE_URL;
  if (process.env.NODE_ENV === 'production' && !endpoint && process.env.PLACES_SINGLE_SERVER !== 'true') {
    return NextResponse.json({ error: 'Place search needs a production provider connection.' }, { status: 503 });
  }
  try {
    globalThis.tripPilotPlaceSearch ??= new PlaceSearchService(endpoint);
    const places = await globalThis.tripPilotPlaceSearch.search(url.searchParams.get('q') || '', url.searchParams.get('destination') || '');
    return NextResponse.json({ places, source: 'OpenStreetMap', attributionUrl: 'https://www.openstreetmap.org/copyright' }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const status = error instanceof PlaceSearchError ? error.status : 503;
    return NextResponse.json({ error: error instanceof PlaceSearchError ? error.message : 'Place search is unavailable.' }, { status, headers: status === 429 ? { 'Retry-After': '5' } : undefined });
  }
}

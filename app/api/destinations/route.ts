import { NextResponse } from 'next/server';
import { find } from 'geo-tz/dist/find-all';
import { PlaceSearchError } from '@/lib/place-service';
import { DestinationSearch } from '@/lib/destination-search';
import { isTimeZone } from '@/lib/domain';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
declare global { var tripPilotDestinations: DestinationSearch | undefined; }
export async function GET(request: Request) {
  const endpoint = process.env.PHOTON_SERVICE_URL;
  if (process.env.NODE_ENV === 'production' && !endpoint) return NextResponse.json({error:'Destination suggestions need a hosted search connection.'},{status:503});
  try {
    if (!globalThis.tripPilotDestinations || typeof globalThis.tripPilotDestinations.nearby !== 'function') globalThis.tripPilotDestinations = new DestinationSearch(endpoint);
    const params=new URL(request.url).searchParams;
    const nearby=params.has('lat') || params.has('lon');
    if (nearby && (!params.get('lat')?.trim() || !params.get('lon')?.trim() || params.has('q'))) throw new PlaceSearchError('Choose a valid point on the globe.',400);
    const places = nearby
      ? await globalThis.tripPilotDestinations.nearby(Number(params.get('lat')),Number(params.get('lon')))
      : await globalThis.tripPilotDestinations.search(params.get('q') || '');
    const destinations = places.flatMap(place => {
      const zones = find(place.latitude, place.longitude).filter(isTimeZone);
      return zones.length ? [{...place, zones, zoneSource:'timezone-boundary-builder'}] : [];
    });
    return NextResponse.json({destinations},{headers:{'Cache-Control':'no-store'}});
  } catch (error) {
    const status = error instanceof PlaceSearchError ? error.status : 503;
    return NextResponse.json({error:error instanceof PlaceSearchError ? error.message : 'Destination search is unavailable.'},{status,headers:status === 429 ? {'Retry-After':'5'} : undefined});
  }
}
